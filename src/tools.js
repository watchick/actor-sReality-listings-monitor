import { Actor } from 'apify';
import { sleep } from '@crawlee/utils';
import { SELECTORS, ESTATE_TYPES, OFFER_TYPES } from './consts.js'; // eslint-disable-line import/extensions

export async function getAndValidateInput() {
    const input = await Actor.getInput();
    const {
        location,
        offerType,
        type,
        maxPages,
        proxyConfiguration,
        notificationsEmail,
        priceMin,
        priceMax,
        areaMin,
        areaMax,
    } = input;

    if (!offerType || !type || !location) {
        throw new Error('Check input! Offer type (sale/rent/auction), type (house/apartment/etc) or location are missing');
    }

    const price = {};
    if (priceMin) price.from = priceMin.toString();
    if (priceMax) price.to = priceMax.toString();

    const livingArea = {};
    if (areaMin) livingArea.from = areaMin.toString();
    if (areaMax) livingArea.to = areaMax.toString();

    const subtype = [];
    const inputKeys = Object.keys(input);
    for (const key of inputKeys) {
        if (key.startsWith(input.type) && input[key] === true) {
            subtype.push(key.split(':')[1]);
        }
    }

    return {
        proxy: proxyConfiguration,
        sendNotificationTo: notificationsEmail,
        offerType,
        type,
        subtype,
        location,
        price,
        livingArea,
        maxPages,
    };
}

export function getSearchUrl(type) {
    return [{
        url: ESTATE_TYPES[type].url,
        label: 'startPage',
    }];
}

export async function selectOfferType({ page, offerType }) {
    await removeCookiesConsentBanner(page);
    await page.click(OFFER_TYPES[offerType].selectors.switcher)
        .catch(() => {
            throw new Error(`No selector matched | offerType: ${offerType}`);
        });
    await sleep(1000);
}

export async function selectSubtype({ page, log, subtype, type }) {
    await removeCookiesConsentBanner(page);
    if (subtype.length > 0) {
        const subtypes = subtype.map((st) => ESTATE_TYPES[type].subtypes[st]);
        const $$subtype = await matchNodesByContents(page, SELECTORS.subtype, subtypes)
            .catch((err) => {
                log.error(err.message);
                throw Error(`No selector matched: subtype -> ${subtype.join('; ')}`);
            });
        await Promise.all($$subtype.map(($node) => $node.click()));
    }
}

export async function setLocation({ page, location }) {
    await removeCookiesConsentBanner(page);
    await page.type(SELECTORS.location.input, location);
    await page.waitForFunction((sel) => document.querySelector(sel), { polling: 'mutation' }, SELECTORS.location.autocomplete);
    await sleep(1000);
    await page.keyboard.press('Enter');
    await sleep(1000);
}

export async function setOtherParams({ page, price, livingArea }) {
    await removeCookiesConsentBanner(page);
    if (price && price.from) await page.type(SELECTORS.price.from, price.from, { delay: 100 });
    if (price && price.to) await page.type(SELECTORS.price.to, price.to, { delay: 100 });
    if (livingArea && livingArea.from) await page.type(SELECTORS.area.from, livingArea.from, { delay: 100 });
    if (livingArea && livingArea.to) await page.type(SELECTORS.area.to, livingArea.to, { delay: 100 });
    await page.click('form div.region.distance .line-title');
    await sleep(2000);
}

export async function loadSearchResults({ page, log, store, previousData, sendNotificationTo }) {
    await removeCookiesConsentBanner(page);

    const showResultsButton = await page.evaluate(() => {
        return document.querySelector('.return-cover')
            && !document.querySelector('.filter__buttons__not-found');
    });

    if (showResultsButton) {
        await Promise.all([
            page.waitForNavigation({ waitUntil: ['load', 'networkidle0'] }),
            page.click(SELECTORS.submit),
        ]);
        await page.waitForSelector('.dir-property-list');
    } else {
        log.info('No search results');
        await store.setValue('currentData', []);
        if (!previousData) {
            log.info('Initial run, no previously found listings. Sending email');
            if (sendNotificationTo) {
                await Actor.call('apify/send-mail', {
                    to: sendNotificationTo,
                    subject: 'Apify sReality Listings Monitor - No Listing(s) Found',
                    text: 'No listing(s) matching your query found',
                });
            }
        } else if (previousData.length > 0) {
            log.info('Previously found listings were removed. Sending email');
            await store.setValue('previousData', previousData);
            if (sendNotificationTo) {
                await Actor.call('apify/send-mail', {
                    to: sendNotificationTo,
                    subject: 'Apify sReality Listings Monitor - Listing(s) Removed',
                    text: `Previously found listing(s):\n${previousData.join('\n')}`,
                });
            }
        }
    }

    return showResultsButton;
}

export async function searchPageExtractProperties({ page, dataset }) {
    
    console.log("page, dataset ",page, dataset);
    await removeCookiesConsentBanner(page);
    const listings = await page.evaluate(() => {
        const output = [];
        [...document.querySelectorAll('.dir-property-list > .property')].map((listing) => {
            if (!listing.querySelector('span[class*=tip]')) {
                output.push({ 
                    url: listing.querySelector('a').href,
                    price: listing.querySelector('.norm-price').value
                 });
            }
        });
        console.log("output",output);
        return output;
    });
    console.log("listings ",listings);
    // await dataset.pushData(listings);
    await dataset.pushData(listings);
    return listings;
}
export async function TryExecute(name,func){
    try{
        return func();
    }catch(e){
        console.log("error-"+name,e);
        return null;
    }
}

export async function detailPageExtractProperties({ page, dataset }) {
    await removeCookiesConsentBanner(page);
    const pList = await page.evaluate(() => {
        const output = [];
        var descriptionParagraphs = [...document.querySelectorAll('.description > p')].map((descriptionP) => {
            console.log("descriptionP",descriptionP,descriptionP.innerText);
            return descriptionP.innerText
        });
        return descriptionParagraphs;
    });
    const gps = await page.evaluate(() => {
        
        return TryExecute("gps",()=> {
                var mapyCzUrl = document.querySelector('#s-map').querySelector("img[alt='Zobrazit na Mapy.cz']").parentElement.href;
                return {
                    url:mapyCzUrl,
                    x: TryExecute("gps-x",mapa.split("x=")[1].split("&")),
                    y: TryExecute("gps-y",mapa.split("y=")[1].split("&")),
                    z: TryExecute("gps-z",mapa.split("z=")[1]),
                };
            }
        );
    });

    $("#s-map").find("img[alt='Zobrazit na Mapy.cz']").parent().attr("href") 
    await dataset.pushData({"description":pList,gps:gps});
    console.log("listings ",listings);
    return listings;
}

export async function enqueueNextPage({ page, maxPages, crawler }) {
    console.log("enqueueNextPage");
    await removeCookiesConsentBanner(page);
    const currentPage = await page.evaluate(() => {
        const currentPageSelector = document.querySelector('.paging-item > a.active');
        return currentPageSelector ? Number(currentPageSelector.innerText) : null;
    });
    const nextPageUrl = await page.evaluate(() => {
        const nextPageSelector = document.querySelector('.paging-item > a.paging-next');
        return nextPageSelector ? nextPageSelector.href : null;
    });
    if ((currentPage && maxPages && currentPage < maxPages) || (!maxPages && nextPageUrl)) {
        console.log("crawler.addRequests", {
            url: nextPageUrl,
            label: 'searchPage',
        });
        await crawler.addRequests([{
            url: nextPageUrl,
            label: 'searchPage',
        }]);
    }
}

export async function compareDataAndSendNotification({ log, store, dataset, previousData, sendNotificationTo }) {
    const outputItems = await dataset.getData().then((resp) => resp.items);
    const currentData = outputItems.map((entry) => entry.url);
    await store.setValue('currentData', currentData);
    log.info(`${currentData.length} matching listing(s) found`);

    if (!previousData) {
        log.info('Initial run, no previously found listings');
        if (sendNotificationTo) {
            log.info('Sending Email');
            await Actor.call('apify/send-mail', {
                to: sendNotificationTo,
                subject: 'Apify sRelity Listings Monitor - Listing(s) Found',
                text: `Found listing(s):\n${currentData.join('\n')}`,
            });
        }
    } else {
        await store.setValue('previousData', previousData);
        if (!(previousData.every((e) => currentData.includes(e)) && currentData.every((e) => previousData.includes(e)))) {
            log.info('There were some updates');
            if (sendNotificationTo) {
                log.info('Sending Email');
                await Actor.call('apify/send-mail', {
                    to: sendNotificationTo,
                    subject: 'Apify sRelity Listings Monitor - Listing(s) Updated',
                    text: `Currently found listing(s):\n${currentData.join('\n')}\n\nPreviously found listing(s):\n${previousData.join('\n')}`,
                });
            }
        } else {
            log.info('No new listing(s) found');
        }
    }
}

export async function matchNodesByContents(page, selector, contents) {
    await removeCookiesConsentBanner(page);
    contents = Array.isArray(contents) ? contents : [contents];

    const $$nodes = await page.$$(selector);

    const nodes = await Promise.all($$nodes.map(async ($node) => ({
        node: $node,
        content: await $node.evaluate((node) => node.innerText),
    })));

    return nodes
        .filter((node) => {
            contents.some((content) => {
                return node.content.trim().toLowerCase() === content.trim().toLowerCase();
            });
        })
        .map((node) => node.node);
}

export async function removeCookiesConsentBanner(page) {
    return page.evaluate(() => document.querySelector('.szn-cmp-dialog-container')?.remove());
}

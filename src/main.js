import { Actor } from 'apify';
import { log, PuppeteerCrawler } from '@crawlee/puppeteer';
import {
    getAndValidateInput,
    getSearchUrl,
    selectOfferType,
    selectSubtype,
    setLocation,
    setOtherParams,
    searchPageExtractProperties,
    detailPageExtractProperties,
    loadSearchResults,
    enqueueNextPage,
    compareDataAndSendNotification,
} from './tools.js'; // eslint-disable-line import/extensions
console.log("Start1- Test autobuildu");
await Actor.init();
console.log("Start2");
const {
    proxy,
    sendNotificationTo,
    offerType,
    type,
    subtype,
    location,
    price,
    livingArea,
    maxPages,
} = await getAndValidateInput();

const dataset = await Actor.openDataset();
// const detailDataset = await Actor.openDataset();
// use named key-value store based on task ID or actor ID
// to be able to have more listings checkers under one Apify account
const storeName = `sReality-monitor-store-${!process.env.APIFY_ACTOR_TASK_ID
    ? process.env.APIFY_ACT_ID
    : process.env.APIFY_ACTOR_TASK_ID}`;
const store = await Actor.openKeyValueStore(storeName);
const previousData = await store.getValue('currentData');

const proxyConfiguration = await Actor.createProxyConfiguration(proxy);

const crawler = new PuppeteerCrawler({
    proxyConfiguration,
    launchContext: {
        useChrome: true,
        launchOptions: { headless: false },
    },
    async requestHandler(context) {
        const { log, page, request: { url, label } } = context;
        var isSearch = false;
        var listings = [];
        console.log("label, url",label, url);
        if (label === 'startPage') {
            isSearch = true;
            log.info(`Search Location: ${location}`);
            log.info(`Object Type: ${type}`);
            log.info(`Operation Type: ${offerType}`);
            log.info(`Processing Start Page | ${url}`);

            await selectOfferType({ ...context, offerType });
            await selectSubtype({ ...context, subtype, type });
            await setLocation({ ...context, location });
            await setOtherParams({ ...context, price, livingArea });
            const propertiesFound =await loadSearchResults({ ...context, store, previousData, sendNotificationTo });
            
            if (propertiesFound) {
                log.info(`Processing First Page | ${page.url()}`);
                listings = await searchPageExtractProperties({ ...context, dataset });
            }
        } else if (label === 'directStartPage') {
            isSearch = true;
            log.info(`Processing Direct Page | ${page.url()}`);
            listings = await searchPageExtractProperties({ ...context, dataset });
        } else if (label === 'searchPage') {
            isSearch = true;
            log.info(`Processing Search Page | ${url}`);
            listings = await searchPageExtractProperties({ ...context, dataset });
        }else if (label === 'detailPage') {
            log.info(`Processing DETAIL PAGE | ${url}`);
            var detail = await detailPageExtractProperties({ ...context, dataset, url });
            // await extractProperties({ ...context, dataset });
        }
        console.log("isSearch, listings.length ",isSearch, listings.length)
        if(isSearch){
            if(listings.length > 0){
                var part = listings.slice(0, 5);
                console.log("part",part);
                var partMapped = part.map(l => 
                    { 
                        return {
                        url: l.url,
                        label: 'detailPage',
                    };
                });
                console.log("partMapped",partMapped);

                await crawler.addRequests(partMapped);
            }
            await enqueueNextPage({ ...context, maxPages });
        }
    },
    preNavigationHooks: [
        async ({ blockRequests }, gotoOptions) => {
            await blockRequests({ urlPatterns: ['mapserver.mapy.cz', 'sdn.cz', '.png', '.jpeg', '.svg'] });
            gotoOptions.waitUntil = ['load', 'networkidle0'];
        },
    ]
});

console.log("Start3");
const initialRequests = [{
    url: "https://www.sreality.cz/hledani/prodej/pozemky/stavebni-parcely/kolin,kutna-hora,praha-zapad,praha-vychod,benesov?no_shares=1&plocha-od=800&plocha-do=10000000000&cena-od=2000000&cena-do=6000000&bez-aukce=1",
    label: 'directStartPage',
}];//const initialRequests =getSearchUrl(type);
await crawler.run(initialRequests);

await compareDataAndSendNotification({ log, store, dataset, previousData, sendNotificationTo });

console.log("Start4");
await Actor.exit();
console.log("Done");

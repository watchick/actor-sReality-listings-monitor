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
await Actor.init();
const {
    proxy,
    sendNotificationTo,
    offerType,
    type,
    subtype,
    location,
    price,
    livingArea,
} = await getAndValidateInput();
const maxPages = 2;
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
                listings = await searchPageExtractProperties({ ...context, dataset, url  });
            }
        } else if (label === 'directStartPage') {
            isSearch = true;
            log.info(`Processing Direct Page | ${page.url()}`);
            listings = await searchPageExtractProperties({ ...context, dataset, url  });
        } else if (label === 'searchPage') {
            isSearch = true;
            log.info(`Processing Search Page | ${url}`);
            listings = await searchPageExtractProperties({ ...context, dataset, url  });
        }else if (label === 'detailPage') {
            log.info(`Processing DETAIL PAGE | ${url}`);
            var detail = await detailPageExtractProperties({ ...context, dataset, url });
            // await extractProperties({ ...context, dataset });
        }
        if(isSearch){
            if(listings.length > 0){
                var partMapped = listings.map(l => 
                    { 
                        return {
                        url: l.url,
                        label: 'detailPage',
                    };
                });

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

const initialRequests = [
    {
    url: "https://www.sreality.cz/hledani/prodej/pozemky/stavebni-parcely/kolin,kutna-hora,praha-zapad,praha-vychod,benesov?no_shares=1&plocha-od=800&plocha-do=10000000000&cena-od=2000000&cena-do=6000000&bez-aukce=1",
    label: 'directStartPage',
},
{
    url: "https://www.sreality.cz/hledani/prodej/domy/rodinne-domy,vily/praha-vychod,benesov,kutna-hora,praha-zapad,kolin?no_shares=1&velikost=4-pokoje,5-a-vice&plocha-od=160&plocha-do=10000000000&cena-od=0&cena-do=10000000&plocha-pozemku-od=800&plocha-pozemku-do=10000000000&bez-aukce=1",
    label: 'directStartPage',
}];
//
//const initialRequests =getSearchUrl(type);
await crawler.run(initialRequests);

await compareDataAndSendNotification({ log, store, dataset, previousData, sendNotificationTo });

await Actor.exit();

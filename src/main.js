import { Actor } from 'apify';
import { log, PuppeteerCrawler } from '@crawlee/puppeteer';
import {
    getAndValidateInput,
    getSearchUrl,
    selectOfferType,
    selectSubtype,
    setLocation,
    setOtherParams,
    loadSearchResults,
    extractProperties,
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
            const propertiesFound = await loadSearchResults({ ...context, store, previousData, sendNotificationTo });
            if (propertiesFound) {
                log.info(`Processing First Page | ${page.url()}`);
                listings = await extractProperties({ ...context, dataset });
            }
        } else if (label === 'searchPage') {
            isSearch = true;
            log.info(`Processing Search Page | ${url}`);
            listings = await extractProperties({ ...context, dataset });
        }else if (label === 'detailPage') {
            log.info(`Processing DETAIL PAGE | ${url}`);
            // await extractProperties({ ...context, dataset });
        }
        if(isSearch){
            if(listings.length > 0){
                await crawler.addRequests(listings.slice(0, 2).map(l => 
                    new {
                        url: l.url,
                        label: 'detailPage',
                    }));
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
const initialRequests = getSearchUrl(type);
await crawler.run(initialRequests);

await compareDataAndSendNotification({ log, store, dataset, previousData, sendNotificationTo });

console.log("Start4");
await Actor.exit();

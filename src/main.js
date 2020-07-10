const Apify = require('apify');
const {
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
} = require('./tools');

Apify.main(async () => {
    const {
        proxyConfiguration: { useApifyProxy, apifyProxyGroups },
        sendNotificationTo,
        offerType,
        type,
        subtype,
        location,
        price,
        livingArea,
        maxPages,
    } = await getAndValidateInput();

    const sources = getSearchUrl(type);
    const requestList = await Apify.openRequestList(null, sources);
    const requestQueue = (!maxPages || (maxPages && maxPages > 1)) ? await Apify.openRequestQueue() : null;
    const dataset = await Apify.openDataset();

    // use named key-value store based on task ID or actor ID
    // to be able to have more listings checkers under one Apify account
    const storeName = `sReality-monitor-store-${!process.env.APIFY_ACTOR_TASK_ID ? process.env.APIFY_ACT_ID : process.env.APIFY_ACTOR_TASK_ID}`;
    const store = await Apify.openKeyValueStore(storeName);
    const previousData = await store.getValue('currentData');

    const groups = useApifyProxy && apifyProxyGroups ? apifyProxyGroups : undefined;
    const proxyConfiguration = groups ? await Apify.createProxyConfiguration({ groups }) : undefined;

    const crawler = new Apify.PuppeteerCrawler({
        requestList,
        requestQueue,
        proxyConfiguration,
        handlePageFunction: async ({ page, request }) => {
            const { userData: { label } } = request;
            if (label === 'startPage') {
                await selectOfferType({ page, offerType });
                await selectSubtype({ page, subtype, type });
                await setLocation({ page, location });
                await setOtherParams({ page, price, livingArea });
                const propertiesFound = await loadSearchResults({ page, store, previousData, sendNotificationTo });
                if (propertiesFound) await extractProperties({ page, dataset });
            } else if (label === 'searchPage') {
                await extractProperties({ page, dataset });
            }
            await enqueueNextPage({ page, maxPages, requestQueue });
        },
        gotoFunction: async ({ page, request }) => {
            return page.goto(request.url, { waitUntil: ['load', 'networkidle0'] });
        },
    });

    await crawler.run();

    await compareDataAndSendNotification({ store, dataset, previousData, sendNotificationTo });
});

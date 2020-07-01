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
    } = await getAndValidateInput();

    const sources = getSearchUrl(type);
    const requestList = await Apify.openRequestList(null, sources);

    // use named key-value store based on task ID or actor ID
    // to be able to have more listings checkers under one Apify account
    const storeName = `sReality-monitor-store-${!process.env.APIFY_ACTOR_TASK_ID ? process.env.APIFY_ACT_ID : process.env.APIFY_ACTOR_TASK_ID}`;
    const store = await Apify.openKeyValueStore(storeName);
    const previousData = await store.getValue('currentData');

    const groups = useApifyProxy && apifyProxyGroups ? apifyProxyGroups : undefined;
    const proxyConfiguration = groups ? await Apify.createProxyConfiguration({ groups }) : undefined;

    const crawler = new Apify.PuppeteerCrawler({
        requestList,
        proxyConfiguration,
        handlePageFunction: async ({ page }) => {
            await selectOfferType({ page, offerType });
            await selectSubtype({ page, subtype, type });
            await setLocation({ page, location });
            await setOtherParams({ page, price, livingArea });
            const propertiesFound = await loadSearchResults({ page, store, previousData, sendNotificationTo });
            if (propertiesFound) await extractProperties({ page, store, previousData, sendNotificationTo });
        },
        gotoFunction: async ({ page, request }) => {
            return page.goto(request.url, { waitUntil: ['load', 'networkidle0'] });
        },
    });

    await crawler.run();
});

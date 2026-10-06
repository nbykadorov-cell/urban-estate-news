const Parser = require('rss-parser');
const sources = require('../lib/sources');

const parser = new Parser({
    timeout: 10000,
    maxRedirects: 5,

    headers: {
        'User-Agent':
            'UrbanEstateNews/1.2 (+https://urban-estate.ru)',

        'Accept':
            'application/rss+xml, application/xml, text/xml, */*'
    }
});


/* =========================================================
   НАСТРОЙКИ
========================================================= */

const SOURCE_LIMIT = 20;

const GOOGLE_RESOLVE_LIMIT = 30;

const DEFAULT_LIMIT = 40;

const MAX_LIMIT = 100;

const DEFAULT_DAYS = 7;

const MAX_DAYS = 30;


/* =========================================================
   КАТЕГОРИИ
========================================================= */

const CATEGORY_RULES = {

    mortgage: [
        'ипотек',
        'ставк',
        'кредит',
        'семейн',
        'материнск',
        'заем',
        'заём',
        'банк',
        'ключев',
        'рефинанс',
        'эскроу',
        'первоначальн',
        'кредитован'
    ],

    newbuild: [
        'новостро',
        'застройщик',
        'девелоп',
        'жк ',
        'жилой комплекс',
        'строительств',
        'эскроу',
        'нового дома',
        'новом доме',
        'новый дом',
        'новые дома'
    ],

    law: [
        'закон',
        'законодатель',
        'правил',
        'постанов',
        'госдум',
        'минстрой',
        'минфин',
        'росреестр',
        'налог',
        'штраф',
        'норм',
        'регулирован',
        'вступил в силу',
        'изменен',
        'изменён',
        'изменили',
        'изменения',
        'законопроект'
    ],

    krasnodar: [
        'краснодар',
        'кубан',
        'соч',
        'адыге',
        'краснодарск',
        'черномор',
        'армавир',
        'геленджик',
        'анап',
        'новороссийск',
        'тимашевск',
        'ейск'
    ],

    rostov: [
        'ростов',
        'донецк',
        'дон ',
        'ростовск',
        'таганрог',
        'шахт',
        'батайск',
        'азов',
        'новочеркасск',
        'ростов-на-дону'
    ],

    estate: [
        'недвижим',
        'жиль',
        'квартир',
        'аренд',
        'рынок жилья',
        'вторич',
        'дом ',
        'участок',
        'земел',
        'апартамент',
        'жилье',
        'жильё',
        'продаж квартир',
        'рынок недвижимости',
        'рынок жилья',
        'частный дом'
    ]
};


/* =========================================================
   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
========================================================= */

function stripHtml(value = '') {

    return String(value)

        .replace(
            /<script[\s\S]*?<\/script>/gi,
            ' '
        )

        .replace(
            /<style[\s\S]*?<\/style>/gi,
            ' '
        )

        .replace(
            /<[^>]+>/g,
            ' '
        )

        .replace(
            /&nbsp;/gi,
            ' '
        )

        .replace(
            /&amp;/gi,
            '&'
        )

        .replace(
            /&quot;/gi,
            '"'
        )

        .replace(
            /&#39;/gi,
            "'"
        )

        .replace(
            /&#x27;/gi,
            "'"
        )

        .replace(
            /\s+/g,
            ' '
        )

        .trim();
}


function normalizeText(value = '') {

    return stripHtml(value)

        .toLowerCase()

        .replace(
            /ё/g,
            'е'
        )

        .replace(
            /[«»“”„]/g,
            '"'
        )

        .replace(
            /[^a-zа-я0-9]+/gi,
            ' '
        )

        .replace(
            /\s+/g,
            ' '
        )

        .trim();
}


/* =========================================================
   КАТЕГОРИЗАЦИЯ
========================================================= */

function detectCategories(
    title,
    description,
    source
) {

    const text = normalizeText(
        `${title} ${description}`
    );

    const result = new Set(
        source.categories || []
    );

    for (
        const [category, words]
        of Object.entries(CATEGORY_RULES)
    ) {

        const found = words.some(
            word =>
                text.includes(
                    normalizeText(word)
                )
        );

        if (found) {
            result.add(category);
        }
    }

    return [...result];
}


/* =========================================================
   ДАТА
========================================================= */

function normalizeDate(item) {

    const raw =
        item.isoDate ||
        item.pubDate ||
        item.published ||
        item.date;

    if (!raw) {
        return null;
    }

    const date = new Date(raw);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return null;
    }

    return date.toISOString();
}


/* =========================================================
   ИЗОБРАЖЕНИЕ
========================================================= */

function getImage(item) {

    if (
        item.enclosure &&
        item.enclosure.url
    ) {
        return item.enclosure.url;
    }

    if (
        item['media:content'] &&
        item['media:content'].url
    ) {
        return item['media:content'].url;
    }

    if (
        item['media:thumbnail'] &&
        item['media:thumbnail'].url
    ) {
        return item['media:thumbnail'].url;
    }

    if (
        item.itunes &&
        typeof item.itunes.image === 'string'
    ) {
        return item.itunes.image;
    }

    return null;
}


/* =========================================================
   НОРМАЛИЗАЦИЯ НОВОСТИ
========================================================= */

function normalizeItem(
    item,
    source
) {

    const title =
        stripHtml(
            item.title ||
            'Без названия'
        );

    const description =
        stripHtml(
            item.contentSnippet ||
            item.content ||
            item.summary ||
            item.description ||
            ''
        );

    const url =
        item.link ||
        item.guid ||
        source.homepage;

    const published =
        normalizeDate(item);

    const image =
        getImage(item);

    return {

        id:
            `${source.id}:${
                item.guid ||
                item.link ||
                title
            }`,

        title,

        description:
            description.slice(0, 320),

        url,

        source:
            source.name,

        sourceId:
            source.id,

        sourceHome:
            source.homepage,

        published,

        image,

        categories:
            detectCategories(
                title,
                description,
                source
            )
    };
}


/* =========================================================
   CANONICAL URL
========================================================= */

function canonicalUrl(
    rawUrl = ''
) {

    try {

        const url =
            new URL(rawUrl);

        url.hash = '';

        const removeParameters = [

            'utm_source',
            'utm_medium',
            'utm_campaign',
            'utm_term',
            'utm_content',
            'utm_id',

            'gclid',
            'fbclid',
            'yclid',

            'mc_cid',
            'mc_eid'
        ];

        for (
            const parameter
            of removeParameters
        ) {

            url.searchParams.delete(
                parameter
            );
        }

        return url
            .toString()
            .replace(/\/$/, '')
            .toLowerCase();

    } catch {

        return String(rawUrl)
            .replace(/\/$/, '')
            .toLowerCase();
    }
}


/* =========================================================
   НОРМАЛИЗАЦИЯ ЗАГОЛОВКА
========================================================= */

function titleKey(
    title = ''
) {

    return normalizeText(title)

        .replace(
            /\b(
                новости|
                новость|
                рынок|
                недвижимости|
                недвижимость
            )\b/gi,
            ' '
        )

        .replace(
            /\s+/g,
            ' '
        )

        .trim();
}


/* =========================================================
   УДАЛЕНИЕ ДУБЛИКАТОВ
========================================================= */

function dedupe(items) {

    const seenUrl =
        new Set();

    const seenTitle =
        new Set();

    const result = [];

    for (
        const item
        of items
    ) {

        const urlKey =
            canonicalUrl(
                item.url
            );

        const title =
            titleKey(
                item.title
            );

        if (
            urlKey &&
            seenUrl.has(urlKey)
        ) {
            continue;
        }

        if (
            title &&
            seenTitle.has(title)
        ) {
            continue;
        }

        if (urlKey) {
            seenUrl.add(
                urlKey
            );
        }

        if (title) {
            seenTitle.add(
                title
            );
        }

        result.push(item);
    }

    return result;
}


/* =========================================================
   GOOGLE NEWS
========================================================= */

function isGoogleNewsUrl(
    url = ''
) {

    return /^https?:\/\/(?:www\.)?news\.google\.com\/rss\/articles\//i
        .test(url);
}


async function resolveGoogleNewsUrl(
    url
) {

    if (
        !isGoogleNewsUrl(url)
    ) {
        return url;
    }

    const controller =
        new AbortController();

    const timer =
        setTimeout(
            () => controller.abort(),
            3500
        );

    try {

        const response =
            await fetch(
                url,
                {
                    method: 'GET',

                    redirect: 'follow',

                    signal:
                        controller.signal,

                    headers: {

                        'User-Agent':
                            'UrbanEstateNews/1.2',

                        'Accept':
                            'text/html,application/xhtml+xml'
                    }
                }
            );

        const finalUrl =
            response.url ||
            url;

        if (
            finalUrl &&
            !isGoogleNewsUrl(
                finalUrl
            )
        ) {
            return finalUrl;
        }

        return url;

    } catch {

        return url;

    } finally {

        clearTimeout(timer);
    }
}


async function resolveOriginalLinks(
    items
) {

    const candidates =
        items.filter(
            item =>
                isGoogleNewsUrl(
                    item.url
                )
        );

    const limited =
        candidates.slice(
            0,
            GOOGLE_RESOLVE_LIMIT
        );

    await Promise.all(

        limited.map(
            async item => {

                item.url =
                    await resolveGoogleNewsUrl(
                        item.url
                    );
            }
        )

    );

    return items;
}


/* =========================================================
   ЗАГРУЗКА ИСТОЧНИКА
========================================================= */

async function loadSource(
    source
) {

    try {

        let feed;

        try {

            feed =
                await parser.parseURL(
                    source.feed
                );

        } catch (
            primaryError
        ) {

            if (
                !source.fallbackFeed
            ) {
                throw primaryError;
            }

            feed =
                await parser.parseURL(
                    source.fallbackFeed
                );
        }

        const items =
            (
                feed.items ||
                []
            )

            .slice(
                0,
                SOURCE_LIMIT
            )

            .map(
                item =>
                    normalizeItem(
                        item,
                        source
                    )
            );

        return {

            source,

            items,

            error:
                null
        };

    } catch (
        error
    ) {

        return {

            source,

            items: [],

            error:
                error.message ||
                'Feed error'
        };
    }
}


/* =========================================================
   СОРТИРОВКА
========================================================= */

function sortItems(
    items
) {

    return items.sort(
        (a, b) => {

            const dateA =
                a.published
                    ? new Date(
                        a.published
                    ).getTime()
                    : 0;

            const dateB =
                b.published
                    ? new Date(
                        b.published
                    ).getTime()
                    : 0;

            return dateB - dateA;
        }
    );
}


/* =========================================================
   ВРЕМЯ НОВОСТИ
========================================================= */

function addAge(
    items
) {

    const now =
        Date.now();

    return items.map(
        item => {

            if (
                !item.published
            ) {

                return {
                    ...item,
                    age: null
                };
            }

            const published =
                new Date(
                    item.published
                ).getTime();

            if (
                Number.isNaN(
                    published
                )
            ) {

                return {
                    ...item,
                    age: null
                };
            }

            const age =
                Math.max(
                    0,
                    Math.floor(
                        (
                            now -
                            published
                        ) / 60000
                    )
                );

            return {
                ...item,
                age
            };
        }
    );
}


/* =========================================================
   ОБРАБОТКА QUERY
========================================================= */

function getQuery(
    req
) {

    const query =
        req.query || {};

    let limit =
        Number(
            query.limit
        );

    if (
        !Number.isFinite(limit)
    ) {
        limit =
            DEFAULT_LIMIT;
    }

    limit =
        Math.min(
            Math.max(
                Math.floor(limit),
                1
            ),
            MAX_LIMIT
        );


    let days =
        Number(
            query.days
        );

    if (
        !Number.isFinite(days)
    ) {
        days =
            DEFAULT_DAYS;
    }

    days =
        Math.min(
            Math.max(
                Math.floor(days),
                1
            ),
            MAX_DAYS
        );


    const category =
        String(
            query.category ||
            'all'
        )
        .toLowerCase()
        .trim();


    const source =
        String(
            query.source ||
            'all'
        )
        .toLowerCase()
        .trim();


    return {

        category,

        source,

        limit,

        days
    };
}


/* =========================================================
   ОСНОВНОЙ HANDLER
========================================================= */

module.exports =
    async function handler(
        req,
        res
    ) {

        /* ---------------------------------------------
           CORS
        --------------------------------------------- */

        res.setHeader(
            'Access-Control-Allow-Origin',
            '*'
        );

        res.setHeader(
            'Access-Control-Allow-Methods',
            'GET, OPTIONS'
        );

        res.setHeader(
            'Access-Control-Allow-Headers',
            'Content-Type'
        );


        /* ---------------------------------------------
           CACHE
        --------------------------------------------- */

        res.setHeader(
            'Cache-Control',
            's-maxage=300, stale-while-revalidate=600'
        );


        /* ---------------------------------------------
           OPTIONS
        --------------------------------------------- */

        if (
            req.method === 'OPTIONS'
        ) {

            return res
                .status(204)
                .end();
        }


        /* ---------------------------------------------
           METHOD
        --------------------------------------------- */

        if (
            req.method !== 'GET'
        ) {

            return res
                .status(405)
                .json({
                    ok: false,
                    error:
                        'Method Not Allowed'
                });
        }


        /* ---------------------------------------------
           QUERY
        --------------------------------------------- */

        const {
            category,
            source,
            limit,
            days
        } = getQuery(req);


        /* ---------------------------------------------
           LOAD SOURCES
        --------------------------------------------- */

        const loaded =
            await Promise.all(
                sources.map(
                    loadSource
                )
            );


        /* ---------------------------------------------
           FLATTEN
        --------------------------------------------- */

        let items =
            loaded.flatMap(
                result =>
                    result.items
            );


        /* ---------------------------------------------
           GOOGLE NEWS → ORIGINAL
        --------------------------------------------- */

        items =
            await resolveOriginalLinks(
                items
            );


        /* ---------------------------------------------
           DEDUPE
        --------------------------------------------- */

        items =
            dedupe(items);


        /* ---------------------------------------------
           DATE FILTER
        --------------------------------------------- */

        const minDate =
            Date.now() -
            days *
            24 *
            60 *
            60 *
            1000;


        items =
            items.filter(
                item => {

                    if (
                        !item.published
                    ) {
                        return true;
                    }

                    const time =
                        new Date(
                            item.published
                        ).getTime();

                    if (
                        Number.isNaN(
                            time
                        )
                    ) {
                        return true;
                    }

                    return (
                        time >=
                        minDate
                    );
                }
            );


        /* ---------------------------------------------
           CATEGORY FILTER
        --------------------------------------------- */

        if (
            category !== 'all'
        ) {

            items =
                items.filter(
                    item =>
                        Array.isArray(
                            item.categories
                        ) &&
                        item.categories.includes(
                            category
                        )
                );
        }


        /* ---------------------------------------------
           SOURCE FILTER
        --------------------------------------------- */

        if (
            source !== 'all'
        ) {

            items =
                items.filter(
                    item =>
                        item.sourceId ===
                        source
                );
        }


        /* ---------------------------------------------
           SORT
        --------------------------------------------- */

        sortItems(
            items
        );


        /* ---------------------------------------------
           AGE
        --------------------------------------------- */

        items =
            addAge(
                items
            );


        /* ---------------------------------------------
           LIMIT
        --------------------------------------------- */

        const resultItems =
            items.slice(
                0,
                limit
            );


        /* ---------------------------------------------
           SOURCE STATUS
        --------------------------------------------- */

        const sourceStatus =
            loaded.map(
                result => ({

                    id:
                        result.source.id,

                    name:
                        result.source.name,

                    type:
                        result.source.type,

                    ok:
                        !result.error,

                    count:
                        result.items.length,

                    error:
                        result.error
                })
            );


        /* ---------------------------------------------
           RESPONSE
        --------------------------------------------- */

        return res
            .status(200)
            .json({

                ok: true,

                updated:
                    new Date()
                        .toISOString(),

                category,

                source,

                days,

                limit,

                count:
                    resultItems.length,

                items:
                    resultItems,

                sources:
                    sourceStatus
            });
    };

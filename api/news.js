const Parser = require('rss-parser');
const sources = require('../lib/sources');

const parser = new Parser({
    timeout: 10000,
    maxRedirects: 5,
    headers: {
        'User-Agent': 'Urban Estate News API/1.2'
    }
});


/* =========================================================
   НАСТРОЙКИ
========================================================= */

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;

const DEFAULT_DAYS = 7;
const MAX_DAYS = 30;

const SOURCE_LIMIT = 20;


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
        'рефинанс',
        'банк',
        'ключев',
        'эскроу',
        'первоначальн',
        'кредитован'
    ],

    newbuild: [
        'новостро',
        'застройщик',
        'девелоп',
        'жилой комплекс',
        'жк ',
        'строительств',
        'нового дома',
        'новом доме',
        'новый дом'
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
        'законопроект'
    ],

    krasnodar: [
        'краснодар',
        'кубан',
        'сочи',
        'адыге',
        'краснодарск',
        'армавир',
        'геленджик',
        'анап',
        'новороссийск',
        'ейск'
    ],

    rostov: [
        'ростов',
        'ростовск',
        'ростов-на-дону',
        'таганрог',
        'шахт',
        'батайск',
        'азов',
        'новочеркасск'
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
        'продаж квартир',
        'рынок недвижимости'
    ]
};


/* =========================================================
   ТЕКСТ
========================================================= */

function stripHtml(value) {

    return String(value || '')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\s+/g, ' ')
        .trim();
}


function normalizeText(value) {

    return stripHtml(value)
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[^a-zа-я0-9]+/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}


/* =========================================================
   КАТЕГОРИИ
========================================================= */

function detectCategories(
    title,
    description,
    source
) {

    const text = normalizeText(
        `${title} ${description}`
    );

    const categories = new Set(
        Array.isArray(source.categories)
            ? source.categories
            : []
    );

    for (
        const category in CATEGORY_RULES
    ) {

        const words =
            CATEGORY_RULES[category];

        const found =
            words.some(word => {

                const normalized =
                    normalizeText(word);

                return text.includes(
                    normalized
                );
            });

        if (found) {
            categories.add(category);
        }
    }

    return Array.from(categories);
}


/* =========================================================
   ДАТА
========================================================= */

function getPublishedDate(item) {

    const value =
        item.isoDate ||
        item.pubDate ||
        item.published ||
        item.date;

    if (!value) {
        return null;
    }

    const date =
        new Date(value);

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

    return null;
}


/* =========================================================
   НОВОСТЬ
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
        source.homepage ||
        '#';

    const published =
        getPublishedDate(item);

    return {

        id:
            `${source.id}-${Buffer.from(
                `${url}-${title}`
            ).toString('base64')
                .replace(/[^a-zA-Z0-9]/g, '')
                .slice(0, 40)}`,

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

        image:
            getImage(item),

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
    value
) {

    if (!value) {
        return '';
    }

    try {

        const url =
            new URL(value);

        url.hash = '';

        const remove = [
            'utm_source',
            'utm_medium',
            'utm_campaign',
            'utm_term',
            'utm_content',
            'utm_id',
            'gclid',
            'fbclid',
            'yclid'
        ];

        remove.forEach(
            parameter => {
                url.searchParams.delete(
                    parameter
                );
            }
        );

        return url
            .toString()
            .replace(/\/$/, '')
            .toLowerCase();

    } catch {

        return String(value)
            .replace(/\/$/, '')
            .toLowerCase();
    }
}


/* =========================================================
   TITLE KEY
========================================================= */

function titleKey(
    value
) {

    return normalizeText(value)
        .replace(
            /\s+/g,
            ' '
        )
        .trim();
}


/* =========================================================
   ДЕДУПЛИКАЦИЯ
========================================================= */

function deduplicate(
    items
) {

    const urls =
        new Set();

    const titles =
        new Set();

    const result = [];

    for (
        const item of items
    ) {

        const url =
            canonicalUrl(
                item.url
            );

        const title =
            titleKey(
                item.title
            );

        if (
            url &&
            urls.has(url)
        ) {
            continue;
        }

        if (
            title &&
            titles.has(title)
        ) {
            continue;
        }

        if (url) {
            urls.add(url);
        }

        if (title) {
            titles.add(title);
        }

        result.push(item);
    }

    return result;
}


/* =========================================================
   GOOGLE NEWS
========================================================= */

function isGoogleNews(
    url
) {

    if (!url) {
        return false;
    }

    return url.includes(
        'news.google.com/rss/articles/'
    );
}


/*
 * ВАЖНО:
 *
 * Мы НЕ пытаемся делать дополнительные запросы
 * к каждому Google News URL.
 *
 * Это существенно уменьшает вероятность:
 *
 * 500
 * timeout
 * rate limit
 *
 * На этом этапе сохраняем URL RSS.
 *
 * Прямую ссылку на источник будем решать
 * отдельным этапом.
 */


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

        const rawItems =
            Array.isArray(feed.items)
                ? feed.items
                : [];

        const items =
            rawItems
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

            ok: true,

            error: null
        };

    } catch (error) {

        return {

            source,

            items: [],

            ok: false,

            error:
                error &&
                error.message
                    ? error.message
                    : 'RSS error'
        };
    }
}


/* =========================================================
   СОРТИРОВКА
========================================================= */

function sortNews(
    items
) {

    return items.sort(
        (a, b) => {

            const aTime =
                a.published
                    ? new Date(
                        a.published
                    ).getTime()
                    : 0;

            const bTime =
                b.published
                    ? new Date(
                        b.published
                    ).getTime()
                    : 0;

            return bTime - aTime;
        }
    );
}


/* =========================================================
   AGE
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

            const time =
                new Date(
                    item.published
                ).getTime();

            if (
                Number.isNaN(time)
            ) {

                return {
                    ...item,
                    age: null
                };
            }

            return {

                ...item,

                age:
                    Math.max(
                        0,
                        Math.floor(
                            (
                                now -
                                time
                            ) / 60000
                        )
                    )
            };
        }
    );
}


/* =========================================================
   QUERY
========================================================= */

function getQuery(
    req
) {

    const query =
        req.query || {};

    let limit =
        parseInt(
            query.limit,
            10
        );

    if (
        Number.isNaN(limit)
    ) {

        limit =
            DEFAULT_LIMIT;
    }

    limit =
        Math.max(
            1,
            Math.min(
                MAX_LIMIT,
                limit
            )
        );


    let days =
        parseInt(
            query.days,
            10
        );

    if (
        Number.isNaN(days)
    ) {

        days =
            DEFAULT_DAYS;
    }

    days =
        Math.max(
            1,
            Math.min(
                MAX_DAYS,
                days
            )
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
   HANDLER
========================================================= */

module.exports =
    async function handler(
        req,
        res
    ) {

        /*
         * CORS
         */

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


        /*
         * CACHE
         */

        res.setHeader(
            'Cache-Control',
            's-maxage=300, stale-while-revalidate=600'
        );


        /*
         * OPTIONS
         */

        if (
            req.method === 'OPTIONS'
        ) {

            return res
                .status(204)
                .end();
        }


        /*
         * GET ONLY
         */

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


        try {

            const {
                category,
                source,
                limit,
                days
            } =
                getQuery(req);


            /*
             * Загружаем источники
             */

            const results =
                await Promise.all(
                    sources.map(
                        source =>
                            loadSource(
                                source
                            )
                    )
                );


            /*
             * Объединяем
             */

            let items =
                results.flatMap(
                    result =>
                        result.items
                );


            /*
             * Удаляем дубли
             */

            items =
                deduplicate(
                    items
                );


            /*
             * Фильтр даты
             */

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


            /*
             * Категория
             */

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


            /*
             * Источник
             */

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


            /*
             * Сортируем
             */

            sortNews(
                items
            );


            /*
             * Добавляем возраст
             */

            items =
                addAge(
                    items
                );


            /*
             * Ограничиваем
             */

            items =
                items.slice(
                    0,
                    limit
                );


            /*
             * Статус источников
             */

            const sourceStatus =
                results.map(
                    result => ({

                        id:
                            result.source.id,

                        name:
                            result.source.name,

                        ok:
                            result.ok,

                        count:
                            result.items.length,

                        error:
                            result.error
                    })
                );


            /*
             * Ответ
             */

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
                        items.length,

                    items,

                    sources:
                        sourceStatus
                });


        } catch (error) {

            /*
             * НИКОГДА не даём функции
             * упасть с необработанной ошибкой.
             */

            console.error(
                'NEWS API ERROR:',
                error
            );


            return res
                .status(500)
                .json({

                    ok: false,

                    error:
                        error &&
                        error.message
                            ? error.message
                            : 'Internal Server Error'
                });
        }
    };

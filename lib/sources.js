/**
 * Urban Estate News API — Stage 1.2
 *
 * Источники новостей.
 *
 * direct-rss
 *     Прямой RSS источника.
 *
 * google-news
 *     Google News RSS с ограничением
 *     по конкретному домену.
 *
 * fallbackFeed
 *     Запасной RSS, если основной временно
 *     недоступен.
 */


/* =========================================================
   GOOGLE NEWS RSS
========================================================= */

const googleNews = (
    domain,
    query = ''
) => {

    const q =
        encodeURIComponent(
            `site:${domain}${
                query
                    ? ` ${query}`
                    : ''
            }`
        );

    return (
        'https://news.google.com/rss/search' +
        `?q=${q}` +
        '&hl=ru' +
        '&gl=RU' +
        '&ceid=RU:ru'
    );
};


/* =========================================================
   ИСТОЧНИКИ
========================================================= */

module.exports = [

    /* -----------------------------------------------------
       ЦИАН
    ----------------------------------------------------- */

    {
        id: 'cian-news',

        name: 'ЦИАН',

        type: 'google-news',

        feed:
            googleNews(
                'cian.ru/novosti'
            ),

        homepage:
            'https://www.cian.ru/novosti/market/',

        categories: [
            'estate',
            'newbuild',
            'mortgage'
        ]
    },


    /* -----------------------------------------------------
       РБК НЕДВИЖИМОСТЬ
    ----------------------------------------------------- */

    {
        id: 'rbc',

        name: 'РБК Недвижимость',

        type: 'google-news',

        feed:
            googleNews(
                'realty.rbc.ru'
            ),

        homepage:
            'https://realty.rbc.ru/',

        categories: [
            'estate',
            'newbuild',
            'mortgage'
        ]
    },


    /* -----------------------------------------------------
       ДОМКЛИК
    ----------------------------------------------------- */

    {
        id: 'domclick-news',

        name: 'Домклик',

        type: 'google-news',

        feed:
            googleNews(
                'blog.domclick.ru/novosti'
            ),

        homepage:
            'https://blog.domclick.ru/tag/novosti',

        categories: [
            'estate',
            'newbuild',
            'mortgage'
        ]
    },


    /* -----------------------------------------------------
       ДОМ.РФ
    ----------------------------------------------------- */

    {
        id: 'domrf-news',

        name: 'ДОМ.РФ',

        type: 'google-news',

        feed:
            googleNews(
                'xn--d1aqf.xn--p1ai'
            ),

        homepage:
            'https://спроси.дом.рф/news/',

        categories: [
            'estate',
            'newbuild',
            'mortgage',
            'law'
        ]
    },


    /* -----------------------------------------------------
       ЕРЗ.РФ
    ----------------------------------------------------- */

    {
        id: 'erz',

        name: 'ЕРЗ.РФ',

        type: 'google-news',

        feed:
            googleNews(
                'erzrf.ru/news'
            ),

        homepage:
            'https://erzrf.ru/news',

        categories: [
            'newbuild',
            'law',
            'mortgage'
        ]
    },


    /* -----------------------------------------------------
       РИА НЕДВИЖИМОСТЬ
    ----------------------------------------------------- */

    {
        id: 'ria',

        name: 'РИА Недвижимость',

        type: 'direct-rss',

        feed:
            'https://realty.ria.ru/export/rss2/index.xml?page_type=google_newsstand',

        homepage:
            'https://realty.ria.ru/',

        categories: [
            'estate',
            'newbuild',
            'mortgage',
            'law'
        ]
    },


    /* -----------------------------------------------------
       МИНСТРОЙ РФ
    ----------------------------------------------------- */

    {
        id: 'minstroy',

        name: 'Минстрой РФ',

        type: 'google-news',

        feed:
            googleNews(
                'minstroyrf.gov.ru',
                'недвижимость OR строительство OR жилье OR ипотека'
            ),

        homepage:
            'https://www.minstroyrf.gov.ru/press/?d=news',

        categories: [
            'law',
            'newbuild',
            'estate'
        ]
    },


    /* -----------------------------------------------------
       МИНФИН РФ
    ----------------------------------------------------- */

    {
        id: 'minfin',

        name: 'Минфин РФ',

        type: 'direct-rss',

        feed:
            'https://minfin.gov.ru/ru/press-center/rss/',

        fallbackFeed:
            googleNews(
                'minfin.gov.ru',
                'недвижимость OR ипотека OR налоги OR строительство'
            ),

        homepage:
            'https://minfin.gov.ru/ru/press-center/',

        categories: [
            'law',
            'mortgage'
        ]
    },


    /* -----------------------------------------------------
       93.RU
    ----------------------------------------------------- */

    {
        id: '93ru',

        name: '93.RU',

        type: 'google-news',

        feed:
            googleNews(
                '93.ru/text',
                'недвижимость OR ипотека OR новостройки OR Краснодар'
            ),

        homepage:
            'https://93.ru/text/tags/nedvizhimost/',

        categories: [
            'krasnodar',
            'estate',
            'mortgage',
            'newbuild'
        ]
    },


    /* -----------------------------------------------------
       КРАСДОМ
    ----------------------------------------------------- */

    {
        id: 'krasdom',

        name: 'КРАСДОМ',

        type: 'google-news',

        feed:
            googleNews(
                'krasdom.ru/news',
                'недвижимость OR ипотека OR новостройки OR Краснодар'
            ),

        homepage:
            'https://krasdom.ru/news/',

        categories: [
            'krasnodar',
            'estate',
            'mortgage',
            'newbuild',
            'law'
        ]
    },


    /* -----------------------------------------------------
       ЯНДЕКС НЕДВИЖИМОСТЬ
    ----------------------------------------------------- */

    {
        id: 'yandex-news',

        name: 'Яндекс Недвижимость',

        type: 'google-news',

        feed:
            googleNews(
                'realty.yandex.ru/journal',
                'недвижимость OR ипотека OR новостройки'
            ),

        homepage:
            'https://realty.yandex.ru/journal/category/news/',

        categories: [
            'estate',
            'newbuild',
            'mortgage'
        ]
    },


    /* -----------------------------------------------------
       161.RU
    ----------------------------------------------------- */

    {
        id: '161ru',

        name: '161.RU',

        type: 'google-news',

        feed:
            googleNews(
                '161.ru',
                'недвижимость OR ипотека OR новостройки OR Ростов'
            ),

        homepage:
            'https://161.ru/',

        categories: [
            'rostov',
            'estate',
            'mortgage',
            'newbuild'
        ]
    }

];

/**
 * Urban Estate News API 6.0
 *
 * The regional and magazine sources are read directly from their public pages.
 * Google News RSS is intentionally no longer used as the primary transport:
 * Google article URLs are opaque and their undocumented resolver can fail in
 * Vercel even when the RSS feed itself works.
 */

module.exports = [
  {
    id: 'domclick-news',
    name: 'Домклик',
    type: 'direct-html',
    feed: 'https://blog.domclick.ru/novosti',
    homepage: 'https://blog.domclick.ru/novosti',
    allowedHosts: ['blog.domclick.ru'],
    allowedPathPrefixes: ['/novosti/'],
    region: null,
    priority: 1
  },
  {
    id: 'domrf-news',
    name: 'ДОМ.РФ',
    type: 'direct-rss',
    feed: 'https://спроси.дом.рф/rss/news/',
    homepage: 'https://спроси.дом.рф/news/',
    allowedHosts: ['xn--h1alcedd.xn--d1aqf.xn--p1ai'],
    allowedPathPrefixes: ['/news/'],
    region: null,
    priority: 2
  },
  {
    id: 'krasdom',
    name: 'КРАСДОМ',
    type: 'direct-html',
    feed: 'https://krasdom.ru/news/',
    homepage: 'https://krasdom.ru/news/',
    allowedHosts: ['krasdom.ru', 'www.krasdom.ru'],
    allowedPathPrefixes: ['/news/'],
    region: 'krasnodar',
    priority: 3
  },
  {
    id: '93ru',
    name: '93.RU',
    type: 'direct-html',
    feed: 'https://93.ru/text/realty/',
    homepage: 'https://93.ru/text/realty/',
    allowedHosts: ['93.ru', 'www.93.ru'],
    allowedPathPrefixes: ['/text/realty/'],
    region: 'krasnodar',
    priority: 4
  },
  {
    id: 'cian-news',
    name: 'ЦИАН',
    type: 'direct-html',
    feed: 'https://krasnodar.cian.ru/magazine/',
    homepage: 'https://krasnodar.cian.ru/magazine/',
    allowedHosts: ['krasnodar.cian.ru'],
    allowedPathPrefixes: ['/magazine/'],
    region: 'krasnodar',
    priority: 5
  },
  {
    id: 'yandex-news',
    name: 'Яндекс Недвижимость',
    type: 'direct-html',
    feed: 'https://realty.yandex.ru/journal/category/news/',
    homepage: 'https://realty.yandex.ru/journal/category/news/',
    allowedHosts: ['realty.yandex.ru'],
    allowedPathPrefixes: ['/journal/'],
    region: null,
    priority: 6
  },
  {
    id: '161ru',
    name: '161.RU',
    type: 'direct-html',
    feed: 'https://161.ru/text/realty/',
    homepage: 'https://161.ru/text/realty/',
    allowedHosts: ['161.ru', 'www.161.ru'],
    allowedPathPrefixes: ['/text/realty/'],
    region: 'rostov',
    priority: 7
  }
];

/**
 * Urban Estate News API 4.0
 *
 * Seven approved news sources only.
 * For Google-backed sources the Google RSS query is used only as transport;
 * the resolver converts the item to the publisher's real article URL.
 */

const googleNews = (siteQuery) => {
  const q = encodeURIComponent(siteQuery);
  return `https://news.google.com/rss/search?q=${q}&hl=ru&gl=RU&ceid=RU:ru`;
};

module.exports = [
  {
    id: 'domclick-news',
    name: 'Домклик',
    type: 'google-news',
    feed: googleNews('site:blog.domclick.ru/novosti'),
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
    type: 'google-news',
    // The current public Krasdom news branch is /news/.
    feed: googleNews('site:krasdom.ru/news/'),
    homepage: 'https://krasdom.ru/Krasnodarskijj-krajj/news/',
    allowedHosts: ['krasdom.ru', 'www.krasdom.ru'],
    allowedPathPrefixes: ['/news/', '/Krasnodarskijj-krajj/news/'],
    region: 'krasnodar',
    priority: 3
  },
  {
    id: '93ru',
    name: '93.RU',
    type: 'google-news',
    feed: googleNews('site:93.ru/text/realty/'),
    homepage: 'https://93.ru/text/realty/',
    allowedHosts: ['93.ru', 'www.93.ru'],
    allowedPathPrefixes: ['/text/realty/'],
    region: 'krasnodar',
    priority: 4
  },
  {
    id: 'cian-news',
    name: 'ЦИАН',
    type: 'google-news',
    // CIAN currently publishes the news stream inside /magazine/.
    feed: googleNews('site:krasnodar.cian.ru/magazine/ "Новости"'),
    homepage: 'https://krasnodar.cian.ru/novosti/',
    allowedHosts: ['krasnodar.cian.ru'],
    allowedPathPrefixes: ['/magazine/'],
    region: 'krasnodar',
    priority: 5
  },
  {
    id: 'yandex-news',
    name: 'Яндекс Недвижимость',
    type: 'google-news',
    feed: googleNews('site:realty.yandex.ru/journal/category/news/'),
    homepage: 'https://realty.yandex.ru/journal/category/news/',
    allowedHosts: ['realty.yandex.ru'],
    allowedPathPrefixes: ['/journal/'],
    region: null,
    priority: 6
  },
  {
    id: '161ru',
    name: '161.RU',
    type: 'google-news',
    feed: googleNews('site:161.ru/text/realty/'),
    homepage: 'https://161.ru/text/realty/',
    allowedHosts: ['161.ru', 'www.161.ru'],
    allowedPathPrefixes: ['/text/realty/'],
    region: 'rostov',
    priority: 7
  }
];

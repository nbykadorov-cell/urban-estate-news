/**
 * Urban Estate News API 2.0
 * Only the seven user-approved news branches are allowed.
 */

const googleNews = (domainPath, query = '') => {
  const q = encodeURIComponent(`site:${domainPath}${query ? ` ${query}` : ''}`);
  return `https://news.google.com/rss/search?q=${q}&hl=ru&gl=RU&ceid=RU:ru`;
};

module.exports = [
  {
    id: 'domclick-news',
    name: 'Домклик',
    type: 'google-news',
    feed: googleNews('blog.domclick.ru/novosti'),
    homepage: 'https://blog.domclick.ru/novosti',
    allowedHosts: ['blog.domclick.ru'],
    allowedPathPrefix: '/novosti/',
    categories: ['estate', 'newbuild', 'mortgage', 'law'],
    priority: 1
  },
  {
    id: 'domrf-news',
    name: 'ДОМ.РФ',
    type: 'direct-rss',
    feed: 'https://спроси.дом.рф/rss/news/',
    homepage: 'https://спроси.дом.рф/news/',
    allowedHosts: ['xn--d1aqf.xn--p1ai', 'xn--80adxhks.xn--p1ai'],
    allowedPathPrefix: '/news/',
    categories: ['estate', 'newbuild', 'mortgage', 'law'],
    priority: 2
  },
  {
    id: 'krasdom',
    name: 'КРАСДОМ',
    type: 'google-news',
    feed: googleNews('krasdom.ru/Krasnodarskijj-krajj/news/'),
    homepage: 'https://krasdom.ru/Krasnodarskijj-krajj/news/',
    allowedHosts: ['krasdom.ru', 'www.krasdom.ru'],
    allowedPathPrefix: '/Krasnodarskijj-krajj/news/',
    categories: ['krasnodar', 'estate', 'mortgage', 'newbuild', 'law'],
    priority: 3
  },
  {
    id: '93ru',
    name: '93.RU',
    type: 'google-news',
    feed: googleNews('93.ru/text/realty/'),
    homepage: 'https://93.ru/text/realty/',
    allowedHosts: ['93.ru', 'www.93.ru'],
    allowedPathPrefix: '/text/realty/',
    categories: ['krasnodar', 'estate', 'mortgage', 'newbuild'],
    priority: 4
  },
  {
    id: 'cian-news',
    name: 'ЦИАН',
    type: 'google-news',
    feed: googleNews('krasnodar.cian.ru/novosti/'),
    homepage: 'https://krasnodar.cian.ru/novosti/',
    allowedHosts: ['krasnodar.cian.ru'],
    allowedPathPrefix: '/novosti/',
    categories: ['estate', 'newbuild', 'mortgage'],
    priority: 5
  },
  {
    id: 'yandex-news',
    name: 'Яндекс Недвижимость',
    type: 'google-news',
    feed: googleNews('realty.yandex.ru/journal/category/news/'),
    homepage: 'https://realty.yandex.ru/journal/category/news/',
    allowedHosts: ['realty.yandex.ru'],
    allowedPathPrefix: '/journal/category/news/',
    categories: ['estate', 'newbuild', 'mortgage', 'law'],
    priority: 6
  },
  {
    id: '161ru',
    name: '161.RU',
    type: 'google-news',
    feed: googleNews('161.ru/text/realty/'),
    homepage: 'https://161.ru/text/realty/',
    allowedHosts: ['161.ru', 'www.161.ru'],
    allowedPathPrefix: '/text/realty/',
    categories: ['rostov', 'estate', 'mortgage', 'newbuild'],
    priority: 7
  }
];

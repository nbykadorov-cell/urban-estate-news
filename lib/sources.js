/**
 * Urban Estate News API
 * Source registry.
 *
 * direct RSS = official/public feed discovered for the source.
 * google-news = Google News RSS query restricted to the source domain.
 *
 * Google News is used only where a stable public source RSS/API was not
 * verified. It returns links to the original publisher pages.
 */

const googleNews = (domain, query = '') => {
  const q = encodeURIComponent(`site:${domain}${query ? ` ${query}` : ''}`);
  return `https://news.google.com/rss/search?q=${q}&hl=ru&gl=RU&ceid=RU:ru`;
};

module.exports = [
  {
    id: 'cian-news',
    name: 'ЦИАН',
    type: 'google-news',
    feed: googleNews('cian.ru/novosti'),
    homepage: 'https://www.cian.ru/novosti/market/',
    categories: ['estate', 'newbuild', 'mortgage']
  },
  {
    id: 'rbc',
    name: 'РБК Недвижимость',
    type: 'google-news',
    feed: googleNews('realty.rbc.ru'),
    homepage: 'https://realty.rbc.ru/',
    categories: ['estate', 'newbuild', 'mortgage']
  },
  {
    id: 'domclick-news',
    name: 'Домклик',
    type: 'google-news',
    feed: googleNews('blog.domclick.ru/novosti'),
    homepage: 'https://blog.domclick.ru/tag/novosti',
    categories: ['estate', 'newbuild', 'mortgage']
  },
  {
    id: 'domrf-news',
    name: 'ДОМ.РФ',
    type: 'google-news',
    feed: googleNews('xn--d1aqf.xn--p1ai'),
    homepage: 'https://спроси.дом.рф/news/',
    categories: ['estate', 'newbuild', 'mortgage', 'law']
  },
  {
    id: 'erz',
    name: 'ЕРЗ.РФ',
    type: 'google-news',
    feed: googleNews('erzrf.ru/news'),
    homepage: 'https://erzrf.ru/news',
    categories: ['newbuild', 'law', 'mortgage']
  },
  {
    id: 'ria',
    name: 'РИА Недвижимость',
    type: 'direct-rss',
    feed: 'https://realty.ria.ru/export/rss2/index.xml?page_type=google_newsstand',
    homepage: 'https://realty.ria.ru/',
    categories: ['estate', 'newbuild', 'mortgage', 'law']
  },
  {
    id: 'minstroy',
    name: 'Минстрой РФ',
    type: 'google-news',
    feed: googleNews('minstroyrf.gov.ru', 'недвижимость OR строительство OR жилье OR ипотека'),
    homepage: 'https://www.minstroyrf.gov.ru/press/?d=news',
    categories: ['law', 'newbuild', 'estate']
  },
  {
    id: 'minfin',
    name: 'Минфин РФ',
    type: 'direct-rss',
    feed: 'https://minfin.gov.ru/ru/press-center/rss/',
    homepage: 'https://minfin.gov.ru/ru/press-center/',
    categories: ['law', 'mortgage']
  },
  {
    id: '93ru',
    name: '93.RU',
    type: 'google-news',
    feed: googleNews('93.ru/text', 'недвижимость OR ипотека OR новостройки OR Краснодар'),
    homepage: 'https://93.ru/text/tags/nedvizhimost/',
    categories: ['krasnodar', 'estate', 'mortgage', 'newbuild']
  },
  {
    id: 'krasdom',
    name: 'КРАСДОМ',
    type: 'google-news',
    feed: googleNews('krasdom.ru/news', 'недвижимость OR ипотека OR новостройки OR Краснодар'),
    homepage: 'https://krasdom.ru/news/',
    categories: ['krasnodar', 'estate', 'mortgage', 'newbuild', 'law']
  },
  {
    id: 'yandex-news',
    name: 'Яндекс Недвижимость',
    type: 'google-news',
    feed: googleNews('realty.yandex.ru/journal', 'недвижимость OR ипотека OR новостройки'),
    homepage: 'https://realty.yandex.ru/journal/category/news/',
    categories: ['estate', 'newbuild', 'mortgage']
  }
];

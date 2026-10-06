module.exports = [
  { id:'domclick-news', name:'Домклик', type:'html', feed:'https://blog.domclick.ru/novosti', homepage:'https://blog.domclick.ru/novosti', hosts:['blog.domclick.ru'], paths:['/novosti/'], region:null, priority:1 },
  { id:'domrf-news', name:'ДОМ.РФ', type:'rss', feed:'https://xn--h1alcedd.xn--d1aqf.xn--p1ai/rss/news/', homepage:'https://xn--h1alcedd.xn--d1aqf.xn--p1ai/news/', hosts:['xn--h1alcedd.xn--d1aqf.xn--p1ai','xn--h1alcedd.xn--d1aqf.xn--p1ai'], paths:['/news/'], region:null, priority:2 },
  { id:'krasdom', name:'КРАСДОМ', type:'html', feed:'https://krasdom.ru/news/', homepage:'https://krasdom.ru/news/', hosts:['krasdom.ru','www.krasdom.ru'], paths:['/news/'], region:'krasnodar', priority:3 },
  { id:'93ru', name:'93.RU', type:'html', feed:'https://93.ru/text/realty/', homepage:'https://93.ru/text/realty/', hosts:['93.ru','www.93.ru'], paths:['/text/realty/'], region:'krasnodar', priority:4 },
  { id:'cian-news', name:'ЦИАН', type:'html', feed:'https://krasnodar.cian.ru/magazine/', homepage:'https://krasnodar.cian.ru/magazine/', hosts:['krasnodar.cian.ru'], paths:['/magazine/'], region:'krasnodar', priority:5 },
  { id:'yandex-news', name:'Яндекс Недвижимость', type:'html', feed:'https://realty.yandex.ru/journal/category/news/', homepage:'https://realty.yandex.ru/journal/category/news/', hosts:['realty.yandex.ru'], paths:['/journal/'], region:null, priority:6 },
  { id:'161ru', name:'161.RU', type:'html', feed:'https://161.ru/text/realty/', homepage:'https://161.ru/text/realty/', hosts:['161.ru','www.161.ru'], paths:['/text/realty/'], region:'rostov', priority:7 }
];

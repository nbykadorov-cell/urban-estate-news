const Parser = require('rss-parser');
const sources = require('../lib/sources');

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'UrbanEstateNews/1.0 (+https://urban-estate.ru)'
  }
});

const CATEGORY_RULES = {
  mortgage: [
    'ипотек', 'ставк', 'кредит', 'семейн', 'материнск', 'заем', 'заём',
    'банк', 'ключев', 'рефинанс', 'эскроу'
  ],
  newbuild: [
    'новостро', 'застройщик', 'девелоп', 'жк ', 'жилой комплекс',
    'строительств', 'эскроу', 'квартир в новом'
  ],
  law: [
    'закон', 'законодатель', 'правил', 'постанов', 'госдум', 'минстрой',
    'минфин', 'росреестр', 'налог', 'штраф', 'норм', 'регулирован'
  ],
  krasnodar: [
    'краснодар', 'кубан', 'соч', 'адыге', 'краснодарск', 'черномор'
  ],
  rostov: [
    'ростов', 'донецк', 'дон', 'ростовск', 'таганрог', 'шахт'
  ],
  estate: [
    'недвижим', 'жиль', 'квартир', 'аренд', 'рынок жилья', 'вторич',
    'дом ', 'участок', 'земел', 'апартамент', 'жилье'
  ]
};

function stripHtml(value = '') {
  return String(value)
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

function detectCategories(title, description, source) {
  const text = `${title} ${description}`.toLowerCase();
  const result = new Set(source.categories || []);

  for (const [category, words] of Object.entries(CATEGORY_RULES)) {
    if (words.some(word => text.includes(word))) result.add(category);
  }

  return [...result];
}

function normalizeDate(item) {
  const raw = item.isoDate || item.pubDate || item.published || item.date;
  const date = raw ? new Date(raw) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

function normalizeItem(item, source) {
  const title = stripHtml(item.title || 'Без названия');
  const description = stripHtml(item.contentSnippet || item.content || item.summary || '');
  const url = item.link || item.guid || source.homepage;
  const published = normalizeDate(item);
  const image = item.enclosure?.url || item.itunes?.image || null;

  return {
    id: `${source.id}:${item.guid || item.link || title}`,
    title,
    description: description.slice(0, 300),
    url,
    source: source.name,
    sourceId: source.id,
    sourceHome: source.homepage,
    published,
    image,
    categories: detectCategories(title, description, source)
  };
}

function dedupe(items) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const normalized = item.url
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
      .toLowerCase();

    const key = normalized || `${item.title}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

async function loadSource(source) {
  try {
    const feed = await parser.parseURL(source.feed);
    return {
      source,
      items: (feed.items || []).map(item => normalizeItem(item, source)),
      error: null
    };
  } catch (error) {
    return {
      source,
      items: [],
      error: error.message || 'Feed error'
    };
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const limit = Math.min(Math.max(Number(req.query?.limit) || 40, 1), 100);
  const category = String(req.query?.category || 'all');

  const loaded = await Promise.all(sources.map(loadSource));

  let items = loaded.flatMap(result => result.items);
  items = dedupe(items);

  if (category !== 'all') {
    items = items.filter(item => item.categories.includes(category));
  }

  items.sort((a, b) => {
    const da = a.published ? new Date(a.published).getTime() : 0;
    const db = b.published ? new Date(b.published).getTime() : 0;
    return db - da;
  });

  return res.status(200).json({
    ok: true,
    updated: new Date().toISOString(),
    count: Math.min(items.length, limit),
    items: items.slice(0, limit),
    sources: loaded.map(result => ({
      id: result.source.id,
      name: result.source.name,
      type: result.source.type,
      ok: !result.error,
      count: result.items.length,
      error: result.error
    }))
  });
};

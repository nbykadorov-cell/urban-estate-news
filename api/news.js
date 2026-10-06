const Parser = require('rss-parser');
const sources = require('../lib/sources');

const parser = new Parser({
  timeout: 10000,
  maxRedirects: 5,
  headers: {
    'User-Agent': 'UrbanEstateNews/1.1 (+https://urban-estate.ru)'
  }
});

const CATEGORY_RULES = {
  mortgage: [
    'ипотек', 'ставк', 'кредит', 'семейн', 'материнск', 'заем', 'заём',
    'банк', 'ключев', 'рефинанс', 'эскроу', 'первоначальн'
  ],
  newbuild: [
    'новостро', 'застройщик', 'девелоп', 'жк ', 'жилой комплекс',
    'строительств', 'эскроу', 'нового дома', 'новом доме'
  ],
  law: [
    'закон', 'законодатель', 'правил', 'постанов', 'госдум', 'минстрой',
    'минфин', 'росреестр', 'налог', 'штраф', 'норм', 'регулирован',
    'вступил в силу', 'изменен', 'изменён'
  ],
  krasnodar: [
    'краснодар', 'кубан', 'соч', 'адыге', 'краснодарск', 'черномор',
    'армавир', 'геленджик', 'анап', 'новороссийск'
  ],
  rostov: [
    'ростов', 'донецк', 'дон ', 'ростовск', 'таганрог', 'шахт',
    'батайск', 'азов', 'новочеркасск'
  ],
  estate: [
    'недвижим', 'жиль', 'квартир', 'аренд', 'рынок жилья', 'вторич',
    'дом ', 'участок', 'земел', 'апартамент', 'жилье', 'жильё',
    'продаж квартир', 'рынок недвижимости'
  ]
};

const SOURCE_LIMIT = 20;
const GOOGLE_RESOLVE_LIMIT = 30;

function stripHtml(value = '') {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(value = '') {
  return stripHtml(value)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»“”„]/g, '"')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectCategories(title, description, source) {
  const text = normalizeText(`${title} ${description}`);
  const result = new Set(source.categories || []);

  for (const [category, words] of Object.entries(CATEGORY_RULES)) {
    if (words.some(word => text.includes(normalizeText(word)))) result.add(category);
  }

  return [...result];
}

function normalizeDate(item) {
  const raw = item.isoDate || item.pubDate || item.published || item.date;
  const date = raw ? new Date(raw) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

function getImage(item) {
  if (item.enclosure?.url) return item.enclosure.url;
  if (item['media:content']?.url) return item['media:content'].url;
  if (item['media:thumbnail']?.url) return item['media:thumbnail'].url;
  if (typeof item.itunes?.image === 'string') return item.itunes.image;
  return null;
}

function normalizeItem(item, source) {
  const title = stripHtml(item.title || 'Без названия');
  const description = stripHtml(
    item.contentSnippet || item.content || item.summary || item.description || ''
  );
  const url = item.link || item.guid || source.homepage;
  const published = normalizeDate(item);
  const image = getImage(item);

  return {
    id: `${source.id}:${item.guid || item.link || title}`,
    title,
    description: description.slice(0, 320),
    url,
    source: source.name,
    sourceId: source.id,
    sourceHome: source.homepage,
    published,
    image,
    categories: detectCategories(title, description, source)
  };
}

function canonicalUrl(rawUrl = '') {
  try {
    const u = new URL(rawUrl);
    u.hash = '';

    // Remove common analytics parameters while keeping meaningful query params.
    const remove = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'utm_id', 'gclid', 'fbclid', 'yclid', 'mc_cid', 'mc_eid'
    ];
    for (const key of remove) u.searchParams.delete(key);

    return u.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return String(rawUrl).replace(/\/$/, '').toLowerCase();
  }
}

function titleKey(title = '') {
  return normalizeText(title)
    .replace(/\b(новости|новость|рынок|недвижимости|недвижимость)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupe(items) {
  const seenUrl = new Set();
  const seenTitle = new Set();
  const result = [];

  for (const item of items) {
    const urlKey = canonicalUrl(item.url);
    const title = titleKey(item.title);

    if (urlKey && seenUrl.has(urlKey)) continue;
    if (title && seenTitle.has(title)) continue;

    if (urlKey) seenUrl.add(urlKey);
    if (title) seenTitle.add(title);
    result.push(item);
  }

  return result;
}

function isGoogleNewsUrl(url = '') {
  return /^https?:\/\/(?:www\.)?news\.google\.com\/rss\/articles\//i.test(url);
}

async function resolveGoogleNewsUrl(url) {
  if (!isGoogleNewsUrl(url)) return url;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'UrbanEstateNews/1.1 (+https://urban-estate.ru)',
        'Accept': 'text/html,application/xhtml+xml'
      }
    });

    const finalUrl = response.url || url;
    if (finalUrl && !isGoogleNewsUrl(finalUrl)) return finalUrl;
    return url;
  } catch {
    return url;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveOriginalLinks(items) {
  const candidates = items.filter(item => isGoogleNewsUrl(item.url));
  const limited = candidates.slice(0, GOOGLE_RESOLVE_LIMIT);

  await Promise.all(limited.map(async item => {
    item.url = await resolveGoogleNewsUrl(item.url);
  }));

  return items;
}

async function loadSource(source) {
  try {
    let feed;

    try {
      feed = await parser.parseURL(source.feed);
    } catch (primaryError) {
      if (!source.fallbackFeed) throw primaryError;
      feed = await parser.parseURL(source.fallbackFeed);
    }

    const items = (feed.items || [])
      .slice(0, SOURCE_LIMIT)
      .map(item => normalizeItem(item, source));

    return {
      source,
      items,
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

function sortItems(items) {
  return items.sort((a, b) => {
    const da = a.published ? new Date(a.published).getTime() : 0;
    const db = b.published ? new Date(b.published).getTime() : 0;
    return db - da;
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader(
    'Cache-Control',
    's-maxage=300, stale-while-revalidate=600'
  );

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const limit = Math.min(Math.max(Number(req.query?.limit) || 40, 1), 100);
  const category = String(req.query?.category || 'all').toLowerCase();

  const loaded = await Promise.all(sources.map(loadSource));
  let items = loaded.flatMap(result => result.items);

  // Google News links are resolved to the publisher URL before de-duplication.
  items = await resolveOriginalLinks(items);
  items = dedupe(items);

  if (category !== 'all') {
    items = items.filter(item => item.categories.includes(category));
  }

  sortItems(items);

  return res.status(200).json({
    ok: true,
    updated: new Date().toISOString(),
    category,
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

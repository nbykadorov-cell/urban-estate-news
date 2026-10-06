const Parser = require('rss-parser');
const sources = require('../lib/sources');

const parser = new Parser({
  timeout: 10000,
  maxRedirects: 5,
  headers: {
    'User-Agent': 'UrbanEstateNews/2.0 (+https://urban-estate.ru)'
  }
});

const CATEGORY_RULES = {
  mortgage: ['ипотек', 'ставк', 'кредит', 'семейн', 'материнск', 'заем', 'заём', 'банк', 'ключев', 'рефинанс', 'эскроу', 'первоначальн'],
  newbuild: ['новостро', 'застройщик', 'девелоп', 'жк ', 'жилой комплекс', 'строительств', 'эскроу', 'нового дома', 'новом доме'],
  law: ['закон', 'законодатель', 'правил', 'постанов', 'госдум', 'минстрой', 'минфин', 'росреестр', 'налог', 'штраф', 'норм', 'регулирован', 'вступил в силу', 'изменен', 'изменён'],
  krasnodar: ['краснодар', 'кубан', 'соч', 'адыге', 'краснодарск', 'черномор', 'армавир', 'геленджик', 'анап', 'новороссийск'],
  rostov: ['ростов', 'донецк', 'дон ', 'ростовск', 'таганрог', 'шахт', 'батайск', 'азов', 'новочеркасск'],
  estate: ['недвижим', 'жиль', 'квартир', 'аренд', 'рынок жилья', 'вторич', 'дом ', 'участок', 'земел', 'апартамент', 'жилье', 'жильё', 'продаж квартир', 'рынок недвижимости']
};

const SOURCE_LIMIT = 20;
const IMAGE_ENRICH_LIMIT = 24;
const ARTICLE_FETCH_TIMEOUT = 3500;

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
  const description = stripHtml(item.contentSnippet || item.content || item.summary || item.description || '');
  const url = item.link || item.guid || source.homepage;
  return {
    id: `${source.id}:${item.guid || item.link || title}`,
    title,
    description: description.slice(0, 320),
    url,
    source: source.name,
    sourceId: source.id,
    sourceHome: source.homepage,
    published: normalizeDate(item),
    image: getImage(item),
    categories: detectCategories(title, description, source),
    priority: source.priority || 99
  };
}

function canonicalUrl(rawUrl = '') {
  try {
    const u = new URL(rawUrl);
    u.hash = '';
    ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','utm_id','gclid','fbclid','yclid','mc_cid','mc_eid'].forEach(k => u.searchParams.delete(k));
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
    const u = canonicalUrl(item.url);
    const t = titleKey(item.title);
    if (u && seenUrl.has(u)) continue;
    if (t && seenTitle.has(t)) continue;
    if (u) seenUrl.add(u);
    if (t) seenTitle.add(t);
    result.push(item);
  }
  return result;
}

function isGoogleNewsUrl(url = '') {
  return /^https?:\/\/(?:www\.)?news\.google\.com\/rss\/articles\//i.test(url);
}

function isAllowedSourceUrl(url, source) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const hosts = (source.allowedHosts || []).map(x => x.toLowerCase());
    if (!hosts.includes(host)) return false;
    return u.pathname.toLowerCase().startsWith((source.allowedPathPrefix || '/').toLowerCase());
  } catch {
    return false;
  }
}

async function resolveGoogleNewsUrl(url) {
  if (!isGoogleNewsUrl(url)) return url;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ARTICLE_FETCH_TIMEOUT);
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'UrbanEstateNews/2.0 (+https://urban-estate.ru)',
        'Accept': 'text/html,application/xhtml+xml'
      }
    });
    return response.url || url;
  } catch {
    return url;
  } finally {
    clearTimeout(timer);
  }
}

function decodeHtml(value = '') {
  return String(value)
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/gi, ' ');
}

function extractMeta(html, names) {
  for (const name of names) {
    const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'i');
    const m = html.match(re1) || html.match(re2);
    if (m && m[1]) return decodeHtml(m[1]);
  }
  return null;
}

async function enrichImage(item, source) {
  if (item.image || !item.url || isGoogleNewsUrl(item.url)) return item;
  if (!isAllowedSourceUrl(item.url, source)) return item;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ARTICLE_FETCH_TIMEOUT);
  try {
    const response = await fetch(item.url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'UrbanEstateNews/2.0 (+https://urban-estate.ru)',
        'Accept': 'text/html,application/xhtml+xml'
      }
    });
    if (!response.ok) return item;
    const html = await response.text();
    const image = extractMeta(html, ['og:image', 'twitter:image', 'og:image:url']);
    if (image) item.image = image;
    return item;
  } catch {
    return item;
  } finally {
    clearTimeout(timer);
  }
}

async function enrichImages(items) {
  const limited = items.slice(0, IMAGE_ENRICH_LIMIT);
  await Promise.all(limited.map(item => {
    const source = sources.find(s => s.id === item.sourceId);
    return source ? enrichImage(item, source) : item;
  }));
  return items;
}

async function loadSource(source) {
  try {
    const feed = await parser.parseURL(source.feed);
    const items = (feed.items || []).slice(0, SOURCE_LIMIT).map(item => normalizeItem(item, source));
    return { source, items, error: null };
  } catch (error) {
    return { source, items: [], error: error.message || 'Feed error' };
  }
}

function sortItems(items) {
  return items.sort((a, b) => {
    const da = a.published ? new Date(a.published).getTime() : 0;
    const db = b.published ? new Date(b.published).getTime() : 0;
    if (db !== da) return db - da;
    return (a.priority || 99) - (b.priority || 99);
  });
}

function isRecent(item, days) {
  if (!item.published) return true;
  const t = new Date(item.published).getTime();
  if (Number.isNaN(t)) return true;
  return Date.now() - t <= days * 86400000;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const requestedCategory = String(req.query?.category || 'all');
    const limit = Math.min(Math.max(Number(req.query?.limit || 15), 1), 50);
    const days = Math.min(Math.max(Number(req.query?.days || 7), 1), 30);

    const loaded = await Promise.all(sources.map(loadSource));
    let items = loaded.flatMap(x => x.items);

    // Only the seven explicitly configured branches are allowed.
    items = items.filter(item => {
      const source = sources.find(s => s.id === item.sourceId);
      if (!source) return false;
      return isGoogleNewsUrl(item.url) || isAllowedSourceUrl(item.url, source);
    });

    // Resolve Google News redirect links first, then validate the final URL.
    const googleItems = items.filter(item => isGoogleNewsUrl(item.url));
    await Promise.all(googleItems.slice(0, 50).map(async item => {
      const resolved = await resolveGoogleNewsUrl(item.url);
      if (resolved && !isGoogleNewsUrl(resolved)) item.url = resolved;
    }));

    items = items.filter(item => {
      const source = sources.find(s => s.id === item.sourceId);
      return source && isAllowedSourceUrl(item.url, source);
    });

    items = items.filter(item => isRecent(item, days));
    items = dedupe(sortItems(items));

    if (requestedCategory !== 'all') {
      items = items.filter(item => Array.isArray(item.categories) && item.categories.includes(requestedCategory));
    }

    items = await enrichImages(items.slice(0, Math.max(limit * 2, 24)));
    items = sortItems(items).slice(0, limit);

    const sourceStatus = loaded.map(x => ({
      id: x.source.id,
      name: x.source.name,
      ok: !x.error,
      count: x.items.length,
      error: x.error || null
    }));

    return res.status(200).json({
      ok: true,
      generatedAt: new Date().toISOString(),
      category: requestedCategory,
      days,
      limit,
      count: items.length,
      items,
      sources: sourceStatus
    });
  } catch (error) {
    console.error('Urban Estate News API:', error);
    return res.status(500).json({ ok: false, error: error.message || 'Internal Server Error' });
  }
};

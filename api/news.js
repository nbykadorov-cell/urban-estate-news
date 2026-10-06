const Parser = require('rss-parser');
const sources = require('../lib/sources');
const { isGoogleNewsUrl, resolveGoogleNewsUrl } = require('../lib/google-news');

const parser = new Parser({
  timeout: 10000,
  maxRedirects: 5,
  headers: {
    'User-Agent': 'UrbanEstateNews/3.0 (+https://urban-estate.ru)'
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
const GOOGLE_RESOLVE_LIMIT_PER_SOURCE = 8;
const GOOGLE_CONCURRENCY = 4;
const IMAGE_ENRICH_LIMIT = 18;
const ARTICLE_FETCH_TIMEOUT = 3000;

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
    ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','utm_id','gclid','fbclid','yclid','mc_cid','mc_eid','oc'].forEach(k => u.searchParams.delete(k));
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

function isAllowedSourceUrl(url, source) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const hosts = (source.allowedHosts || []).map(x => x.toLowerCase());
    if (!hosts.includes(host)) return false;
    const path = u.pathname.toLowerCase();
    const prefixes = source.allowedPathPrefixes || ['/'];
    return prefixes.some(prefix => path.startsWith(prefix.toLowerCase()));
  } catch {
    return false;
  }
}

async function mapWithConcurrency(items, concurrency, worker) {
  const result = new Array(items.length);
  let nextIndex = 0;

  async function runner() {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      try {
        result[index] = await worker(items[index], index);
      } catch {
        result[index] = null;
      }
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, runner);
  await Promise.all(runners);
  return result;
}

async function resolveGoogleItems(items) {
  const candidates = items
    .filter(item => isGoogleNewsUrl(item.url))
    .slice(0, GOOGLE_RESOLVE_LIMIT_PER_SOURCE * sources.length);

  const resolved = await mapWithConcurrency(candidates, GOOGLE_CONCURRENCY, async item => {
    const url = await resolveGoogleNewsUrl(item.url);
    if (url && !isGoogleNewsUrl(url)) {
      item.url = url;
      item.googleResolved = true;
    }
    return item;
  });

  return resolved.filter(Boolean);
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
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i');
    const m = html.match(re1) || html.match(re2);
    if (m && m[1]) return decodeHtml(m[1]);
  }
  return null;
}

async function enrichImage(item, source) {
  if (item.image || !item.url || !isAllowedSourceUrl(item.url, source)) return item;

  const { controller, timer } = (() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ARTICLE_FETCH_TIMEOUT);
    return { controller, timer };
  })();

  try {
    const response = await fetch(item.url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; UrbanEstateNews/3.0)',
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
  await mapWithConcurrency(limited, 5, async item => {
    const source = sources.find(s => s.id === item.sourceId);
    return source ? enrichImage(item, source) : item;
  });
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
    const rawItems = loaded.flatMap(x => x.items);

    // Direct RSS sources are validated immediately. Google News URLs are
    // temporarily retained so their opaque tokens can be resolved.
    let items = rawItems.filter(item => {
      const source = sources.find(s => s.id === item.sourceId);
      if (!source) return false;
      return isGoogleNewsUrl(item.url) || isAllowedSourceUrl(item.url, source);
    });

    const googleBySource = new Map();
    for (const source of sources) googleBySource.set(source.id, 0);
    for (const item of items) {
      if (isGoogleNewsUrl(item.url)) googleBySource.set(item.sourceId, (googleBySource.get(item.sourceId) || 0) + 1);
    }

    // Resolve only the newest N items per Google-backed source. This keeps the
    // endpoint within Vercel's execution budget while leaving enough material
    // for category filters and the 15-item API response.
    const googleItems = [];
    for (const source of sources) {
      const sourceItems = items
        .filter(item => item.sourceId === source.id && isGoogleNewsUrl(item.url))
        .sort((a, b) => {
          const da = a.published ? new Date(a.published).getTime() : 0;
          const db = b.published ? new Date(b.published).getTime() : 0;
          return db - da;
        })
        .slice(0, GOOGLE_RESOLVE_LIMIT_PER_SOURCE);
      googleItems.push(...sourceItems);
    }

    const resolvedGoogle = await mapWithConcurrency(googleItems, GOOGLE_CONCURRENCY, async item => {
      const resolved = await resolveGoogleNewsUrl(item.url);
      if (resolved && !isGoogleNewsUrl(resolved)) {
        item.url = resolved;
        item.googleResolved = true;
      }
      return item;
    });

    const resolvedIds = new Set(resolvedGoogle.filter(Boolean).map(item => item.id));
    const resolvedMap = new Map(resolvedGoogle.filter(Boolean).map(item => [item.id, item]));

    // Keep only successfully resolved Google items. Never expose news.google.com
    // as an article URL in the portal.
    items = items.filter(item => {
      if (isGoogleNewsUrl(item.url)) {
        if (!resolvedIds.has(item.id)) return false;
        const resolved = resolvedMap.get(item.id);
        if (resolved) item.url = resolved.url;
      }
      const source = sources.find(s => s.id === item.sourceId);
      return source && isAllowedSourceUrl(item.url, source);
    });

    items = items.filter(item => isRecent(item, days));
    items = dedupe(sortItems(items));

    if (requestedCategory !== 'all') {
      items = items.filter(item => Array.isArray(item.categories) && item.categories.includes(requestedCategory));
    }

    items = await enrichImages(items.slice(0, Math.max(limit * 2, 18)));
    items = sortItems(items).slice(0, limit);

    const sourceStatus = loaded.map(x => {
      const rawCount = x.items.length;
      const sourceFinalCount = items.filter(item => item.sourceId === x.source.id).length;
      const googleRawCount = x.items.filter(item => isGoogleNewsUrl(item.url)).length;
      const googleResolvedCount = x.items
        .filter(item => googleItems.some(g => g.id === item.id) && resolvedIds.has(item.id))
        .length;
      return {
        id: x.source.id,
        name: x.source.name,
        ok: !x.error,
        count: rawCount,
        finalCount: sourceFinalCount,
        googleItems: googleRawCount,
        googleResolved: googleResolvedCount,
        error: x.error || null
      };
    });

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

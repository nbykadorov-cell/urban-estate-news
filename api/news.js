const Parser = require('rss-parser');
const sources = require('../lib/sources');
const { isGoogleNewsUrl, resolveGoogleNewsUrl } = require('../lib/google-news');

const parser = new Parser({
  timeout: 10000,
  maxRedirects: 5,
  headers: {
    'User-Agent': 'UrbanEstateNews/4.0 (+https://urban-estate.ru)'
  }
});

const CATEGORY_RULES = {
  mortgage: [
    'ипотек', 'ставк', 'кредит', 'семейн', 'материнск', 'заем', 'заём',
    'банк', 'банков', 'ключев', 'рефинанс', 'эскроу', 'первоначальн',
    'кредитован', 'процентн', 'кредитн', 'заемщик', 'заёмщик'
  ],
  newbuild: [
    'новостро', 'застройщик', 'девелоп', 'жк ', 'жилой комплекс',
    'строительств', 'эскроу', 'дду', 'долев', 'нового дома', 'новом доме',
    'разрешени на строительств', 'жилых домов', 'жилых комплексов'
  ],
  law: [
    'закон', 'законодатель', 'правил', 'постанов', 'госдум', 'минстрой',
    'минфин', 'росреестр', 'налог', 'штраф', 'норм', 'регулирован',
    'вступил в силу', 'изменен', 'изменён', 'поправк', 'законопроект',
    'госуслуг', 'еgrн', 'егрн'
  ],
  estate: [
    'недвижим', 'жиль', 'квартир', 'аренд', 'рынок жилья', 'вторич',
    'дом ', 'участок', 'земел', 'апартамент', 'жилье', 'жильё',
    'продаж квартир', 'рынок недвижимости', 'собственник', 'покупател',
    'продавц', 'коммерческ', 'ипотечн'
  ]
};

const SOURCE_LIMIT = 20;
const GOOGLE_RESOLVE_LIMIT_PER_SOURCE = 8;
const GOOGLE_CONCURRENCY = 4;
const IMAGE_ENRICH_LIMIT = 24;
const IMAGE_CONCURRENCY = 5;
const ARTICLE_FETCH_TIMEOUT = 4500;

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
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sourceRegion(source) {
  return source.region || null;
}

function detectCategories(title, description, source) {
  const text = normalizeText(`${title} ${description}`);
  const result = new Set();

  // Regional sources are authoritative for the regional filter.
  if (source.region) result.add(source.region);

  for (const [category, words] of Object.entries(CATEGORY_RULES)) {
    if (words.some(word => text.includes(normalizeText(word)))) result.add(category);
  }

  // Every item from the real-estate editorial branches is relevant to the
  // general "Недвижимость" filter unless it is obviously unrelated.
  if (source.id !== 'domrf-news' || result.has('estate') || result.has('mortgage') || result.has('newbuild')) {
    if (!result.has('law') || /недвиж|жиль|квартир|ипотек|строитель|застройщик|росреестр|земел|участок|аренд/i.test(text)) {
      result.add('estate');
    }
  }

  return [...result];
}

function normalizeDate(item) {
  const raw = item.isoDate || item.pubDate || item.published || item.date;
  const date = raw ? new Date(raw) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

function absoluteUrl(raw, baseUrl) {
  if (!raw) return null;
  const value = String(raw).trim();
  if (!value) return null;
  try {
    return new URL(value, baseUrl || undefined).toString();
  } catch {
    return null;
  }
}

function normalizeImageUrl(raw, baseUrl) {
  if (!raw) return null;
  let value = String(raw).trim();
  if (!value) return null;

  value = value.replace(/^['"]|['"]$/g, '');
  value = value.replace(/\\\//g, '/');
  value = value.replace(/&amp;/gi, '&');

  // Some feeds return: https://hosthttps://host/path
  const duplicated = value.match(/^(https?:\/\/[^/]+)(https?:\/\/.*)$/i);
  if (duplicated) value = duplicated[2];

  return absoluteUrl(value, baseUrl);
}

function getImage(item, baseUrl) {
  const candidates = [];
  const push = v => {
    if (Array.isArray(v)) v.forEach(push);
    else if (v && typeof v === 'object') {
      push(v.url);
      push(v.href);
    } else if (typeof v === 'string') candidates.push(v);
  };

  push(item.enclosure);
  push(item['media:content']);
  push(item['media:thumbnail']);
  push(item.media?.content);
  push(item.media?.thumbnail);
  push(item.image);
  push(item.itunes?.image);

  for (const candidate of candidates) {
    const url = normalizeImageUrl(candidate, baseUrl);
    if (url) return url;
  }
  return null;
}

function normalizeItem(item, source) {
  const title = stripHtml(item.title || 'Без названия');
  const description = stripHtml(
    item.contentSnippet || item.content || item.summary || item.description || ''
  );
  const url = item.link || item.guid || source.homepage;

  return {
    id: `${source.id}:${item.guid || item.link || title}`,
    title,
    description: description.slice(0, 360),
    url,
    source: source.name,
    sourceId: source.id,
    sourceHome: source.homepage,
    published: normalizeDate(item),
    image: getImage(item, source.homepage),
    categories: detectCategories(title, description, source),
    priority: source.priority || 99
  };
}

function canonicalUrl(rawUrl = '') {
  try {
    const u = new URL(rawUrl);
    u.hash = '';
    [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'utm_id', 'gclid', 'fbclid', 'yclid', 'mc_cid', 'mc_eid', 'oc'
    ].forEach(k => u.searchParams.delete(k));
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
    const path = decodeURIComponent(u.pathname || '/').toLowerCase();
    const prefixes = source.allowedPathPrefixes || ['/'];
    return prefixes.some(prefix => path.startsWith(prefix.toLowerCase()));
  } catch {
    return false;
  }
}

function isClearlyNewsGoogleUrl(url) {
  return isGoogleNewsUrl(url);
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

function decodeHtml(value = '') {
  return String(value)
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/\\u002F/gi, '/')
    .replace(/\\\//g, '/');
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ARTICLE_FETCH_TIMEOUT);

  try {
    const response = await fetch(item.url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; UrbanEstateNews/4.0)',
        'Accept': 'text/html,application/xhtml+xml'
      }
    });
    if (!response.ok) return item;
    const html = await response.text();
    const image = extractMeta(html, [
      'og:image', 'og:image:url', 'twitter:image', 'twitter:image:src'
    ]);
    const normalized = normalizeImageUrl(image, item.url);
    if (normalized) item.image = normalized;
    return item;
  } catch {
    return item;
  } finally {
    clearTimeout(timer);
  }
}

async function enrichImages(items) {
  const candidates = items
    .filter(item => !item.image)
    .slice(0, IMAGE_ENRICH_LIMIT);

  await mapWithConcurrency(candidates, IMAGE_CONCURRENCY, async item => {
    const source = sources.find(s => s.id === item.sourceId);
    if (source) await enrichImage(item, source);
    return item;
  });
  return items;
}

async function loadSource(source) {
  try {
    const feed = await parser.parseURL(source.feed);
    const items = (feed.items || [])
      .slice(0, SOURCE_LIMIT)
      .map(item => normalizeItem(item, source));
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

function categoryFilter(items, category) {
  if (category === 'all') return items;
  return items.filter(item => Array.isArray(item.categories) && item.categories.includes(category));
}

async function resolveGoogleCandidates(items) {
  const grouped = new Map(sources.map(s => [s.id, []]));
  for (const item of items) {
    if (isClearlyNewsGoogleUrl(item.url)) {
      const list = grouped.get(item.sourceId);
      if (list) list.push(item);
    }
  }

  const candidates = [];
  for (const source of sources) {
    const list = (grouped.get(source.id) || []).sort((a, b) => {
      const da = a.published ? new Date(a.published).getTime() : 0;
      const db = b.published ? new Date(b.published).getTime() : 0;
      return db - da;
    });
    candidates.push(...list.slice(0, GOOGLE_RESOLVE_LIMIT_PER_SOURCE));
  }

  const resolved = await mapWithConcurrency(candidates, GOOGLE_CONCURRENCY, async item => {
    const url = await resolveGoogleNewsUrl(item.url);
    if (!url || isGoogleNewsUrl(url)) return null;
    const source = sources.find(s => s.id === item.sourceId);
    if (!source || !isAllowedSourceUrl(url, source)) return null;
    item.url = url;
    item.googleResolved = true;
    return item;
  });

  return {
    candidates,
    resolved: resolved.filter(Boolean)
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=300');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const requestedCategory = String(req.query?.category || 'all').toLowerCase();
    const limit = Math.min(Math.max(Number(req.query?.limit || 15), 1), 50);
    const days = Math.min(Math.max(Number(req.query?.days || 7), 1), 30);

    const loaded = await Promise.all(sources.map(loadSource));
    const rawItems = loaded.flatMap(x => x.items);

    // Filter out stale direct-RSS items early. Google items are retained until
    // their real publisher URL is resolved.
    let items = rawItems.filter(item => {
      const source = sources.find(s => s.id === item.sourceId);
      if (!source) return false;
      if (!isRecent(item, days)) return false;
      return isGoogleNewsUrl(item.url) || isAllowedSourceUrl(item.url, source);
    });

    // Category filtering is performed BEFORE Google URL resolution. This is
    // important: regional sources and topical filters now use the actual item
    // metadata instead of returning the same first 15 articles for every tab.
    items = categoryFilter(items, requestedCategory);

    const { candidates, resolved } = await resolveGoogleCandidates(items);
    const resolvedMap = new Map(resolved.map(item => [item.id, item]));

    items = items.filter(item => {
      if (!isGoogleNewsUrl(item.url)) return true;
      return resolvedMap.has(item.id);
    });

    // Replace Google wrapper URLs with the actual publisher URLs.
    items = items.map(item => resolvedMap.get(item.id) || item);
    items = items.filter(item => {
      const source = sources.find(s => s.id === item.sourceId);
      return source && isAllowedSourceUrl(item.url, source);
    });

    items = dedupe(sortItems(items));

    // Enrich enough candidates before taking the final 15 so cards have a
    // realistic chance of receiving images even when the newest item has one.
    items = await enrichImages(items.slice(0, Math.max(limit * 3, IMAGE_ENRICH_LIMIT)));
    items = sortItems(items).slice(0, limit);

    const sourceStatus = loaded.map(x => {
      const rawCount = x.items.length;
      const rawGoogle = x.items.filter(item => isGoogleNewsUrl(item.url));
      const categoryRaw = categoryFilter(x.items.filter(item => isRecent(item, days)), requestedCategory);
      const candidateCount = candidates.filter(item => item.sourceId === x.source.id).length;
      const resolvedCount = resolved.filter(item => item.sourceId === x.source.id).length;
      const finalCount = items.filter(item => item.sourceId === x.source.id).length;
      const imagesCount = items.filter(item => item.sourceId === x.source.id && item.image).length;

      return {
        id: x.source.id,
        name: x.source.name,
        ok: !x.error,
        count: rawCount,
        categoryCount: categoryRaw.length,
        googleItems: rawGoogle.length,
        googleCandidates: candidateCount,
        googleResolved: resolvedCount,
        finalCount,
        images: imagesCount,
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
    return res.status(500).json({
      ok: false,
      error: error.message || 'Internal Server Error'
    });
  }
};

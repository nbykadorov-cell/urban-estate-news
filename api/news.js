const Parser = require('rss-parser');
const sources = require('../lib/sources');

const parser = new Parser({
  timeout: 10000,
  maxRedirects: 5,
  headers: {
    'User-Agent': 'UrbanEstateNews/6.0 (+https://urban-estate.ru)'
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

const SOURCE_LIMIT = 30;
const HTML_FETCH_TIMEOUT = 10000;
const ARTICLE_FETCH_TIMEOUT = 5000;
const IMAGE_ENRICH_LIMIT = 30;
const IMAGE_CONCURRENCY = 5;

const MONTHS = {
  января: 0, февраля: 1, марта: 2, апреля: 3, мая: 4, июня: 5,
  июля: 6, августа: 7, сентября: 8, октября: 9, ноября: 10, декабря: 11
};

function stripHtml(value = '') {
  return decodeHtml(String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtml(value = '') {
  return String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function normalizeText(value = '') {
  return stripHtml(value)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function absoluteUrl(raw, baseUrl) {
  if (!raw) return null;
  try {
    return new URL(String(raw).trim(), baseUrl).toString();
  } catch {
    return null;
  }
}

function normalizeImageUrl(raw, baseUrl) {
  if (!raw) return null;
  let value = decodeHtml(String(raw).trim()).replace(/\\\//g, '/');
  const duplicated = value.match(/^(https?:\/\/[^/]+)(https?:\/\/.*)$/i);
  if (duplicated) value = duplicated[2];
  return absoluteUrl(value, baseUrl);
}

function sourceRegion(source) {
  return source.region || null;
}

function detectCategories(title, description, source) {
  const text = normalizeText(`${title} ${description}`);
  const result = new Set();
  if (source.region) result.add(source.region);

  for (const [category, words] of Object.entries(CATEGORY_RULES)) {
    if (words.some(word => text.includes(normalizeText(word)))) result.add(category);
  }

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

function parseRussianDate(text = '') {
  const value = stripHtml(text).replace(/\u00a0/g, ' ').trim();
  const now = new Date();

  let m = value.match(/(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s*,?\s*(\d{4})(?:\s*,?\s*(\d{1,2}):(\d{2}))?/i);
  if (m) {
    const d = new Date(Number(m[3]), MONTHS[m[2].toLowerCase()], Number(m[1]), Number(m[4] || 12), Number(m[5] || 0));
    return d.toISOString();
  }

  m = value.match(/(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/i);
  if (m) {
    const d = new Date(Number(m[3]), MONTHS[m[2].toLowerCase()], Number(m[1]), Number(m[4] || 12), Number(m[5] || 0));
    return d.toISOString();
  }

  m = value.match(/(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:,)?\s*(\d{1,2}):(\d{2})/i);
  if (m) {
    const month = MONTHS[m[2].toLowerCase()];
    let year = now.getFullYear();
    const d = new Date(year, month, Number(m[1]), Number(m[3]), Number(m[4]));
    if (d.getTime() > Date.now() + 2 * 86400000) d.setFullYear(year - 1);
    return d.toISOString();
  }

  if (/сегодня/i.test(value)) {
    m = value.match(/сегодня\s+(\d{1,2}):(\d{2})/i);
    const d = new Date();
    if (m) d.setHours(Number(m[1]), Number(m[2]), 0, 0);
    return d.toISOString();
  }

  if (/вчера/i.test(value)) {
    m = value.match(/вчера\s+(\d{1,2}):(\d{2})/i);
    const d = new Date(Date.now() - 86400000);
    if (m) d.setHours(Number(m[1]), Number(m[2]), 0, 0);
    return d.toISOString();
  }

  return null;
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

function extractJsonLdArticles(html, source) {
  const result = [];
  const blocks = String(html).match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];

  for (const block of blocks) {
    const raw = block.replace(/^.*?>/s, '').replace(/<\/script>.*$/is, '').trim();
    try {
      const data = JSON.parse(raw);
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        if (!node || typeof node !== 'object') continue;
        const graph = Array.isArray(node['@graph']) ? node['@graph'] : [node];
        for (const x of graph) {
          const type = Array.isArray(x?.['@type']) ? x['@type'].join(' ') : String(x?.['@type'] || '');
          if (!/article|newsarticle|blogposting/i.test(type)) continue;
          const url = absoluteUrl(x.url || x.mainEntityOfPage?.['@id'] || x.mainEntityOfPage, source.feed);
          if (!url || !isAllowedSourceUrl(url, source)) continue;
          const title = stripHtml(x.headline || x.name || '');
          if (title.length < 15) continue;
          result.push({
            title,
            description: stripHtml(x.description || ''),
            url,
            published: x.datePublished ? new Date(x.datePublished).toISOString() : null,
            image: normalizeImageUrl(Array.isArray(x.image) ? x.image[0] : (typeof x.image === 'object' ? x.image?.url : x.image), url)
          });
        }
      }
    } catch {}
  }
  return result;
}

function looksLikeArticleUrl(url, source) {
  if (!isAllowedSourceUrl(url, source)) return false;
  const path = new URL(url).pathname;
  if (source.id === 'krasdom') return /^\/news\/\d+\/?$/i.test(path);
  if (source.id === '93ru' || source.id === '161ru') return /^\/text\/realty\/\d{4}\/\d{2}\/\d{2}\/\d+\/?$/i.test(path);
  if (source.id === 'cian-news') return /^\/magazine\/[^/?#]+/i.test(path) && !/\/magazine\/$/i.test(path);
  if (source.id === 'domclick-news') return /^\/novosti\/[^/?#]+/i.test(path) && !/\/novosti\/?$/i.test(path);
  if (source.id === 'yandex-news') return /^\/journal\/(news|[^/]+)\/[^/?#]+/i.test(path);
  return false;
}

function extractAnchors(html, source) {
  const result = [];
  const re = /<a\b([^>]*?)href\s*=\s*(["'])(.*?)\2([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;

  while ((m = re.exec(html))) {
    const href = decodeHtml(m[3]);
    const url = absoluteUrl(href, source.feed);
    if (!url || !looksLikeArticleUrl(url, source)) continue;

    const title = stripHtml(m[5]);
    if (title.length < 15 || title.length > 300) continue;
    if (/^(читать|далее|подробнее|все новости|новости|статьи|блоги)$/i.test(title)) continue;

    const start = Math.max(0, m.index - 1400);
    const end = Math.min(html.length, re.lastIndex + 1400);
    const context = stripHtml(html.slice(start, end));
    const published = parseRussianDate(context);

    result.push({ title, description: '', url, published, image: null });
  }
  return result;
}

function extractPageArticles(html, source) {
  const json = extractJsonLdArticles(html, source);
  const anchors = extractAnchors(html, source);
  const all = [...json, ...anchors];
  const seen = new Set();
  const result = [];

  for (const item of all) {
    const key = canonicalUrl(item.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result.slice(0, SOURCE_LIMIT);
}

function canonicalUrl(rawUrl = '') {
  try {
    const u = new URL(rawUrl);
    u.hash = '';
    ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','utm_id','gclid','fbclid','yclid'].forEach(k => u.searchParams.delete(k));
    return u.toString().replace(/\/$/, '').toLowerCase();
  } catch { return String(rawUrl).replace(/\/$/, '').toLowerCase(); }
}

function normalizeItem(item, source) {
  const title = stripHtml(item.title || 'Без названия');
  const description = stripHtml(item.description || item.contentSnippet || item.content || item.summary || '');
  const url = item.url || item.link || source.homepage;
  return {
    id: `${source.id}:${canonicalUrl(url) || title}`,
    title,
    description: description.slice(0, 360),
    url,
    source: source.name,
    sourceId: source.id,
    sourceHome: source.homepage,
    published: item.published || null,
    image: normalizeImageUrl(item.image, url),
    categories: detectCategories(title, description, source),
    priority: source.priority || 99
  };
}

function isAllowedSourceUrl(url, source) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const hosts = (source.allowedHosts || []).map(x => x.toLowerCase());
    if (!hosts.includes(host)) return false;
    const path = decodeURIComponent(u.pathname || '/').toLowerCase();
    return (source.allowedPathPrefixes || ['/']).some(prefix => path.startsWith(prefix.toLowerCase()));
  } catch { return false; }
}

function titleKey(title = '') {
  return normalizeText(title)
    .replace(/\b(новости|новость|рынок|недвижимости|недвижимость)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupe(items) {
  const urls = new Set();
  const titles = new Set();
  return items.filter(item => {
    const u = canonicalUrl(item.url);
    const t = titleKey(item.title);
    if (u && urls.has(u)) return false;
    if (t && titles.has(t)) return false;
    if (u) urls.add(u);
    if (t) titles.add(t);
    return true;
  });
}

function isRecent(item, days) {
  if (!item.published) return true;
  const t = new Date(item.published).getTime();
  return Number.isNaN(t) || Date.now() - t <= days * 86400000;
}

function categoryFilter(items, category) {
  return category === 'all' ? items : items.filter(item => item.categories.includes(category));
}

function sortItems(items) {
  return items.sort((a, b) => {
    const da = a.published ? new Date(a.published).getTime() : 0;
    const db = b.published ? new Date(b.published).getTime() : 0;
    if (db !== da) return db - da;
    return (a.priority || 99) - (b.priority || 99);
  });
}

function mapWithConcurrency(items, concurrency, worker) {
  const result = new Array(items.length);
  let next = 0;
  async function runner() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      try { result[i] = await worker(items[i], i); } catch { result[i] = null; }
    }
  }
  return Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runner)).then(() => result);
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTML_FETCH_TIMEOUT);
  try {
    const response = await fetch(url, {
      redirect: 'follow', signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36 UrbanEstateNews/6.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8'
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { html: await response.text(), finalUrl: response.url || url };
  } finally { clearTimeout(timer); }
}

async function loadSource(source) {
  try {
    if (source.type === 'direct-rss') {
      const feed = await parser.parseURL(source.feed);
      const items = (feed.items || []).slice(0, SOURCE_LIMIT).map(item => {
        const image = item.enclosure?.url || item['media:content']?.url || item['media:thumbnail']?.url || null;
        return normalizeItem({
          title: item.title,
          description: item.contentSnippet || item.content || item.description,
          url: item.link || item.guid,
          published: normalizeDate(item),
          image
        }, source);
      });
      return { source, items, error: null, mode: 'rss' };
    }

    const page = await fetchHtml(source.feed);
    const finalSourceUrl = page.finalUrl || source.feed;
    if (!isAllowedSourceUrl(finalSourceUrl, { ...source, allowedPathPrefixes: ['/'] })) {
      // A redirect to a canonical homepage is acceptable as long as the host is right.
      const redirected = new URL(finalSourceUrl);
      if (!source.allowedHosts.includes(redirected.hostname.toLowerCase())) throw new Error('Unexpected redirect host');
    }
    const parsed = extractPageArticles(page.html, source);
    const items = parsed.map(item => normalizeItem(item, source));
    return { source, items, error: null, mode: 'html' };
  } catch (error) {
    return { source, items: [], error: error.message || 'Source fetch error', mode: source.type };
  }
}

async function enrichImage(item, source) {
  if (item.image || !item.url || !isAllowedSourceUrl(item.url, source)) return item;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ARTICLE_FETCH_TIMEOUT);
  try {
    const response = await fetch(item.url, {
      redirect: 'follow', signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36 UrbanEstateNews/6.0',
        'Accept': 'text/html,application/xhtml+xml'
      }
    });
    if (!response.ok) return item;
    const html = await response.text();
    const image = extractMeta(html, ['og:image', 'og:image:url', 'twitter:image', 'twitter:image:src']);
    if (image) item.image = normalizeImageUrl(image, item.url);
    return item;
  } catch { return item; }
  finally { clearTimeout(timer); }
}

async function enrichImages(items) {
  const candidates = items.filter(x => !x.image).slice(0, IMAGE_ENRICH_LIMIT);
  await mapWithConcurrency(candidates, IMAGE_CONCURRENCY, async item => {
    const source = sources.find(s => s.id === item.sourceId);
    if (source) await enrichImage(item, source);
    return item;
  });
  return items;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const requestedCategory = String(req.query?.category || 'all').toLowerCase();
    const limit = Math.min(Math.max(Number(req.query?.limit || 15), 1), 50);
    const days = Math.min(Math.max(Number(req.query?.days || 7), 1), 30);

    const loaded = await Promise.all(sources.map(loadSource));
    let items = loaded.flatMap(x => x.items)
      .filter(item => {
        const source = sources.find(s => s.id === item.sourceId);
        return source && isAllowedSourceUrl(item.url, source) && isRecent(item, days);
      });

    items = categoryFilter(items, requestedCategory);
    items = dedupe(sortItems(items));
    items = await enrichImages(items.slice(0, Math.max(limit * 3, IMAGE_ENRICH_LIMIT)));
    items = sortItems(items).slice(0, limit);

    const sourceStatus = loaded.map(x => ({
      id: x.source.id,
      name: x.source.name,
      type: x.mode,
      ok: !x.error,
      count: x.items.length,
      categoryCount: categoryFilter(x.items.filter(item => isRecent(item, days)), requestedCategory).length,
      finalCount: items.filter(item => item.sourceId === x.source.id).length,
      images: items.filter(item => item.sourceId === x.source.id && item.image).length,
      error: x.error || null
    }));

    return res.status(200).json({
      ok: true,
      version: '6.0.0',
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

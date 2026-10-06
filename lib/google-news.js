/**
 * Google News RSS article URL resolver — v5.
 *
 * Google News now serves RSS article links as opaque tokens. A plain HTTP
 * redirect is not reliable. The stable flow is:
 *   1) GET the Google News article page;
 *   2) read data-n-a-id / data-n-a-sg / data-n-a-ts;
 *   3) call DotsSplashUi/batchexecute with those parameters;
 *   4) extract garturlres — the publisher URL.
 *
 * The resolver is intentionally dependency-free.
 */

const GOOGLE_ARTICLE_RE = /^https?:\/\/(?:www\.)?news\.google\.com\/(?:rss\/)?articles\/([^/?#]+)/i;
const GOOGLE_RSS_ARTICLE_RE = /^https?:\/\/(?:www\.)?news\.google\.com\/rss\/articles\//i;
const RESOLVE_TIMEOUT = 7000;

function isGoogleNewsUrl(url = '') {
  return GOOGLE_RSS_ARTICLE_RE.test(String(url));
}

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, timer };
}

function decodeEscaped(value = '') {
  return String(value)
    .replace(/\\u003d/gi, '=')
    .replace(/\\u0026/gi, '&')
    .replace(/\\u002F/gi, '/')
    .replace(/\\\//g, '/')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"');
}

function extractGoogleParams(html, token) {
  const source = String(html || '');

  // Preferred: the exact div Google creates for the article token.
  const tokenEscaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const exact = new RegExp(
    `<div[^>]*data-n-a-id=["']${tokenEscaped}["'][^>]*>`,
    'i'
  ).exec(source);

  const block = exact ? exact[0] : source;

  const signature =
    /data-n-a-sg=["']([^"']+)["']/i.exec(block)?.[1] ||
    /data-n-a-sg=([^\\s>]+)/i.exec(block)?.[1] ||
    null;

  const timestamp =
    /data-n-a-ts=["']([^"']+)["']/i.exec(block)?.[1] ||
    /data-n-a-ts=([^\\s>]+)/i.exec(block)?.[1] ||
    null;

  if (!signature || !timestamp) return null;

  return {
    id: token,
    signature: decodeEscaped(signature),
    timestamp: String(timestamp).replace(/[^\d.-]/g, '')
  };
}

function extractGartUrl(responseText) {
  const text = String(responseText || '');

  // Current response format.
  const marker = '[\\"garturlres\\",\\"';
  const start = text.indexOf(marker);

  if (start >= 0) {
    const rest = text.slice(start + marker.length);
    const end = rest.indexOf('\\",');
    if (end >= 0) {
      const url = decodeEscaped(rest.slice(0, end));
      if (/^https?:\/\//i.test(url)) return url;
    }
  }

  // More tolerant fallback: parse a JSON-looking escaped string.
  const matches = text.match(/garturlres.{0,2000}/g) || [];
  for (const chunk of matches) {
    const m = chunk.match(/garturlres[^\"]*\\?"(?:,)?\\?"(https?:[^"\\]+)/i);
    if (m && m[1]) return decodeEscaped(m[1]);
  }

  return null;
}

async function getGoogleArticleParams(sourceUrl, token) {
  const { controller, timer } = withTimeout(RESOLVE_TIMEOUT);

  try {
    const articlePageUrl = `https://news.google.com/articles/${token}`;
    const response = await fetch(articlePageUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8'
      }
    });

    if (!response.ok) return null;

    const finalUrl = response.url || sourceUrl;
    if (!isGoogleNewsUrl(finalUrl)) {
      // In case Google itself performed the redirect.
      return /^https?:\/\//i.test(finalUrl) ? { directUrl: finalUrl } : null;
    }

    const html = await response.text();
    return extractGoogleParams(html, token);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveCurrentGoogleUrl(params) {
  if (!params || params.directUrl) return params?.directUrl || null;

  const requestArray = [
    'Fbv4je',
    `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${params.id}",${params.timestamp},"${params.signature}"]`
  ];

  const body = `f.req=${encodeURIComponent(JSON.stringify([[requestArray]]))}`;
  const { controller, timer } = withTimeout(RESOLVE_TIMEOUT);

  try {
    const response = await fetch(
      'https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je',
      {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'Referer': 'https://news.google.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36'
        },
        body
      }
    );

    if (!response.ok) return null;
    return extractGartUrl(await response.text());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveGoogleNewsUrl(sourceUrl) {
  if (!isGoogleNewsUrl(sourceUrl)) return sourceUrl;

  const match = String(sourceUrl).match(GOOGLE_ARTICLE_RE);
  if (!match) return null;

  const token = match[1];

  const params = await getGoogleArticleParams(sourceUrl, token);
  if (!params) return null;

  if (params.directUrl) return params.directUrl;

  return resolveCurrentGoogleUrl(params);
}

module.exports = {
  isGoogleNewsUrl,
  resolveGoogleNewsUrl
};

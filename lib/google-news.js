/**
 * Google News RSS article URL resolver.
 *
 * Since 2024 many Google News RSS article URLs use an opaque token such as
 * /rss/articles/CBMi... . A normal HTTP redirect is not enough to resolve it.
 * The current format can be resolved through Google's internal batchexecute
 * endpoint. Older tokens can sometimes be decoded locally first.
 *
 * This implementation intentionally keeps the resolver dependency-free.
 */

const GOOGLE_ARTICLE_RE = /^https?:\/\/(?:www\.)?news\.google\.com\/(?:rss\/)?articles\/([^/?#]+)/i;
const GOOGLE_RSS_ARTICLE_RE = /^https?:\/\/(?:www\.)?news\.google\.com\/rss\/articles\//i;
const RESOLVE_TIMEOUT = 4500;

function isGoogleNewsUrl(url = '') {
  return GOOGLE_RSS_ARTICLE_RE.test(String(url));
}

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, timer };
}

function base64UrlDecodeLatin1(value) {
  let s = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64').toString('latin1');
}

function tryDecodeLegacyGoogleUrl(sourceUrl) {
  const match = String(sourceUrl).match(GOOGLE_ARTICLE_RE);
  if (!match) return null;

  try {
    const token = match[1];
    let decoded = base64UrlDecodeLatin1(token);
    const prefix = Buffer.from([0x08, 0x13, 0x22]).toString('latin1');
    const suffix = Buffer.from([0xd2, 0x01, 0x00]).toString('latin1');

    if (decoded.startsWith(prefix)) decoded = decoded.slice(prefix.length);
    if (decoded.endsWith(suffix)) decoded = decoded.slice(0, -suffix.length);

    const bytes = Buffer.from(decoded, 'latin1');
    if (!bytes.length) return null;

    const first = bytes[0];
    let length;
    let offset;
    if (first >= 0x80 && bytes.length >= 2) {
      length = ((first & 0x7f) | (bytes[1] << 7));
      offset = 2;
    } else {
      length = first;
      offset = 1;
    }

    if (!length || offset + length > bytes.length) return null;
    const candidate = bytes.subarray(offset, offset + length).toString('utf8');

    if (/^https?:\/\//i.test(candidate) && !candidate.startsWith('AU_yqL')) {
      return candidate;
    }
  } catch (_) {
    // Fall through to Google's current resolver.
  }

  return null;
}

async function resolveCurrentGoogleUrl(token) {
  const payload =
    '[[["Fbv4je","[\\"garturlreq\\",[[\\"en-US\\",\\"US\\",[\\"FINANCE_TOP_INDICES\\",\\"WEB_TEST_1_0_0\\"],null,null,1,1,\\"US:en\\",null,180,null,null,null,null,null,0,null,null,[1608992183,723341000]],\\"en-US\\",\\"US\\",1,[2,3,4,8],1,0,\\"655000234\\",0,0,null,0],\\"' +
    token +
    '\\"]",null,"generic"]]]';

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
          'User-Agent': 'Mozilla/5.0 (compatible; UrbanEstateNews/4.0)'
        },
        body: `f.req=${encodeURIComponent(payload)}`
      }
    );

    if (!response.ok) return null;
    const text = await response.text();

    const header = '[\\"garturlres\\",\\"';
    const footer = '\\",';
    const startIndex = text.indexOf(header);
    if (startIndex === -1) return null;

    const start = text.slice(startIndex + header.length);
    const endIndex = start.indexOf(footer);
    if (endIndex === -1) return null;

    let url = start.slice(0, endIndex);
    url = url
      .replace(/\\u003d/g, '=')
      .replace(/\\u0026/g, '&')
      .replace(/\\u002F/gi, '/')
      .replace(/\\\//g, '/');

    if (/^https?:\/\//i.test(url)) return url;
    return null;
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveGoogleNewsUrl(sourceUrl) {
  if (!isGoogleNewsUrl(sourceUrl)) return sourceUrl;

  const legacy = tryDecodeLegacyGoogleUrl(sourceUrl);
  if (legacy) return legacy;

  const match = String(sourceUrl).match(GOOGLE_ARTICLE_RE);
  if (!match) return null;

  return resolveCurrentGoogleUrl(match[1]);
}

module.exports = {
  isGoogleNewsUrl,
  resolveGoogleNewsUrl
};

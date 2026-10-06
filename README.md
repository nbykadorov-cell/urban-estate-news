# Urban Estate News API v3

Backend API for Urban Estate Workspace / Tilda.

## What was fixed in v3

1. Google News RSS links are no longer treated as normal HTTP redirects.
2. Current Google News `/rss/articles/CBMi...` tokens are resolved through Google's `batchexecute` endpoint.
3. Legacy Google News article tokens are decoded locally when possible.
4. `news.google.com` URLs are never returned to Tilda as article URLs.
5. DОМ.РФ punycode host is corrected to:
   `xn--h1alcedd.xn--d1aqf.xn--p1ai`
6. Yandex News feed uses the `/journal/category/news/` branch, while article URLs are allowed under `/journal/` because individual articles do not keep `/category/news/` in their URL.
7. Article `og:image`, `twitter:image` and `og:image:url` are fetched server-side when the RSS item does not contain an image.
8. API returns diagnostic fields for every source: `count`, `finalCount`, `googleItems`, `googleResolved`, `error`.
9. The endpoint remains limited to the seven configured source branches.

## Project structure

```text
urban-estate-news-api/
├── api/
│   └── news.js
├── lib/
│   ├── google-news.js
│   └── sources.js
├── package.json
├── vercel.json
└── README.md
```

## Deploy to Vercel

### If the project already exists

Replace the files in the existing Vercel project with the contents of this ZIP and deploy again.

No environment variables are required.

### API URL

```text
https://urban-estate-news.vercel.app/api/news
```

## Test URLs

All news:

```text
https://urban-estate-news.vercel.app/api/news
```

Mortgage:

```text
https://urban-estate-news.vercel.app/api/news?category=mortgage&limit=15&days=7
```

Krasnodar:

```text
https://urban-estate-news.vercel.app/api/news?category=krasnodar&limit=15&days=7
```

Rostov:

```text
https://urban-estate-news.vercel.app/api/news?category=rostov&limit=15&days=7
```

## Expected diagnostic response

For Google-backed sources you should see something like:

```json
{
  "id": "93ru",
  "name": "93.RU",
  "ok": true,
  "count": 20,
  "finalCount": 5,
  "googleItems": 20,
  "googleResolved": 8,
  "error": null
}
```

`googleResolved` can be lower than `googleItems` because Google can rate-limit or temporarily reject URL-resolution requests.

## Important

Google's `batchexecute` endpoint is an internal, undocumented interface and can change or rate-limit requests. The API therefore resolves only the newest 8 Google News items per configured source per request and uses concurrency 4 to stay within the Vercel execution budget.

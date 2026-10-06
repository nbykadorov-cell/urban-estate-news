# Urban Estate News API 4.0

Backend for the live news section of Urban Estate Workspace / Tilda.

## What changed in v4

1. Google News RSS is still used only as a transport layer. The API resolves Google article URLs to the publisher's real URL before returning them.
2. Category detection was rewritten. Source-wide categories are no longer assigned to every article, so the same DOM.RF articles no longer appear in every topical tab.
3. Regional categories are source-aware:
   - Krasnodar: КРАСДОМ, 93.RU, CIAN
   - Rostov: 161.RU
4. Image URLs from RSS are normalized, including malformed values such as `https://hosthttps://host/path`.
5. Missing images are fetched from article `og:image` / Twitter image metadata.
6. CIAN and Krasdom use their current public article branches for filtering:
   - Krasdom: `/news/`
   - CIAN: `/magazine/`
   The user-facing home links remain the requested news pages.
7. The API reports per-source diagnostics: raw count, category count, Google candidates, resolved Google items, final count, and image count.
8. Category filtering happens before Google URL resolution, which prevents the `all` feed from consuming the entire resolver budget and leaving regional/topic tabs empty.

## Files

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

Replace the files in the existing `urban-estate-news` project with these files and deploy/redeploy.

No environment variables are required.

## API

```text
https://urban-estate-news.vercel.app/api/news
https://urban-estate-news.vercel.app/api/news?category=mortgage
https://urban-estate-news.vercel.app/api/news?category=newbuild
https://urban-estate-news.vercel.app/api/news?category=law
https://urban-estate-news.vercel.app/api/news?category=krasnodar
https://urban-estate-news.vercel.app/api/news?category=rostov
```

Supported categories:

- `all`
- `mortgage`
- `estate`
- `newbuild`
- `law`
- `krasnodar`
- `rostov`

Optional parameters:

- `limit=15` (1–50)
- `days=7` (1–30)

## Expected diagnostics

For Google-backed sources you should see values such as:

```json
{
  "googleItems": 20,
  "googleCandidates": 8,
  "googleResolved": 8,
  "finalCount": 3,
  "images": 3
}
```

The exact values vary with the current news feed.

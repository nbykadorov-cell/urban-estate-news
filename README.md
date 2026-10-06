# Urban Estate News API — Stage 1.1

Backend for the Urban Estate Workspace news dashboard in Tilda.

## What changed in 1.1

- Google News RSS article links are resolved to the original publisher URL when possible.
- Duplicate articles are removed using canonical URLs and normalized titles.
- Common tracking parameters are removed before URL de-duplication.
- Source loading is limited to 20 articles per source to keep the feed diverse.
- `sourceHome` is included in every item.
- `image` is extracted from common RSS media fields when the source provides one.
- Minfin has a Google News fallback if its direct RSS endpoint temporarily returns an error.
- Added 161.RU for the Rostov news category.
- API response now includes the requested `category`.
- Node.js is pinned to 24.x, the current Vercel-supported LTS line for Functions.

## Endpoints

- `/api/news`
- `/api/news?limit=40`
- `/api/news?category=mortgage`
- `/api/news?category=estate`
- `/api/news?category=newbuild`
- `/api/news?category=law`
- `/api/news?category=krasnodar`
- `/api/news?category=rostov`

`limit` is clamped to 1–100.

## Response

Each item contains:

- `id`
- `title`
- `description`
- `url` — original publisher URL when Google News resolution succeeds
- `source`
- `sourceId`
- `sourceHome`
- `published`
- `image`
- `categories`

The API only aggregates article metadata. It does not republish full article text.

## Deploy

Deploy the project as a Vercel Functions project. No environment variables are required.

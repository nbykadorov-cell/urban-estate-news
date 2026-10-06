# Urban Estate News API v5

## What changed

v5 fixes the main issue in v4: Google News RSS article URLs were being discarded because the old resolver called the `batchexecute` endpoint without first obtaining Google's per-article signature and timestamp.

The resolver now follows the current flow:

1. GET `https://news.google.com/articles/<token>`
2. Extract `data-n-a-id`, `data-n-a-sg`, and `data-n-a-ts`
3. POST those values to Google's `Fbv4je` / `garturlreq` endpoint
4. Extract `garturlres`
5. Validate the resolved publisher URL against the configured source

This is important for:
- Домклик
- КРАСДОМ
- 93.RU
- ЦИАН
- Яндекс Недвижимость
- 161.RU

ДОМ.РФ continues to use its direct RSS feed.

## Category behavior

Categories are determined before Google URL resolution, so regional filters do not depend on the resolver.

- `krasdom`, `93ru`, `cian-news` -> `krasnodar`
- `161ru` -> `rostov`
- topical categories are detected from title/description
- an article may have more than one topical category

## Endpoints

- `/api/news`
- `/api/news?category=estate`
- `/api/news?category=mortgage`
- `/api/news?category=newbuild`
- `/api/news?category=law`
- `/api/news?category=krasnodar`
- `/api/news?category=rostov`

Optional:
- `limit` 1..50
- `days` 1..30

## Deployment

Replace the files in the existing Vercel project and redeploy.

No environment variables are required.

Tilda does not need a code change for v5. The existing portal requests the same endpoint and category parameters.

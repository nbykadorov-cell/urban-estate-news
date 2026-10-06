# Urban Estate News API — Stage 1

Serverless API for the Urban Estate Tilda portal.

## Deploy

1. Create/import this project in Vercel.
2. Deploy without environment variables.
3. Open `/api/news?limit=40`.
4. Optional filters: `/api/news?category=mortgage`, `newbuild`, `law`, `krasnodar`, `rostov`, `estate`.

## Sources

Direct RSS is used where a public feed was verified. For sources where a stable public RSS/API was not verified, the project uses Google News RSS restricted to the publisher's domain. The returned links point to the original publisher pages.

## Important

The API only aggregates metadata (title, short description, publication date, image when supplied, original URL). It does not republish full article text.

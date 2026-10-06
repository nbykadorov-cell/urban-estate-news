# Urban Estate News API v8

This version uses the current Vercel Node.js Web Handler format (`export default`) and ESM (`type: module`). No npm dependencies are required. Sources are embedded directly in `api/news.js` to eliminate module-resolution/runtime ambiguity.

Tilda URL remains unchanged:
https://urban-estate-news.vercel.app/api/news

Test:
/api/news?category=rostov&limit=15&days=7
/api/news?category=krasnodar&limit=15&days=7
/api/news?category=all&limit=15&days=7

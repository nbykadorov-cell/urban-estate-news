# Urban Estate News API v6

## What changed

v6 removes Google News RSS as the primary transport. The previous versions successfully found regional articles in Google RSS, but the Google article URL resolver returned `googleResolved: 0` on Vercel, so every non-DOM.RF article was discarded.

v6 reads the public pages of the approved sources directly:

- Домклик — `https://blog.domclick.ru/novosti`
- ДОМ.РФ — direct RSS
- КРАСДОМ — `https://krasdom.ru/news/`
- 93.RU — `https://93.ru/text/realty/`
- ЦИАН — `https://krasnodar.cian.ru/magazine/`
- Яндекс Недвижимость — `https://realty.yandex.ru/journal/category/news/`
- 161.RU — `https://161.ru/text/realty/`

Regional mapping is assigned from the source itself:
- КРАСДОМ / 93.RU / ЦИАН → `krasnodar`
- 161.RU → `rostov`

This means `krasnodar` and `rostov` no longer depend on Google URL decoding.

## Deploy

Replace the files in the existing Vercel project with this archive and redeploy. Tilda does not need a code change: it already calls the same `/api/news` endpoint.

## Test

- `/api/news?category=all&limit=15&days=7`
- `/api/news?category=krasnodar&limit=15&days=7`
- `/api/news?category=rostov&limit=15&days=7`
- `/api/news?category=mortgage&limit=15&days=7`

A successful response contains `version: "6.0.0"`. For `rostov`, `161ru.categoryCount` and `161ru.finalCount` should be greater than zero when the source is reachable. For `krasnodar`, the same applies to `krasdom` and/or `93ru`.

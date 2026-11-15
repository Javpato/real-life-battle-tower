# Food search and barcode capture

The journal has one field for a food name, brand or printed barcode. Names use the `food-search` Supabase Edge Function. Numeric barcodes use the Open Food Facts product endpoint directly. Saved journal foods are matched locally; a selected product is only logged after the user confirms the portion.

The legacy Open Food Facts `/cgi/search.pl` endpoint returned HTTP 503 during this fix. Its replacement, [Search-a-licious](https://openfoodfacts.github.io/search-a-licious/users/ref-openapi/), returned valid product results but did not include browser CORS permission. The read-only Edge Function calls that fixed upstream and supplies CORS. [Open Food Facts documentation](https://openfoodfacts.github.io/openfoodfacts-server/api/) confirms that API v2 does not support full-text name search; replacing the URL with v2 would silently return the wrong search results.

Deploy with `npx supabase functions deploy food-search --no-verify-jwt` against the linked project. No database migration or service-role key is needed. It accepts only `POST {"query":"food name"}`, limits body/query/results, escapes search operators, uses a nine-second upstream deadline, and keeps bounded five-minute response caches and per-instance burst limits. It never reads player saves or food diaries. Client requests contain only the typed query. Only explicit submitted searches contact the service; editing the field cancels stale work.

Barcode capture requests an HD rear camera, muted inline playback, optional continuous autofocus, EAN/UPC/ITF-specific ZXing decoding and harder image analysis. The preview is visible while starting and becomes the main modal content. The first valid decode stops the stream before lookup; close, retry and late permission results release their tracks. A photo can also be decoded locally without sending image data anywhere. A successful scan and a product missing from the database are reported separately.

Verification on 2026-11-15:

- Chromium and WebKit: actual ZXing decoding from a synthetic EAN-13 camera stream and local photo; permission retry, pending-permission close, no duplicate lookup, canceled search, and six viewport sizes passed with zero page errors.
- Live game UI against the deployed `food-search` function: `quaker oats` returned 12 real products; selection opened the portion form. A real barcode lookup also passed. No food was logged during this live check.
- Evidence: `docs/verification/food-search/`. Synthetic barcode frames and desktop WebKit do not establish real iPhone autofocus, lighting or physical package scan performance.

Reproduce with `GAME_URL=http://127.0.0.1:5194 node tests/food-search-browser.mjs` against Vite. Set `BROWSER=webkit` and the appropriate `PLAYWRIGHT_BROWSERS_PATH` for WebKit. Use `GAME_URL=https://YOUR-GAME node tests/food-search-live-browser.mjs` for the opt-in real provider check.

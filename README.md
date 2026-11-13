# Everstride — Real-Life RPG

An original pixel village, turn-based exercise combat, and a private nutrition journal. Built for Javpato’s girlfriend and Uriel’s brother. English UI; no generative nutrition AI. This is a working implementation with explicit unfinished integrations, not a claim that every master-spec item has shipped. See QA.md.

## Run

Node 22+ (developed with Node 24). From this directory:

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

The project has its own Git repository; do not use the parent workspace repository. The standard browser build is `dist/`.

## Play

WASD/arrows move; E/Enter interacts with a nearby villager. Touch arrows and interaction button are also available. Escape pauses combat/opens the menu. Camera is optional and manual units are clearly marked unverified. Earn three gym badges in any order, then visit Rowan at the summit. The Rest House heals for free; supplies and skills are in the shop. The journal is available from the header and does not award progress for eating or losing weight.

Each camera exercise offers a skippable demonstration, framing, initial position, practice repetition, countdown and local tracking. Pause indefinitely. Canceling a series keeps its damage and consumes the turn; pausing does not. Detection is not a medical assessment. Camera frames stay on device; physical testing remains required.

## Local data

IndexedDB holds one atomic adventure snapshot (player plus battle) and the nutrition journal. A suspended encounter resumes paused. Data belongs to the current browser/profile. Clearing browser data removes local saves. Nutrition exports are available under Progress: CSV, complete JSON, and browser Print / Save PDF. JSON export is a backup artifact; restore UI is not yet implemented.

## Nutrition

Mifflin–St Jeor, Katch–McArdle and entered clinical resting measurements are independently testable. Unknown label values stay unknown. OFF product lookup and text search require internet; manual entry and attributed offline product snapshots remain available. Scanning does not log consumption. Portion confirmation is explicit. Recipes preserve ingredient energy through changes in cooked yield. Extra exercise credit defaults to zero to avoid double counting habitual activity.

Optional adult weight scenarios use an experimental deterministic implementation of Hall’s published model; they are not the official NIH planner or validated individual predictions. Its input bounds differ from the separate resting calculator. Proposals require enough completed history and explicit acceptance. See source comments and in-app assumptions.

## Cloud and devices

Copy `.env.example` to `.env.local` and configure public Supabase URL/anon key. Never put privileged keys in frontend variables. Enable anonymous auth and deploy the migrations in `supabase/migrations/`. See `docs/PLATFORM.md` for implemented RPCs, RLS tests and limitations. A configured adapter is not evidence of a deployed backend. The app runs locally without Supabase; local state must not be silently copied over a cloud save.

All devices linked to one cloud save are authorized to access that save’s journal; linking UI explains this. Never link a device belonging to someone who should not see the journal. Game control and nutrition edits have separate concurrency rules.

## Android

Requires JDK 21 (not just a JRE), Android SDK 36 and network for first Gradle build. Health Connect implementation requires Android 8+; device support varies.

```sh
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

The installable debug APK is `android/app/build/outputs/apk/debug/app-debug.apk`. Debug signing is for this demonstration, not a store release. Camera and activity permissions are requested when used. Web never invents steps. Health Connect and sensor availability are reported by native code. An emulator cannot validate actual walking. HealthKit is not implemented or verified in this Linux/Android environment.

## Verification

`npm test` covers domain behavior, detectors, platform availability and projections. `tests/ui-smoke.mjs` and `tests/adventure-smoke.mjs` run against the dev server using Chrome at `/usr/bin/google-chrome` in an isolated browser context. Test-only data is never seeded into the production experience. `tests/exercises-browser-smoke.mjs` validates real bundled model loading with a blank frame; this is not physical exercise validation.

## Hosting

Sites deployment identity lives in `.openai/hosting.json`; use the configured static `dist/` directory. Build assets and source revision must match. Camera requires HTTPS or localhost. Downloaded pose model/WASM are served from the same origin. External food queries send only the requested product/search terms; camera footage is never sent.

## Licenses

Original world and exercise illustrations are project-created. Open Food Facts extracts carry ODbL/DbCL attribution in `src/nutrition/foodSearchService.ts`. Food photos, if used, retain their upstream license; no photos are redistributed here. Projection implementation attribution is in `src/nutrition/projection.ts`. MediaPipe runtime and model are official Google assets; preserve upstream notices and review distribution terms before store release. Fonts are Google Fonts DM Sans and Fraunces; a readable system fallback is provided offline.

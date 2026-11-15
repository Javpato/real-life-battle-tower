# Real-Life Battle Tower

Cozylight's physical RPG: **YOUR BODY IS YOUR WEAPON. HOW HIGH CAN YOU CLIMB?**

**[Play in your browser](https://javpato.github.io/real-life-battle-tower/)** · [Source code](https://github.com/Javpato/real-life-battle-tower)

[Download the Android demo APK](https://github.com/Javpato/real-life-battle-tower/releases/tag/demo-2026-11-15-flash-camera) (signed debug build).

Run `npm install`, then `npm run dev`. The game starts with title, three independent saves and the tower menu. On the save screen, **Explore a local preview** opens the isolated developer profile with every skill and specialization available. Infinite Tower preparation exposes a preview starting floor. Preview never writes a normal slot or synchronizes.

## Playing

- **Skills:**90 exercises, 15 in each discipline: Leg, Arm, Back, Core, Cardio and Mobility. Four starter attacks are learned and equipped immediately, without fabricated camera verification. Advanced skills require prerequisite trials and opportunities earned every three completed floors.
- **Infinite Tower:** deterministic encounters through floor1,000,000,000; 36 normal opponents and20 bosses. A boss appears every5floors, with the centennial boss at100. Four skills required; safe-point equipment changes; no XP or character levels.
- **Boss rewards:** choose a temporary +10% attack improvement (cap+50% per run) or a Flash trial opportunity. Flash requires a learned base skill and controlled, observed full cycles; manual unlocks never invent speed evidence.
- **Types:** six distinct balanced matchup profiles. Hybrid attacks average both types against the defender; STAB×1.25 applies once. The in-game codex explains the full matrix and calculates dual-type matchups.
- **Challenges:**10 finite towers with assigned four-skill loadouts, visible prerequisites and specialization rewards. Personal Flash variants do not replace assigned challenge skills.
- **Custom Workout / Training Grounds:**all90 exercises available regardless of combat unlocks, filtered by discipline/support/impact/detection. Save ordered routines, split long goals into short series, rest freely and resume. Guided/manual exercises have exact written instructions; unsupported motion is never falsely verified by a reused camera detector. Training uses exercise-driven minigames, not enemy-HP encounters.
- **Records:** completed-floor records and workout results; manual/mixed evidence is never promoted to camera verification.
- **Settings:** fullscreen, reduced motion, voice feedback, camera source/phone pairing, cloud devices, Android steps and cosmetic banners. Nutrition remains a separate local/shared diary.

The primary camera runs MediaPipe locally. The phone companion transmits joint positions directly; video preview remains optional. A supported detector is not a medical technique assessment. Mini squat and knee push-up are experimental profiles; unsupported variants remain manual-only. See QA.md for what was actually tested.

**Phone camera** in the game header opens pairing during a battle, trial or workout, pauses the session and preserves its progress. Flash shows a repetition timer and a generous personal pace window; manual timing remains unverified. Use **Recalibrate Flash pace** to repeat the camera trial. The journal accepts food names, brands and barcodes in one field, with rear-camera and local-photo scanning; see [food search setup](docs/FOOD_SEARCH.md).

## Architecture

`src/tower/model.ts`, `catalog.ts`, `generation.ts` and `engine.ts` are the canonical contracts/content/reducer. `useTower.ts` owns atomic local slots and cloud acknowledgements. Camera events cannot directly update rewards. The renderer animates accepted progress only. `skillGuides.ts` contains physical instructions for every variant.

Version2 saves retain the `battle-tower:slots:v1` storage key to preserve the three existing slots. Version1 Tower saves receive a backup and deterministic migration; active old expeditions retain version1 rules. Unreadable slots fail closed instead of overwriting progress. The old exploration state is not imported or interpreted. There is no legacy journey/XP compatibility layer. Explicit import of a NEW local tower profile to an empty cloud save validates content and labels imported evidence unverified.

Original art sources and replacement instructions are in ASSET_GUIDE.md. No old world, character or opening graphics remain in public assets. Asset manifest: `public/assets/tower-v2/manifest.json`. The illustrated cast contains60 characters and992 distinct pose frames. Open `art-production/v2/gallery.html` or `/art-production/v2/gallery.html` on the local development server to review them.

## Build and checks

```
npm test
npm run build
node supabase/sync-core.mjs --check
node supabase/tests/tower.mjs
node supabase/tests/platform.mjs
GAME_URL=http://127.0.0.1:5174 node tests/tower-v2-ui-browser.mjs
GAME_URL=http://127.0.0.1:5174 node tests/tower-v2-art-browser.mjs
GAME_URL=http://127.0.0.1:5174 node tests/tower-migration-browser.mjs
```

Browser checks require Chrome (default `/usr/bin/google-chrome`) and the local server. `tests/tower-offline.mjs` targets production preview on4174. Browser screenshots use real menu/pointer interaction and explicit manual controls, not injected save progress.

For Android: `npx cap sync android`, then run `./gradlew assembleDebug` in `android/` with an installed Android SDK. Package identity remains `app.everstride.rpg`; display name is Battle Tower.

## Public web deployment

GitHub Pages serves the compiled game over HTTPS. Every push to `main` runs the tests, checks the shared backend source and local SQL contracts, builds the application with its repository subdirectory, and deploys `dist`. See [the workflow](.github/workflows/pages.yml). The website does not require the development computer or a Cloudflare tunnel to remain running.

For a fork, enable **Settings → Pages → Source → GitHub Actions**, then add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` under **Settings → Secrets and variables → Actions**. These values are public client configuration and appear in the browser bundle. Never use a Supabase service-role key or personal access token. Local `.env` files, dependencies, private build configuration and player data are excluded from Git. The workflow does not deploy or modify Supabase.

For phone camera pairing, open the same published game on PC and phone, use the same Wi-Fi, create a fresh invitation and explicitly allow the phone camera. Old temporary-host links and QR codes are not the published website. Browser-local saves belong to their original origin; changing hosts does not transfer them automatically. Existing device/cloud linking remains available.

## Backend release

Apply migrations through `202611140008_tower_v2.sql` and deploy `tower-command`, retaining camera-pair and journal/device services. Run `node supabase/sync-core.mjs` after changing the canonical reducer. Only the Edge Function has service credentials; SQL rejects client commits, unknown cosmetics and developer saves. Deployed sync must be tested separately from embedded PostgreSQL checks. See QA.md for the present deployment limitation.

# Real-Life Battle Tower

Cozylight's physical RPG: **YOUR BODY IS YOUR WEAPON. HOW HIGH CAN YOU CLIMB?**

Run `npm install`, then `npm run dev`. The game starts with title, three independent saves and the tower menu. On the save screen, **Explore a local preview** opens the isolated developer profile with every skill and specialization available. Infinite Tower preparation exposes a preview starting floor. Preview never writes a normal slot or synchronizes.

## Playing

- **Skills:**30 physical skills across Leg, Arm and Back. Four introductory candidates; demonstrate one to begin. Camera, experimental camera and manual-only capabilities are explicitly distinguished. Manual unlocks remain playable.
- **Infinite Tower:** deterministic seed/floor encounters, bounded growth, minibosses every5 floors, bosses every10, special Warden at50. Four equipment slots; one unlocked skill is enough to start. Techniques and specialization can change at safe points between infinite floors. HP persists within the run, with partial recovery between normal floors and full recovery after guardians. No XP or character levels.
- **Challenges:**7 finite towers with fixed four-skill loadouts and visible prerequisites. Elemental trials unlock specializations.
- **Custom Workout:**30 original exercise-controlled scenes, exact goals, ordered routines, automatic series splitting, free rests, skipping marked incomplete, result history and evidence-aware stars. No HP or enemy attacks.
- **Records:** completed-floor records and workout results; manual/mixed evidence is never promoted to camera verification.
- **Settings:** fullscreen, reduced motion, voice feedback, camera source/phone pairing, cloud devices, Android steps and cosmetic banners. Nutrition remains a separate local/shared diary.

The primary camera runs MediaPipe locally. The phone companion transmits joint positions directly; video preview remains optional. A supported detector is not a medical technique assessment. Mini squat and knee push-up are experimental profiles; unsupported variants remain manual-only. See QA.md for what was actually tested.

## Architecture

`src/tower/model.ts`, `catalog.ts`, `generation.ts` and `engine.ts` are the canonical contracts/content/reducer. `useTower.ts` owns atomic local slots and cloud acknowledgements. Camera events cannot directly update rewards. The renderer animates accepted progress only. `skillGuides.ts` contains physical instructions for every variant.

New saves use `battle-tower:slots:v1` in the existing IndexedDB storage. The old exploration state is not imported or interpreted. There is no legacy journey/XP compatibility layer. Explicit import of a NEW local tower profile to an empty cloud save validates content and labels imported evidence unverified.

Original art sources and replacement instructions are in ASSET_GUIDE.md. No old world, character or opening graphics remain in public assets. Asset manifest: `public/assets/tower/manifest.json`.

## Build and checks

```
npm test
npm run build
node supabase/sync-core.mjs --check
node supabase/tests/tower.mjs
node supabase/tests/platform.mjs
GAME_URL=http://127.0.0.1:5174 node tests/tower-browser.mjs
```

Browser checks require Chrome (default `/usr/bin/google-chrome`) and the local server. `tests/tower-offline.mjs` targets production preview on4174. Browser screenshots use real menu/pointer interaction and explicit manual controls, not injected save progress.

For Android: `npx cap sync android`, then run `./gradlew assembleDebug` in `android/` with an installed Android SDK. Package identity remains `app.everstride.rpg`; display name is Battle Tower.

## Backend release

Apply migrations through `202611140007_battle_tower.sql` and deploy `tower-command`, retaining camera-pair and journal/device services. Run `node supabase/sync-core.mjs` after changing the canonical reducer. Only the Edge Function has service credentials; SQL rejects client commits, unknown cosmetics and developer saves. Deployed sync must be tested separately from embedded PostgreSQL checks. See QA.md for the present deployment limitation.

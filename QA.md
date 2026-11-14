# Battle Tower verification — 14 November 2026

This record replaces the retired exploration-RPG acceptance report (preserved in Git history at55ace53). It describes the new local game, not a hosted deployment or validated exercise assessment.

## Executed checks

- `npm test`:287 tests in26 files. Includes deterministic floors1/10/100/1000/10000/1,000,000,000, numeric bounds, types/STAB, duplicate event rejection, trial permanence/prerequisites, four-slot restrictions, fixed challenge loadouts, safe-point equipment, phase thresholds, defense, exact workout series, provenance, import validation and retained detector/nutrition behavior.
- Balance:240 full manual battles across five floor cases through the supported maximum, four specialization choices and12seeds, using strategic learned loadouts. All won on Standard difficulty; lowest remainingHP2.5. This is a game simulation, not a physiological recommendation or a guarantee for every loadout/harder difficulty.
- TypeScript/production build and generated Edge-source parity pass.
- Embedded PostgreSQL tower and platform suites pass: membership/RLS, service-only commits, revision/lease fencing, idempotent receipts, debug-profile rejection, three shared saves, fourth-slot rejection, journal isolation/conflicts, pairing permissions, Android step deduplication and cosmetic-only purchases. No client can purchase a skill or a combat-stat upgrade through the new Tower endpoint.
- `tests/tower-browser.mjs`: real UI creation, first manual trial/unlock, one-skill floor victory, ascent, reload during floor2, independent second slot, fixed challenge, ten-floor boss transformation, workouts, records and device/exit modals. Zero JavaScript errors and failed application-resource loads.
- Five layout sizes:1920×1080,1366×768,1280×720,915×412,800×360. No global scroll overflow; actors remain within the shared arena/platform plane. Close controls remain reachable.
- Connected skill trees: four initial lessons together; three prerequisite graphs with9/9/8edges; locked advanced trial blocked; first trial permanently changes learned count. Inspector/training controls remain reachable at800×360.
- `tests/tower-minigames.mjs`: all30 distinct scenes completed using actual manual controls in three ten-exercise routines, with exact two-unit goals. Screenshots show accepted progress. This does not validate physical detection.
- `tests/exercises-browser-smoke.mjs`: real bundled Lite model and WASM load and return zero landmarks for a blank frame. `camera-sources-browser.mjs`: primary manual-to-camera action, webcam/phone switch, track release and stale/lost evidence tested using synthetic transport.
- `tests/companion-browser.mjs`: two separate Chrome processes exchange fresh poses over real WebRTC; explicit pairing confirmation, opt-in video and stale/disconnected fencing pass. Signaling is mocked, camera/poses synthetic; no image or pose data passes through the signaling server.
- `tests/journal-rpg-browser.mjs`: retained journal chapters, manual food portions, unknown nutritional values, recipes, display preferences and responsive close controls pass.
- `tests/tower-camera-ui.mjs`: actual Tower UI with real Lite inference and a blank fake camera. Camera, counter, instructions and starting position fit all five viewports; Bird Dog side feedback and all camera help/settings close controls were also checked at800×360. Optional phone-video display attaches and clears in the camera component without starting a second local webcam.
- Android: final signed debug APK installed and launched in the landscape emulator; title and slot controls work. Native safe-area handling removes the early Capacitor CSS-injection race. Final AndroidRuntime/Capacitor console error log is empty. All81 packaged web files match the final production build byte for byte; APK Signature Scheme v2 verifies.
- Production offline reload opens the title and Tower menu; no retired world/sprite/opening assets are cached.

## Visual evidence

Actual runtime PNGs and an index live in `docs/verification/battle-tower/`. Most gameplay evidence uses clearly labelled manual input or the isolated developer preview. `camera-fake-input-*` shows browser-generated blank-camera input. `android-emulator-title.png` is an Android emulator capture, not a physical handset.

69 original PNG assets,30 code-rendered workout scenes,16 native icons,11 exercise illustrations, two protagonists, eight enemy identities and six arenas replace the active old art. Four-frame character atlases run in fixed clips with stable foot anchors. No active graphics reference the retired asset directories. See ASSET_GUIDE.md and the central manifest.

## Boundaries and outstanding external validation

- Real people performing exercises, phone camera on actual Wi-Fi, device orientation/performance, Android health permissions/step sensors and thermal behavior still need physical-device validation. No recognition accuracy or clinical technique claim is made.
- Mini Squat and Knee Push-up are explicitly experimental profiles. Other existing detector families are reused with their stated limits; insufficiently verifiable variations use labelled manual confirmation. Thirty skills does not mean thirty independently validated camera detectors.
- Hosted Supabase is not deployed or accepted by this run. The CLI has no authenticated access token (`AccessTokenRequiredError`); no credentials were requested or exposed. Apply the new migration/Edge Function using an authenticated deployment environment, then verify real two-device sync. The implementation retains the previous phone, membership, lease, journal and sensor integration.
- Fresh Tower profiles intentionally do not translate the old exploration/XP state. The old IndexedDB key is untouched. Importing a new local Tower profile into an empty shared slot is explicit and labels its previous evidence unverified. Developer preview cannot synchronize.

## Reproduction

Start Vite on5174, run the commands listed in AGENTS.md and README.md, then the specialized browser scripts above. Run production preview on4174 for `tests/tower-offline.mjs`. Browser tests create isolated disposable profiles. Android is built with Java21 and the installed Android SDK after syncing the final production assets. The delivery evidence JSON records the final APK hash and packaged-web comparison.

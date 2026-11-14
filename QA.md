# Battle Tower v2 — verification

## Automated and browser evidence

- Final integrated unit suite: **326 tests in29files pass**. Includes90catalogue entries,15pertype, prerequisites, deterministic generation at1/10/100/1000/10000/1,000,000,000, six distinct balanced matchup profiles, hybrid average effectiveness, singleSTAB, phase caps, initialfour, permanent trial opportunities, boss rewards/Flash, challenge restrictions, four slots at everyfloor, provenance and replay fencing.
- **420 strategic balance simulations pass** with sixspecializations plusneutral; lowest remainingHP5, atmost8enemyresponses. This models game rules, not exercise safety or guaranteed success with arbitrary loadouts.
- TypeScript/production build and generated Supabase source parity pass. EmbeddedPostgreSQL tower/platform suites pass permission/revision/lease/receipt rules, v1/v2snapshot acceptance, invalidversion rejection and safe transfer status.
- Three-slot browser migration tests pass: independent migration, untouched v1backup, active old expedition retains old rules, corrupt/unreadable data blocks creation/deletion instead of overwriting all slots.
- V2UI browser suite passes newfourattacksave, sixskilltrees, dual-type codex, all90routineoptions, lockedskillmanualtraining, boss5choice, camp trials, manualFlash unlock/equip, direct slot replacement and workout save/reload.
- Real rendered art suite passes title, slots, protagonist choice, both instructors, battle, accepted-hit animation, transformation and victory. Footpositions checked against the generated platforms during animation. Five requiredviewports pass:1920×1080,1366×768,1280×720,915×412,800×360.
- Mobile battle refinement passes six buttons≥44px, no global overflow, stable feet and camera preserved. Battle sceneheight improved to164px at800×360 and216px at915×412.
- Support suite passes five journalchapters, light/dark settings, phone presentation and genuinely clickable modalclose at800×360. No active requests use retired tower assets.
- Real MediaPipe Lite inference/WASM on a blankframe yields zero landmarks. Camera source switching, trackrelease and stale evidence tests pass. CameraHUD checked in allfiveviewports using synthetic/blank input.
- TwoChrome WebRTC pairing test passes with synthetic poses/mocked signaling. Initial parallelrun had an ICEtimeout; two subsequent runs passed withoutproductionchanges. This is not a physical PC/phone pairing test.

- All90minigames browser traversal passes:9routines,180manualunits,15exercisespertype, zero skipped/verifiedcameraunits, zero errors/missingfiles/oldassetrequests. Sixrealcaptures and individual90results are in`game-captures/minigames`. This checks sessionflow, not90distinct minigame mechanics.

## Artistic review

`art-production/v2/validation.json` records60current-source characters reviewed,60unique fronts,992different poseframes,432characterPNGexports, binaryalpha, shared per-character scale, preservedsourceRGB and stablefootbaseline122. All15replacementbosses received freshvisualreview after the first rostercontactsheet exposed similar silhouettes. Zero unresolved crop defects; narrow-gutter exceptions are explicitly reviewed against sourcehashes.

The approved original protagonistface is used for front/portrait. No global palette reduction or eye repainting was applied. Generated originals, fullprompts, rejectediterations, alpha repairrecords, nativeexports, editable pixel data where produced and comparison sheets are retained. Sixbattlebackgrounds,title/huband24icons replace the old active pack. The old geometricgenerator is retired.

## Evidence and reproduction

Open `art-production/v2/gallery.html` for the60character gallery and clipselection. Runtimecaptures and reports are in `art-production/v2/game-captures/`; camera/SQL/unit logs are in its`core/`folder. Native/enlarged artwork and keyposecomparisons are in `art-production/v2/contact-sheets/`.

Start `npm run dev -- --port 5174`, then run:

```sh
npm test
npm run build
node supabase/sync-core.mjs --check
node supabase/tests/tower.mjs
node supabase/tests/platform.mjs
GAME_URL=http://127.0.0.1:5174 node tests/tower-v2-ui-browser.mjs
GAME_URL=http://127.0.0.1:5174 node tests/tower-v2-art-browser.mjs
GAME_URL=http://127.0.0.1:5174 node tests/tower-v2-mobile-battle-browser.mjs
GAME_URL=http://127.0.0.1:5174 node tests/tower-migration-browser.mjs
```

## Android package

`releases/Real-Life-Battle-Tower-v2-debug.apk` is the final signed debug package (30,558,866bytes). SHA256:`7288b4d7fe04ec30ed16883db2444a878c71f2bdf81bcd509c4e8b9f6e2cea99`. All477packagedwebfiles matchfinal`dist`byteforbyte; APKv2signature verifies. Offline shell:`88950f4d77f5fa3b`. Compilation used a fullJDK21 andtheinstalledAndroidSDK aftertheinitialsystemJava21pathwasfoundtobeJRE-only. Buildlogs, signatureoutput, parityevidenceandAndroidemulatorcapturesarein`game-captures/android`. Installed and launched on the read-only Android15/API35 emulator at2400×1080; title and all three save slots visually checked, with zero AndroidRuntime/Capacitor/chromium error-level entries. The emulator was shut down after capture. Emulator evidence is not a physical handset test.

## Boundaries

- All60new movements intentionally start guided/manual. The90entries do not represent90validatedcamera detectors. Exactwritten instructions are available; a complete reviewed illustration/animation of every exercise is not produced in this delivery.
- Real exercise accuracy, actualphone/Wi-Fi pairing, Android physical sensors/permissions/thermalbehavior remain externalvalidation. Synthetic frames do not establish physical accuracy.
- HostedSupabase has not been deployed in this session. Migration`202611140008_tower_v2.sql` and sharedEdge sources are prepared/tested locally; deployment requires an authenticated environment, followed by real two-device validation. No credentials were requested or exposed.
- Training uses90exercise sessions in sixgenerated environments and a progress-driven minigame renderer. They are not90mechanicallydifferent minigames. The older optional custom-workout finalboss concept remains outside the implemented trainingflow.
- Prior v1 runtime screenshots and reports under`docs/verification/battle-tower` are historical; use the v2evidence directory for this delivery.

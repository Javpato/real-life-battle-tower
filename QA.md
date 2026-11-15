# Battle Tower v2 — verification

## Recorded movement fixes and whole-set Flash — 2026-11-15 afternoon

- Flash now uses a whole-set countdown: median of three comfortable camera cycles × timed repetitions × 0.8. Custom 1–600 second targets can be selected before starting and are labelled separately. Expiry retains completed damage and continues ordinary damage; resting interrupts the bonus, and timed trials can be retried free. Existing unlocks and old active trial rules remain compatible.
- Fast recognition no longer waits for a cloud receipt between repetitions. A bounded ordered queue preserves authoritative acceptance, rejects stale sessions and discards speculative following events after rejection. Rest drains already completed observations before sending the canonical pause; countdown display reconciles with the accepted start timestamp. Raw fast-motion peaks no longer need to coincide with the smoothed display peak; visibility, timestamp and spike guards remain.
- Ten easy five-floor towers are available immediately with four temporary assigned techniques. Each unlocks its matching hard tower. Borrowing never grants permanent Infinite Tower ownership. Old active encounters retain their original definitions and old victories remain meaningful.
- Browser suites passed the full tower flow, Flash three-reference/six-faster-cycle path, manual provenance, challenge access/borrowed attacks and all five viewports. Real hosted signaling/WebRTC during an active battle passed using synthetic camera input, including rest, disconnect and preserved HP/repetitions. This is not a physical phone accuracy test.
- Public-safe interface captures/reports: `docs/verification/rep-countdown/`. User recordings, camera crops and inferred body landmarks remain local under `/tmp/bt-review`; none are included in the repository or release.
- Local recording replay uses re-inference on compressed, mirrored screen-recorded camera views with existing skeleton overlays. It is a regression diagnostic, not a general accuracy benchmark or technique validation. With the same stable calibration and complete frame stream in each comparison: Sit to Stand **0/3 → 3/3**, Squat **3/8 → 8/8**, Sumo Squat **0/2 → 2/2**, Single-leg Squat **0/3 → 3/3** matched independently annotated completed cycles. The single-leg sequence correctly alternated left/right/left. No unmatched detections in these four reviewed segments. See `recording-replay.json`.

- Final validation: 669 full-suite tests passed, followed by the added alternating-leg regression (11/11 focused tests); production TypeScript/build, shared parity and both SQL suites passed. The total suite now contains 670 tests. The final slow-receipt Flash integration and hosted phone pairing rechecks passed.
- Deployed matching `tower-command` rules and import compatibility to the existing Supabase project; no database migration or player-save reset. Final Android debug APK: **30,877,202 bytes**, **478 web files** byte-identical to final `dist`, APK v2 signature verified. SHA256: `1958f4267b2af01ead02be76fbc177bd87856911dee99ff39e9b3b0161b563fb`. Release: https://github.com/Javpato/real-life-battle-tower/releases/tag/demo-2026-11-15-rep-countdown . No physical handset installation was performed in this follow-up.


## All-exercise camera and visual learning — 2026-11-15

- Recovered and completed the interrupted camera-profile/detector drafts. Every one of the 90 exact skill IDs has camera setup, observable evidence, limitations, references and a visual movement sequence. Coverage: **10 existing profiles, 60 assisted counters, 20 preview + manual confirmation**. No newly assisted movement is claimed as physically validated or awarded verified technique/Flash evidence.
- Exact skill binding is carried from training/battle/trial to the detector and canonical shared reducer. Legacy clients and save identifiers remain compatible. Assisted progress uses the existing unverified/manual counters, with explicit labels. Calibration, actual stable pauses, slow movement intervals, opposite-limb requirements, complete returns, fresh-frame holds, tracking loss and anatomical alternation have synthetic regression coverage.
- Visual learning uses labelled motion schematics, distinct from game character artwork: starting/moving/return stages, supports, side colours, play/pause/step controls and reduced motion. Training lessons open in a focus-contained window with a persistent Close control; Escape closes the lesson without navigating away. Exact per-skill seconds/repetition labels and guidance replace transport-family assumptions.
- **639 unit tests in 40 files passed**, TypeScript/production build and generated source parity passed. Both local SQL suites passed; these are not production saved-game end-to-end tests. The complete tower UI regression passed across five viewports, covering starters, skill trees, training, save/resume, boss rewards, Flash and loadout changes.
- Browser checks: 450 exact guide renders (90 skills × 5 viewports), playback and system/game reduced motion; real Lite model with a synthetic blank camera (zero units); an assisted sumo-squat cycle through synthetic phone frames; pause/tracking-loss rejection; exact unverified event identity; per-skill units; manual-to-camera side preservation; confirmation-only preview never counting. No physical iPhone, Android or human exercise accuracy validation was performed.
- Evidence: `docs/verification/exercise-guides/` and `docs/verification/all-exercise-camera/`. Research and all 90 classifications: `docs/EXERCISE_CAMERA_RESEARCH.md`. New automated entry points: `tests/assisted-detectors.test.ts`, `tests/assisted-evidence.test.ts`, `tests/exercise-motion-maps.test.ts`, `tests/all-exercise-camera-browser.mjs` and `tests/exercise-guides-browser.mjs`.
- Published runtime commit `a614add` passed GitHub Actions run `43715035864` and deployed to GitHub Pages. The public URL passed the 90-exercise/filter/visual-guide/live-model checks. Real hosted signaling and WebRTC passed during an active battle with synthetic camera input, including preserved HP/repetitions, existing rest, all five viewports and disconnect cleanup. Reports are under `docs/verification/all-exercise-camera/public/` and `public-phone/`.
- Updated the existing `tower-command` function to enforce exact assisted evidence; CORS preflight returns 204. No database migration or player-save rewrite. Production offline reload passed.
- Final signed Android demo APK: **30,917,224 bytes**, **478 packaged web files** byte-identical to the production build, APK v2 signature verified. SHA256 `d7cc0baabb07fea772b7ce5b03f5fe56b80ea812064e8c8795a7d58db2a77c2a` also matches GitHub's uploaded asset digest. Release: https://github.com/Javpato/real-life-battle-tower/releases/tag/demo-2026-11-15-exercise-camera . Original interrupted drafts are preserved locally in the sibling `camera-recovery-2026-11-15/` directory.


## Flash timing, food lookup and mid-battle pairing — 2026-11-15

- Flash exposes observed repetition time, its personal window, last-cycle time and accepted bonus feedback. A three-repetition reference plus six test repetitions remains; tolerance is now 0.5×–1.75× the reference, bounded to 700–12,000 ms. Opt-in Flash geometry allows shallower motion and more angle variation without weakening visibility, stale-frame, interruption or complete-return checks. Manual practice has an explicitly unverified stopwatch and can be followed by a repeat camera trial. Canonical receipts now distinguish a credited repetition from a successful command that rejected its evidence.
- Food name/brand/barcode entry is unified. The failed legacy name endpoint was replaced by a fixed-upstream, bounded, read-only `food-search` Edge Function. Scanner startup shows a muted inline HD rear-camera preview, uses EAN/UPC-specific decoding and optional autofocus/light, stops after its first valid result, handles cancellation/late permissions and supports local photo decoding. Opening the journal now releases any exercise webcam before scanning. No food is logged merely by selecting a result.
- The header's Phone camera action works during battles, trials and workouts. Opening the persistent pairing dialog pauses the session; closing it restores the prior pause state, preserves damage/repetitions and keeps the peer connection alive. Five viewport checks cover the return button and horizontal overflow.
- **381 unit tests across 37 files pass**; production build and generated shared-source parity pass, both embedded SQL suites pass, and the full five-viewport tower regression passes. Actual synthetic joint frames pass through the pose filter/detector/canonical Flash trial, including timer movement, paused/rejected receipts, three reference plus six test cycles and manual provenance. Chromium and WebKit decode real synthetic EAN-13 video/photo inputs; the journal's existing chapter/portion/preferences regression also passes.
- `food-search` and `tower-command` were deployed to the existing Supabase project without a database migration. Their CORS preflights return 204. A real name query returned 12 products; camera-pair backend/WebRTC tests passed with synthetic camera input. This does not establish physical iPhone autofocus, human exercise accuracy or a complete cloud saved-game end-to-end test.
- GitHub Pages deployment of runtime commit `1daacda` succeeded in Actions run `43658911924`. Post-deployment checks on the public URL passed real food name/barcode lookup and portion selection (without logging food), Flash layout/manual timing/retrial at all five viewports, and real in-battle phone pairing/MediaPipe/WebRTC with synthetic video; zero page errors. Evidence is in `docs/verification/flash-food-phone/` and `docs/verification/food-search/`.
- Refreshed signed Android debug APK: **30,848,766 bytes**, all **478 web files** byte-identical to the final root-path build, APK v2 signature verified. SHA256 `6de5c18c780a027ae00390569f15b77e9368d8559dfa8d2af1b2057af51a95c8`. Public release: https://github.com/Javpato/real-life-battle-tower/releases/tag/demo-2026-11-15-flash-camera . No physical Android test was performed for this update.

Reproduce against Vite with `tests/flash-timer-browser.mjs`, `tests/food-search-browser.mjs` and `tests/journal-camera-release-browser.mjs`. Opt-in public checks are `tests/food-search-live-browser.mjs`, `tests/flash-layout-browser.mjs` and `tests/battle-phone-browser.mjs`; set `GAME_URL` and `QA_DIR`. Pairing checks create and close a disposable camera room and never access saved games.

## Public GitHub publication — 2026-11-15

- Public repository: https://github.com/Javpato/real-life-battle-tower . Source, tracked art sources/runtime assets, documentation, tests and backend migrations are published on `main`. A scan of 2,078 Git blobs found no matching private-key/token/service-role patterns or oversized GitHub objects. `.env.local`, dependencies, local backend state and player saves were not uploaded.
- Live game: https://javpato.github.io/real-life-battle-tower/ . GitHub Actions run `43655754404` passed unit tests, shared-source parity, both local SQL suites, subdirectory production build and Pages deployment. Only the existing public Supabase URL/publishable key are supplied as build configuration; this publication did not deploy or change the backend.
- Public JS, WASM and pose-model downloads all returned HTTP 200 with appropriate MIME types. Hosted camera pairing passed against the real backend: desktop approval, actual MediaPipe with synthetic camera, WebRTC data channel, optional direct video and disconnect cleanup. The game camera also initialized inside a floor-one battle at 915×412, with zero page errors. Reports and screenshot: `docs/verification/github-pages/`. These checks do not establish physical iPhone or exercise accuracy.
- Android demo: https://github.com/Javpato/real-life-battle-tower/releases/tag/demo-2026-11-15 . The previously verified signed debug APK is attached with its SHA256; no runtime game source changed during publication, so the existing APK was retained.
- This public HTTPS site replaces the temporary tunnel for sharing. It does not depend on the development computer remaining awake. Create new phone invitations from this address; browser-local saves on old hosts are not automatically transferred.

## Temporary demo tunnel recovery — 2026-11-15

- The previous `implementing-satisfy-warm-raise.trycloudflare.com` address returned Cloudflare HTTP 530 while the local MediaPipe module returned HTTP 200. Its tunnel process was no longer running. This failure was hosting-related; no frontend or Supabase change was needed.
- Current temporary address: https://consistent-shame-positioning-incorporated.trycloudflare.com . Open this address on PC and generate a new phone pairing invitation. The previous address and QR in older evidence are historical. Browser-local storage belongs to each origin; this recovery does not migrate or erase old saves.
- Production preview and tunnel now run as transient user services, `battle-tower-demo-web.service` and `battle-tower-demo-tunnel.service`, with restart-on-failure. They require the computer to remain awake, connected and the user session running. A restarted Quick Tunnel may receive a different URL; this is temporary hosting.
- Public GET checks passed for the JS module (322,082 bytes, `text/javascript`), WASM (11,153,641 bytes, `application/wasm`) and pose model (5,777,746 bytes). The hosted phone test passed again: real Supabase camera-pair backend, desktop approval, synthetic camera plus actual MediaPipe startup, real WebRTC, opt-in video and disconnect cleanup, zero page errors. This does not validate a physical iPhone.
- Runtime verification report and screenshot: `/tmp/bt-demo-recovery-qa/`. Inspect services with `systemctl --user status battle-tower-demo-web battle-tower-demo-tunnel`; retrieve the current address from `journalctl --user -u battle-tower-demo-tunnel`. Stop both services after the demo with `systemctl --user stop battle-tower-demo-tunnel battle-tower-demo-web`.

## iPhone camera startup and hosted pairing — 2026-11-15

- User screenshots showed an inactive preview, disabled Start/Stop buttons, and “Still waiting”. Phone capture previously depended on the WebRTC channel being connected; Safari can need capture permission before exposing local candidates. The phone can now explicitly start local capture after claiming the invitation, before the channel connects. SDP/ICE answering waits for the live stream; desktop code confirmation remains independently required.
- Camera and connection messages are separate. An inactive/failed camera displays a placeholder and retryable status instead of an unexplained black rectangle. Camera properties explicitly request muted inline playback. Live video still requires opt-in after connection; poses cannot send before the approved channel opens.
- Hosted testing exposed concurrent signaling compare-and-swap conflicts (`SIGNAL_BUSY_RETRY`). Peer mutations are now serialized with bounded conflict retries and capped SDP republishing. Negotiation flags recover after failures; disconnect/preview races cannot reject an ignored promise. No new relay or media-upload service was added.
- **346 unit tests in 32 files pass**, production build and shared-source parity pass. Both embedded SQL suites pass. Five-viewport game regression passes. Chromium synthetic-camera tests and WebKit UI/permission tests pass, including denial/retry, no automatic camera request, opt-in preview, camera switching and remote disconnection. Initial WebKit runs were blocked by missing test-runtime dependencies; the correct browser and isolated libraries were supplied in /tmp without system package changes.
- **Real hosted camera-pair verification now passes** on the public HTTPS address: create/claim, desktop approval, local MediaPipe startup, WebRTC data channel, opt-in video stream and disconnect cleanup, with zero page errors. This supersedes the earlier camera-pair HTTP404 finding; the user deployed that function. No Supabase migration or function was deployed by this fix, and cloud saved-game deployment is not established by a camera-pair test.
- Evidence: `docs/verification/iphone-camera/`. These are automated browser and synthetic-camera checks, not a physical iPhone or exercise-accuracy validation. User-provided screenshots remain outside the repository.
- Temporary hosting updated in place at https://implementing-satisfy-warm-raise.trycloudflare.com . Reload the PC page, create a fresh QR, close the old phone tab, connect and explicitly start camera, then confirm the code on PC. No new Supabase deployment is required for this frontend fix.
- Refreshed APK: 30,843,889 bytes, 477 web files byte-identical to the final build, SHA256 `8329075ee6ebefe2b5cbc74c6b8d4adb5d3e7a95de1ca4d124e451852d7de422`. Signature verified. Offline shell `821dd6e8b9314047`. Supersedes earlier APK hashes in this historical log.

Reproduction:

```sh
GAME_URL=http://127.0.0.1:5185 node tests/iphone-camera-browser.mjs
GAME_URL=https://YOUR-TEMPORARY-HOST node tests/phone-live-browser.mjs
```

The first test requires a compatible Playwright WebKit runtime. The hosted test creates and closes one disposable camera room, never saved-game records.

## Presentation and temporary mobile hosting — 2026-11-15

- Approved character designs retained. Title sprites now use direct PNG rendering at native pixel multiples. The hub foot anchor is (184,250) in the 480×270 background, using the existing (64,122) sprite pivot. Battle anchors are unchanged.
- Every attack displays English effectiveness text plus its multiplier, using the current boss phase and existing dual-type math. STAB remains separate. Live victory announces “You defeated [name]!” once, respecting mute/voice settings; restored wins and transformations do not announce a win.
- 329 tests in 30 files pass; production build, shared-source parity, and both local SQL suites pass. Browser regression covers skills, routines, save/resume, boss rewards and Flash with zero errors. Presentation browser checks all five required viewports, foot anchoring, crisp title dimensions, visible touch targets, changing boss-phase labels and exactly one en-US victory utterance.
- New screenshots and reports: `docs/verification/presentation-mobile/`. Public HTTPS loading, game camera activation and MediaPipe Lite initialization were checked with Chrome synthetic video at 915×412; no runtime errors. Neither physical exercise detection nor audible speech on an actual phone is claimed.
- Temporary URL: https://implementing-satisfy-warm-raise.trycloudflare.com . It is process-bound and will stop when the tunnel or computer stops. QR is in the evidence directory. Only compiled `dist` is served, on loopback port 4174; the tunnel uses Host `localhost`. No source directory or credentials are published.
- The configured Supabase `camera-pair` endpoint returns HTTP 404 (“Requested function was not found”). On-device HTTPS camera activation works; PC–phone pairing still needs its backend deployed. No Supabase deployment was performed.
- Refreshed Android APK compiles and signature verifies. Its 477 web files exactly match the tested build. Size 30,556,214 bytes; SHA256 `097ec1a2faab6853a8de75f0f5d3f011c498af6c60a76f8af174b5d86f9162ac`. This supersedes the earlier package hash below. No new physical-device test was performed.

Reproduce against a running production preview:

```sh
GAME_URL=http://127.0.0.1:4174 node tests/tower-presentation-browser.mjs
GAME_URL=http://127.0.0.1:4174 node tests/tower-browser.mjs
GAME_URL=https://YOUR-TEMPORARY-HOST node tests/tower-public-camera-browser.mjs
```

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

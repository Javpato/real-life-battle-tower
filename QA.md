# Cozylight overhaul — November 14, 2026

This section supersedes older feature-coverage statements below. Earlier release records are retained as history.

Implemented: cinematic Cozylight/title opening; selectable male/female protagonists; three real UUID-backed adventures and per-adventure journals; atomic legacy migration with immutable recovery; explicit cloud linkage/import and read-only offline caches; introduction and persistent tutorial; three exterior maps and fourteen reciprocal interiors; restored detailed exploration sprites, extra NPC animation and original PNG indicators; visual-foot battle anchoring; delayed recalibration and useful voice preparation.

## Full campaign and Android acceptance

Real keyboard/touch-menu/manual-play campaign completed on Medium through all three leaders and Rowan. The final visual build was tested across legitimate persistent browser sessions, including a real defeat, recovery at the Rest House, purchases/upgrades paid with earned coins, a successful Rowan retry and reload with identical XP/coins, three badges and ending flag. No progress was injected; final runner exited zero with no page errors. A navigation-helper lattice oscillation was corrected in the test, not by changing gameplay. `tests/adventure-smoke.mjs` now runs this complete flow.

Android debug packaging passes Gradle and APK signature verification. The APK web assets are checked byte-for-byte against the final dist; evidence and SHA256 are in `releases/android-build-evidence.json`. Hardware installation/sensors remain unverified.

## Current automated evidence

- **238 tests across 24 files passed**, TypeScript/Vite production build passed, and generated browser/Edge reducer parity passed.
- PostgreSQL platform tests passed: full canonical manual campaign, RLS, membership, leases, receipts, wallet, journal conflicts, three distinct cloud saves, retry idempotency, fourth-save rejection and foreign-owner isolation.
- `tests/opening-browser.mjs`: real UI creation of both protagonists, independent slots, reload, intro persistence, first-click Settings close, four viewport bounds; touch startup/character creation at 844×390.
- `tests/save-slots-browser.mjs`: real IndexedDB migration and immutable malformed-data recovery, concurrent slot creation, journal isolation, deletion guards for unresolved cloud work, UUID recreation, offline linked cache read-only behavior.
- `tests/overhaul-camera-browser.mjs`: actual game UI, Settings/inventory/help/map/shop/demo first-click closes; synthetic accepted movement and repeated five-second recalibration preserving progress. Shop/Moss placement and pose signals in this test are explicitly fixtures.
- Real MediaPipe model/WASM and worker initialization passed in `tests/camera-browser-smoke.mjs` on an isolated development cache: fake camera hardware, permissions/retry, three restart cycles, front/back changes, stale devices and no units from a blank body image. This is not physical movement validation.
- `tests/overhaul-offline-browser.mjs`: production service worker, actual UI-created female save and keyboard movement, offline title/three slots/continue with matching saved position and progression, completed intro and in-progress mandatory tutorial, and accessible journal. No adventure state injection.
- Existing `tests/ui-smoke.mjs` updated for the opening: food registration, persistence, profile calculation and mobile overflow passed with zero page errors.
- World geometry tests verify reciprocal destinations, valid spawns, gate behavior and reachable interior exits. Real keyboard/manual tutorial victory and visual battle anchors were verified at 1920×1080, 1366×768 and 844×390.

## User review corrections

- Tutorial is mandatory for new adventures. The skip action is removed; canonical commands reject stage jumps and exploration/encounters beyond the onboarding area until Moss practice and the two explanations are completed. Legacy completed adventures remain compatible. Narrative introduction alone remains skippable/replayable.
- Replaced the enlarged male title-atlas crop with a dedicated 1024×1536 illustration preserving the existing identity.
- Fixed the supplied Ana scene-3 screenshot: explicit SVG frame clipping prevents neighboring back-frame bleed in wide/letterboxed sprite containers. All six scenes were captured at2525×1280,1366×768,844×390.
- Reproduced the supplied quest X/manual-start failure exactly: a trailing movement command after starting a quest produced FINISH_CURRENT_ACTIVITY and poisoned the local command queue. World now suppresses activity-handoff writes; rejected local intents cannot block valid close/cancel commands. Storage and cloud failures still retain pending work.
- Quest manual instructions and completion action are immediately visible; optional camera preview remains mounted but collapsible. Real browser tests passed stationary/moving-interaction close, manual completion and reward with zero page errors. Compare the before/after screenshots in releases/screenshots.
- Restored original detailed world resources, added matching female walking artwork, animated the existing NPC artwork, organized streets/plazas/districts and furnished interiors with detailed bitmap art. Trees remain outside route ponds.
- Switched the 2D world to Phaser Canvas to avoid the observed intermittent WebGL framebuffer failure during resize/map lifecycle. No required WebGL effects existed.

## Corrected defects found during integration

- Recalibrate immediately acquired the nearby-phone posture: now five seconds to reposition, then one second of fresh stable posture, preserving credited units and alternating side.
- Camera transport-ready falsely announced posture recognition: preparation and recognition states are now separate.
- Exercise guides could reopen after dismissal: dismissal is scoped to the active session.
- Tutorial Skip was underneath the exploration dock: the ribbon now clears the dock and receives a real first click.
- A focused menu button prevented E interaction after closing: world input now restores interaction on movement/E.
- Door crossing could enqueue an old-map movement after the portal command: transition now stops further position writes.
- Small interior scenes were left-aligned: camera bounds center rooms within the viewport.
- Shared development dependency caches interrupted MediaPipe: per-checkout cache and eager MediaPipe optimization prevent worktree interference.

## Maps and interiors

Exteriors: `starter_town` (Willowmere), `training_route` (Fernway Trail), `rival_town` (Summit Hollow).

Interiors: `starter_house_bedroom`, `starter_house`, `mentor_house`, `oak_house`, `willow_house`, `rest_house`, `general_store`, `alchemy_lab`, `gym_leg`, `gym_arm`, `gym_back`, `summit_house`, `summit_rest`, `rival_arena`.

## Art and screenshots

Preserved original combat PNGs and restored the previous detailed overworld artwork after user review. Both protagonists have detailed four-direction walking atlases; NPCs retain original portraits with breathing, strolling, training, facing and activity animation. Added female front/back illustration, a standalone high-resolution male title illustration, seven transparent indicator sprites, detailed furniture, title landscape and replaceable Cozylight mark. Large combat actions use anchored presentation animations, not newly drawn individual attack frames. The rejected simplified miniature atlas is no longer used in exploration. Provenance and prompt details are in ASSET_GUIDE.md.

Real browser captures are in ignored `releases/screenshots/`: logo, desktop/landscape title, character selection, empty/local slots, introduction, room, battle anchor layouts, camera/recalibration and offline screens. Generated camera and synthetic motion captures are QA fixtures, not people exercising. No genuine linked-cloud screenshot is claimed.

## Remaining external validation

- Hosted Supabase auth currently returns **Anonymous sign-ins are disabled**. Owner CLI returns **AccessTokenRequiredError**. The new SQL/Edge changes have not been deployed; live linked saves cannot be claimed. Local play remains independent and usable. See docs/PLATFORM.md.
- Nine exercises require real-person movement, framing, lighting and device speech trials. Android camera, Health Connect, actual steps, gamepad hardware and physical fullscreen/cutouts require hardware acceptance.
- New local-import provenance represents explicit imported local progress, not cryptographic proof of physical exercise.

---

# QA record and delivery limits

This document reports the implemented build, not the full master-prompt wish list. Status was inspected during the November 13–14, 2026 sprint. “Connected” means a feature has a reachable application flow; it does not mean it was physically validated or deployed to a public service.

## Latest integration update

- Public release is live at https://everstride-real-life-rpg.transformacion801587.chatgpt.site. The public URL passed the real keyboard/manual trainer victory and saved-reward reload test in an isolated Chrome context.
- Production offline shell installation, offline reload and offline journal opening passed in Chrome. Pose models cache only after their first successful download.
- Original procedural village/trainer/leader/rival/victory music is connected; optional device speech counts accepted units and announces sides/completion; independent recorded audio tracks are not included.
- Native device panel is connected to actual permission, step-reading and health snapshot APIs. Accepted snapshots are saved to the journal without adding overlapping calorie estimates. Physical hardware remains unverified.
- Real Supabase project URL and publishable key are configured only in ignored `.env.local`. A real auth request returned `Anonymous sign-ins are disabled` (422). CLI link returned `AccessTokenRequiredError`. No hosted migration or live shared save success is claimed.
- Embedded PostgreSQL verification was rerun by the integrator and passed: RLS, pairing, idempotency, wallet, fencing, safe transfer, shared diary, version conflicts, erase generation, steps, service-only adventure commits and CAS receipts. This remains distinct from hosted Supabase verification.
- Non-finite profile input validation and unknown-energy display have been corrected; 100 ml-labelled product basis is preserved.
- Historical profiles now drive historical expenditure and food targets. Extra activity is explicitly distinguished from habitual activity, and 0/50/100% food-budget credit does not alter expenditure itself. Dated reports exclude planned food.
- Cloud journal settings (weekly targets, date overrides and reminders) now round-trip with explicit conflict handling; they are no longer dropped by serialization.
- Final integrated production build and offline browser smoke passed after these fixes. The cloud controller also rejects stale idempotent receipts so a retry cannot roll back newer acknowledged progress. Physical testing remains pending.

## Observed automated results

| Check | Result and evidence | What it does not establish |
|---|---|---|
| `npm test` | **208 tests passed across 19 files**, observed after the immersive interface rework on November 14. Covers game, pose state machines, nutrition calculations, projections, preferences, food mapping, and web platform failure behavior. | Physical movement accuracy, production service configuration, or end-to-end Android behavior. The release build must also pass after any later changes. |
| Game rules | 6 initial tests plus 17 audit tests. Includes type symmetry, STAB, phase caps, deduplication, session fencing, input checks, fatigue, guard/dodge, idempotent rewards and progression simulations. | A malicious client cannot be trusted merely because its local reducer validates input. Local play uses the same reducer; cloud play commits only through the authenticated Edge Function. Physical unit events are not cryptographic proof of exercise. |
| Exercise detectors | 64 synthetic detector tests. Full cycles, incomplete motion, side alternation, partial hold time, pauses, timestamps, missing joints, torso movement and opposite-limb geometry. | Successful recognition on any real person. |
| `node tests/exercises-browser-smoke.mjs http://127.0.0.1:5198` | Passed against the exercise development server: actual bundled MediaPipe model and WASM loaded in headless Chrome; blank-frame inference returned zero landmarks. | Webcam permission, valid rep detection, physical form or Android WebView performance. The script expects a Vite dev server because it imports the worker source path. |
| `node tests/adventure-smoke.mjs` | Passed in a fresh isolated Chrome context: real WASD/E navigation → nearby trainer → manual attack confirmation → victory → 70 coins / 35 XP / one claimed encounter → reload with identical saved rewards. No test save or progression was injected. | Camera combat or completion of all leaders through browser navigation. |
| `node tests/ui-smoke.mjs` | Passed: village/journal rendering, manual food entry, portion confirmation, persistence, adult profile example yielding 1,780 kcal resting estimate, and 390 px mobile overflow check. Zero captured page errors. | All journal forms, all viewport sizes, clinical validity, live food provider uptime, or native imports. |
| TypeScript | `npm run build` passed on the integrated tree, producing the web bundle and offline worker. | A build check is not a gameplay test. Run `npm run build` on the final integrated tree. |
| SQL migration checks | Integrator executed all four migrations successfully in PGlite PostgreSQL, including a complete database-backed adventure through all leaders and rival phases. Tests exercise RLS, membership, pairing reuse, wallet idempotency, leases, nutrition versions, deletion generation and monotonic step credit. | Hosted Supabase Auth, production pgcrypto behavior, Realtime, network outages or actual concurrent devices. See `docs/PLATFORM.md`. |
| Native compilation | Kotlin/Android compilation and debug APK packaging passed. APK signature verified; bundled web files were compared byte for byte with the web build. No ADB devices were connected. | Installation, sensor readings, camera performance, permission handling on hardware or Health Connect data quality. |

Browser tests use `/usr/bin/google-chrome` by default; `adventure-smoke.mjs` accepts `CHROME_PATH` and `GAME_URL`. Browser test output is from a new profile, so it does not inspect or alter a person's existing browser data.

Screenshots created during this run: `/tmp/everstride-encounter-preview.png`, `/tmp/everstride-after-victory.png`, `/tmp/everstride-world.png`, `/tmp/everstride-journal.png`, `/tmp/everstride-mobile.png`. These are local QA artifacts, not required application assets.

## Feature coverage

| Feature | Actual coverage |
|---|---|
| Village exploration | Connected Phaser village, player animation, collision checks, camera following, keyboard and pointer controls, proximity interaction, visible NPCs and buildings. One overworld scene; building interiors and a dialogue-tree system are not implemented. |
| RPG combat | Connected attack/defend/potion/guard/boost, deterministic type rules, manual and camera input paths, phases, pauses, cancellation, XP, coins and defeat recovery. A trainer was completed through the browser UI. |
| Adventure completion | Three leaders and three-phase rival exist and are connected to encounters, badge locks, specials and ending UI. Deterministic simulations complete all encounter types. A full fresh-save browser playthrough of all three leaders and the rival is still pending. |
| Exercise camera | Nine exercise detectors and the real worker pipeline are connected. Local processing, recoverable permission flow, initial-position guides, partial-body framing, optional automatic calibration, manual arming, countdown, pause/recalibration and manual fallback exist. **All nine physical acceptance tests remain pending.** |
| Manual mode | Connected and explicitly unverified. Full remaining units are generated through the central combat reducer; group fatigue applies only to those units. This is not evidence of exercise performed. |
| Quests | Four reachable exercise missions, five escalating targets and repeat rewards. Camera/manual completion paths exist. Automated/browser coverage of every quest and repeated reward boundary remains incomplete. |
| Shop and equipment | Reachable item purchase, upgrades, up to four equipped attacks and unlocked specials. Adventure mutations route through the common semantic command reducer, including local play. |
| Alchemy | Journal product discovery awards a unique fictional ingredient; laboratory crafting spends ingredients on potion/guard/boost. Discovery does not mark a meal eaten. Physical barcode scan and full live-product-to-crafted-object browser path remain pending. |
| Audio and visual polish | Original raster sprite atlases, four-direction animations, synthesized UI/combat sounds and village/trainer/leader/rival/victory music. Voiced coaching and dedicated transformation sprite sequences remain incomplete. |
| Persistence | Local IndexedDB adventure snapshot includes player and battle together; journal is a separate record. Reloaded battles pause. Reward claim IDs prevent duplicate victory claims. No remote merge is implied. |
| Nutrition journal | Connected manual label entry, OFF lookup/search, saved foods, meal quantities, planning dates, recipes, activities, measurements, charts, adult calculation profiles, conditional projections, export/delete and preferences. Source-specific limitations below apply. |
| Android package | Capacitor/native source and compilation work exist; hardware acceptance is pending. A buildable APK is not proof of real steps or camera operation. |
| Native health/steps | Kotlin and TypeScript adapters provide availability, permissions, Health Connect aggregates and step-counter fallback. Browser correctly reports unsupported readings. The device panel invokes these real adapters and explicitly previews journal imports. Hardware readings remain unverified. |
| Shared adventure | Supabase schema and semantic adapters implement pairing, control leases, wallet operations, step epochs and versioned journal records. The UI routes combat, quests, position, purchases and progression through canonical Edge commands when a cloud record is selected. Durable pending operations, retry receipts, control handoff and a separate versioned cloud journal are connected. **Hosted save/load is still blocked by disabled anonymous auth and missing local CLI authorization.** Embedded SQL tests do not establish deployed functionality. |
| Public URL/submission | The public URL passed the browser trainer victory and persisted-reward flow. A continuous real-camera video and official hackathon form submission remain human tasks; neither is claimed here. |

## Known limitations and follow-up checks

1. **Physical detector reliability:** lunge identification depends on visibly different knee flexion; symmetric or occluded lateral positions can be rejected. Bird Dog needs both sides visible. Superman geometry cannot establish prone orientation or medical form correctness. Diamond hand/finger placement is not verified. Recalibrate or use the clearly marked manual fallback.
2. **Balance is provisional:** active-time simulations are substantially shorter than the original duration goals; see `GAME_DESIGN.md`. Do not claim 4–7 minute leader sessions have been validated. Diamond's damage per repetition is intentionally high, and physical effort/duration requires user trials before balance can be called complete.
3. **Enemy move coverage:** enemies choose an active phase type deterministically. A separate coverage-move repertoire/AI is absent. There are no enemy critical hits or exercise dodges.
4. **Safe stopping:** pausing stops combat advancement; ending a series keeps damage and yields a turn. Secondary trainers can be left. The safe-stop command exits an encounter without a defeat penalty. Camera pause is immediate even while a cloud acknowledgement is pending.
5. **Very short keyboard presses:** Interaction keydown events are queued, fixing missed short taps between frames. The browser test uses a 150 ms E press; physical low-FPS ergonomics still need testing.
6. **Food service compatibility:** product lookup currently uses OFF v2 and text search uses its legacy search endpoint. Requests must retain attribution, respect provider limits and display failure honestly. USDA FoodData Central and CIQUAL are not integrated; the included offline examples are a small attributed OFF snapshot, not a comprehensive food database.
7. **Unknown nutrients:** engine aggregates preserve null. During audit, several UI totals incorrectly displayed unknown energy as zero; the integrator has corrected those views and barcode volume-basis parsing. Regression-check unknown kcal in dashboard, portion preview and meal totals, and a product labelled per 100 ml.
8. **Journal validation:** verify NaN/infinite/extreme profile and manual-entry values at the calculation boundary, not only HTML input attributes. Missing/invalid age, weight, height, factor and measured resting energy must suppress invalid personalized results. Finite/range validation has dedicated tests; further adversarial form coverage remains useful.
9. **Activity reconciliation is conservative:** the first included activity wins an overlap; later overlapping sessions are excluded whole rather than prorated. There is no completed provider-priority reconciliation UI for mixed native imports. Manual MET expenditure is an estimate, not a reward source.
10. **Planning and measurements:** future meals remain marked planned until explicitly copied/recorded; missing days are not zero intake. The lightweight weight trend is not a validated body-composition estimate. Import from Apple Health/HealthKit, arbitrary CSV/JSON restoration and clinical data workflows are absent.
11. **Model limitations:** the local adult Hall-inspired RK4 projection is not the official NIH planner and is not clinically validated. It assumes constant activity and dietary composition, has eligibility/range checks and refuses some inputs. Recalibration proposes a bounded change after sufficient completed records and held-out validation; it does not silently change preferences.
12. **Cloud/native constraints:** source-switch step remainder handling, takeover restrictions, authenticated service tests and device permissions are documented in `docs/PLATFORM.md`. A native sensor reading and a server wallet mutation must be demonstrated together before advertising walking rewards. Health import currently covers steps, active energy, sleep and last weight; total energy/exercise-session import is not a completed general integration.
13. **Product scope:** the interface is English only. Spanish/French translations, kcal/kJ switching, general voice entry, smart-scale APIs and OS-level scheduled notifications are not complete. Current reminders are in-app. Nutrition deletion/export exists; a complete anonymous-account deletion workflow is not implemented.
14. **Offline and data privacy:** browser storage may be cleared or unavailable. Export journal data before relying on it as a backup. Linking explicitly shares nutrition access; remote deletion cannot instantly erase a disconnected device's cached copy. A nutrition erase does not erase the adventure or all local presentation preferences.

## Required physical acceptance

For each of squat, lunge, push-up, diamond push-up, Superman, Bird Dog, chair sit-to-stand, wall push-up and glute bridge, on desktop and a real Android device:

1. Grant/deny camera permission and recover without losing the adventure.
2. Follow the guide, position the camera and complete calibration.
3. Perform a valid unit and observe one immediate HP reduction.
4. Perform an incomplete movement and observe no credited unit or HP reduction.
5. Leave frame, return and retain completed progress without crediting invisible time.
6. Pause, rest, resume, recalibrate and cancel safely.
7. For alternating exercises, test either starting side, repeated same side, opposing Bird Dog limbs and mirrored preview.
8. Defeat an enemy early or reach a phase threshold; confirm no further reps are required and stale frames do not cause damage.

For Android: install the final APK, test supported and unsupported sensors, permission revocation, Health Connect with empty/real data, baseline creation, reopen/reboot, repeated synchronization, source changes and a second device. Confirm no overlapping step sources are summed and no duplicate coins appear. Test app background behavior rather than assuming continuous sensing.

For deployment: test fresh storage, HTTPS permissions, bundled WASM/model loading, a normal trainer victory, reload persistence, service errors and a landscape phone viewport on the actual public URL. Record only real demonstrated capabilities.

## Camera, recognition and graphics rework — November 14

The current source replaces the original all-joints visibility gate and mandatory practice repetition. It uses exercise-specific chains, lower per-joint visibility floors with strong anchors and aggregate confidence gates, fresh-evidence checks, side locking, smoothing and a 400 ms incomplete-cycle retention window. Retained points/state never earn invisible repetitions or held seconds. A visible **Start without automatic calibration** action can arm recognition immediately; missing evidence still earns zero units.

Camera transport is separate from exercise state: generations fence late permission/worker responses, tracks and `srcObject` are released on stop, restart creates a new stream, devices/facing mode can be selected, timeout recovery is bounded, and stale device inventories cannot stop a replacement stream. The camera panel remains mounted during battle pause, manual fallback, intervening turns and victory. A new detector instance restores canonical alternation and uses fresh unit IDs. Async unit acknowledgement keeps rejected/duplicate events from consuming the remaining target.

Observed checks on the rework:

- **201 unit/domain tests across 18 files passed**, including 64 detector tests for the nine exercises, 17 camera lifecycle mocks, audio cue policy and recognition-to-combat contracts.
- Real Chromium with its generated test-camera source passed permission denial/retry, three stop/reactivate cycles, track cleanup, pause/session transitions, manual preview without credit, front/back changes, late permissions, stale device inventories and manual start with no detected body. This is real browser/MediaPipe execution, **not physical movement validation**.
- Synthetic browser fixtures passed fast calibration without a practice rep, one pending canonical receipt, non-optimistic HUD, rejection recovery, pause fencing and target completion.
- Actual App navigation passed camera → exercise → pause/resume → off/restart → manual fallback → multiple turns → victory without remounting the panel or generating damage from an empty image. No page errors.
- Desktop and 844×390 landscape were inspected. In the actual App, counters measured approximately 153 px and 80 px respectively. Starting-position guidance, next side, progress, camera controls and manual-start action remain accessible. Desktop controls below the large HUD may require scrolling. A 390 px portrait fixture had no horizontal overflow.
- Final integrated battle-layout regression passed at desktop, 844×390 landscape and 390 px portrait: no horizontal overflow, complete cast silhouettes, visible HP and world-first ordering between turns. Camera stays full width on phones and moves first during active exercise.
- Original raster atlases replace procedural character/building placeholders; four walking directions, alpha bounds and NPC visibility were inspected. Real Shift movement test measured 31 walking units versus 53 running units over 400 ms, preserving collision checks.
- Actual UI home-exercise checks passed: guide → equip → keyboard trainer → Root Rise 6/6, Wall Pulse 8/8, and Meadow Bridge early victory at 5/6. All manual units stayed explicitly unverified; zero page errors.
- The shared-core parity check and complete embedded-PostgreSQL campaign still pass after the three added basic attacks.

New basic exercise attacks: chair sit-to-stand, wall push-up and glute bridge. They are available in the satchel, use the central damage rules and have original starting/movement illustrations. References: [NHS home strength exercises](https://www.nhs.uk/live-well/exercise/strength-exercises/) and [Cambridge University Hospitals general stability exercises](https://www.cuh.nhs.uk/patient-information/general-stability-exercises1/). Only movement descriptions inform the game; no source photographs or clinical exercise prescription is reproduced.

All nine exercises still require trials with real people on real cameras. The model loading, browser-generated camera and synthetic landmark fixtures cannot establish physical accuracy or Android performance. Hosted Supabase remains separately blocked by owner authentication setup; this rework did not claim remote save verification.

## Immersive fullscreen release — November 14, final source

This release changes the presentation architecture: viewport-sized Phaser world, floating HUD, a separate RPG command component, a persistent exercise camera region, an exercise action dock and internally scrolling RPG windows. The journal stays a separate readable document view.

- **208 tests across 19 files passed.** Production TypeScript/Vite/offline build passed. Existing large-bundle and mixed static/dynamic storage-import warnings remain; they did not fail the build.
- Real Chrome navigation verified **1920×1080, 1366×768, 915×412, 844×390 and 390×844**. The world canvas fills its viewport; no global horizontal/vertical scrolling was observed. Native browser fullscreen entered and exited from the user-facing button.
- World, character/settings window, encounter preview, four-action command menu and equipped-skill menu passed. Attack details use the central type/STAB helpers. Inventory, guide, healing, devices, shop and alchemy windows were inspected at 1366×768 and 915×412; larger content scrolls inside the window, with close controls reachable.
- Preparation, active camera, explicit rest/resume, stop/restart, recalibration and manual continuation were exercised in the actual App. Counter sizes measured about **160 px at 1920, 136 px at 1366, 80 px in short landscape and 96 px in portrait**. Portrait side labels EITHER SIDE/LEFT/RIGHT now fit without clipping.
- Short landscape uses a full-width camera layout and a **150×100 battle inset** beside the image. A 170 px gutter keeps the inset outside the displayed video/skeleton. The enemy and both HP indicators remain visible; the hero sprite is intentionally omitted in compact exercise layouts. Both characters remain visible in desktop exercise and normal battle scenes.
- Generated-camera lifecycle smoke passed 11 checks. The real App camera remained mounted across pause, stop/restart, manual continuation, intervening turns and victory. Blank camera images earned zero units.
- An explicitly labelled **synthetic-landmark** actual-App test credited one verified unit and reduced canonical enemy HP. Tracking loss, stop/restart and recalibration preserved exactly that HP/progress without extra credit; remaining manual units stayed separately unverified. These are integration checks, not proof of physical movement accuracy.
- Manual adventure victory/reward reload and the food journal's registration/profile/persistence/mobile checks still pass. Three added home exercises still equip and complete through real UI interactions. Production offline installation, offline reload, retained adventure and offline journal opening passed after replacing obsolete heading selectors with the visible game scene.

Problems found and corrected during visual QA:

1. Old page margins/cards and fixed aspect ratios constrained the game. The viewport scene and Phaser resize camera now own the available screen.
2. In short landscape, old minimum heights cut off characters. Arena-height-based sprite sizes and explicit command regions keep the cast/HP inside their region.
3. Chromium omitted some live battle descendants when switching layout inside the old `fieldset`. Replacing that form container with `div.world-scene` and an `inert` interaction lock restored layout. Fresh-context regressions require positive HP/sprite dimensions, not merely coordinates within bounds. No forced-reflow workaround or camera remount is used.
4. A long camera/demo column displaced exercise feedback. The camera, telemetry, guide popover and control strip now share a fixed viewport region.
5. Camera mode retained a stale manual-mode message. The off-camera instruction is now derived from the current mode.
6. EITHER SIDE overflowed the portrait telemetry column. It now wraps in a dedicated row while preserving the large counter.
7. A shared food-row flex rule stretched shop item icons. The RPG item footprint is explicitly square.

A transient Phaser framebuffer error appeared during rapid resize/HMR diagnostics with multiple browser sessions. Stable fresh-context final layout runs reported zero page errors; physical GPU/device resilience remains unverified.

Native Android immersive-window code compiled. System bars are recoverable by an edge swipe and Back behavior is not intercepted. Final APK byte/signature verification is separate from actual installation: no real Android device or person was available. Hosted Supabase remains pending the owner's anonymous-auth/CLI authorization; no new live cloud save claim is made.

Final actual-App immersive suite (`tests/immersive-browser.mjs`) passed all five viewports, including portrait after the side-label correction. Fullscreen entry/exit, menus, visible positive-sized battle HP, camera lifecycle and the labelled synthetic recognition-to-damage flow were confirmed. `releases/screenshots/` contains selected real browser captures; generated-camera/synthetic cases carry an explicit QA label.


## Overhaul changed-file inventory

- `.gitignore`
- `ASSET_GUIDE.md`
- `QA.md`
- `README.md`
- `TASK_BOARD.md`
- `docs/PLATFORM.md`
- `public/assets/manifest.json`
- `public/assets/opening/cozylight.svg`
- `public/assets/opening/hero-title-v4.png`
- `public/assets/opening/title-landscape.png`
- `public/assets/sprites/hero-female-v3.png`
- `public/assets/sprites/heroine-walk-v4.png`
- `public/assets/sprites/indicators-v3.png`
- `public/assets/sprites/overworld-v3.png`
- `public/assets/world/furniture-v4.png`
- `scripts/build-mini-art.py`
- `src/App.tsx`
- `src/audio/exerciseFeedback.ts`
- `src/audio/music.ts`
- `src/core/commands.ts`
- `src/core/contracts.ts`
- `src/core/game.ts`
- `src/core/importSave.test.ts`
- `src/core/importSave.ts`
- `src/core/worldMaps.ts`
- `src/exercises/ExerciseCamera.tsx`
- `src/exercises/ExerciseHUD.tsx`
- `src/exercises/detectors.ts`
- `src/exercises/exercisePresentation.ts`
- `src/exercises/exerciseUi.ts`
- `src/exercises/exercises.css`
- `src/exercises/preparation.ts`
- `src/game/BattleSprite.tsx`
- `src/game/World.tsx`
- `src/game/art.ts`
- `src/game/assets.ts`
- `src/main.tsx`
- `src/opening/GameShell.tsx`
- `src/opening/Introduction.tsx`
- `src/opening/opening.css`
- `src/platform/DevicePanel.tsx`
- `src/services/saveSlots.test.ts`
- `src/services/saveSlots.ts`
- `src/services/storage.ts`
- `src/services/sync.ts`
- `src/services/useAdventure.ts`
- `src/ui/BattleCommandMenu.tsx`
- `src/ui/immersive.css`
- `supabase/functions/_shared/commands.ts`
- `supabase/functions/_shared/contracts.ts`
- `supabase/functions/_shared/game.ts`
- `supabase/functions/_shared/importSave.ts`
- `supabase/functions/_shared/worldMaps.ts`
- `supabase/functions/adventure-command/index.ts`
- `supabase/migrations/202611140005_save_slots.sql`
- `supabase/sync-core.mjs`
- `supabase/tests/platform.mjs`
- `tests/adventure-smoke.mjs`
- `tests/camera-receipts-browser.mjs`
- `tests/cloud-controller.test.ts`
- `tests/exercise-presentation-browser.mjs`
- `tests/exercise-recalibration.test.ts`
- `tests/exercise-ui-browser.mjs`
- `tests/intro-visual-browser.mjs`
- `tests/opening-browser.mjs`
- `tests/overhaul-camera-browser.mjs`
- `tests/overhaul-offline-browser.mjs`
- `tests/overhaul-quest-browser.mjs`
- `tests/overhaul-world-browser.mjs`
- `tests/save-slots-browser.mjs`
- `tests/tutorial-required.test.ts`
- `tests/ui-smoke.mjs`
- `tests/world-maps.test.ts`
- `vite.config.ts`

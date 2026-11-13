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
| `npm test` | **201 tests passed across 18 files**, observed after the camera and graphics rework on November 14. Covers game, pose state machines, nutrition calculations, projections, preferences, food mapping, and web platform failure behavior. | Physical movement accuracy, production service configuration, or end-to-end Android behavior. The release build must also pass after any later changes. |
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

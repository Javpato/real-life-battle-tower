# Battle Tower v2 delivery

## All-exercise camera and learning — 2026-11-15

- Completed: 90 exact skill profiles; 10 existing detectors, 60 assisted counters and 20 camera-preview/manual-confirmation options. Stable personal calibration, conservative interval/side/occlusion checks and exact unverified evidence binding.
- Completed: 90 motion teaching sequences, source/limitation register, library/academy/active-exercise learning, responsive lesson dialog, exact per-skill HUD and English voice guidance, phone-frame integration.
- Verified: 639 tests, production build/shared parity, local SQL, complete tower UI regression, 450 guide renders and synthetic camera/phone integration. Physical human accuracy remains unvalidated; assistance and confirmation cannot create camera verification or Flash cadence.

## Flash, food and in-battle phone update — 2026-11-15

- Completed: visible Flash timer and wider cadence/geometry, meaningful accepted-unit receipts, manual timing labels and repeat pace trials; unified online food search, rear-camera barcode/photo decoding and camera release when entering the journal; phone pairing from active battle with pause/progress preservation.
- Verified: 381 unit tests, build/parity, local SQL suites, five-viewport tower/Flash/pairing flows, synthetic pose/cadence integration, Chromium/WebKit barcode decoding, real provider name/barcode results and real hosted camera signaling/WebRTC with synthetic video.
- Published: updated GitHub Pages runtime; `food-search` and `tower-command` functions; verified Android APK in release `demo-2026-11-15-flash-camera`.
- Remaining validation: physical iPhone autofocus/lighting and real human exercise recognition. Synthetic/WebKit tests do not establish those.

## Public hosting — 2026-11-15

- Published source/assets/tests on https://github.com/Javpato/real-life-battle-tower and the live HTTPS game on https://javpato.github.io/real-life-battle-tower/ . Main pushes build, validate and deploy through GitHub Actions.
- Published the verified Android debug/demo APK as release `demo-2026-11-15`. Local environment files and private credentials are excluded.
- Verified the public game camera and real hosted camera-pair/WebRTC flow using synthetic video. GitHub Pages no longer depends on the temporary tunnel. Physical iPhone validation remains pending.

## Game implementation

- Implemented: six distinct types, mean dual-type attacks, single STAB, four initial learned/equipped attacks, trial opportunities every3floors, boss rewards every5floors,20boss cycle, temporary upgrades and evidence-aware Flash.
- Implemented:90skills,15perdiscipline; all available in Training Grounds;10fixed-loadout challenges; unrestricted routine composition; six trees and interactive matchup codex.
- Integrated:60 illustrated characters,16poses each,32additional hero back poses;128px native exports, portraits,6arenas,title/hub,24icons, revised minigame renderer and unified support screens. All60current sources reviewed; zero unresolved art validation issues. See art-production/v2/validation.json.
- Preserved:camera/phone transport,MediaPipe,coach/calibration,manual input,3slots,cloud command architecture,Android steps and journal. Version1Tower saves backed up/migrated; old active runs retain old rules.
- Tests and evidence:QA.md and art-production/v2/game-captures. Hosted Supabase deployment and physical exercise/device validation are external follow-ups, not claimed as completed.
- Superseded by the camera/learning update above: the former 60-new-exercise manual-only restriction and text-only guides. New visual lessons are teaching schematics; physical detector validation remains pending. Workout mode remains exercise-driven minigames; the older optional workout-final-boss concept is not implemented.

## Presentation fixes — 2026-11-15

- Completed: grounded hub hero; approved title art rendered directly and at crisp scales; English effectiveness labels on all battle moves; one English, named victory announcement per live win.
- Verified: 329 unit tests, production build, shared core parity, local tower/platform SQL, full tower UI regression and five-viewport screenshots. APK refreshed and byte/signature checked.
- Temporary mobile HTTPS is live for the current tunnel process; link, QR and evidence are in QA.md and docs/verification/presentation-mobile.
- Outstanding external service: configured camera-pair function returns HTTP404. The phone's own camera initializes over HTTPS; PC–phone pairing cannot work until backend deployment. Physical exercise accuracy is not established by synthetic-camera tests.

## iPhone companion fix — 2026-11-15

- Completed: independent local camera start, capture-before-ICE negotiation, clear separate statuses, retry and remote-close cleanup, bounded serialized signaling and safe optional-preview replacement.
- Verified: 346 unit tests, production build/parity, SQL suites, game regression, Chromium real peers with synthetic camera, WebKit permission UI, and live HTTPS camera-pair/WebRTC/video path against the user's deployed backend. APK refreshed and package parity checked.
- Published on the existing temporary HTTPS link. Recipients must reload the PC and create a new QR; existing phone invitation tabs cannot be reused after reload.
- Pending physical validation: user must retry on the real iPhone. Automated WebKit and synthetic video do not prove physical exercise recognition.

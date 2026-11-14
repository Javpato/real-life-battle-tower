# Battle Tower v2 delivery

- Implemented: six distinct types, mean dual-type attacks, single STAB, four initial learned/equipped attacks, trial opportunities every3floors, boss rewards every5floors,20boss cycle, temporary upgrades and evidence-aware Flash.
- Implemented:90skills,15perdiscipline; all available in Training Grounds;10fixed-loadout challenges; unrestricted routine composition; six trees and interactive matchup codex.
- Integrated:60 illustrated characters,16poses each,32additional hero back poses;128px native exports, portraits,6arenas,title/hub,24icons, revised minigame renderer and unified support screens. All60current sources reviewed; zero unresolved art validation issues. See art-production/v2/validation.json.
- Preserved:camera/phone transport,MediaPipe,coach/calibration,manual input,3slots,cloud command architecture,Android steps and journal. Version1Tower saves backed up/migrated; old active runs retain old rules.
- Tests and evidence:QA.md and art-production/v2/game-captures. Hosted Supabase deployment and physical exercise/device validation are external follow-ups, not claimed as completed.
- Deliberate coverage limits:60new exercises guided/manual until validated; no per-exercise reviewed pose illustrations yet. Workout mode remains exercise-driven minigames; the older optional workout-final-boss concept is not implemented.

## Presentation fixes — 2026-11-15

- Completed: grounded hub hero; approved title art rendered directly and at crisp scales; English effectiveness labels on all battle moves; one English, named victory announcement per live win.
- Verified: 329 unit tests, production build, shared core parity, local tower/platform SQL, full tower UI regression and five-viewport screenshots. APK refreshed and byte/signature checked.
- Temporary mobile HTTPS is live for the current tunnel process; link, QR and evidence are in QA.md and docs/verification/presentation-mobile.
- Outstanding external service: configured camera-pair function returns HTTP404. The phone's own camera initializes over HTTPS; PC–phone pairing cannot work until backend deployment. Physical exercise accuracy is not established by synthetic-camera tests.

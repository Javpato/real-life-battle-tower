# Task board

| Task | Agent | Branch | Dependencies | Status | Evidence / remaining limits |
|---|---|---|---|---|---|
| Central RPG, nutrition, integration | Astra | main | shared contracts | integrated | Typed commands, save/reload, nutrition equations and historical accounting tested |
| Village, original art and music | combat_review | feature/world | WorldProps | integrated | Browser village and encounter flow; leader labels aligned |
| Camera and six exercise detectors | pose_android_feasibility | feature/pose | ExerciseUnit | integrated; physical QA pending | Synthetic cycles and actual bundled model loading passed |
| Canonical cloud/local controller | pose_android_feasibility | feature/cloud-ui | Edge API | integrated | Command queue, receipt retry, safe control and local separation tested |
| Supabase schema, pairing and security | sync_review | feature/platform | shared reducer | implemented; hosted deployment blocked | Four SQL migrations, explicit GRANT/RLS, complete database-backed campaign passed |
| Shared nutrition diary | sync_review | feature/platform | schema + nutrition contracts | integrated; hosted QA blocked | Outbox, conflicts, lost acknowledgements, erase generations and settings roundtrip tested |
| Android / real step adapters | sync_review | feature/platform | final dist | APK built and verified | Kotlin, signature and packaged asset comparison passed; no ADB device connected |
| Public release | Astra | main | build + browser | public site live; release checks recorded in QA.md | Public trainer victory and saved rewards passed |
| Real Supabase create/save/load | Astra + owner | main | anonymous auth + local CLI login | blocked externally | Auth returned 422 disabled; CLI returned AccessTokenRequiredError |
| Authentic physical demo | owner | — | camera + Android | pending | Nine exercise acceptance flows, actual steps, continuous video and official form |

## Latest integrations

- Shared game source parity verified. All four SQL migrations executed in embedded PostgreSQL, including complete manual campaign through all leaders and rival phases.
- Local/cloud adventure and nutrition data are separate and selected explicitly. No existing local health data is automatically uploaded.
- Historical nutrition profiles now govern historical activity and targets. Extra expenditure and the fraction credited to the food budget are distinct.
- Final counts and release evidence are recorded in QA.md after the release build.

## External actions

Owner enables anonymous sign-ins in the existing project's Authentication settings and runs `npx supabase login` locally. No secret belongs in chat. Then link existing project `mydltosqcvyfmwjmqswo`, inspect/apply migrations, deploy `adventure-command`, and run `supabase/tests/live.mjs`. The public game remains playable locally while hosted setup is incomplete.

## Camera and visual rework integration

| Work | Owner | Status | Evidence |
|---|---|---|---|
| Camera stream lifecycle and unconditional manual arming | sync_review | integrated | 17 mocks, browser camera cycles, real App regression |
| Partial-body detection and three home exercises | pose_android_feasibility | integrated | 64 geometry/state tests; nine basic exercises + central damage |
| Large HUD, optional speech, initial-position guide | Astra | integrated | desktop/landscape counters, pause retention, original movement diagrams |
| Original sprite atlases, world and battle art | combat_review | integrated | four directions, transparency, manifest, actual village gameplay |
| Shift sprint | combat_review | integrated | real keyboard 1.71× movement comparison, same collisions |
| Final composition and new skill UI verification | QA agents | passed | three viewports without clipping; all three new skills equip, damage and finish through UI; no physical accuracy claim |

Hosted Supabase authorization remains unchanged and does not block local gameplay. Physical human-camera validation and Android sensor tests remain pending.


## Immersive interface rework

| Work | Owner / branch | Status | Checks |
|---|---|---|---|
| Root scene separation, fullscreen, RPG command menu and safe dock | Astra / main | integrated | TypeScript; world/menu/commands in five browser viewports |
| Full-viewport Phaser, floating HUD, RPG windows and transitions | combat_review / feature/art-rework | integrated and verified | 1920×1080, 1366×768, 915×412, 844×390, 390×844 |
| Exercise preparation, giant counter, local video and concise feedback | pose_android_feasibility / feature/exercise-presentation | integrated and verified | actual App and isolated HUD; synthetic camera only |
| Native immersive window and visual regression suite | sync_review / test/immersive-qa | native compiled; browser flows verified | no physical Android device connected |
| Final screenshots, public release and matching Android package | Astra + QA | verified; packaging final source | full browser suite and synthetic actual-App damage flow passed |


## Cozylight overhaul integration

- Root: opening, narrative/tutorial composition, per-slot game/journal integration, map help, responsive title, final QA/publication. Worktree `feature/overhaul-opening`.
- Save/platform agent: UUID slots, migration/recovery, cloud isolation/import, canonical journey commands and SQL tests. Worktree `feature/overhaul-saves`.
- World/art agent: three exteriors, fourteen interiors, directional miniature art, heroine, icons and feet anchors. Worktree `feature/overhaul-world`.
- Camera agent: preparation, voice, five-second recalibration, one-click guides, actual-App and offline QA. Worktree `feature/overhaul-camera`.
- Exact test evidence and external blockers are recorded at the top of QA.md. Existing public project identity is preserved.

User review integrated: mandatory onboarding; restored original detailed character/environment art with added animation; improved male title illustration; fixed Ana atlas bleed; reproduced and fixed moving-interaction quest deadlock. Runtime remains in the existing project and deployment identity.

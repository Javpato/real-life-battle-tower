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
| Authentic physical demo | owner | — | camera + Android | pending | Six exercise acceptance flows, actual steps, continuous video and official form |

## Latest integrations

- Shared game source parity verified. All four SQL migrations executed in embedded PostgreSQL, including complete manual campaign through all leaders and rival phases.
- Local/cloud adventure and nutrition data are separate and selected explicitly. No existing local health data is automatically uploaded.
- Historical nutrition profiles now govern historical activity and targets. Extra expenditure and the fraction credited to the food budget are distinct.
- Final counts and release evidence are recorded in QA.md after the release build.

## External actions

Owner enables anonymous sign-ins in the existing project's Authentication settings and runs `npx supabase login` locally. No secret belongs in chat. Then link existing project `mydltosqcvyfmwjmqswo`, inspect/apply migrations, deploy `adventure-command`, and run `supabase/tests/live.mjs`. The public game remains playable locally while hosted setup is incomplete.

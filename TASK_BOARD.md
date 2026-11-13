# Task board
|Task|Owner|Branch|Dependencies|Status|Checks|
|Core, nutrition, app integration|Astra|main|contracts|active|Vitest/build/browser|
|Phaser world and assets|world|feature/world|WorldProps|queued|build + visual|
|Pose pipeline and detectors|pose|feature/pose|ExerciseUnit|queued|synthetic tests; physical pending|
|Supabase and Android adapters|platform|feature/platform|contracts|queued|RLS/native validation pending|

## Integration log
- World, pose, nutrition, native adapters, SQL migrations and mathematical projections integrated into main.
- 81 automated tests passed before latest validation additions; final totals recorded in QA.md.
- Browser journal and first trainer victory flows passed in isolated Chrome contexts.
- Android Kotlin and APK build passed in platform worktree; final APK refresh follows integration.
- Real Supabase endpoint reached. Anonymous auth returned 422 (disabled). CLI linking returned AccessTokenRequiredError; waiting for owner's local login and enabling anonymous sign-ins.
- Public Sites registration created; source repository access verified. Publication pending final package.

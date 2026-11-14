# Battle Tower integration contract

React/Vite/TypeScript, native pixel canvas presentation, Capacitor Android and Supabase remain the stack. English UI. Cozylight studio; Real-Life Battle Tower game. Use isolated worktrees and one writer per file. Integrator owns main entry, persistence and cross-agent interfaces.

## Shared authority
- src/tower/model.ts defines PlayerSave, Skill, Series, TowerRun, WorkoutActivity and TowerCommand. src/tower/engine.ts is the single canonical progression/combat/workout reducer. Presentation must not calculate rewards, damage or accepted progress.
- src/tower/catalog.ts owns the30 physical skills and challenges; generation.ts owns deterministic floors. No XP, levels, old journey compatibility or geographical progression.
- ExerciseCamera/MediaPipe and phone transport emit exercise evidence; never upload camera frames. Only accepted unique events advance. Pausing, stale frames and tracking loss never credit units.
- Camera/manual/mixed provenance is explicit. Experimental detector profiles are not physical validation. Technique stars require evidence; rests never reduce score.
- src/tower/useTower.ts persists atomic local slots and canonical cloud acknowledgements. Three normal slots; developer preview is separate and cannot sync. Nutrition keeps its independent journal and consent boundary.
- Supabase tower-command runs generated source copies. Run node supabase/sync-core.mjs after tower changes and --check before delivery. Service keys stay server-side. Existing linked-device membership, receipts and revision control apply.
- Android steps require native readings and server accounting; no fake production steps. Coins never buy physical unlocks or stats.

## Approved art-method change
- Complex character illustration must use the available image-generation tool or a specialized art model. Python/Pillow/SVG/Canvas are only for image processing, pixel repairs, sheets and presentation, never the primary anatomy/character illustration method.
- Do not regenerate characters with scripts/build-tower-art.py. Its output is the previous art direction awaiting replacement.
- art-review/trainers-v2 is an isolated three-candidate approval proof. Do not integrate or mass-produce the new art until the user approves the direction.

## Visual ownership
- Native source-resolution pixel assets live under public/assets/tower with manifest and reproducible generator. No old RPG graphics. PixelScene maps authoritative accepted progress to visuals; no independent exercise counters.
- World exploration and associated sprites/core are retired. All new screens and support panels must follow the tower visual system.

## Verification
npm test
npm run build
node supabase/sync-core.mjs --check
node supabase/tests/tower.mjs
node supabase/tests/platform.mjs
GAME_URL=http://127.0.0.1:5174 node tests/tower-browser.mjs

Use isolated browser profiles. Five viewports:1920x1080,1366x768,1280x720,915x412,800x360. Inspect real screenshots as well as bounds. Build/repackage Android after final web changes. Update QA.md and TASK_BOARD.md with actual evidence. Never describe synthetic pose tests as physical validation, or local SQL tests as deployed cloud sync.

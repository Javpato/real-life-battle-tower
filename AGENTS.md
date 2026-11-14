# Everstride — integration contract

## Ownership and branches

React/Vite/TypeScript + Phaser, Capacitor/Android, Supabase. Keep the existing stack and hosting identity. English UI; no generative nutrition AI. Root owns integration, app and nutrition; platform owns SQL/native/sync, pose owns detectors and cloud controller, world owns Phaser/art/audio. Writers use isolated worktrees and small commits. Never edit another agent's files concurrently. Root reviews and integrates commits into a playable main.

## Shared contracts

- `src/core/contracts.ts` defines Player, Battle, ExerciseUnit, ExerciseCameraProps and WorldProps. Do not invent alternative player state.
- `src/core/game.ts` owns damage, turns, types, fatigue, progression and rewards. React and detectors do not calculate damage. Nutrition must never reward weight loss or restriction.
- `src/core/commands.ts` owns `AdventureSnapshot` and `AdventureCommand`. UI sends semantic commands through `src/services/useAdventure.ts`. Local writes persist one atomic snapshot; cloud writes accept only canonical server acknowledgements.
- `supabase/functions/adventure-command` uses generated copies of that exact reducer. Run `node supabase/sync-core.mjs` after core edits, then `--check`. Privileged keys stay in the Edge Function environment, never frontend variables.
- `src/exercises` emits verified/unverified ExerciseUnit events with unique session/unit identifiers. MediaPipe processes video locally; never upload camera frames. Pauses and loss of tracking preserve credited progress.
- `src/game/World.tsx` implements WorldProps. Interaction IDs: trainer-1/2/3, leader-leg/arm/back, rival, healer, shop, alchemy, quest-squat/pushup/birddog/lunge.
- `src/nutrition/engine.ts` owns nutrition types and calculations. Unknown nutrients stay null. Keep dated profiles, source snapshots and human confirmation. `dailyEnergySummary` separates expenditure from the food-budget credit policy.
- `src/services/useNutritionSync.ts` owns a separate cloud journal. Never silently upload local records. Pending operations have actor/save-scoped caches, versions, stable IDs and deletion generations. Conflicts require explicit choices.
- Android steps use `src/platform/health.ts`; browser reports unavailable. Never add simulated steps to production. Remote rewards require server semantic accounting.

## Integration checks

```sh
npm test
npm run build
node supabase/sync-core.mjs --check
node supabase/tests/platform.mjs
node tests/ui-smoke.mjs
node tests/adventure-smoke.mjs
```

Browser scripts use fresh isolated Chrome profiles and the local dev server unless configured otherwise. `tests/offline-browser.mjs` targets the production preview on port4173. Physical movement and sensor validation must be recorded separately from fixtures. Never claim real hosted sync until `supabase/tests/live.mjs` passes against the owner's deployed project.

## Secrets and delivery

`.env.local`, native build outputs, CLI temporary state and `releases/` are ignored. Only URL and publishable key belong in VITE variables. Use the owner's local Supabase CLI login; no password/token requests in chat. Keep .openai/hosting.json's existing site project_id. Rebuild and repackage Android after web changes. Update QA.md and TASK_BOARD.md with actual evidence and explicit limitations.

## Active camera and art rework

- Camera agent owns ExerciseCamera.tsx, camera lifecycle modules and lifecycle/browser tests. Root owns App.tsx, ExerciseHUD.tsx, exerciseUi.ts, exercises.css and audio feedback. Recognition agent owns detectors.ts, pose.worker.ts and detector tests. Graphics agent owns game art/World, new public/assets files, manifest, asset registry and ASSET_GUIDE.md. No concurrent edits of these paths.
- Preserve ExerciseCameraProps and core rules. Camera may locally extend it with sessionId?:string, muted?:boolean and mode?:'camera'|'manual'. A new session resets detector cycle/alternation; stream and valid framing can stay open across turns. active=false stops credited events immediately, not the visible control panel. Root keeps the panel mounted across pause/manual/turn states.
- Observation gains optional status/message/missingJoints/observedSide/fresh fields; old synthetic observations remain supported. Use exercise-specific required groups and anatomical sides. Brief cached points can stabilize display/state but cannot authorize a new repetition or held second without fresh evidence. Unknown alternating sides never earn a unit.
- Root's ExerciseHUD receives exerciseId,progress,target,status,message,nextSide,quality,countdown,paused,muted,active. Camera imports it and removes the old tiny readout. status uses no-body|partial|insufficient|ready|moving|return|valid|incomplete|hold|paused|off|loading|error|countdown. Root handles large typography, feedback/audio and optional speech.
- Graphics must be original or legally reusable, with documented provenance. No ROM or copyrighted character extraction. Use real redesigned 128/256 source frames where useful, manifest-driven file assets, crisp sampling, coherent display footprints. Maintain collision/map coordinates and interaction IDs.

## Immersive fullscreen layout rework

Root owns App.tsx integration, fullscreen browser controls, compact player overlay and battle dock actions. Graphics agent owns src/ui/immersive.css and World.tsx viewport sizing, scoped to `.immersive-game`; it must not edit App.tsx or exercise CSS. Pose/UX agent owns ExerciseHUD.tsx, exercises.css and new presentation-only components/styles inside src/exercises; no detection/core changes for this pass. Camera/QA agent audits browser flows/tests and packages only after the final build signal. Existing camera controls remain mounted and reachable; no duplicate command handlers or damage rules. Root supplies `.immersive-game.mode-explore|mode-battle.is-series.input-camera|input-manual`, `.game-hud-player`, `.game-hud-objective`, `.game-hud-controls`, `.series-command-dock` and `.arena-toggle` hooks. Native browser fullscreen is user-initiated with a visible control; the game fills the available viewport without requiring that API.

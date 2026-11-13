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

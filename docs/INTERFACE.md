# Immersive adventure interface

The adventure is a viewport scene, not a document. `src/main.tsx` loads the normal journal styling first and `src/ui/immersive.css` second. All spatial overrides are scoped to `.immersive-game`, so the nutrition journal keeps readable scrolling reports. The root fills `100dvh`; world and HUD are separate layers. Menus scroll internally, never by moving the world off screen.

## Scene ownership

- `src/App.tsx`: scene state, fullscreen user gesture, player/objective HUD, shared safe exercise command dock, canonical-command wiring and overlays.
- `src/game/World.tsx`: Phaser viewport resizing, camera zoom, sharp sprite sampling and touch/keyboard controls. World coordinates and collision logic are unchanged by presentation resizing.
- `src/ui/BattleCommandMenu.tsx`: action → equipped skills or inventory. Effectiveness and STAB are read from the core rules. The component never deals damage. Arrow keys move focus among command buttons; Enter/Space activate them.
- `src/exercises/ExerciseCamera.tsx`: persistent camera and detector lifecycle plus preparation/presentation controls. Collapsing a drawer must not replace its video element.
- `src/exercises/ExerciseHUD.tsx`: accepted progress, side, instruction priority, starting position and optional local voice feedback.
- `src/ui/immersive.css` and `src/exercises/exercises.css`: independent scene and exercise presentation layers.

## Spatial contract

Exploration uses the entire viewport with small player/progression overlays. Battles reserve the lower region for one command menu. A camera series uses approximately 40% for the arena and 60% for body/progress feedback on desktop. Short landscape viewports prioritize the camera and use a compact battle inset. The same camera component remains mounted through preparation, pauses, fallback and turn changes. Manual confirmation is explicitly unverified and uses the existing fatigue rules.

The browser fullscreen button calls the Fullscreen API only after a user action. `fullscreenchange` keeps its state correct after browser-driven exits. Unsupported or rejected requests keep ordinary viewport play functional. Android remains `sensorLandscape`; system bars can reappear with a swipe and Back behavior is retained. A native build does not establish real-device fullscreen or camera performance.

## Visual references

Nintendo's [Ring Fit Adventure introduction](https://www.nintendo.com/jp/ichikara/al3pa/02_en.html) describes side-by-side movement guidance, audio cues, visible success feedback and exercise-based skill selection. These are interaction principles, not copied art or a reproduced HUD. Everstride uses its own forest/gold palette, original atlas artwork and its own camera-based recognition. It does not inherit Ring-Con-specific exercise claims or instructions.

The initial position and movement guides use original drawings. Home-exercise references and source licensing notes are in `docs/POSE.md` and `ASSET_GUIDE.md`. No commercial game images are included in the application.

## Verification

See the latest immersive-layout section of `QA.md` for exact tested resolutions, screenshots, regressions and unverified hardware. Generated camera feeds and synthetic landmarks remain clearly separate from physical exercise trials.

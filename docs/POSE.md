# Local exercise recognition

`ExerciseCamera` implements the shared `ExerciseCameraProps`. Mount it with the current exercise, required units and committed progress; use a React key equal to the attack/session ID so a fresh series resets its alternation history. `active=false` immediately prevents outgoing units. `onUnit` reports one verified repetition, or one verified second for Superman. The combat engine must independently deduplicate `id` and enforce its current session and phase. Quality is in [0,1], not percent. Bird Dog side refers to the extended arm. The component does not apply damage or rewards.

The camera is permission-gated, local-only and stopped on unmount. A dedicated worker runs the official MediaPipe lite pose model with CPU WebAssembly. It processes at most one frame at a time and skips stale video frames. No camera data is sent to any server. The preview is mirrored with CSS; anatomical landmarks are never swapped.

Calibration requires visible joints, a stable starting pose for two seconds, and one practice movement that does not emit a combat unit. A three-second countdown follows; automatic or button-triggered start is available. Guides are skippable and can be opened again. Pause, tracking loss and recalibration preserve committed progress. A partially completed dynamic repetition must restart after a pause. Superman preserves fractions of valid time and excludes gaps above 250 ms. The app's battle controls provide manual continuation and encounter cancellation.

## Assets

- Model: `public/models/pose_landmarker_lite.task`, official model revision float16/1 from https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task .
- WebAssembly files: copied without modification from installed `@mediapipe/tasks-vision` 0.10.35 into `public/models/wasm`. Keep the package and WASM versions identical. The worker uses the module-compatible WASM loader (`forVisionTasks(path, true)`).
- Model/framework source and licensing: https://github.com/google-ai-edge/mediapipe (Apache-2.0). Exercise illustrations are original SVG diagrams in `ExerciseDemo.tsx`.

## Detection limitations

These are game heuristics, not a clinical posture assessment. All required joints must be visible. Side identification for lunges uses a distinctly flexed knee and separated feet; ambiguous side views are rejected instead of guessed. Bird Dog requires opposite arm/leg extension. Superman checks visible elevation and horizontal torso geometry; a single camera cannot prove prone orientation or medical form correctness. Diamond push-ups use the standard push-up detector and do not verify finger placement. Model performance, lighting, occlusion and camera angle affect reliability.

`tests/exercises.test.ts` exercises pure synthetic state transitions, alternation, partial motion, timestamps, hold accounting, missing joints and geometric sanity. Synthetic tests are not physical verification.

Verified during implementation: 15 synthetic tests passed; TypeScript check passed; `node tests/exercises-browser-smoke.mjs http://127.0.0.1:5198` loaded the actual bundled model/WASM in headless Chrome and processed a blank frame, correctly returning no landmarks. This verifies worker startup and inference plumbing only, not camera permission or physical exercise accuracy.

## Physical acceptance — PENDING

For each exercise on desktop and Android: camera permission; recommended framing; calibration; valid unit with actual combat damage; incomplete motion with no damage; tracking loss/recovery without lost progress; pause; cancellation; early victory stopping units. Test both anatomical sides with a mirrored preview. Check lunge side ambiguity and same-side Bird Dog rejection. Measure low-light and lower-performance Android behavior. No physical camera/device validation has been performed by this agent.

# Local exercise recognition

`ExerciseDetector` converts fresh MediaPipe landmarks into verified `ExerciseUnit` events. It never calculates HP, rewards or medical form approval. The central engine independently checks IDs, session, turn and minimum confidence (0.5). Bird Dog's side is the extended arm; lunge's side is the measured active leg. Preview mirroring never swaps anatomical indexes.

## Observation contract

`observePose(exercise, frame, preferredObservedSide?)` returns `visible`, `ready`, `extended`, `side`, `amplitude`, `confidence`, `motion`; optional additions are `status`, `message`, `missingJoints`, `observedSide` and `fresh`. `visible` means the exercise's current evidence is available, not that the entire body is visible. `ready && fresh` can calibrate the initial position. There is no requirement to perform a practice repetition before calibration. The camera lifecycle uses a stable initial position and a countdown; that lifecycle is separate from this detector.

`status` is `no-body`, `partial`, `insufficient`, `ready`, `moving` or `hold`. `missingJoints` names anatomical joints. `observedSide` identifies a measured camera-facing chain for squat/push-up/Superman; it is not an invented alternating side. `side` exists only when the active lunge/Bird Dog side is geometrically distinguishable. `DetectorFeedback` retains `state`, `message`, optional `unit`/`rejected`, with optional HUD `status`/`nextSide`.

### Evidence by exercise

| Exercise | Fresh required evidence | Other checks |
|---|---|---|
| Squat | Either hip–knee–ankle chain | Standing angle >155°, depth <115°; measurable hip movement. Arms and shoulders may be hidden. A visible shoulder is an additional upright check. |
| Push-up / diamond | One shoulder–elbow–wrist chain, same-side hip and either ankle or knee | Horizontal body, observable body alignment, elbow >150° at top and <112° at depth, measurable torso displacement. The far arm/leg is optional. Finger placement is not verified. |
| Lunge | Active hip–knee–ankle, real opposite ankle; both shins for standing reset | Split feet, flexion <118°, distinct knee bend or forward knee/foot geometry. Far hip can be hidden. Ambiguous equally bent sides do not count. |
| Superman | One same-side shoulder, wrist, hip and ankle | Low horizontal torso, arm/leg reach beyond torso, visible elevation. Far floor-hidden limbs are optional. Each valid second contributes independently. |
| Bird Dog | Torso reference, extending shoulder–elbow–wrist and opposite hip–knee–ankle, supporting wrist and knee | Opposite anatomical pair, extended angles, arm/leg projecting away from torso, visible support points. Support elbow and ankle can be hidden. |

Required chains use visibility/presence ≥0.50; anatomical alternating evidence uses ≥0.55. Confidence is the minimum of the actual measured required points, never promoted above the source confidence. Out-of-frame/nonfinite points cannot authorize a unit. These thresholds and angle bands are heuristic configuration, not a clinical standard.

## Filtering, cycles and recovery

Positions are aspect-corrected and smoothed with a 65 ms exponential time constant. A newly visible point is not blended from its previous hidden/inferred position. Entry and exit angle bands provide hysteresis. Starting/depth stability is 180 ms, return stability 140 ms, and a cycle must last at least 650 ms after leaving the starting band. Complete depth and return are required; a noisy sample or small bounce cannot count.

A chosen nonalternating body chain is locked during the cycle. Switching from one hidden leg/arm to the other cannot assemble a phantom repetition. A long loss resets that lock so a new, clearly observed initial position can recover automatically.

Call `update(frame)` even when tracking is partial: it retains unfinished cycle state for at most 400 ms, resets stability and freezes time credit. Cached points may stabilize state/display but never authorize a unit or a held second. There must be new stable visible evidence after recovery. Loss beyond 400 ms resets only the unfinished cycle; alternation and saved Superman fractions remain. Frame gaps above 250 ms also cannot contribute elapsed held time. A brief occlusion at the only observed depth may still invalidate the repetition because stable depth was never verified.

`pause()` resets an unfinished cycle, filtering and lock but preserves completed alternation and held-time fractions. Construct a new detector with the new session ID to reset the entire session. Do not call `pause()` on every invisible raw frame: that defeats short-loss recovery. `active=false` in the camera immediately suppresses unit delivery independently of the inference worker.

## Worker and assets

A dedicated worker runs MediaPipe's lite pose model with CPU WebAssembly, one pose and no segmentation. Camera frames remain on the device. Every transferred bitmap is closed, including invalid or uninitialized frames. Reinitialization closes an existing landmarker. Detection, presence and tracking thresholds are 0.50; downstream exercise confidence remains independently enforced.

- Model: `public/models/pose_landmarker_lite.task`, official float16/1 model from https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task .
- WASM: `public/models/wasm`, copied unchanged from the installed `@mediapipe/tasks-vision` package. Keep package and WASM versions aligned. The worker uses `forVisionTasks(path, true)` for module-compatible loading.
- Framework/model provenance: https://github.com/google-ai-edge/mediapipe (Apache-2.0). `ExerciseDemo.tsx` contains original SVG guides.

## Verification and limits

`tests/exercises.test.ts` retains the original state-machine contracts: cycle completion, quality, alternation, incomplete movement, timing, pause, hold fractions and geometry. One old assertion required rejection when either knee disappeared; that assertion was intentionally replaced with acceptance of the other complete leg and rejection when neither chain is visible, matching the new lateral-view requirement.

`tests/exercises-geometry.test.ts` uses actual 33-landmark geometry and full smoothed cycles: lateral squats without arms, near-side push-ups/diamond, knee references, partial and ambiguous lunges, strict alternation, opposite-limb Bird Dog from lateral/three-quarter views, same-side rejection, low Superman, camera aspect ratio, noise, short/long occlusion, chain switching, hold fractions and confidence bounds. These fixtures are not physical camera validation. The worker browser smoke loads real model/WASM and infers a blank frame; it validates plumbing, not exercise accuracy.

A monocular camera cannot prove prone orientation, foot contact, exact hand/finger position or safe medical technique. Partial occlusion is supported only when the remaining evidence suffices; ambiguous anatomical sides are deliberately rejected. Real lighting, clothing, lens angle and model misidentification remain unverified risks.

## Physical acceptance — PENDING

For every exercise on desktop and Android: grant permission; follow the exercise-specific starting pose; calibrate without a practice repetition; complete a real unit and observe canonical damage; perform incomplete movement with no damage; briefly hide an irrelevant limb; hide a required chain; recover without losing credited progress; pause; cancel; test early victory. Test anatomical left/right alternation with mirrored preview and both camera-facing sides. For Superman, verify low floor placement and no time credited during tracking loss. Check lower-light and lower-performance phones. No physical camera/device validation was performed by the recognition agent.

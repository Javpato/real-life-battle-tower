# Detection evidence and validation boundaries

## Evidence used

- [BlazePose (2020)](https://arxiv.org/abs/2006.10204) describes an on-device pose pipeline with 33 landmarks. These are estimates, not direct measurements of joint movement.
- [BlazePose GHUM Holistic (2022)](https://arxiv.org/abs/2206.11678) extends monocular on-device pose tracking. Occlusion and camera perspective remain relevant to this game's 2D geometry.
- [Casiez, Roussel and Vogel, CHI 2012](https://gery.casiez.net/1euro/) defines the speed-adaptive One Euro filter. We implemented the recurrence independently: minimum cutoff 1.7 Hz, beta 1.2, derivative cutoff 1 Hz. These are engineering defaults, not clinically validated parameters.
- [Camera positioning observational study, JMIR 2026](https://pmc.ncbi.nlm.nih.gov/articles/PMC12978916/) evaluates smartphone positioning for exercise pose estimation. This motivates collecting multiple angles; its results are not accuracy results for our detector.
- [Viewpoint-Invariant Exercise Repetition Counting (2021)](https://arxiv.org/abs/2107.13760) studies temporal skeletal repetition counting. Our deterministic full-cycle rules are not that trained model and inherit none of its reported performance.
- [Google's maintained web example](https://github.com/google-ai-edge/mediapipe-samples-web/blob/main/src/tasks/pose-landmarker.ts) identifies the optional Full model. Lite remains bundled. Full downloads only on explicit request and caches a public model locally. Neither choice is advertised as proven better on this device.

## Implemented engineering decisions

Coordinates use aspect-corrected x. A speed-adaptive filter reduces small jitter; current raw visibility always controls evidence. Missing joints are never interpolated. Large isolated coordinate jumps are suppressed; two consistent samples can reacquire a genuinely changed location. Filter history resets on missing joints, pauses and long gaps. The displayed skeleton and detector use the same filtered frame, while start/end/hold evidence must also satisfy raw observations. Thus smoothing cannot extend a hold after raw posture loss.

Sit-to-stand and bridge use stable baseline proportions instead of a moving scale. Bridge needs the visible shoulder/hip/knee chain; when ankle is visible it also checks bent-knee/foot geometry. When feet are absent, it explicitly cannot check their support. A complete observed hip lift/return can count, without claiming medical form correctness.

Cropped squats require an explicit choice, an upright reference, visible shoulder/hip/knee evidence, a hip descent and complete return. Units are labelled estimated/unverified. Static poses, missing essential joints and unobserved depth cannot fabricate credit. Full-leg tracking remains the default.

Transport has at most one captured frame in flight. Responses exceeding 500 ms capture-to-result are delivered as tracking loss, never as old body coordinates. Request IDs prevent old replies consuming a new request. Inference time and capture-to-result time are measured separately and shown in model options; no benchmark is inferred from a single sample. Phone clocks/freshness are validated by the companion receiver and again by the exercise surface. Source changes stop local camera tracks and invalidate old movement evidence.

Correction messages dwell for 800 ms within an unchanged presentation state. Loss, pause, errors, countdown and detector-state changes remain immediate. Speech and the HUD consume the same displayed instruction. Resume requires fresh calibration while canonical completed units and alternation remain intact.

## Real labelled clip evaluation

No labelled real exercise clips were supplied. Synthetic tests verify invariants and boundary cases; they do **not** establish real-world recall, precision, safety, Android performance or camera placement reliability. Physical testing across body proportions, clothing, lighting, viewpoints, mobility ranges and occlusion is still required. Full vs Lite must be measured on representative devices with the same clips.

Run Vite locally, then:

```sh
node tests/evaluate-pose-clips.mjs /absolute/path/labelled-clips.json http://127.0.0.1:5188
```

The input is an array of `LabelledPoseClip` from `src/exercises/evaluation.ts`. Each clip contains `id`, `exerciseId`, sequential raw `frames` (`timestamp` milliseconds, `width`, `height`, 33 `landmarks` with x/y/visibility/presence), and independently annotated `expected` cycle-return events (`timestamp`, optional anatomical `side`). Use hold-second milestones for Superman. Optional `calibration` is an independently identified starting frame; `allowPartialSquat` records explicit estimate mode. `toleranceMs` defaults to 1000.

The harness only replays local landmark data through the actual detector; it does not upload video or landmarks. It reports count error, unmatched detections, missed annotated events, side-aware matched events and timing offsets. Unmatched detections can include duplicate or mistimed counts and must be reviewed against the source clip. Label stationary/no-exercise, partial cycles, loss, switching sides and pauses separately; do not report only successful positive clips. Landmark replay does not benchmark image inference: record source model, inference timing, camera geometry and device alongside clips, and compare Lite/Full using independent landmark exports of the same footage.

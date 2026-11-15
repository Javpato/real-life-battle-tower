import type { PoseFrame } from "./detectors";
import { createExerciseDetector } from "./assistedDetector";
import { PoseFilter } from "./poseFilter";
import type { ExerciseId, ExerciseUnit } from "../core/contracts";
/** Local, labelled landmark replay. No benchmark is supplied or implied by this harness. */
export interface LabelledPoseClip {
  id: string;
  exerciseId: ExerciseId;
  /** Exact skill is required to evaluate assisted profiles rather than a legacy transport family. */
  skillId?: string;
  recognitionTolerance?: "standard" | "flash";
  /** Match the live camera filter unless the supplied frames are already processed. */
  filter?: boolean;
  source?: "screen-recording-reinference" | "camera-landmarks" | "synthetic";
  notes?: string;
  frames: PoseFrame[];
  expected: { timestamp: number; side?: "left" | "right" }[];
  toleranceMs?: number;
  allowPartialSquat?: boolean;
  calibration?: PoseFrame;
  /** Warm the live filter on setup frames, then calibrate at the first visible frame at/after this timestamp. */
  calibrationAtMs?: number;
}
export function evaluatePoseClip(clip: LabelledPoseClip) {
  const detector = createExerciseDetector(clip.exerciseId, clip.id, undefined, {
    skillId: clip.skillId,
    tolerance: clip.recognitionTolerance,
    allowPartialSquat: clip.allowPartialSquat,
  });
  const filter = new PoseFilter();
  const process = (frame: PoseFrame) =>
    clip.filter === false ? frame : filter.process(frame);
  if (clip.calibration && !detector.recalibrate(process(clip.calibration)))
    throw new Error("Invalid labelled calibration");
  let calibrated = clip.calibrationAtMs === undefined;
  const detected: { timestamp: number; unit: ExerciseUnit }[] = [];
  for (const frame of clip.frames) {
    const processed = process(frame);
    if (!calibrated) {
      if (frame.timestamp >= clip.calibrationAtMs!)
        calibrated = detector.recalibrate(processed);
      if (!calibrated) continue;
    }
    const result = detector.update(processed);
    if (result.unit)
      detected.push({ timestamp: frame.timestamp, unit: result.unit });
  }
  const unmatched = new Set(clip.expected.map((_, i) => i));
  let matched = 0;
  const timingErrors: number[] = [];
  for (const event of detected) {
    const candidates = [...unmatched]
      .filter(
        (i) =>
          (!clip.expected[i].side ||
            clip.expected[i].side === event.unit.side) &&
          Math.abs(event.timestamp - clip.expected[i].timestamp) <=
            (clip.toleranceMs ?? 1000),
      )
      .sort(
        (a, b) =>
          Math.abs(event.timestamp - clip.expected[a].timestamp) -
          Math.abs(event.timestamp - clip.expected[b].timestamp),
      );
    const index = candidates[0];
    if (index !== undefined) {
      unmatched.delete(index);
      matched++;
      timingErrors.push(event.timestamp - clip.expected[index].timestamp);
    }
  }
  return {
    id: clip.id,
    skillId: clip.skillId,
    source: clip.source ?? "unspecified",
    calibrated,
    notes: clip.notes,
    expected: clip.expected.length,
    detected: detected.length,
    matched,
    missed: unmatched.size,
    unmatchedDetections: detected.length - matched,
    countAbsoluteError: Math.abs(detected.length - clip.expected.length),
    timingErrorsMs: timingErrors,
    events: detected,
  };
}

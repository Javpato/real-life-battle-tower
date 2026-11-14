import { ExerciseDetector, type PoseFrame } from "./detectors";
import type { ExerciseId, ExerciseUnit } from "../core/contracts";
/** Local, labelled landmark replay. No benchmark is supplied or implied by this harness. */
export interface LabelledPoseClip {
  id: string;
  exerciseId: ExerciseId;
  frames: PoseFrame[];
  expected: { timestamp: number; side?: "left" | "right" }[];
  toleranceMs?: number;
  allowPartialSquat?: boolean;
  calibration?: PoseFrame;
}
export function evaluatePoseClip(clip: LabelledPoseClip) {
  const detector = new ExerciseDetector(clip.exerciseId, clip.id, undefined, {
    allowPartialSquat: clip.allowPartialSquat,
  });
  if (clip.calibration && !detector.recalibrate(clip.calibration))
    throw new Error("Invalid labelled calibration");
  const detected: { timestamp: number; unit: ExerciseUnit }[] = [];
  for (const frame of clip.frames) {
    const result = detector.update(frame);
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

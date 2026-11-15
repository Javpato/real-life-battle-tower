import { describe, it, expect } from "vitest";
import { AssistedExerciseDetector } from "../src/exercises/assistedDetector";
import { ExerciseDetector, type PoseFrame } from "../src/exercises/detectors";
import { SKILL_BY_ID } from "../src/tower/catalog";
import type { ExerciseUnit } from "../src/core/contracts";

// Synthetic regression geometry, not a substitute for local recorded-pose replay.
function standing(): PoseFrame {
  const landmarks = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 0,
    presence: 0,
  }));
  for (let i = 0; i < 2; i++)
    for (const [j, y] of [
      [11, 0.2],
      [23, 0.48],
      [25, 0.67],
      [27, 0.87],
    ])
      landmarks[j + i] = {
        x: 0.45 + i * 0.1,
        y,
        visibility: 0.99,
        presence: 0.99,
      };
  return { timestamp: 0, width: 600, height: 600, landmarks };
}
function lower(a: PoseFrame, dy = 0.09) {
  const b = structuredClone(a);
  for (const i of [11, 12, 23, 24]) b.landmarks[i].y += dy;
  return b;
}
function run(id: string, start: PoseFrame, end: PoseFrame, dwell = 100) {
  const d = new AssistedExerciseDetector(
    id,
    SKILL_BY_ID[id].exercise,
    "regression",
  );
  expect(d.recalibrate(start)).toBe(true);
  let time = 0;
  const units: ExerciseUnit[] = [];
  const feed = (f: PoseFrame, count: number) => {
    for (let n = 0; n < count; n++) {
      const u = d.update({ ...f, timestamp: (time += 50) }).unit;
      if (u) units.push(u);
    }
  };
  feed(start, 6);
  feed(lower(start, (end.landmarks[23].y - start.landmarks[23].y) * 0.5), 2);
  feed(end, dwell / 50);
  feed(start, 5);
  return { units, feed };
}
describe("front camera leg movement regressions", () => {
  it("counts a frontal sumo bend even when projected knees stay nearly straight", () => {
    const a = standing();
    a.landmarks[27].x = 0.35;
    a.landmarks[28].x = 0.65;
    expect(run("sumo-squat", a, lower(a), 200).units).toHaveLength(1);
  });
  it("counts sit to stand from a seated height without needing a side-on knee angle", () => {
    const top = standing(),
      seat = lower(top, 0.13);
    expect(run("sitstand", seat, top, 300).units).toHaveLength(1);
  });
  it("requires the real pause at the comfortable squat depth", () => {
    const a = standing(),
      b = lower(a, 0.07);
    expect(run("pause-squat", a, b, 100).units).toHaveLength(0);
    expect(run("pause-squat", a, b, 900).units).toHaveLength(1);
  });
  it("uses the supporting leg and does not count lifting a foot alone", () => {
    const a = standing(),
      lift = structuredClone(a);
    lift.landmarks[28].y -= 0.08;
    lift.landmarks[26].y -= 0.06;
    expect(run("single-leg-squat", a, lift, 500).units).toHaveLength(0);
    const b = lower(lift, 0.065);
    const r = run("single-leg-squat", a, b, 500);
    expect(r.units).toHaveLength(1);
    expect(r.units[0].side).toBe("left");
    r.feed(b, 12);
    r.feed(a, 5);
    expect(r.units).toHaveLength(1);
  });
  it("does not interpret whole-body translation or standing jitter as a squat", () => {
    const a = standing(),
      translated = structuredClone(a);
    translated.landmarks.forEach((p) => (p.y += 0.05));
    expect(run("sumo-squat", a, translated, 500).units).toHaveLength(0);
    expect(run("sumo-squat", a, lower(a, 0.008), 500).units).toHaveLength(0);
  });
  it("counts ordinary squats from the front with natural narrow feet", () => {
    const a = standing(),
      b = lower(a, 0.08),
      d = new ExerciseDetector("squat", "frontal");
    expect(d.recalibrate(a)).toBe(true);
    let time = 0;
    const units: ExerciseUnit[] = [];
    for (const [pose, count] of [
      [a, 8],
      [lower(a, 0.03), 4],
      [b, 8],
      [a, 8],
    ] as const)
      for (let n = 0; n < count; n++) {
        const u = d.update({ ...pose, timestamp: (time += 50) }).unit;
        if (u) units.push(u);
      }
    expect(units).toHaveLength(1);
  });
});

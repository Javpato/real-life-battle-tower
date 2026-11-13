import { describe, expect, it } from "vitest";
import {
  ExerciseDetector,
  angle,
  observePose,
  type Observation,
  type PoseFrame,
  type Side,
} from "../src/exercises/detectors";
import type { ExerciseId, ExerciseUnit } from "../src/core/contracts";

const observation = (overrides: Partial<Observation> = {}): Observation => ({
  visible: true,
  ready: true,
  extended: false,
  amplitude: 0,
  confidence: 0.95,
  motion: 0,
  ...overrides,
});
function rep(
  detector: ExerciseDetector,
  start: number,
  side?: Side,
): ExerciseUnit[] {
  const units: ExerciseUnit[] = [];
  const points: [number, Partial<Observation>][] = [
    [0, {}],
    [200, {}],
    [400, { ready: false, motion: 0.1, amplitude: 0.2 }],
    [600, { ready: false, extended: true, motion: 0.8, amplitude: 0.95, side }],
    [800, { ready: false, extended: true, motion: 1, amplitude: 1, side }],
    [1000, { ready: false, motion: 0.5, amplitude: 0.5 }],
    [1200, {}],
    [1400, {}],
  ];
  for (const [delta, o] of points) {
    const result = detector.updateObservation(observation(o), start + delta);
    if (result.unit) units.push(result.unit);
  }
  return units;
}

describe("exercise cycle and quality contracts", () => {
  it.each<ExerciseId>(["squat", "pushup", "diamond"])(
    "%s emits once after a full return and never computes damage",
    (id) => {
      const d = new ExerciseDetector(id, "fixture");
      const units = rep(d, 0);
      expect(units).toHaveLength(1);
      expect(units[0].verified).toBe(true);
      expect(units[0].quality).toBeGreaterThan(0.7);
      expect(units[0]).not.toHaveProperty("damage");
      expect(d.updateObservation(observation(), 1600).unit).toBeUndefined();
    },
  );
  it("does not count a bounce or incomplete movement", () => {
    const d = new ExerciseDetector("squat");
    d.updateObservation(observation(), 0);
    d.updateObservation(observation(), 200);
    d.updateObservation(observation({ ready: false, motion: 0.1 }), 400);
    expect(d.updateObservation(observation(), 600)).toMatchObject({
      rejected: true,
    });
  });
  it.each<ExerciseId>(["lunge", "birddog"])(
    "%s enforces anatomical alternation",
    (id) => {
      const d = new ExerciseDetector(id, "alternation");
      expect(rep(d, 0, "right")).toHaveLength(1);
      expect(d.expectedSide).toBe("left");
      expect(rep(d, 1600, "right")).toHaveLength(0);
      expect(d.expectedSide).toBe("left");
      const units = rep(d, 3200, "left");
      expect(units).toHaveLength(1);
      expect(units[0].side).toBe("left");
    },
  );
  it("rejects indistinguishable sides", () => {
    expect(rep(new ExerciseDetector("lunge"), 0)).toHaveLength(0);
  });
  it("cannot finish an interrupted cycle after tracking loss", () => {
    const d = new ExerciseDetector("squat");
    rep(d, 0);
    d.updateObservation(
      observation({ ready: false, extended: true, motion: 1 }),
      1600,
    );
    d.updateObservation(observation({ visible: false }), 1800);
    expect(d.updateObservation(observation(), 2000).unit).toBeUndefined();
    expect(d.updateObservation(observation(), 2200).unit).toBeUndefined();
  });
  it("pause preserves alternation and fresh IDs", () => {
    const d = new ExerciseDetector("birddog", "ids");
    const first = rep(d, 0, "left")[0];
    d.pause();
    expect(d.expectedSide).toBe("right");
    const second = rep(d, 2000, "right")[0];
    expect(second.id).not.toBe(first.id);
  });
  it.each<ExerciseId>(["lunge", "birddog"])(
    "%s restores canonical alternation after a same-session remount",
    (id) => {
      const first = rep(
        new ExerciseDetector(id, "restored-session"),
        0,
        "left",
      )[0];
      const restored = new ExerciseDetector(id, "restored-session", first.side);
      expect(restored.expectedSide).toBe("right");
      expect(rep(restored, 2000, "left")).toHaveLength(0);
      restored.pause();
      const next = rep(restored, 4000, "right");
      expect(next).toHaveLength(1);
      expect(next[0].side).toBe("right");
      expect(next[0].id).not.toBe(first.id);
    },
  );
  it("uses distinct unit IDs when a nonalternating detector remounts in the same session", () => {
    const first = rep(new ExerciseDetector("squat", "same-session"), 0)[0];
    const next = rep(new ExerciseDetector("squat", "same-session"), 0)[0];
    expect(next.id).not.toBe(first.id);
  });
  it("holds count real visible seconds, preserve fractions and exclude gaps", () => {
    const d = new ExerciseDetector("superman");
    const held = observation({ extended: true, amplitude: 1 });
    let count = 0;
    for (let t = 0; t <= 800; t += 200)
      if (d.updateObservation(held, t).unit) count++;
    expect(count).toBe(0);
    d.pause();
    for (let t = 2000; t <= 2600; t += 200)
      if (d.updateObservation(held, t).unit) count++;
    expect(count).toBe(1);
    expect(d.updateObservation(held, 10000).unit).toBeUndefined();
    expect(d.updateObservation(held, 10000).unit).toBeUndefined();
  });
  it("does not count arm movement without torso motion as a push-up", () => {
    const d = new ExerciseDetector("pushup");
    for (let t = 0; t <= 200; t += 200) d.updateObservation(observation(), t);
    for (let t = 400; t <= 1000; t += 200)
      d.updateObservation(
        observation({ ready: false, extended: true, amplitude: 1, motion: 0 }),
        t,
      );
    d.updateObservation(observation(), 1200);
    expect(d.updateObservation(observation(), 1400).rejected).toBe(true);
  });
});

describe("pose geometry", () => {
  const frame = (): PoseFrame => {
    const landmarks = Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.5,
      visibility: 0.99,
    }));
    for (const i of [11, 12])
      landmarks[i] = { x: 0.45 + (i - 11) * 0.05, y: 0.2, visibility: 0.99 };
    for (const i of [23, 24])
      landmarks[i] = { x: 0.45 + (i - 23) * 0.05, y: 0.45, visibility: 0.99 };
    for (const i of [25, 26])
      landmarks[i] = { x: 0.45 + (i - 25) * 0.05, y: 0.65, visibility: 0.99 };
    for (const i of [27, 28])
      landmarks[i] = { x: 0.45 + (i - 27) * 0.05, y: 0.85, visibility: 0.99 };
    return { timestamp: 0, width: 480, height: 480, landmarks };
  };
  it("recognizes straight starting legs", () => {
    expect(observePose("squat", frame())).toMatchObject({
      visible: true,
      ready: true,
      extended: false,
    });
  });
  it("accepts the visible leg and rejects when neither complete leg is visible", () => {
    const f = frame();
    f.landmarks[25].visibility = 0.1;
    expect(observePose("squat", f)).toMatchObject({
      visible: true,
      observedSide: "right",
    });
    f.landmarks[26].visibility = 0.1;
    expect(observePose("squat", f).visible).toBe(false);
  });
  it("uses angle geometry and guards degenerate points", () => {
    expect(angle({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(90);
    expect(angle({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(0);
  });
  it("requires opposite limbs for Bird Dog, never same-side extension", () => {
    const f = frame();
    const put = (i: number, x: number, y: number) => {
      f.landmarks[i] = { x, y, visibility: 0.99 };
    };
    put(11, 0.38, 0.4);
    put(12, 0.4, 0.42);
    put(23, 0.62, 0.4);
    put(24, 0.64, 0.42);
    put(13, 0.25, 0.4);
    put(15, 0.12, 0.4);
    put(14, 0.4, 0.55);
    put(16, 0.4, 0.7);
    put(25, 0.76, 0.4);
    put(27, 0.9, 0.4);
    put(26, 0.64, 0.57);
    put(28, 0.78, 0.57);
    expect(observePose("birddog", f).extended).toBe(false);
    put(25, 0.62, 0.57);
    put(27, 0.76, 0.57);
    put(26, 0.77, 0.42);
    put(28, 0.92, 0.42);
    expect(observePose("birddog", f)).toMatchObject({
      extended: true,
      side: "left",
    });
  });
});

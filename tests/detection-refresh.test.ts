import { describe, it, expect } from "vitest";
import { OneEuro, PoseFilter } from "../src/exercises/poseFilter";
import { FeedbackDwell } from "../src/exercises/feedbackDwell";
import {
  ExerciseDetector,
  observePose,
  type PoseFrame,
} from "../src/exercises/detectors";
const frame = (timestamp: number, x = 0.5): PoseFrame => ({
  timestamp,
  width: 480,
  height: 480,
  landmarks: Array.from({ length: 33 }, () => ({
    x,
    y: 0.5,
    visibility: 0.95,
    presence: 0.95,
  })),
});
describe("adaptive filtering preserves current evidence", () => {
  it("reduces small stationary jitter and resets across a gap", () => {
    const f = new OneEuro();
    const values = Array.from({ length: 30 }, (_, i) =>
      f.update(0.5 + (i % 2 ? 0.01 : -0.01), i * 70),
    );
    expect(
      Math.max(...values.slice(10)) - Math.min(...values.slice(10)),
    ).toBeLessThan(0.02);
    expect(f.update(0.8, 3000)).toBe(0.8);
  });
  it("rejects a one-frame jump without drawing or crediting an invented joint", () => {
    const f = new PoseFilter();
    f.process(frame(0));
    const spike = f.process(frame(70, 0.95));
    expect(spike.spikeJoints).toHaveLength(33);
    expect(spike.landmarks[23].visibility).toBe(0);
    const recovered = f.process(frame(140));
    expect(recovered.landmarks[23].x).toBe(0.5);
    expect(recovered.landmarks[23].visibility).toBe(0.95);
  });
  it("never smooths old visibility into a missing frame and rejects stale timestamps", () => {
    const f = new PoseFilter();
    f.process(frame(0));
    const missing = frame(70);
    missing.landmarks[23].visibility = 0;
    expect(f.process(missing).landmarks[23].visibility).toBe(0);
    expect(
      f.process(frame(60)).landmarks.every((p) => p.visibility === 0),
    ).toBe(true);
  });
});
describe("message dwell", () => {
  it("holds changing correction text for 800ms but immediately reports loss/pause", () => {
    const d = new FeedbackDwell();
    expect(d.update("Lower", "incomplete", 0)).toBe("Lower");
    expect(d.update("Rise", "incomplete", 100)).toBe("Lower");
    expect(d.update("Rise", "incomplete", 899)).toBe("Lower");
    expect(d.update("Rise", "incomplete", 900)).toBe("Rise");
    expect(d.update("Lost view", "no-body", 901)).toBe("Lost view");
    expect(d.update("Paused", "paused", 902)).toBe("Paused");
  });
});
describe("cropped squat consent and baseline", () => {
  const cropped = (t: number) => {
    const f = frame(t);
    f.landmarks.forEach((p) => (p.visibility = 0));
    for (const [i, x, y] of [
      [11, 0.4, 0.2],
      [23, 0.4, 0.45],
      [25, 0.4, 0.7],
    ])
      f.landmarks[i] = { x, y, visibility: 0.95, presence: 0.95 };
    return f;
  };
  it("requires explicit opt in and fresh calibration, with no credit for static standing", () => {
    expect(observePose("squat", cropped(0)).visible).toBe(false);
    expect(
      observePose("squat", cropped(0), undefined, { allowPartialSquat: true }),
    ).toMatchObject({
      visible: true,
      estimated: true,
      ready: true,
      extended: false,
    });
    const d = new ExerciseDetector("squat", "crop", undefined, {
      allowPartialSquat: true,
    });
    expect(d.recalibrate(cropped(0))).toBe(true);
    for (let t = 70; t < 3000; t += 70)
      expect(d.update(cropped(t)).unit).toBeUndefined();
  });
});

it("does not flash alternating nonurgent framing statuses", () => {
  const d = new FeedbackDwell();
  expect(d.update("Show knee", "partial", 0)).toBe("Show knee");
  expect(d.update("Stand tall", "insufficient", 100)).toBe("Show knee");
  expect(d.update("Show knee", "partial", 200)).toBe("Show knee");
  expect(d.update("Hold still", "ready", 300)).toBe("Show knee");
  expect(d.update("Hold still", "ready", 1100)).toBe("Hold still");
  expect(d.update("Begin", "countdown", 1101)).toBe("Begin");
});
it("credits a complete cropped hip cycle only as an explicit estimate", () => {
  const make = (t: number, q: number): PoseFrame => {
    const f = frame(t);
    f.landmarks.forEach((p) => (p.visibility = 0));
    for (const [i, x, y, dx, dy] of [
      [11, 0.4, 0.2, 0, 0.15],
      [23, 0.4, 0.45, -0.15, 0.2],
      [25, 0.4, 0.7, 0.15, 0],
    ])
      f.landmarks[i] = {
        x: x + dx * q,
        y: y + dy * q,
        visibility: 0.95,
        presence: 1,
      };
    return f;
  };
  const d = new ExerciseDetector("squat", "crop-cycle", undefined, {
    allowPartialSquat: true,
  });
  expect(d.recalibrate(make(0, 0))).toBe(true);
  const units = [];
  for (let t = 80; t <= 2560; t += 80) {
    const q =
      t <= 480
        ? 0
        : t <= 960
          ? (t - 480) / 480
          : t <= 1440
            ? 1
            : t <= 1920
              ? 1 - (t - 1440) / 480
              : 0;
    const result = d.update(make(t, q));
    if (result.unit) units.push(result.unit);
  }
  expect(units).toHaveLength(1);
  expect(units[0].verified).toBe(false);
});

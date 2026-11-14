import { describe, it, expect } from "vitest";
import {
  ExerciseDetector,
  observePose,
  type PoseFrame,
} from "../src/exercises/detectors";
import type { ExerciseUnit } from "../src/core/contracts";
// Anatomically proportioned synthetic side views. Angles are measured at the knee;
// these are algorithm regressions, not captured people or clinical accuracy data.
function chairFrame(
  t: number,
  kneeAngle: number,
  standingFraction: number,
  thigh = 0.22,
  shin = 0.24,
  scale = 1,
): PoseFrame {
  const a = (kneeAngle * Math.PI) / 180;
  const seat = { x: 0.56 - thigh * Math.sin(a), y: 0.64 + thigh * Math.cos(a) };
  const stand = { x: 0.56, y: 0.64 - thigh };
  const hip = {
    x: seat.x + (stand.x - seat.x) * standingFraction,
    y: seat.y + (stand.y - seat.y) * standingFraction,
  };
  const f: PoseFrame = {
    timestamp: t,
    width: 480,
    height: 480,
    landmarks: Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.5,
      visibility: 0,
      presence: 1,
    })),
  };
  for (const [i, x, y] of [
    [11, hip.x, hip.y - 0.27],
    [23, hip.x, hip.y],
    [25, 0.56, 0.64],
    [27, 0.56, 0.64 + shin],
  ])
    f.landmarks[i] = {
      x: 0.5 + (x - 0.5) * scale,
      y: 0.5 + (y - 0.5) * scale,
      visibility: 0.96,
      presence: 1,
    };
  return f;
}
function run(
  angle: number,
  options: {
    depth?: number;
    scale?: number;
    thigh?: number;
    shin?: number;
    returnFraction?: number;
    edit?: (f: PoseFrame, t: number) => void;
  } = {},
) {
  const d = new ExerciseDetector("sitstand", "chair-height"),
    units: ExerciseUnit[] = [];
  for (let t = 0; t <= 3200; t += 80) {
    const depth = options.depth ?? 1,
      back = options.returnFraction ?? 0;
    const q =
      t <= 640
        ? 0
        : t <= 1280
          ? ((t - 640) / 640) * depth
          : t <= 1760
            ? depth
            : t <= 2400
              ? depth + ((back - depth) * (t - 1760)) / 640
              : back;
    const f = chairFrame(
      t,
      angle,
      q,
      options.thigh,
      options.shin,
      options.scale,
    );
    options.edit?.(f, t);
    const result = d.update(f);
    if (result.unit) units.push(result.unit);
  }
  return { d, units };
}
describe("chair height aware seated reference", () => {
  it.each([85, 90, 105, 125, 135, 145, 151])(
    "counts seated → upright → same %i° seat without extra descent",
    (angle) => {
      const seated = chairFrame(0, angle, 0);
      expect(observePose("sitstand", seated).ready).toBe(true);
      // The reported failing high chairs are outside the old hard-coded <130° range.
      expect(run(angle).units).toHaveLength(1);
    },
  );
  it.each([
    [0.16, 0.29, 0.65],
    [0.3, 0.18, 0.9],
    [0.24, 0.24, 1.15],
  ])(
    "normalizes different proportions and camera scales (%s,%s,%s)",
    (thigh, shin, scale) => {
      for (const angle of [90, 135, 145])
        expect(run(angle, { thigh, shin, scale }).units).toHaveLength(1);
    },
  );
  it("learns a stable seated baseline instead of accepting a single passing chair-height frame", () => {
    const d = new ExerciseDetector("sitstand");
    expect(d.update(chairFrame(0, 145, 0)).message).toMatch(/Sit still/);
    expect(d.update(chairFrame(80, 145, 0)).message).toMatch(/Sit still/);
    expect(d.update(chairFrame(160, 145, 0)).message).toMatch(/Sit still/);
    expect(d.update(chairFrame(240, 145, 0)).message).not.toMatch(/Sit still/);
  });
  it("never credits a stationary seat, small oscillation, or incomplete stand", () => {
    for (const angle of [90, 135, 145]) {
      expect(run(angle, { depth: 0 }).units).toHaveLength(0);
      expect(run(angle, { depth: 0.35 }).units).toHaveLength(0);
      expect(
        run(angle, {
          depth: 0,
          edit: (f, t) => {
            for (const p of f.landmarks) {
              p.x += Math.sin(t / 160) * 0.003;
              p.y += Math.cos(t / 160) * 0.003;
            }
          },
        }).units,
      ).toHaveLength(0);
    }
  });
  it("does not award upright-only or return to a shallower point instead of the learned seat", () => {
    expect(run(90, { returnFraction: 0.6 }).units).toHaveLength(0);
    const d = new ExerciseDetector("sitstand");
    for (let t = 0; t < 3000; t += 80)
      expect(d.update(chairFrame(t, 90, 1)).unit).toBeUndefined();
  });
  it("does not require or reward descending below the calibrated seat", () => {
    const { d } = run(135);
    const deeper = chairFrame(3280, 135, 0);
    deeper.landmarks[23].y += 0.1;
    deeper.landmarks[11].y += 0.1;
    expect(d.observe(deeper).ready).toBe(false);
    expect(d.observe(chairFrame(3360, 135, 0)).ready).toBe(true);
  });
  it("cannot bridge missing essential hip evidence into a completed cycle", () => {
    expect(
      run(135, {
        edit: (f, t) => {
          if (t >= 720 && t <= 2400) f.landmarks[23].visibility = 0.1;
        },
      }).units,
    ).toHaveLength(0);
  });
});
it("matches the actual-App regression coordinates at a normal high chair", () => {
  const d = new ExerciseDetector("sitstand", "app-chair"),
    units: ExerciseUnit[] = [];
  const start = [
      [11, 0.36, 0.26],
      [23, 0.36, 0.51],
      [25, 0.5, 0.65],
      [27, 0.5, 0.86],
    ],
    end = [
      [11, 0.5, 0.15],
      [23, 0.5, 0.4],
      [25, 0.5, 0.63],
      [27, 0.5, 0.86],
    ];
  const make = (t: number, q: number) => {
    const f = chairFrame(t, 135, 0);
    for (let j = 0; j < start.length; j++) {
      const [i, x, y] = start[j];
      f.landmarks[i] = {
        x: x + (end[j][1] - x) * q,
        y: y + (end[j][2] - y) * q,
        visibility: 0.96,
        presence: 1,
      };
    }
    return f;
  };
  expect(observePose("sitstand", make(0, 0)).ready).toBe(true);
  // App prepares on stable frames and calls recalibrate explicitly before starting.
  expect(d.recalibrate(make(0, 0))).toBe(true);
  for (let t = 80; t <= 3200; t += 80) {
    const q =
      t <= 640
        ? 0
        : t <= 1280
          ? (t - 640) / 640
          : t <= 1760
            ? 1
            : t <= 2400
              ? 1 - (t - 1760) / 640
              : 0;
    const result = d.update(make(t, q));
    if (result.unit) units.push(result.unit);
  }
  expect(units).toHaveLength(1);
  expect(units[0].verified).toBe(true);
});
describe("explicit calibration resets preparation reference only", () => {
  it("ordinary pause retains the seat; explicit calibration admits a different chair and camera position", () => {
    const d = new ExerciseDetector("sitstand");
    expect(d.recalibrate(chairFrame(0, 90, 0))).toBe(true);
    const changed = chairFrame(1000, 145, 0, 0.22, 0.24, 0.8);
    for (const p of changed.landmarks) p.y += 0.07;
    expect(d.observe(changed).ready).toBe(false);
    d.pause();
    expect(d.observe(changed).ready).toBe(false);
    d.beginCalibration();
    expect(d.observe(changed).ready).toBe(true);
    expect(d.recalibrate(changed)).toBe(true);
    expect(d.observe(changed).ready).toBe(true);
    expect(d.update({ ...changed, timestamp: 1080 }).unit).toBeUndefined();
  });
  it("keeps completed unit sequence while a second chair is calibrated and used", () => {
    const { d, units } = run(90);
    expect(units).toHaveLength(1);
    d.beginCalibration();
    expect(d.recalibrate(chairFrame(4000, 145, 0))).toBe(true);
    const later: ExerciseUnit[] = [];
    for (let dt = 80; dt <= 3200; dt += 80) {
      const q =
        dt <= 640
          ? 0
          : dt <= 1280
            ? (dt - 640) / 640
            : dt <= 1760
              ? 1
              : dt <= 2400
                ? 1 - (dt - 1760) / 640
                : 0;
      const result = d.update(chairFrame(4000 + dt, 145, q));
      if (result.unit) later.push(result.unit);
    }
    expect(later).toHaveLength(1);
    expect(units[0].id).toMatch(/:1$/);
    expect(later[0].id).toBe(units[0].id.replace(/:1$/, ":2"));
  });
  it("never resets the accepted alternating side or awards a unit when beginning calibration", () => {
    const d = new ExerciseDetector("lunge", "accepted-side", "left");
    expect(d.expectedSide).toBe("right");
    expect(d.beginCalibration()).toBeUndefined();
    expect(d.expectedSide).toBe("right");
    d.beginCalibration();
    expect(d.expectedSide).toBe("right");
  });
});

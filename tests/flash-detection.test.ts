import { describe, expect, it } from "vitest";
import {
  ExerciseDetector,
  observePose,
  type Observation,
  type PoseFrame,
  type RecognitionOptions,
} from "../src/exercises/detectors";
import type { ExerciseId, ExerciseUnit } from "../src/core/contracts";

const flash: RecognitionOptions = { tolerance: "flash" };
const frame = (): PoseFrame => ({
  timestamp: 0,
  width: 480,
  height: 480,
  landmarks: Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 0,
  })),
});
function point(f: PoseFrame, i: number, x: number, y: number) {
  f.landmarks[i] = { x, y, visibility: 0.98, presence: 0.98 };
}
function squat(degrees: number) {
  const f = frame(),
    radians = (degrees * Math.PI) / 180;
  point(f, 23, 0.5 - Math.sin(radians) * 0.22, 0.65 + Math.cos(radians) * 0.22);
  point(f, 25, 0.5, 0.65);
  point(f, 27, 0.5, 0.87);
  return f; // Far leg, shoulders and arms are not necessary for the measured leg cycle.
}
function pushup(degrees: number) {
  const f = frame(),
    radians = (degrees * Math.PI) / 180;
  const shoulderY = 0.66 + Math.cos(radians) * 0.18;
  point(f, 11, 0.28 - Math.sin(radians) * 0.18, shoulderY);
  point(f, 13, 0.28, 0.66);
  point(f, 15, 0.28, 0.86);
  point(f, 23, 0.55, shoulderY + 0.12);
  point(f, 25, 0.78, 0.78);
  return f; // Near knee supports the body; the far arm and both ankles may be occluded.
}
function movement(
  id: ExerciseId,
  top: PoseFrame,
  bottom: PoseFrame,
  options: RecognitionOptions,
  edit?: (f: PoseFrame) => void,
) {
  const detector = new ExerciseDetector(
    id,
    "flash-geometry",
    undefined,
    options,
  );
  const units: ExerciseUnit[] = [];
  for (let t = 0; t <= 2160; t += 80) {
    const fraction =
      t <= 320
        ? 0
        : t <= 800
          ? (t - 320) / 480
          : t <= 1200
            ? 1
            : t <= 1680
              ? 1 - (t - 1200) / 480
              : 0;
    const f = {
      ...top,
      timestamp: t,
      landmarks: top.landmarks.map((p, i) => ({
        ...p,
        x: p.x + (bottom.landmarks[i].x - p.x) * fraction,
        y: p.y + (bottom.landmarks[i].y - p.y) * fraction,
      })),
    };
    edit?.(f);
    const unit = detector.update(f).unit;
    if (unit) units.push(unit);
  }
  return units;
}
describe("opt-in Flash range tolerance", () => {
  it("accepts a measured shallower squat only when Flash tolerance is selected", () => {
    expect(movement("squat", squat(175), squat(132), {})).toHaveLength(0);
    const units = movement("squat", squat(175), squat(132), flash);
    expect(units).toHaveLength(1);
    expect(units[0]).toMatchObject({
      verified: true,
      cycle: { uninterrupted: true },
    });
  });
  it("calibrates a Flash mini squat from relaxed knees without requiring a rigid standing pose", () => {
    const standard: RecognitionOptions = { profile: "mini-squat" };
    expect(movement("squat", squat(153), squat(122), standard)).toHaveLength(0);
    expect(
      movement("squat", squat(153), squat(122), { ...standard, ...flash }),
    ).toHaveLength(1);
  });
  it("accepts a shorter push-up range with visible knee support", () => {
    const standard: RecognitionOptions = { profile: "knee-pushup" };
    expect(movement("pushup", pushup(160), pushup(123), standard)).toHaveLength(
      0,
    );
    const units = movement("pushup", pushup(160), pushup(123), {
      ...standard,
      ...flash,
    });
    expect(units).toHaveLength(1);
    expect(units[0].cycle?.uninterrupted).toBe(true);
  });
  it("still requires the measured knee in the knee-pushup profile", () => {
    const f = pushup(160);
    f.landmarks[25].visibility = 0.1;
    expect(
      observePose("pushup", f, undefined, { ...flash, profile: "knee-pushup" })
        .visible,
    ).toBe(false);
  });
  it.each(["squat", "pushup"] as const)(
    "%s never credits stillness or small anatomical jitter",
    (id) => {
      const make = id === "squat" ? squat : pushup;
      expect(
        movement(id, make(170), make(166), flash, (f) => {
          for (const p of f.landmarks) {
            p.x += Math.sin(f.timestamp / 100) * 0.003;
            p.y += Math.cos(f.timestamp / 100) * 0.002;
          }
        }),
      ).toHaveLength(0);
    },
  );
  it.each(["squat", "pushup"] as const)(
    "%s does not loosen confidence or invent hidden core joints",
    (id) => {
      const make = id === "squat" ? squat : pushup;
      expect(
        movement(id, make(170), make(120), flash, (f) => {
          f.landmarks[23].visibility = 0.2;
        }),
      ).toHaveLength(0);
      expect(
        movement(id, make(170), make(120), flash, (f) => {
          for (const p of f.landmarks) p.visibility = 0.44;
        }),
      ).toHaveLength(0);
    },
  );
  it("does not give a Flash cadence to estimated cropped geometry", () => {
    const detector = new ExerciseDetector(
      "squat",
      "estimated",
      undefined,
      flash,
    );
    const units = observedCycle(detector, { estimated: true });
    expect(units).toHaveLength(1);
    expect(units[0]).toMatchObject({ verified: false });
    expect(units[0].cycle).toBeUndefined();
  });
});

const ready: Observation = {
  visible: true,
  fresh: true,
  ready: true,
  extended: false,
  amplitude: 0,
  motion: 0,
  confidence: 0.98,
};
const moving: Observation = {
  ...ready,
  ready: false,
  amplitude: 0.3,
  motion: 0.04,
};
const bent: Observation = {
  ...ready,
  ready: false,
  extended: true,
  amplitude: 0.7,
  motion: 0.1,
};
function observedCycle(
  detector: ExerciseDetector,
  extra: Partial<Observation> = {},
) {
  const observations: [number, Observation][] = [
    [0, ready],
    [200, ready],
    [300, moving],
    [420, bent],
    [540, bent],
    [700, moving],
    [900, ready],
    [1000, ready],
  ];
  return observations.flatMap(([t, observation]) => {
    const unit = detector.updateObservation(
      { ...observation, ...extra },
      t,
    ).unit;
    return unit ? [unit] : [];
  });
}
describe("Flash observed movement timer and endpoint dwell", () => {
  it("accepts a complete controlled cycle with short endpoint pauses and an actual 700ms clock", () => {
    const detector = new ExerciseDetector(
      "squat",
      "short-dwell",
      undefined,
      flash,
    );
    const units = observedCycle(detector);
    expect(units).toHaveLength(1);
    expect(units[0].cycle).toMatchObject({
      startedAt: 300,
      endedAt: 1000,
      uninterrupted: true,
    });
    expect(detector.cycleStartedAt).toBeNull();
  });
  it("starts at actual motion and clears on pause or missing/stale evidence", () => {
    for (const condition of ["pause", "hidden", "stale"] as const) {
      const detector = new ExerciseDetector(
        "pushup",
        condition,
        undefined,
        flash,
      );
      expect(detector.cycleStartedAt).toBeNull();
      detector.updateObservation(ready, 0);
      detector.updateObservation(ready, 200);
      detector.updateObservation(moving, 300);
      expect(detector.cycleStartedAt).toBe(300);
      if (condition === "pause") detector.pause();
      else
        detector.updateObservation(
          { ...bent, [condition === "hidden" ? "visible" : "fresh"]: false },
          400,
        );
      expect(detector.cycleStartedAt).toBeNull();
    }
  });
  it("clears the clock after long frame gaps and cannot finish the old repetition", () => {
    const detector = new ExerciseDetector("squat", "gap", undefined, flash);
    detector.updateObservation(ready, 0);
    detector.updateObservation(ready, 200);
    detector.updateObservation(moving, 300);
    detector.updateObservation(bent, 420);
    detector.updateObservation(bent, 540);
    expect(detector.cycleStartedAt).toBe(300);
    expect(detector.updateObservation(ready, 1100).unit).toBeUndefined();
    expect(detector.cycleStartedAt).toBeNull();
    expect(detector.updateObservation(ready, 1300).unit).toBeUndefined();
  });
  it("a briefly retained movement cannot regain cadence evidence after a hidden frame", () => {
    const detector = new ExerciseDetector(
      "squat",
      "interrupted",
      undefined,
      flash,
    );
    const samples: [number, Observation][] = [
      [0, ready],
      [200, ready],
      [300, moving],
      [420, bent],
      [540, bent],
      [600, { ...bent, visible: false }],
      [700, bent],
      [850, moving],
      [1000, ready],
      [1100, ready],
    ];
    const units = samples.flatMap(([t, observation]) => {
      const unit = detector.updateObservation(observation, t).unit;
      return unit ? [unit] : [];
    });
    expect(units).toHaveLength(1);
    expect(units[0].cycle?.uninterrupted).toBe(false);
  });
  it("rejects an excessively short movement despite flexible endpoints", () => {
    const detector = new ExerciseDetector(
      "pushup",
      "too-quick",
      undefined,
      flash,
    );
    const samples: [number, Observation][] = [
      [0, ready],
      [200, ready],
      [300, moving],
      [350, bent],
      [470, bent],
      [600, ready],
      [700, ready],
    ];
    for (const [t, observation] of samples)
      expect(detector.updateObservation(observation, t).unit).toBeUndefined();
    expect(detector.cycleStartedAt).toBeNull();
  });
  it("rejects elbow-only movement without observable torso travel", () => {
    const detector = new ExerciseDetector(
      "pushup",
      "arm-only",
      undefined,
      flash,
    );
    expect(observedCycle(detector, { motion: 0 })).toHaveLength(0);
  });
});

import { describe, it, expect } from "vitest";
import {
  ExerciseDetector,
  observePose,
  type Landmark,
  type PoseFrame,
  type Side,
} from "../src/exercises/detectors";
import type { ExerciseId, ExerciseUnit } from "../src/core/contracts";
const frame = (): PoseFrame => ({
  timestamp: 0,
  width: 480,
  height: 480,
  landmarks: Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 0,
    presence: 1,
  })),
});
const put = (f: PoseFrame, i: number, x: number, y: number, v = 0.96) => {
  f.landmarks[i] = { x, y, visibility: v, presence: 1 };
};
const hide = (f: PoseFrame, ...ids: number[]) => {
  for (const i of ids) f.landmarks[i].visibility = 0.1;
  return f;
};
function squat(bottom = false, side: Side = "left") {
  const f = frame(),
    i = side === "left" ? 0 : 1;
  put(f, 23 + i, bottom ? 0.3 : 0.4, bottom ? 0.58 : 0.45);
  put(f, 25 + i, bottom ? 0.48 : 0.4, 0.65);
  put(f, 27 + i, 0.4, 0.85);
  return f; // No arms or shoulders are required for a leg cycle.
}
function pushup(bottom = false) {
  const f = frame();
  put(f, 11, 0.22, bottom ? 0.68 : 0.48);
  put(f, 13, bottom ? 0.3 : 0.22, bottom ? 0.75 : 0.64);
  put(f, 15, 0.22, 0.8);
  put(f, 23, 0.5, bottom ? 0.738 : 0.63);
  put(f, 25, 0.65, bottom ? 0.769 : 0.715);
  put(f, 27, 0.8, 0.8);
  return f;
}
function lunge(bottom = false, side: Side = "left", farHip = false) {
  const f = frame(),
    i = side === "left" ? 0 : 1,
    j = 1 - i;
  put(f, 23 + i, 0.4, bottom ? 0.6 : 0.42);
  if (farHip) put(f, 23 + j, 0.44, bottom ? 0.6 : 0.42);
  put(f, 25 + i, bottom ? 0.62 : 0.41, 0.62);
  put(f, 27 + i, bottom ? 0.62 : 0.41, 0.82);
  put(f, 25 + j, bottom ? 0.36 : 0.47, bottom ? 0.7 : 0.62);
  put(f, 27 + j, bottom ? 0.2 : 0.47, 0.82);
  return f;
}
function birddog(side?: Side) {
  const f = frame();
  for (let i = 0; i < 2; i++) {
    put(f, 11 + i, 0.36 + i * 0.02, 0.4 + i * 0.02);
    put(f, 23 + i, 0.62 + i * 0.02, 0.4 + i * 0.02);
    put(f, 15 + i, 0.36 + i * 0.02, 0.72);
    put(f, 25 + i, 0.62 + i * 0.02, 0.65);
  }
  if (side) {
    const i = side === "left" ? 0 : 1,
      j = 1 - i;
    put(f, 13 + i, 0.23, 0.4 + i * 0.02);
    put(f, 15 + i, 0.1, 0.4 + i * 0.02);
    put(f, 25 + j, 0.77, 0.4 + j * 0.02);
    put(f, 27 + j, 0.92, 0.4 + j * 0.02);
  }
  return f;
}
function superman(raised = true) {
  const f = frame();
  put(f, 11, 0.35, 0.82);
  put(f, 23, 0.62, 0.82);
  put(f, 15, 0.14, raised ? 0.77 : 0.84);
  put(f, 27, 0.88, raised ? 0.79 : 0.84);
  return f;
}
function interpolate(
  a: PoseFrame,
  b: PoseFrame,
  factor: number,
  timestamp: number,
): PoseFrame {
  return {
    ...a,
    timestamp,
    landmarks: a.landmarks.map((p, i) => ({
      ...p,
      x: p.x + (b.landmarks[i].x - p.x) * factor,
      y: p.y + (b.landmarks[i].y - p.y) * factor,
      visibility: Math.min(p.visibility ?? 0, b.landmarks[i].visibility ?? 0),
    })),
  };
}
function cycle(
  id: ExerciseId,
  top: PoseFrame,
  bottom: PoseFrame,
  detector = new ExerciseDetector(id, "geometry"),
  start = 0,
  edit?: (f: PoseFrame) => void,
) {
  const units: ExerciseUnit[] = [];
  for (let t = 0; t <= 1760; t += 80) {
    const factor =
      t <= 320
        ? 0
        : t <= 640
          ? (t - 320) / 320
          : t <= 1040
            ? 1
            : t <= 1360
              ? 1 - (t - 1040) / 320
              : 0;
    const f = interpolate(top, bottom, factor, start + t);
    edit?.(f);
    const r = detector.update(f);
    if (r.unit) units.push(r.unit);
  }
  return units;
}

describe("exercise-specific lateral camera geometry", () => {
  it("counts a lateral squat without arms, shoulders, or the far leg", () => {
    expect(observePose("squat", squat())).toMatchObject({
      visible: true,
      ready: true,
      fresh: true,
      observedSide: "left",
    });
    const units = cycle("squat", squat(), squat(true));
    expect(units).toHaveLength(1);
    expect(units[0].confidence).toBeGreaterThanOrEqual(0.5);
  });
  it.each<ExerciseId>(["pushup", "diamond"])(
    "counts %s with the far arm and leg occluded",
    (id) => {
      expect(observePose(id, pushup())).toMatchObject({
        visible: true,
        ready: true,
        observedSide: "left",
      });
      expect(observePose(id, pushup(true)).extended).toBe(true);
      expect(cycle(id, pushup(), pushup(true))).toHaveLength(1);
    },
  );
  it("can use a near knee body reference when both ankles are hidden", () => {
    expect(
      cycle("pushup", hide(pushup(), 27), hide(pushup(true), 27)),
    ).toHaveLength(1);
  });
  it("does not accept an inferred near elbow or a collapsed torso", () => {
    expect(observePose("pushup", hide(pushup(), 13))).toMatchObject({
      visible: false,
      fresh: false,
      status: "partial",
    });
    const sag = pushup();
    put(sag, 23, 0.5, 0.85);
    expect(observePose("pushup", sag).ready).toBe(false);
  });
  it("accepts a partial lunge when the active anatomical leg and both feet are clear", () => {
    expect(observePose("lunge", lunge())).toMatchObject({
      visible: true,
      ready: true,
    });
    expect(observePose("lunge", lunge(true))).toMatchObject({
      extended: true,
      side: "left",
    });
    expect(cycle("lunge", lunge(), lunge(true))[0]?.side).toBe("left");
  });
  it("does not invent a lunge side when the opposite foot is hidden", () => {
    expect(observePose("lunge", hide(lunge(true), 28))).toMatchObject({
      visible: false,
      extended: false,
    });
  });
  it("counts measured lunge cycles with strict left/right alternation", () => {
    const d = new ExerciseDetector("lunge");
    expect(
      cycle(
        "lunge",
        lunge(false, "left", true),
        lunge(true, "left", true),
        d,
      )[0]?.side,
    ).toBe("left");
    expect(
      cycle(
        "lunge",
        lunge(false, "left", true),
        lunge(true, "left", true),
        d,
        2000,
      ),
    ).toHaveLength(0);
    expect(
      cycle(
        "lunge",
        lunge(false, "right", true),
        lunge(true, "right", true),
        d,
        4000,
      )[0]?.side,
    ).toBe("right");
  });
  it("rejects ambiguous equally flexed split legs", () => {
    const f = frame();
    for (let i = 0; i < 2; i++) {
      put(f, 23 + i, 0.5, 0.55);
      put(f, 25 + i, i ? 0.7 : 0.3, 0.57);
      put(f, 27 + i, i ? 0.7 : 0.3, 0.8);
    }
    expect(observePose("lunge", f)).toMatchObject({
      extended: false,
      side: undefined,
    });
  });
  it("holds Superman near the floor with the far shoulder/wrist/hip/ankle hidden", () => {
    expect(observePose("superman", superman())).toMatchObject({
      visible: true,
      ready: true,
      extended: true,
      observedSide: "left",
    });
    expect(observePose("superman", superman(false)).extended).toBe(false);
    const d = new ExerciseDetector("superman");
    let units = 0;
    for (let t = 0; t <= 1440; t += 80) {
      const f = superman();
      f.timestamp = t;
      if (d.update(f).unit) units++;
    }
    expect(units).toBe(1);
  });
  it.each<Side>(["left", "right"])(
    "recognizes opposite Bird Dog limbs with %s arm and floor-hidden support joints",
    (side) => {
      expect(observePose("birddog", birddog())).toMatchObject({ ready: true });
      expect(observePose("birddog", birddog(side))).toMatchObject({
        extended: true,
        side,
      });
    },
  );
  it("supports a modest three-quarter torso angle without requiring support elbows/ankles", () => {
    const f = birddog("right");
    for (const i of [23, 24, 25, 26, 27, 28]) f.landmarks[i].y += 0.05;
    expect(observePose("birddog", f)).toMatchObject({
      extended: true,
      side: "right",
    });
  });
  it("counts full geometric Bird Dog cycles on alternating opposite pairs", () => {
    const complete = (side?: Side) => {
      const f = birddog(side);
      for (let i = 0; i < 2; i++) {
        if (!f.landmarks[13 + i].visibility)
          put(f, 13 + i, 0.36 + i * 0.02, 0.56);
        if (!f.landmarks[27 + i].visibility)
          put(f, 27 + i, 0.78 + i * 0.02, 0.65);
      }
      return f;
    };
    const d = new ExerciseDetector("birddog");
    expect(cycle("birddog", complete(), complete("left"), d)[0]?.side).toBe(
      "left",
    );
    expect(
      cycle("birddog", complete(), complete("right"), d, 2000)[0]?.side,
    ).toBe("right");
  });
  it("never calls same-side arm and leg extension a Bird Dog", () => {
    const f = birddog("left");
    put(f, 25, 0.77, 0.4);
    put(f, 27, 0.92, 0.4);
    put(f, 26, 0.64, 0.65);
    put(f, 28, 0.8, 0.65);
    expect(observePose("birddog", f).extended).toBe(false);
  });
  it("needs actual confidence in the opposite Bird Dog leg", () => {
    expect(observePose("birddog", hide(birddog("left"), 28)).extended).toBe(
      false,
    );
  });
});

describe("fresh evidence, noise and recovery", () => {
  it("does not make repetitions from standing landmark jitter", () => {
    const d = new ExerciseDetector("squat");
    let units = 0;
    for (let t = 0; t < 5000; t += 80) {
      const f = squat();
      f.timestamp = t;
      for (const p of f.landmarks) {
        p.x += Math.sin(t * 0.1) * 0.005;
        p.y += Math.cos(t * 0.07) * 0.004;
      }
      if (d.update(f).unit) units++;
    }
    expect(units).toBe(0);
  });
  it("briefly retains a cycle but counts no stale/invisible sample", () => {
    const units = cycle(
      "squat",
      squat(),
      squat(true),
      new ExerciseDetector("squat"),
      0,
      (f) => {
        if (f.timestamp === 1120) hide(f, 25);
      },
    );
    expect(units).toHaveLength(1);
  });
  it("cannot complete a cycle after a long occlusion; a new fresh cycle recovers", () => {
    const d = new ExerciseDetector("squat");
    const units = cycle("squat", squat(), squat(true), d, 0, (f) => {
      if (f.timestamp >= 720 && f.timestamp <= 1280) hide(f, 25);
    });
    expect(units).toHaveLength(0);
    expect(cycle("squat", squat(), squat(true), d, 2000)).toHaveLength(1);
  });
  it("locks the observed leg so changing the visible chain cannot fabricate a squat cycle", () => {
    const d = new ExerciseDetector("squat");
    let units = 0;
    for (let t = 0; t <= 320; t += 80) {
      const f = squat();
      f.timestamp = t;
      if (d.update(f).unit) units++;
    }
    for (let t = 400; t <= 960; t += 80) {
      const f = squat(true, "right");
      f.timestamp = t;
      if (d.update(f).unit) units++;
    }
    for (let t = 1040; t <= 1440; t += 80) {
      const f = squat(false, "right");
      f.timestamp = t;
      if (d.update(f).unit) units++;
    }
    expect(units).toBe(0);
    expect(
      cycle("squat", squat(false, "right"), squat(true, "right"), d, 1600),
    ).toHaveLength(1);
  });
  it("does not credit missing Superman time and retains its earlier fraction", () => {
    const d = new ExerciseDetector("superman");
    let units = 0;
    for (let t = 0; t <= 800; t += 80) {
      const f = superman();
      f.timestamp = t;
      if (d.update(f).unit) units++;
    }
    for (let t = 880; t <= 2080; t += 80) {
      const f = hide(superman(), 15);
      f.timestamp = t;
      expect(d.update(f).unit).toBeUndefined();
    }
    for (let t = 2160; t <= 2880; t += 80) {
      const f = superman();
      f.timestamp = t;
      if (d.update(f).unit) units++;
    }
    expect(units).toBe(1);
  });
  it("preserves required alternation after a long loss of the body", () => {
    const d = new ExerciseDetector("lunge");
    expect(cycle("lunge", lunge(), lunge(true), d)[0]?.side).toBe("left");
    for (let t = 1840; t <= 2640; t += 80) {
      const f = frame();
      f.timestamp = t;
      expect(d.update(f).unit).toBeUndefined();
    }
    expect(d.expectedSide).toBe("right");
    expect(cycle("lunge", lunge(), lunge(true), d, 2800)).toHaveLength(0);
  });
  it("normalizes pixel aspect ratio before evaluating a lateral push-up", () => {
    const convert = (f: PoseFrame) => ({
      ...f,
      width: 960,
      landmarks: f.landmarks.map((p) => ({ ...p, x: p.x / 2 })),
    });
    expect(
      cycle("pushup", convert(pushup()), convert(pushup(true))),
    ).toHaveLength(1);
  });
  it("rejects stale cached observations and sub-core-confidence evidence", () => {
    const d = new ExerciseDetector("superman");
    for (let t = 0; t < 4000; t += 100)
      expect(
        d.updateObservation(
          {
            visible: true,
            ready: true,
            extended: true,
            amplitude: 1,
            motion: 0,
            confidence: 0.95,
            fresh: false,
          },
          t,
        ).unit,
      ).toBeUndefined();
    for (let t = 4000; t < 7000; t += 100)
      expect(
        d.updateObservation(
          {
            visible: true,
            ready: true,
            extended: true,
            amplitude: 1,
            motion: 0,
            confidence: 0.49,
          },
          t,
        ).unit,
      ).toBeUndefined();
  });
});

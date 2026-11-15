import { describe, it, expect } from "vitest";
import {
  AssistedExerciseDetector,
  createExerciseDetector,
  measureAssistedPose,
  PreviewExerciseDetector,
} from "../src/exercises/assistedDetector";
import {
  EXERCISE_PROFILES,
  exerciseProfile,
  EXERCISE_SOURCES,
} from "../src/tower/exerciseProfiles";
import { SKILLS, SKILL_BY_ID } from "../src/tower/catalog";
import type { PoseFrame } from "../src/exercises/detectors";
import type { ExerciseUnit } from "../src/core/contracts";

const put = (f: PoseFrame, id: number, x: number, y: number) => {
  f.landmarks[id] = { x, y, visibility: 0.99, presence: 0.99 };
};
const copy = (f: PoseFrame) => structuredClone(f);
function front(): PoseFrame {
  const f: PoseFrame = {
    timestamp: 0,
    width: 600,
    height: 600,
    landmarks: Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.5,
      visibility: 0,
      presence: 0,
    })),
  };
  for (const i of [0, 1]) {
    const x = i ? 0.61 : 0.39;
    put(f, 11 + i, x, 0.2);
    put(f, 13 + i, i ? 0.7 : 0.3, 0.35);
    put(f, 15 + i, i ? 0.7 : 0.3, 0.5);
    put(f, 23 + i, x, 0.48);
    put(f, 25 + i, x, 0.67);
    put(f, 27 + i, x, 0.87);
    put(f, 29 + i, x, 0.9);
    put(f, 31 + i, x + 0.04, 0.9);
  }
  return f;
}
function prone(): PoseFrame {
  const f = front();
  for (const i of [0, 1]) {
    const off = i * 0.03;
    put(f, 11 + i, 0.25, 0.6 + off);
    put(f, 23 + i, 0.5, 0.6 + off);
    put(f, 25 + i, 0.68, 0.6 + off);
    put(f, 27 + i, 0.85, 0.6 + off);
    put(f, 13 + i, 0.17, 0.65 + off);
    put(f, 15 + i, 0.08, 0.65 + off);
  }
  return f;
}
function quadruped() {
  const f = prone();
  for (const i of [0, 1]) {
    const off = i * 0.03;
    put(f, 13 + i, 0.25, 0.72 + off);
    put(f, 15 + i, 0.25, 0.85 + off);
    put(f, 25 + i, 0.5, 0.82 + off);
    put(f, 27 + i, 0.7, 0.82 + off);
  }
  return f;
}
function seated() {
  const f = front();
  for (const i of [0, 1]) {
    put(f, 25 + i, 0.58 + i * 0.04, 0.5);
    put(f, 27 + i, 0.58 + i * 0.04, 0.8);
  }
  return f;
}
function series(id: string, start: PoseFrame, end: PoseFrame, holdMs = 900) {
  const d = new AssistedExerciseDetector(id, SKILL_BY_ID[id].exercise, "test");
  expect(d.recalibrate(start)).toBe(true);
  let time = 0;
  const units: ExerciseUnit[] = [];
  const feed = (pose: PoseFrame, count: number) => {
    for (let n = 0; n < count; n++) {
      const r = d.update({ ...copy(pose), timestamp: (time += 50) });
      if (r.unit) units.push(r.unit);
    }
  };
  feed(start, 8);
  feed(end, holdMs / 50);
  feed(start, 6);
  return {
    d,
    units,
    feed,
    get time() {
      return time;
    },
  };
}
const fixtures: Record<string, () => [PoseFrame, PoseFrame]> = {
  "knee-bend": () => {
    const a = front(),
      b = copy(a);
    for (const i of [0, 1]) put(b, 25 + i, 0.53 + i * 0.22, 0.64);
    return [a, b];
  },
  "elbow-bend": () => {
    const a = front();
    for (const i of [0, 1]) {
      put(a, 13 + i, 0.65 + i * 0.03, 0.3);
      put(a, 15 + i, 0.85 + i * 0.03, 0.4);
    }
    const b = copy(a);
    for (const i of [0, 1]) put(b, 13 + i, 0.5 + i * 0.03, 0.5);
    return [a, b];
  },
  lunge: () => {
    const a = front(),
      b = copy(a);
    put(b, 25, 0.54, 0.64);
    return [a, b];
  },
  hinge: () => {
    const a = front(),
      b = copy(a);
    for (const i of [0, 1]) put(b, 11 + i, 0.17 + i * 0.22, 0.36);
    return [a, b];
  },
  "leg-out": () => {
    const a = front(),
      b = copy(a);
    put(b, 27, 0.2, 0.82);
    return [a, b];
  },
  calf: () => {
    const a = front(),
      b = copy(a);
    for (const i of [0, 1]) put(b, 29 + i, 0.39 + i * 0.22, 0.865);
    return [a, b];
  },
  "hip-lift": () => {
    const a = prone();
    for (const i of [0, 1]) {
      put(a, 11 + i, 0.2, 0.75 + i * 0.03);
      put(a, 23 + i, 0.48, 0.75 + i * 0.03);
      put(a, 25 + i, 0.65, 0.5 + i * 0.03);
      put(a, 27 + i, 0.75, 0.75 + i * 0.03);
    }
    const b = copy(a);
    for (const i of [0, 1]) put(b, 23 + i, 0.46, 0.65 + i * 0.03);
    return [a, b];
  },
  "arm-lift": () => {
    const a = front(),
      b = copy(a);
    for (const i of [0, 1]) put(b, 15 + i, 0.3 + i * 0.4, 0.35);
    return [a, b];
  },
  "arm-open": () => {
    const a = front(),
      b = copy(a);
    for (const i of [0, 1]) put(b, 15 + i, 0.1 + i * 0.8, 0.3);
    return [a, b];
  },
  "knee-lift": () => {
    const a = front(),
      b = copy(a);
    put(b, 25, 0.39, 0.58);
    put(b, 27, 0.39, 0.78);
    return [a, b];
  },
  "knee-extend": () => {
    const a = seated(),
      b = copy(a);
    put(b, 27, 0.8, 0.52);
    return [a, b];
  },
  "heel-slide": () => {
    const a = prone();
    for (const i of [0, 1]) {
      put(a, 25 + i, 0.65, 0.4 + i * 0.03);
      put(a, 27 + i, 0.7, 0.65 + i * 0.03);
    }
    const b = copy(a);
    put(b, 25, 0.69, 0.59);
    put(b, 27, 0.86, 0.65);
    return [a, b];
  },
  tap: () => {
    const a = quadruped(),
      b = copy(a);
    put(b, 15, 0.28, 0.63);
    return [a, b];
  },
  jack: () => {
    const a = front(),
      b = copy(a);
    for (const i of [0, 1]) {
      put(b, 15 + i, 0.25 + i * 0.5, 0.12);
      put(b, 27 + i, 0.25 + i * 0.5, 0.87);
    }
    return [a, b];
  },
  step: () => {
    const a = front(),
      b = copy(a);
    put(b, 27, 0.25, 0.87);
    return [a, b];
  },
  punch: () => {
    const a = front();
    put(a, 13, 0.3, 0.35);
    put(a, 15, 0.45, 0.26);
    const b = copy(a);
    put(b, 15, 0.21, 0.5);
    return [a, b];
  },
  uppercut: () => {
    const a = front();
    put(a, 13, 0.3, 0.4);
    put(a, 15, 0.42, 0.35);
    const b = copy(a);
    put(b, 15, 0.42, 0.26);
    return [a, b];
  },
  curl: () => {
    const a = prone(),
      b = copy(a);
    for (const i of [0, 1]) put(b, 11 + i, 0.25, 0.55 + i * 0.03);
    return [a, b];
  },
  rock: () => {
    const a = quadruped(),
      b = copy(a);
    for (const i of [0, 1]) {
      put(b, 11 + i, 0.3, 0.6 + i * 0.03);
      put(b, 23 + i, 0.55, 0.6 + i * 0.03);
    }
    return [a, b];
  },
  "side-bend": () => {
    const a = front(),
      b = copy(a);
    for (const i of [0, 1]) put(b, 11 + i, 0.34 + i * 0.22, 0.2);
    return [a, b];
  },
  "opposite-reach": () => {
    const a = quadruped(),
      b = copy(a);
    put(b, 13, 0.16, 0.6);
    put(b, 15, 0.08, 0.59);
    put(b, 26, 0.7, 0.63);
    put(b, 28, 0.87, 0.63);
    return [a, b];
  },
};
const examples: Record<string, string> = {
  "knee-bend": "sumo-squat",
  "elbow-bend": "close-wall-pushup",
  lunge: "assisted-lunge",
  hinge: "guided-hip-hinge",
  "leg-out": "standing-side-leg-raise",
  calf: "calf-raise",
  "hip-lift": "glute-bridge",
  "arm-lift": "wall-arm-slide",
  "arm-open": "standing-chest-opening",
  "knee-lift": "march-in-place",
  "knee-extend": "seated-knee-extension",
  "heel-slide": "supine-heel-slide",
  tap: "quadruped-shoulder-tap",
  jack: "step-jack",
  step: "step-touch",
  punch: "shadowbox-straight",
  uppercut: "shadowbox-uppercut",
  curl: "back-extension",
  rock: "quadruped-wrist-rock",
  "side-bend": "standing-side-bend",
  "opposite-reach": "pause-birddog",
};

describe("camera assistance catalogue", () => {
  it("covers exactly the 90 skills with real source IDs, unit-specific methods and no aliases", () => {
    expect(Object.keys(EXERCISE_PROFILES).sort()).toEqual(
      SKILLS.map((s) => s.id).sort(),
    );
    for (const p of Object.values(EXERCISE_PROFILES)) {
      expect(p.sources.every((s) => !!EXERCISE_SOURCES[s])).toBe(true);
      expect(p.limitation.length).toBeGreaterThan(20);
      expect(p.method === "assisted" ? p.validation : "ok").not.toBe(
        "existing-logic-tests",
      );
    }
  });
  it("fails closed for unknown, confirmation and wrong transport IDs", () => {
    for (const id of [
      "__proto__",
      "missing",
      "cat-cow",
      "advanced-birddog",
      "abdominal-brace",
    ]) {
      const d = createExerciseDetector("squat", "t", undefined, {
        skillId: id,
      });
      expect(d).toBeInstanceOf(PreviewExerciseDetector);
      for (let t = 0; t < 5000; t += 50)
        expect(d.update({ ...front(), timestamp: t }).unit).toBeUndefined();
    }
    expect(
      createExerciseDetector("pushup", "t", undefined, {
        skillId: "mini-squat",
      }),
    ).toBeInstanceOf(PreviewExerciseDetector);
  });
});

describe("measured movement families", () => {
  for (const [strategy, make] of Object.entries(fixtures))
    it(`${strategy} completes an assisted cycle, never a verified/Flash unit`, () => {
      const id = examples[strategy],
        [a, b] = make(),
        profile = exerciseProfile(id)!;
      expect(
        measureAssistedPose(profile, a, SKILL_BY_ID[id].alternating).posture,
      ).toBe(true);
      expect(
        measureAssistedPose(profile, b, SKILL_BY_ID[id].alternating).posture,
      ).toBe(true);
      const { units } = series(id, a, b, 1100);
      expect(units).toHaveLength(1);
      expect(units[0]).toMatchObject({
        verified: false,
        skillId: id,
        profileId: `assisted-v1:${id}`,
        evidence: "assisted",
      });
      expect(units[0].cycle).toBeUndefined();
    });
  for (const [strategy, make] of Object.entries(fixtures))
    it(`${strategy} ignores stillness and sub-threshold jitter`, () => {
      const id = examples[strategy],
        [a] = make();
      expect(series(id, a, a, 2000).units).toHaveLength(0);
    });
  it("requires both opposite limbs, and follows the reaching arm rather than the leg", () => {
    const [a, b] = fixtures["opposite-reach"](),
      onlyArm = copy(a);
    onlyArm.landmarks[13] = b.landmarks[13];
    onlyArm.landmarks[15] = b.landmarks[15];
    expect(series("pause-birddog", a, onlyArm, 1200).units).toHaveLength(0);
    const both = series("pause-birddog", a, b, 1200);
    expect(both.units[0].side).toBe("left");
    both.feed(b, 25);
    both.feed(a, 8);
    expect(both.units).toHaveLength(1);
  });
  it("requires both arm and leg motion for jacks", () => {
    const [a, b] = fixtures.jack(),
      onlyArms = copy(a);
    onlyArms.landmarks[15] = b.landmarks[15];
    onlyArms.landmarks[16] = b.landmarks[16];
    expect(series("step-jack", a, onlyArms).units).toHaveLength(0);
  });
  it("does not assign the same sideways bend to the other side", () => {
    const [a, b] = fixtures["side-bend"](),
      r = series("standing-side-bend", a, b);
    r.feed(b, 25);
    r.feed(a, 8);
    expect(r.units).toHaveLength(1);
  });
  it("rejects missing, raw-hidden, spiking, stale and malformed required joints", () => {
    const p = exerciseProfile("march-in-place")!;
    const a = front();
    const variants = [copy(a), copy(a), copy(a), copy(a), copy(a)];
    variants[0].landmarks[25].visibility = 0;
    variants[1].rawLandmarks = copy(a).landmarks;
    variants[1].rawLandmarks![25].visibility = 0;
    variants[2].spikeJoints = [25];
    variants[3].captureLatencyMs = 1100;
    variants[4].landmarks[25].x = NaN;
    for (const f of variants)
      expect(measureAssistedPose(p, f, true).visible).toBe(false);
  });
  it("pauses and tracking loss discard an unfinished repetition", () => {
    const [a, b] = fixtures["knee-lift"]();
    for (const event of ["pause", "lost", "gap", "stale"]) {
      const d = new AssistedExerciseDetector(
        "march-in-place",
        "birddog",
        "test",
      );
      d.recalibrate(a);
      for (let t = 50; t <= 400; t += 50) d.update({ ...a, timestamp: t });
      for (let t = 450; t <= 1000; t += 50) d.update({ ...b, timestamp: t });
      if (event === "pause") d.pause();
      if (event === "lost") {
        const f = copy(b);
        f.landmarks[25].visibility = 0;
        d.update({ ...f, timestamp: 1050 });
      }
      if (event === "gap") d.update({ ...b, timestamp: 1500 });
      if (event === "stale") d.update({ ...b, timestamp: 950 });
      const result = [];
      for (let t = 1550; t < 2000; t += 50) {
        const unit = d.update({ ...a, timestamp: t }).unit;
        if (unit) result.push(unit);
      }
      expect(result, event).toHaveLength(0);
    }
  });
  it("a changed camera distance requires a new reference", () => {
    const [a, b] = fixtures["knee-lift"]();
    const r = series("march-in-place", a, b);
    const scaled = copy(a);
    for (const p of scaled.landmarks) {
      p.x = 0.5 + (p.x - 0.5) * 0.6;
      p.y = 0.5 + (p.y - 0.5) * 0.6;
    }
    r.feed(scaled, 20);
    expect(r.units).toHaveLength(1);
  });
});

function holdPose(id: string) {
  const f = prone();
  if (id === "wall-sit") {
    const s = front();
    for (const i of [0, 1]) {
      put(s, 25 + i, 0.56 + i * 0.22, 0.51);
      put(s, 27 + i, 0.56 + i * 0.22, 0.8);
    }
    return s;
  }
  if (id === "tabletop-hold") {
    for (const i of [0, 1]) {
      put(f, 25 + i, 0.5, 0.35 + i * 0.03);
      put(f, 27 + i, 0.7, 0.35 + i * 0.03);
    }
    return f;
  }
  for (const i of [0, 1]) {
    put(f, 25 + i, 0.68, 0.6 + i * 0.03);
    put(f, 27 + i, 0.85, 0.6 + i * 0.03);
    put(f, 13 + i, 0.25, 0.72 + i * 0.03);
    put(
      f,
      15 + i,
      id === "forearm-plank" ? 0.12 : 0.25,
      (id === "forearm-plank" ? 0.72 : 0.85) + i * 0.03,
    );
  }
  return f;
}
describe("hold and calibration clocks", () => {
  for (const id of ["high-plank", "forearm-plank", "wall-sit", "tabletop-hold"])
    it(`${id} credits fresh held seconds only`, () => {
      const pose = holdPose(id),
        p = exerciseProfile(id)!,
        m = measureAssistedPose(p, pose);
      expect(m.posture).toBe(true);
      expect(m.hold).toBe(true);
      const d = new AssistedExerciseDetector(id, SKILL_BY_ID[id].exercise);
      expect(d.recalibrate(pose)).toBe(true);
      const units = [];
      for (let t = 50; t <= 1200; t += 50) {
        const u = d.update({ ...pose, timestamp: t }).unit;
        if (u) units.push(u);
      }
      expect(units).toHaveLength(1);
      d.pause();
      expect(d.update({ ...pose, timestamp: 60000 }).unit).toBeUndefined();
      for (let t = 60050; t < 60700; t += 50)
        expect(d.update({ ...pose, timestamp: t }).unit).toBeUndefined();
      const hidden = copy(pose);
      hidden.landmarks.forEach((p) => (p.visibility = 0));
      expect(d.update({ ...hidden, timestamp: 60700 }).unit).toBeUndefined();
      for (let t = 60750; t < 61700; t += 50)
        expect(d.update({ ...pose, timestamp: t }).unit).toBeUndefined();
    });
  it("will not calibrate a continuously moving pose", () => {
    const [a, b] = fixtures["knee-lift"]();
    const d = new AssistedExerciseDetector("march-in-place", "birddog");
    for (let t = 0; t < 4000; t += 50)
      expect(
        d.update({ ...copy(t % 100 === 0 ? a : b), timestamp: t }).unit,
      ).toBeUndefined();
    expect(d.observe({ ...a, timestamp: 4050 }).message).toContain("calibrate");
  });
  it("does not credit an incomplete pause even with a slow return", () => {
    const [a, b] = fixtures["knee-bend"]();
    const r = series("pause-squat", a, b, 200);
    expect(r.units).toHaveLength(0);
  });
  it("holding the bottom does not substitute for slow lowering", () => {
    const [a, b] = fixtures["knee-bend"]();
    expect(series("tempo-squat", a, b, 2400).units).toHaveLength(0);
  });
  it("slow visible lowering followed by a complete return can count", () => {
    const [a, b] = fixtures["knee-bend"](),
      d = new AssistedExerciseDetector("tempo-squat", "squat");
    d.recalibrate(a);
    let t = 0;
    const units: ExerciseUnit[] = [];
    const feed = (f: PoseFrame) => {
      const u = d.update({ ...f, timestamp: (t += 50) }).unit;
      if (u) units.push(u);
    };
    for (let n = 0; n < 8; n++) feed(a);
    // Sweep the knee continuously over a long outward phase; no artificial waiting at the end.
    for (let n = 1; n <= 240; n++) {
      const f = copy(a),
        ratio = n / 240;
      for (const i of [0, 1]) {
        f.landmarks[25 + i].x =
          a.landmarks[25 + i].x +
          (b.landmarks[25 + i].x - a.landmarks[25 + i].x) * ratio;
      }
      feed(f);
    }
    for (let n = 0; n < 10; n++) feed(b);
    for (let n = 0; n < 8; n++) feed(a);
    expect(units).toHaveLength(1);
  });
  it("does not accept reversed wall-sit time or empty frames", () => {
    const f = holdPose("wall-sit"),
      d = new AssistedExerciseDetector("wall-sit", "squat");
    d.recalibrate(f);
    for (let t = 0; t < 900; t += 50) d.update({ ...f, timestamp: t });
    expect(d.update({ ...f, timestamp: 500 }).unit).toBeUndefined();
    expect(d.update({ ...f, timestamp: NaN }).unit).toBeUndefined();
    expect(
      d.update({ ...f, timestamp: 1000, landmarks: [] }).unit,
    ).toBeUndefined();
  });
});

describe("all exact skill profiles", () => {
  for (const skill of SKILLS)
    it(`${skill.id}: no invisible or inactive credit`, () => {
      const d = createExerciseDetector(skill.exercise, "matrix", undefined, {
        skillId: skill.id,
      });
      const blank = front();
      blank.landmarks.forEach((p) => {
        p.visibility = 0;
        p.presence = 0;
      });
      for (let t = 0; t < 2500; t += 50)
        expect(d.update({ ...blank, timestamp: t }).unit).toBeUndefined();
      d.pause();
      expect(d.update({ ...blank, timestamp: 40000 }).unit).toBeUndefined();
    });
  it("a new camera source cannot complete the previous side of a partial cycle", () => {
    const [a, b] = fixtures["knee-lift"]();
    const d = new AssistedExerciseDetector("march-in-place", "birddog");
    d.recalibrate(a);
    for (let t = 0; t < 300; t += 50) d.update({ ...a, timestamp: t });
    for (let t = 300; t < 1000; t += 50) d.update({ ...b, timestamp: t });
    d.beginCalibration();
    for (let t = 1000; t < 2500; t += 50)
      expect(d.update({ ...a, timestamp: t }).unit).toBeUndefined();
  });
  it("a one-sided hold cannot credit both knees in tabletop", () => {
    const pose = holdPose("tabletop-hold");
    put(pose, 26, 0.7, 0.6);
    put(pose, 28, 0.85, 0.6);
    expect(
      measureAssistedPose(exerciseProfile("tabletop-hold")!, pose).hold,
    ).toBe(false);
  });
});

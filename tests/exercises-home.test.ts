import { describe, it, expect } from "vitest";
import {
  ExerciseDetector,
  observePose,
  type PoseFrame,
} from "../src/exercises/detectors";
import type { ExerciseId, ExerciseUnit } from "../src/core/contracts";
type Home = "sitstand" | "wallpushup" | "bridge";
const make = (): PoseFrame => ({
  timestamp: 0,
  width: 480,
  height: 480,
  landmarks: Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 0,
  })),
});
function put(f: PoseFrame, i: number, x: number, y: number, visibility = 0.95) {
  f.landmarks[i] = { x, y, visibility };
}
function posture(id: Home, raised = false): PoseFrame {
  const f = make();
  if (id === "sitstand") {
    put(f, 11, raised ? 0.5 : 0.3, raised ? 0.14 : 0.3);
    put(f, 23, raised ? 0.5 : 0.3, raised ? 0.43 : 0.6);
    put(f, 25, 0.5, raised ? 0.64 : 0.62);
    put(f, 27, 0.5, 0.85);
  }
  if (id === "wallpushup") {
    put(f, 11, raised ? 0.56 : 0.35, raised ? 0.28 : 0.25);
    put(f, 13, raised ? 0.61 : 0.55, raised ? 0.41 : 0.25);
    put(f, 15, 0.75, 0.25);
    put(f, 23, raised ? 0.47 : 0.35, raised ? 0.62 : 0.6);
  }
  if (id === "bridge") {
    put(f, 11, 0.2, 0.8);
    put(f, 23, raised ? 0.45 : 0.46, raised ? 0.67 : 0.8);
    put(f, 25, 0.62, raised ? 0.59 : 0.6);
    put(f, 27, 0.76, 0.8);
  }
  return f;
}
function cycle(id: Home, depth = 1, edit?: (frame: PoseFrame) => void) {
  const a = posture(id),
    b = posture(id, true),
    d = new ExerciseDetector(id, "home-test"),
    units: ExerciseUnit[] = [];
  for (let t = 0; t <= 1920; t += 80) {
    const q =
        depth *
        (t <= 320
          ? 0
          : t <= 720
            ? (t - 320) / 400
            : t <= 1120
              ? 1
              : t <= 1520
                ? 1 - (t - 1120) / 400
                : 0),
      f = {
        ...a,
        timestamp: t,
        landmarks: a.landmarks.map((p, i) => ({
          ...p,
          x: p.x + (b.landmarks[i].x - p.x) * q,
          y: p.y + (b.landmarks[i].y - p.y) * q,
        })),
      };
    edit?.(f);
    const result = d.update(f);
    if (result.unit) units.push(result.unit);
  }
  return units;
}
describe("three connected home exercises", () => {
  it.each<Home>(["sitstand", "wallpushup", "bridge"])(
    "%s has distinct starting/range geometry and emits one complete unit",
    (id) => {
      expect(observePose(id, posture(id))).toMatchObject({
        visible: true,
        ready: true,
        extended: false,
      });
      expect(observePose(id, posture(id, true))).toMatchObject({
        visible: true,
        ready: false,
        extended: true,
      });
      const units = cycle(id);
      expect(units).toHaveLength(1);
      expect(units[0]).toMatchObject({ exerciseId: id, verified: true });
      expect(units[0].confidence).toBeGreaterThanOrEqual(0.5);
    },
  );
  it.each<Home>(["sitstand", "wallpushup", "bridge"])(
    "%s never counts the starting position alone or a small incomplete movement",
    (id) => {
      const d = new ExerciseDetector(id);
      for (let t = 0; t < 4000; t += 80) {
        const f = posture(id);
        f.timestamp = t;
        expect(d.update(f).unit).toBeUndefined();
      }
      expect(cycle(id, 0.15)).toHaveLength(0);
    },
  );
  it.each<Home>(["sitstand", "wallpushup", "bridge"])(
    "%s requires fresh primary joints even though the far body is hidden",
    (id) => {
      expect(
        cycle(id, 1, (f) => {
          f.landmarks[23].visibility = 0.1;
        }),
      ).toHaveLength(0);
    },
  );
  it("does not count wall elbow motion without torso movement", () => {
    expect(
      cycle("wallpushup", 1, (f) => {
        put(f, 11, 0.35, 0.25);
        put(f, 23, 0.35, 0.6);
      }),
    ).toHaveLength(0);
  });
  it("does not accept a bridge with straight knees", () => {
    const f = posture("bridge", true);
    put(f, 25, 0.6, 0.59);
    put(f, 27, 0.75, 0.51);
    expect(observePose("bridge", f).extended).toBe(false);
  });
});
describe("per-joint confidence floors with strong measured anchors", () => {
  it.each<Home>(["sitstand", "wallpushup", "bridge"])(
    "%s tolerates a moderately confident distal point without inventing missing geometry",
    (id) => {
      const distal = id === "wallpushup" ? 15 : 27;
      const units = cycle(id, 1, (f) => {
        f.landmarks[distal].visibility = 0.42;
      });
      expect(units).toHaveLength(1);
      expect(units[0].confidence).toBeGreaterThanOrEqual(0.5);
      expect(units[0].confidence).toBeLessThan(0.95);
      expect(
        cycle(id, 1, (f) => {
          f.landmarks[distal].visibility = 0.1;
        }),
      ).toHaveLength(id === "bridge" ? 1 : 0);
    },
  );
  it("accepts a squat with clear hip/knee and a moderately confident ankle", () => {
    const f = make();
    put(f, 23, 0.4, 0.45);
    put(f, 25, 0.4, 0.65);
    put(f, 27, 0.4, 0.85, 0.42);
    expect(observePose("squat", f)).toMatchObject({
      visible: true,
      ready: true,
    });
    expect(observePose("squat", f).confidence).toBeGreaterThan(0.5);
  });
  it("recognizes a relaxed starting knee angle without counting that posture", () => {
    const f = make();
    put(f, 23, 0.4, 0.45);
    put(f, 25, 0.45, 0.65);
    put(f, 27, 0.4, 0.85);
    expect(observePose("squat", f)).toMatchObject({
      ready: true,
      extended: false,
    });
  });
  it("does not average away weak core anchors or entirely uncertain bodies", () => {
    for (const id of ["sitstand", "wallpushup", "bridge"] as Home[]) {
      const f = posture(id);
      for (const p of f.landmarks) if (p.visibility) p.visibility = 0.44;
      expect(observePose(id, f).visible).toBe(false);
      expect(
        cycle(id, 1, (f) => {
          f.landmarks[23].visibility = 0.3;
        }),
      ).toHaveLength(0);
    }
  });
  it("still requires aggregate confidence and a measured anatomical side for lunges", () => {
    const f = make();
    put(f, 23, 0.4, 0.6);
    put(f, 25, 0.62, 0.62);
    put(f, 27, 0.62, 0.82, 0.42);
    put(f, 26, 0.36, 0.7);
    put(f, 28, 0.2, 0.82, 0.6);
    expect(observePose("lunge", f)).toMatchObject({
      extended: true,
      side: "left",
    });
    expect(observePose("lunge", f).confidence).toBeGreaterThanOrEqual(0.55);
    put(f, 23, 0.4, 0.6, 0.56);
    put(f, 25, 0.62, 0.62, 0.56);
    put(f, 28, 0.2, 0.82, 0.35);
    expect(observePose("lunge", f).extended).toBe(false);
  });
});
describe('baseline proportion invariance',()=>{
 it.each<Home>(['sitstand','bridge'])('%s keeps full cycles at different image scales',(id)=>{
  for(const scale of [.6,.85,1.15])expect(cycle(id,1,f=>{for(const p of f.landmarks){p.x=.5+(p.x-.5)*scale;p.y=.5+(p.y-.5)*scale;}})).toHaveLength(1);
 });
});

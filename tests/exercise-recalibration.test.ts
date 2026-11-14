import { describe, it, expect } from "vitest";
import { RecalibrationGate } from "../src/exercises/preparation";
import { ExerciseDetector } from "../src/exercises/detectors";
import {
  ExerciseCuePlanner,
  type CueSnapshot,
} from "../src/audio/exerciseFeedback";

describe("safe recalibration timing", () => {
  it("allows five real seconds to reposition before acquiring any reference", () => {
    const gate = new RecalibrationGate();
    gate.start(100);
    for (let t = 100; t < 5100; t += 100)
      expect(gate.observe(true, true, t, t)).toBe(false);
    expect(gate.remaining(4100)).toBe(1);
    for (let t = 5100; t < 6100; t += 100)
      expect(gate.observe(true, true, t, t)).toBe(false);
    expect(gate.observe(true, true, 6100, 6100)).toBe(true);
    expect(gate.active).toBe(false);
  });
  it("requires a new stable second after loss or a frame gap", () => {
    const gate = new RecalibrationGate();
    gate.start(0);
    gate.observe(true, true, 5000, 5000);
    gate.observe(true, true, 5300, 5300);
    expect(gate.observe(true, false, 5600, 5600)).toBe(false);
    gate.observe(true, true, 5700, 5700);
    expect(gate.observe(true, true, 6800, 6800)).toBe(false);
    for (let t = 6900; t < 7900; t += 100)
      expect(gate.observe(true, true, t, t)).toBe(false);
    expect(gate.observe(true, true, 7900, 7900)).toBe(true);
  });
  it("can restart repeatedly and cannot complete after cancellation", () => {
    const gate = new RecalibrationGate();
    gate.start(0);
    gate.start(4000);
    expect(gate.remaining(5000)).toBe(4);
    gate.cancel();
    expect(gate.observe(true, true, 10000, 10000)).toBe(false);
  });
  it("acquires fresh reference coordinates without awarding movement", () => {
    const detector = new ExerciseDetector("squat", "reference");
    const landmarks = Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.5,
      visibility: 0,
      presence: 1,
    }));
    landmarks[23] = { x: 0.4, y: 0.45, visibility: 0.96, presence: 1 };
    landmarks[25] = { x: 0.4, y: 0.65, visibility: 0.96, presence: 1 };
    landmarks[27] = { x: 0.4, y: 0.85, visibility: 0.96, presence: 1 };
    const frame = { timestamp: 100, width: 480, height: 480, landmarks };
    expect(detector.recalibrate(frame)).toBe(true);
    expect(detector.update({ ...frame, timestamp: 200 }).unit).toBeUndefined();
    expect(detector.recalibrate({ ...frame, timestamp: 300 })).toBe(true);
    expect(detector.update({ ...frame, timestamp: 400 }).unit).toBeUndefined();
  });
  it("rejects missing reference data without erasing canonical alternation", () => {
    const detector = new ExerciseDetector("lunge", "test", "left");
    expect(
      detector.recalibrate({
        timestamp: 100,
        width: 640,
        height: 480,
        landmarks: [],
      }),
    ).toBe(false);
    expect(detector.expectedSide).toBe("right");
  });
});

describe("preparation speech", () => {
  const state: CueSnapshot = {
    progress: 0,
    target: 8,
    status: "insufficient",
    message: "Stand tall.",
    active: true,
    seconds: false,
  };
  it("speaks a changed stable correction without nagging or interrupting every frame", () => {
    const coach = new ExerciseCuePlanner();
    expect(coach.update(state, 0)).toEqual([]);
    expect(coach.update(state, 3000)[0].speech).toBe("Stand tall.");
    expect(
      coach.update({ ...state, message: "Show your knee." }, 4000),
    ).toEqual([]);
    expect(
      coach.update({ ...state, message: "Show your knee." }, 5000),
    ).toEqual([]);
    expect(
      coach.update({ ...state, message: "Show your knee." }, 9000)[0].speech,
    ).toBe("Show your knee.");
    expect(
      coach.update({ ...state, message: "Show your knee." }, 60000),
    ).toEqual([]);
  });
  it("does not claim readiness for an unrecognized starting posture", () => {
    const coach = new ExerciseCuePlanner();
    expect(
      coach.update(
        { ...state, status: "loading", message: "Starting camera." },
        0,
      ),
    ).toEqual([]);
    expect(coach.update(state, 1000)).toEqual([]);
    expect(
      coach.update(
        { ...state, status: "ready", message: "Starting position visible." },
        2000,
      )[0].speech,
    ).toBe("Starting position visible.");
  });
});

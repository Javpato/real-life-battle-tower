import { describe, it, expect } from "vitest";
import {
  ExerciseCuePlanner,
  type CueSnapshot,
} from "../src/audio/exerciseFeedback";
const snapshot = (extra: Partial<CueSnapshot> = {}): CueSnapshot => ({
  progress: 0,
  target: 8,
  status: "moving",
  message: "Show your knee.",
  active: true,
  seconds: false,
  ...extra,
});
describe("exercise audio policy", () => {
  it("announces a verified progress change once with the next anatomical side", () => {
    const p = new ExerciseCuePlanner();
    expect(p.update(snapshot({ progress: 1, nextSide: "right" }), 100)).toEqual(
      [{ kind: "rep", speech: "1. Next, right side." }],
    );
    expect(p.update(snapshot({ progress: 1, nextSide: "right" }), 200)).toEqual(
      [],
    );
  });
  it("waits for significant tracking loss and does not nag in the same episode", () => {
    const p = new ExerciseCuePlanner();
    expect(p.update(snapshot({ status: "insufficient" }), 0)).toEqual([]);
    expect(p.update(snapshot({ status: "insufficient" }), 2999)).toEqual([]);
    expect(p.update(snapshot({ status: "insufficient" }), 3000)).toEqual([
      { kind: "lost", speech: "Show your knee." },
    ]);
    expect(p.update(snapshot({ status: "insufficient" }), 60000)).toEqual([]);
    p.update(snapshot(), 61000);
    p.update(snapshot({ status: "partial" }), 62000);
    expect(p.update(snapshot({ status: "partial" }), 65000)[0].kind).toBe(
      "lost",
    );
  });
  it("does not issue loss prompts while paused or manually inactive", () => {
    const p = new ExerciseCuePlanner();
    p.update(snapshot({ status: "no-body", active: false }), 0);
    expect(
      p.update(snapshot({ status: "no-body", active: false }), 10000),
    ).toEqual([]);
  });
  it("announces an early series completion once without requiring target reps", () => {
    const p = new ExerciseCuePlanner(3);
    expect(
      p.update(snapshot({ progress: 3, complete: true, active: false }), 100),
    ).toEqual([{ kind: "complete", speech: "Series complete. You can rest." }]);
    expect(
      p.update(snapshot({ progress: 3, complete: true, active: false }), 300),
    ).toEqual([]);
  });
  it("reset progress allows a new series completion and does not announce historic initial progress", () => {
    const p = new ExerciseCuePlanner(8);
    p.update(snapshot({ progress: 8, complete: true }), 0);
    p.update(snapshot({ progress: 0, complete: false }), 1000);
    expect(
      p
        .update(snapshot({ progress: 8, complete: true }), 2000)
        .filter((c) => c.kind === "complete"),
    ).toHaveLength(1);
  });
});

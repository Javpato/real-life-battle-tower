import { describe, it, expect } from "vitest";
import {
  ExerciseDetector,
  type PoseFrame,
  type Observation,
  type Side,
} from "../src/exercises/detectors";
import {
  applyAdventureCommand,
  initialAdventure,
  type AdventureSnapshot,
} from "../src/core/commands";
import type { ExerciseUnit } from "../src/core/contracts";
function battle(attack = "squat") {
  let s = initialAdventure();
  if (attack !== "squat")
    s = applyAdventureCommand(s, { kind: "equip", attackIds: [attack] });
  s = applyAdventureCommand(s, {
    kind: "startBattle",
    enemyId: "trainer-1",
    specialization: null,
  });
  return applyAdventureCommand(s, { kind: "beginAttack", attackId: attack });
}
function squatFrame(t: number, bend: number): PoseFrame {
  const landmarks = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 0,
  }));
  landmarks[23] = {
    x: 0.4 - 0.1 * bend,
    y: 0.45 + 0.13 * bend,
    visibility: 0.96,
  };
  landmarks[25] = { x: 0.4 + 0.08 * bend, y: 0.65, visibility: 0.96 };
  landmarks[27] = { x: 0.4, y: 0.85, visibility: 0.96 };
  return { timestamp: t, width: 480, height: 480, landmarks };
}
function measuredSquat(
  d = new ExerciseDetector("squat", "measured"),
  depth = 1,
) {
  const events: ExerciseUnit[] = [];
  for (let t = 0; t <= 1760; t += 80) {
    const fraction =
      t <= 320
        ? 0
        : t <= 640
          ? (t - 320) / 320
          : t <= 1040
            ? 1
            : t <= 1360
              ? 1 - (t - 1040) / 320
              : 0;
    const r = d.update(squatFrame(t, fraction * depth));
    if (r.unit) events.push(r.unit);
  }
  return events;
}
function send(
  s: AdventureSnapshot,
  unit: ExerciseUnit,
  sessionId = s.battle!.sessionId,
) {
  return applyAdventureCommand(s, { kind: "exerciseUnit", unit, sessionId });
}
function alternating(d: ExerciseDetector, side: Side, start: number) {
  const units: ExerciseUnit[] = [];
  const steps: Partial<Observation>[] = [
    {},
    {},
    { ready: false, motion: 0.1 },
    { ready: false, extended: true, motion: 0.8, amplitude: 1, side },
    { ready: false, extended: true, motion: 1, amplitude: 1, side },
    { ready: false, motion: 0.5 },
    {},
    {},
  ];
  steps.forEach((step, i) => {
    const r = d.updateObservation(
      {
        visible: true,
        ready: true,
        extended: false,
        amplitude: 0,
        confidence: 0.95,
        motion: 0,
        ...step,
      },
      start + i * 200,
    );
    if (r.unit) units.push(r.unit);
  });
  return units;
}

describe("synthetic recognition to canonical combat integration", () => {
  it("applies damage only after a complete measured squat and exactly once per event ID", () => {
    const s = battle(),
      before = s.battle!.enemyHp;
    const units = measuredSquat();
    expect(units).toHaveLength(1);
    const next = send(s, units[0]);
    expect(next.battle!.enemyHp).toBeLessThan(before);
    expect(next.battle!.progress).toBe(1);
    expect(next.battle!.verified).toBe(1);
    expect(send(next, units[0]).battle).toEqual(next.battle);
  });
  it("incomplete geometric movement emits no event and leaves HP and progress unchanged", () => {
    const s = battle(),
      before = structuredClone(s);
    for (const u of measuredSquat(new ExerciseDetector("squat"), 0.15))
      send(s, u);
    expect(measuredSquat(new ExerciseDetector("squat"), 0.15)).toHaveLength(0);
    expect(s).toEqual(before);
  });
  it("a paused canonical battle rejects a valid detector event without advancing HP", () => {
    const s = applyAdventureCommand(battle(), { kind: "pause", paused: true }),
      unit = measuredSquat()[0];
    expect(send(s, unit).battle).toEqual(s.battle);
  });
  it("rejects a stale series callback and untrusted low-confidence events", () => {
    const s = battle(),
      unit = measuredSquat()[0];
    expect(() => send(s, unit, "old-series")).toThrow("STALE_EXERCISE_SESSION");
    const before = structuredClone(s);
    expect(() => send(s, { ...unit, confidence: 0.49 })).toThrow(
      "INVALID_UNIT",
    );
    expect(s).toEqual(before);
  });
  it("stops at early victory and ignores later repetitions from the same synthetic stream", () => {
    let s = battle();
    s.battle!.enemyHp = 0.25;
    const unit = measuredSquat()[0];
    s = send(s, unit);
    expect(s.battle!.turn).toBe("won");
    expect(s.battle!.enemyHp).toBe(0);
    expect(s.battle!.progress).toBe(1);
    const hp = s.battle!.playerHp;
    const later = send(s, { ...unit, id: unit.id + "-late" });
    expect(later.battle).toEqual(s.battle);
    expect(later.battle!.playerHp).toBe(hp);
  });
  it("preserves canonical alternating side and avoids duplicate IDs after returning from the journal", () => {
    let s = battle("lunge");
    const firstDetector = new ExerciseDetector("lunge", s.battle!.sessionId);
    const first = alternating(firstDetector, "left", 0)[0];
    s = send(s, first);
    expect(s.battle!.progress).toBe(1);
    s = applyAdventureCommand(s, { kind: "pause", paused: true });
    const remounted = new ExerciseDetector(
      "lunge",
      s.battle!.sessionId,
      s.battle!.side,
    );
    expect(alternating(remounted, "left", 2000)).toHaveLength(0);
    remounted.pause();
    const right = alternating(remounted, "right", 4000)[0];
    s = applyAdventureCommand(s, { kind: "pause", paused: false });
    s = send(s, right);
    expect(s.battle!.progress).toBe(2);
    expect(s.battle!.verified).toBe(2);
    expect(s.battle!.side).toBe("right");
    expect(s.battle!.seen).toContain(first.id);
    expect(s.battle!.seen).toContain(right.id);
  });
});

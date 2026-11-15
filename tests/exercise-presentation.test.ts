import { describe, expect, it } from "vitest";
import {
  exerciseHeadline,
  STARTING_CUES,
} from "../src/exercises/exercisePresentation";
import type { ExerciseHudProps } from "../src/exercises/exerciseUi";
const base: ExerciseHudProps = {
  exerciseId: "birddog",
  progress: 0,
  target: 10,
  status: "ready",
  message: "Starting position visible.",
  quality: null,
  paused: false,
  active: true,
};
describe("actionable exercise presentation", () => {
  it("uses the actual starting posture for all nine exercises", () => {
    for (const exerciseId of Object.keys(STARTING_CUES) as Array<
      keyof typeof STARTING_CUES
    >)
      expect(exerciseHeadline({ ...base, exerciseId })).toBe(
        STARTING_CUES[exerciseId].toUpperCase(),
      );
  });
  it("shows an actually missing anatomical joint above side and encouragement", () => {
    expect(
      exerciseHeadline({
        ...base,
        status: "partial",
        missingJoints: ["left knee"],
        nextSide: "right",
      }),
    ).toBe("SHOW YOUR LEFT KNEE");
    expect(
      exerciseHeadline({
        ...base,
        status: "insufficient",
        missingJoints: ["right wrist"],
      }),
    ).toBe("SHOW YOUR RIGHT WRIST");
  });
  it("does not invent a side or diagnose a missing joint without evidence", () => {
    expect(
      exerciseHeadline({
        ...base,
        status: "insufficient",
        message: "Required joints not clear.",
      }),
    ).toBe("KEEP REQUIRED JOINTS IN VIEW");
    expect(
      exerciseHeadline({
        ...base,
        status: "partial",
        missingJoints: ["face"],
        message: "Unclear.",
      }),
    ).toBe("KEEP REQUIRED JOINTS IN VIEW");
  });
  it("prioritizes camera errors and explicit rest over old frame metadata", () => {
    expect(
      exerciseHeadline({
        ...base,
        status: "error",
        paused: true,
        missingJoints: ["left knee"],
      }),
    ).toBe("CAMERA NEEDS ATTENTION");
    expect(
      exerciseHeadline({
        ...base,
        status: "partial",
        paused: true,
        missingJoints: ["left knee"],
      }),
    ).toBe("REST — NO TIME LIMIT");
  });
  it("drops an old missing-joint warning once the observation recovers", () => {
    expect(
      exerciseHeadline({
        ...base,
        status: "ready",
        missingJoints: ["left knee"],
      }),
    ).toBe(STARTING_CUES.birddog.toUpperCase());
    expect(
      exerciseHeadline({
        ...base,
        status: "valid",
        nextSide: "right",
        missingJoints: [],
      }),
    ).toBe("RIGHT ARM + OPPOSITE LEG NEXT");
  });
  it("promotes posture instructions when joints are present but preparation is incomplete", () => {
    expect(
      exerciseHeadline({
        ...base,
        status: "insufficient",
        message: "Settle into the illustrated starting position.",
      }),
    ).toBe(STARTING_CUES.birddog.toUpperCase());
    expect(
      exerciseHeadline({
        ...base,
        exerciseId: "bridge",
        status: "insufficient",
        message:
          "Start with hips down and knees bent. Lift the hips, then lower back to the starting position.",
      }),
    ).toBe(STARTING_CUES.bridge.toUpperCase());
    expect(
      exerciseHeadline({
        ...base,
        exerciseId: "lunge",
        status: "insufficient",
        message:
          "Side unclear. Turn slightly so the front knee and both feet are distinguishable.",
      }),
    ).toBe("SHOW YOUR FRONT KNEE + BOTH FEET");
  });
  it("retains short correction, completion and whole-frame instructions", () => {
    expect(
      exerciseHeadline({
        ...base,
        status: "incomplete",
        message: "Slow down and complete the full movement.",
      }),
    ).toContain("SLOW DOWN");
    expect(exerciseHeadline({ ...base, status: "no-body" })).toBe(
      "MOVE INTO CAMERA VIEW",
    );
    expect(
      exerciseHeadline({
        ...base,
        status: "valid",
        complete: true,
        nextSide: "left",
      }),
    ).toBe("SERIES COMPLETE");
  });
});

it("never gives a transport-family exercise cue for an assisted variation", () => {
  const p = {
    ...base,
    exerciseId: "superman" as const,
    skillId: "back-extension",
    assisted: true,
  };
  expect(exerciseHeadline({ ...p, status: "ready" })).toBe(
    "READY · MOVE WHEN COMFORTABLE",
  );
  expect(exerciseHeadline({ ...p, status: "moving" })).toBe(
    "MOVE WITH CONTROL",
  );
  expect(exerciseHeadline({ ...p, status: "return" })).toBe(
    "RETURN TO YOUR START",
  );
  expect(exerciseHeadline({ ...p, status: "valid", nextSide: "right" })).toBe(
    "RIGHT SIDE NEXT",
  );
});

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { SKILLS } from "../src/tower/catalog";
import { exerciseMotionMap } from "../src/tower/exerciseMotionMaps";
import ExerciseDemo from "../src/exercises/ExerciseDemo";
import { skillGuide } from "../src/tower/skillGuides";

describe("exact exercise learning diagrams", () => {
  it.each(SKILLS.map((skill) => [skill.id]))(
    "%s has bounded, finite teaching poses and a return/rest sequence",
    (id) => {
      const map = exerciseMotionMap(id);
      expect(map.frames.length).toBeGreaterThanOrEqual(3);
      for (const frame of map.frames) {
        expect(frame.label.length).toBeGreaterThan(1);
        expect(frame.cue.length).toBeGreaterThan(10);
        for (const point of Object.values(frame.pose))
          for (const number of point) {
            expect(Number.isFinite(number)).toBe(true);
            expect(number).toBeGreaterThanOrEqual(0);
            expect(number).toBeLessThanOrEqual(320);
          }
      }
      expect(map.frames.at(-1)!.label).toMatch(/RETURN|REST|LOWER|FINISH/);
    },
  );
  it("never silently falls back to an unrelated movement", () => {
    expect(() => exerciseMotionMap("new-unreviewed-skill")).toThrow(
      "UNKNOWN_EXERCISE_MOTION_MAP",
    );
    expect(() => exerciseMotionMap("__proto__")).toThrow();
  });
  it("teaches a multi-step advanced Bird Dog, a hold, a pause and a compound exercise distinctly", () => {
    expect(
      exerciseMotionMap("advanced-birddog").frames.map((f) => f.label),
    ).toEqual(["START", "REACH", "DRAW IN", "REACH AGAIN", "RETURN"]);
    expect(exerciseMotionMap("high-plank").frames[1].label).toBe("HOLD");
    expect(
      exerciseMotionMap("pause-squat").frames.map((f) => f.label),
    ).toContain("PAUSE");
    expect(exerciseMotionMap("squat-reach").frames.map((f) => f.label)).toEqual(
      ["START", "SQUAT", "REACH", "RETURN"],
    );
    expect(
      exerciseMotionMap("continuous-side-step").frames.map((f) => f.label),
    ).toContain("STEP 2");
  });
  it("Bird Dog and Dead Bug move opposite anatomical sides", () => {
    for (const id of ["birddog", "deadbug"]) {
      const { frames } = exerciseMotionMap(id),
        start = frames[0].pose,
        end = frames[1].pose;
      expect(end.lw).not.toEqual(start.lw);
      expect(end.ra).not.toEqual(start.ra);
      expect(end.rw).toEqual(start.rw);
      expect(end.la).toEqual(start.la);
    }
  });
  it("exact skill ID controls visuals even when its transport says birddog", () => {
    const markup = renderToStaticMarkup(
      createElement(ExerciseDemo, {
        exerciseId: "birddog",
        skillId: "deadbug",
        guideOverride: skillGuide("deadbug"),
      }),
    );
    expect(markup).toContain('data-motion-skill="deadbug"');
    expect(markup).toContain("ACE · Supine dead bug");
    expect(markup).not.toContain("Exercise reference · NHS");
    expect(markup).not.toContain('data-motion-skill="birddog"');
  });
  it("holds and confirmation diagrams never imply that the animation credits progress", () => {
    const markup = renderToStaticMarkup(
      createElement(ExerciseDemo, {
        exerciseId: "birddog",
        skillId: "abdominal-brace",
      }),
    );
    expect(markup).toContain("manual confirmation");
    expect(markup).toContain(
      "Muscle contraction and normal breathing cannot be verified",
    );
    expect(markup).toContain("Teaching schematic");
  });
});

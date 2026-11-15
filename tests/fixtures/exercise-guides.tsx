import { useState } from "react";
import { createRoot } from "react-dom/client";
import { SKILLS, SKILL_BY_ID } from "../../src/tower/catalog";
import ExerciseDemo from "../../src/exercises/ExerciseDemo";
import { skillGuide } from "../../src/tower/skillGuides";
function Fixture() {
  const [id, setId] = useState("deadbug");
  const [reduced, setReduced] = useState(false);
  const skill = SKILL_BY_ID[id];
  return (
    <main
      className={`bt ${reduced ? "bt-reduced-motion" : ""}`}
      style={{
        maxWidth: 720,
        margin: "auto",
        padding: 12,
        background: "#f5ebd1",
        fontFamily: "sans-serif",
      }}
    >
      <label>
        Exercise{" "}
        <select
          aria-label="Exercise"
          value={id}
          onChange={(e) => setId(e.target.value)}
        >
          {SKILLS.map((s) => (
            <option value={s.id} key={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={reduced}
          onChange={(e) => setReduced(e.target.checked)}
        />
        Reduced motion
      </label>
      <ExerciseDemo
        exerciseId={skill.exercise}
        skillId={id}
        guideOverride={skillGuide(id)}
      />
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);

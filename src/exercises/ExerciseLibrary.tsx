import { useState } from "react";
import type { ExerciseId } from "../core/contracts";
import { attacks } from "../core/game";
import ExerciseDemo, { EXERCISE_GUIDES } from "./ExerciseDemo";
import "./exercises.css";
export default function ExerciseLibrary() {
  const [selected, SELECT] = useState<ExerciseId>("squat");
  const list = attacks.filter(
    (a, i) => attacks.findIndex((b) => b.exercise === a.exercise) === i,
  );
  return (
    <section className="exercise-library">
      <p>
        Choose an exercise to see its starting position, full movement and
        camera placement. Equip its skill from your satchel before an encounter.
      </p>
      <div className="exercise-library-tabs">
        {list.map((a) => (
          <button
            key={a.exercise}
            aria-pressed={selected === a.exercise}
            onClick={() => SELECT(a.exercise)}
          >
            <strong>
              {EXERCISE_GUIDES[a.exercise].title.split(" · ")[1] ??
                EXERCISE_GUIDES[a.exercise].title}
            </strong>
            <small>
              {["sitstand", "wallpushup", "bridge"].includes(a.exercise)
                ? "NEW · HOME EXERCISE"
                : a.type.toUpperCase()}
            </small>
          </button>
        ))}
      </div>
      <div className="exercise-library-demo">
        <ExerciseDemo exerciseId={selected} />
      </div>
      <p className="tiny">
        Choose a comfortable space and pause whenever needed. Home exercise
        references inform the movement descriptions; game repetition targets are
        not a medical exercise plan.
      </p>
    </section>
  );
}

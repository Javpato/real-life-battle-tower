// Development-only fixture. Vite's production entry does not import or bundle this file.
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import ExerciseCamera from "../../src/exercises/ExerciseCamera";
import type { ExerciseId } from "../../src/core/contracts";
function CameraFixture() {
  const [active, setActive] = useState(true),
    [manual, setManual] = useState(false),
    [paused, setPaused] = useState(false),
    [session, setSession] = useState(1),
    [progress, setProgress] = useState(0),
    [exercise, setExercise] = useState<ExerciseId>("squat");
  return (
    <main style={{ maxWidth: 980, margin: "auto" }}>
      <h1>Camera lifecycle test fixture</h1>
      <nav aria-label="Test controls">
        <button onClick={() => setActive((v) => !v)}>
          {active ? "End turn" : "Begin turn"}
        </button>
        <button onClick={() => setManual((v) => !v)}>
          {manual ? "Camera mode" : "Manual mode"}
        </button>
        <button onClick={() => setPaused((v) => !v)}>
          {paused ? "Global resume" : "Global pause"}
        </button>
        <button
          onClick={() => {
            setSession((v) => v + 1);
            setProgress(0);
          }}
        >
          New session
        </button>
        <button
          onClick={() =>
            setExercise((v) => (v === "squat" ? "lunge" : "squat"))
          }
        >
          Change exercise
        </button>
      </nav>
      <output data-testid="units">{progress}</output>
      <ExerciseCamera
        exerciseId={exercise}
        sessionId={`test-session-${session}`}
        target={8}
        progress={progress}
        active={active && !paused && !manual}
        mode={manual ? "manual" : "camera"}
        paused={paused}
        muted
        onUnit={() => setProgress((v) => v + 1)}
      />
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CameraFixture />
  </StrictMode>,
);

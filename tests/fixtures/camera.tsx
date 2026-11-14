// Development-only fixture. Vite's production entry does not import or bundle this file.
import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import ExerciseCamera from "../../src/exercises/ExerciseCamera";
import type { PoseFrame } from "../../src/exercises/detectors";
import type { ExerciseId } from "../../src/core/contracts";
function CameraFixture() {
  const [active, setActive] = useState(true),
    [manual, setManual] = useState(false),
    [paused, setPaused] = useState(false),
    [session, setSession] = useState(1),
    [progress, setProgress] = useState(0),
    [exercise, setExercise] = useState<ExerciseId>("squat");
  const [source, setSource] = useState<"webcam" | "phone">("webcam"),
    [phoneFrame, setPhoneFrame] = useState<PoseFrame | null>(null);
  useEffect(() => {
    const receive = (event: Event) =>
      setPhoneFrame((event as CustomEvent<PoseFrame | null>).detail);
    window.addEventListener("test-phone-frame", receive);
    return () => window.removeEventListener("test-phone-frame", receive);
  }, []);
  const receiptMode = new URLSearchParams(location.search).has("receipts");
  const pendingReceipt = useRef<((accepted: boolean) => void) | null>(null);
  const [requests, setRequests] = useState(0);
  const settle = (accepted: boolean) => {
    if (!pendingReceipt.current) return;
    const resolve = pendingReceipt.current;
    pendingReceipt.current = null;
    if (accepted) setProgress((v) => v + 1);
    resolve(accepted);
  };
  return (
    <main style={{ maxWidth: 980, margin: "auto" }}>
      <h1>Camera lifecycle test fixture</h1>
      <nav aria-label="Test controls">
        <button
          onClick={() =>
            setSource((v) => (v === "webcam" ? "phone" : "webcam"))
          }
        >
          {source === "webcam" ? "Phone source" : "Webcam source"}
        </button>
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
        {receiptMode && (
          <>
            <button onClick={() => settle(true)}>Accept repetition</button>
            <button onClick={() => settle(false)}>Reject repetition</button>
          </>
        )}
      </nav>
      <output data-testid="units">{progress}</output>
      <output data-testid="requests">{requests}</output>
      <ExerciseCamera
        source={source}
        externalPoseFrame={phoneFrame}
        onRequestCameraMode={() => {
          setManual(false);
          setPaused(false);
        }}
        exerciseId={exercise}
        sessionId={`test-session-${session}`}
        target={receiptMode ? 2 : 8}
        progress={progress}
        active={active && !paused && !manual}
        mode={manual ? "manual" : "camera"}
        paused={paused}
        muted
        onUnit={() => {
          if (!receiptMode) {
            setProgress((v) => v + 1);
            return;
          }
          setRequests((v) => v + 1);
          return new Promise<boolean>((resolve) => {
            pendingReceipt.current = resolve;
          });
        }}
      />
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CameraFixture />
  </StrictMode>,
);

// Development-only fixture. Vite's production entry does not import or bundle this file.
import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import ExerciseCamera from "../../src/exercises/ExerciseCamera";
import type { PoseFrame } from "../../src/exercises/detectors";
import type { ExerciseId, ExerciseUnit } from "../../src/core/contracts";
import { SKILL_BY_ID } from "../../src/tower/catalog";
import { skillGuide } from "../../src/tower/skillGuides";
import { exerciseProfile } from "../../src/tower/exerciseProfiles";
function CameraFixture() {
  const params = new URLSearchParams(location.search);
  const candidate = params.get("skill") ?? "";
  const skill = Object.hasOwn(SKILL_BY_ID, candidate)
    ? SKILL_BY_ID[candidate]
    : undefined;
  const confirmation =
    !!skill && exerciseProfile(skill.id)?.method === "confirmation";
  const [events, setEvents] = useState<ExerciseUnit[]>([]);
  const [lastSide, setLastSide] = useState<"left" | "right">();
  const [active, setActive] = useState(true),
    [manual, setManual] = useState(false),
    [paused, setPaused] = useState(false),
    [session, setSession] = useState(1),
    [progress, setProgress] = useState(0),
    [exercise, setExercise] = useState<ExerciseId>("squat");
  const [source, setSource] = useState<"webcam" | "phone">("webcam"),
    [phoneFrame, setPhoneFrame] = useState<PoseFrame | null>(null);
  const [phonePreview, setPhonePreview] = useState<MediaStream | null>(null);
  useEffect(() => {
    const receive = (e: Event) =>
      setPhonePreview((e as CustomEvent<MediaStream | null>).detail);
    window.addEventListener("test-phone-preview", receive);
    return () => window.removeEventListener("test-phone-preview", receive);
  }, []);
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
            setLastSide(undefined);
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
      {manual && skill && (
        <button
          onClick={() => {
            setProgress((v) => v + 1);
            if (skill.alternating)
              setLastSide((side) => (side === "left" ? "right" : "left"));
          }}
        >
          Confirm manual fixture unit
        </button>
      )}
      <output data-testid="units">{progress}</output>
      <output data-testid="requests">{requests}</output>
      <output data-testid="events" hidden>
        {JSON.stringify(events)}
      </output>
      <ExerciseCamera
        source={source}
        externalPoseFrame={phoneFrame}
        externalPreview={phonePreview}
        onRequestCameraMode={() => {
          setManual(false);
          setPaused(false);
        }}
        exerciseId={skill?.exercise ?? exercise}
        skillId={skill?.id}
        lastSide={lastSide}
        guideOverride={skill ? skillGuide(skill.id) : undefined}
        recognitionProfile={
          skill?.id === "mini-squat" || skill?.id === "knee-pushup"
            ? skill.id
            : undefined
        }
        sessionId={`test-session-${session}`}
        target={receiptMode ? 2 : 8}
        progress={progress}
        active={active && !paused && !manual && !confirmation}
        mode={manual || confirmation ? "manual" : "camera"}
        paused={paused}
        muted
        onUnit={(unit) => {
          setEvents((previous) => [...previous, unit]);
          if (unit.side) setLastSide(unit.side);
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

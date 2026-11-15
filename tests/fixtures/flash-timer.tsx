// Development-only integration fixture; never imported by the production entry.
// Synthetic phone joints go through the real filter/detector, camera UI and reducer.
import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import ExerciseCamera from "../../src/exercises/ExerciseCamera";
import FlashTimer from "../../src/exercises/FlashTimer";
import {
  activeSeries,
  applyCommand,
  initialSave,
} from "../../src/tower/engine";
import type {
  ExerciseUnit,
  PlayerSave,
  TowerCommand,
} from "../../src/tower/model";
import type { PoseFrame } from "../../src/exercises/detectors";

function createTrial() {
  const save = initialSave("Synthetic QA", "female");
  // A single test opportunity allows a genuine canonical trial; no repetitions
  // or cadence are inserted into its save by the fixture.
  save.progression!.flashTokens = 1;
  return applyCommand(save, { kind: "startFlashTrial", skillId: "mini-squat" });
}

function Fixture() {
  const [save, setSave] = useState<PlayerSave>(createTrial),
    saved = useRef(save);
  const [phone, setPhone] = useState<PoseFrame | null>(null),
    [manual, setManual] = useState(false);
  const [requests, setRequests] = useState(0),
    [rejected, setRejected] = useState(0),
    staleNext = useRef(false);
  const commit = (command: TowerCommand) => {
    const next = applyCommand(saved.current, command);
    saved.current = next;
    setSave(next);
    return next;
  };
  const receive = (unit: ExerciseUnit) => {
    setRequests((value) => value + 1);
    try {
      const current = activeSeries(saved.current)!;
      const next = commit({
        kind: "unit",
        sessionId: staleNext.current ? "expired-test-session" : current.id,
        unit,
      });
      const accepted = activeSeries(next)?.seen.includes(unit.id) === true;
      if (!accepted) setRejected((value) => value + 1);
      return accepted;
    } catch (error) {
      if (
        !(error instanceof Error) ||
        error.message !== "STALE_EXERCISE_SESSION"
      )
        throw error;
      setRejected((value) => value + 1);
      return false;
    } finally {
      staleNext.current = false;
    }
  };
  useEffect(() => {
    const receiveFrame = (event: Event) =>
      setPhone((event as CustomEvent<PoseFrame | null>).detail);
    window.addEventListener("test-flash-frame", receiveFrame);
    return () => window.removeEventListener("test-flash-frame", receiveFrame);
  }, []);
  const trial = save.activity.kind === "trial" ? save.activity : null;
  const series = trial?.series;
  const flash = trial
    ? {
        stage: trial.flashStage ?? "reference",
        cadenceMs: trial.cadenceMs,
        set: series?.flash,
      }
    : undefined;
  return (
    <main style={{ maxWidth: 980, margin: "auto", fontFamily: "sans-serif" }}>
      <h1>Flash timing · synthetic phone integration</h1>
      <p>
        No physical camera or human exercise accuracy is evaluated by this
        fixture.
      </p>
      <nav aria-label="Fixture controls">
        <button
          onClick={() => {
            const next = createTrial();
            saved.current = next;
            setSave(next);
            setManual(false);
            setRequests(0);
            setRejected(0);
            staleNext.current = false;
          }}
        >
          Reset trial
        </button>
        <button onClick={() => setManual((value) => !value)}>
          {manual ? "Camera mode" : "Manual mode"}
        </button>
        <button
          onClick={() => {
            staleNext.current = true;
          }}
        >
          Reject next stale receipt
        </button>
        {series && (
          <button
            onClick={() => commit({ kind: "pause", paused: !series.paused })}
          >
            {series.paused ? "Resume trial" : "Pause trial"}
          </button>
        )}
        {manual && series && (
          <button
            disabled={series.paused || trial?.completed}
            onClick={() => commit({ kind: "manualUnit", sessionId: series.id })}
          >
            Confirm manual repetition
          </button>
        )}
        {trial?.completed && (
          <button onClick={() => commit({ kind: "finishTrial" })}>
            Finish trial
          </button>
        )}
      </nav>
      <div>
        Saved repetitions:{" "}
        <output data-testid="saved-units">{series?.progress ?? 9}</output> / 9
      </div>
      <div>
        Camera receipt requests:{" "}
        <output data-testid="requests">{requests}</output>
      </div>
      <div>
        Rejected receipts: <output data-testid="rejected">{rejected}</output>
      </div>
      <output data-testid="trial-state">
        {trial?.completed ? "complete" : (trial?.flashStage ?? "finished")}
      </output>
      <output data-testid="cadence">
        {trial?.cadenceMs ??
          save.progression?.flashCadence["mini-squat"] ??
          "none"}
      </output>
      <output data-testid="verification">
        {save.progression?.flashVerification?.["mini-squat"] ?? "pending"}
      </output>
      {series && flash && (
        <>
          {manual && (
            <FlashTimer
              {...flash}
              mode="manual"
              elapsedMs={0}
              lastCycleMs={null}
              progress={series.progress}
              active={!series.paused && !trial?.completed}
            />
          )}
          <ExerciseCamera
            source="phone"
            externalPoseFrame={phone}
            exerciseId="squat"
            recognitionProfile="mini-squat"
            onFlashInterrupted={() => {
              if (series?.flash)
                commit({ kind: "interruptFlash", sessionId: series.id });
            }}
            flash={flash}
            sessionId={series.id}
            target={series.target}
            progress={series.progress}
            active={!trial?.completed}
            paused={series.paused}
            sessionComplete={trial?.completed}
            mode={manual ? "manual" : "camera"}
            muted
            hideIllustration
            onUnit={receive}
          />
        </>
      )}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Fixture />
  </StrictMode>,
);

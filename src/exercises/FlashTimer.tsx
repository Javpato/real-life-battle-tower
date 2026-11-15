import { useEffect, useState } from "react";
import { flashCadenceWindow } from "../tower/flash";

export type FlashTiming = {
  stage: "reference" | "test" | "battle";
  cadenceMs?: number;
};
export type FlashTimerProps = FlashTiming & {
  mode?: "camera" | "manual";
  elapsedMs: number;
  lastCycleMs: number | null;
  progress: number;
  active: boolean;
  feedback?: string;
};

export default function FlashTimer(props: FlashTimerProps) {
  const [practiceMs, setPracticeMs] = useState(0);
  const manual = props.mode === "manual";
  useEffect(() => {
    if (!manual || !props.active) return;
    const start = performance.now();
    setPracticeMs(0);
    const timer = setInterval(
      () => setPracticeMs(performance.now() - start),
      100,
    );
    return () => clearInterval(timer);
  }, [manual, props.active, props.progress]);
  const elapsed = manual ? practiceMs : props.elapsedMs;
  const window = flashCadenceWindow(props.cadenceMs);
  const measured = window.referenceMs !== null;
  const seconds = (n: number) => (n / 1000).toFixed(1);
  return (
    <section
      className="exercise-flash-timer"
      aria-label="Flash timer"
      data-mode={manual ? "manual" : "camera"}
    >
      <div className="flash-timer-readout">
        <span>FLASH TIMER{!props.active ? " · PAUSED" : ""}</span>
        <strong
          role="timer"
          aria-label={
            manual ? "Unverified practice time" : "Observed repetition time"
          }
        >
          {seconds(elapsed)}
          <small>s</small>
        </strong>
      </div>
      <div className="flash-timer-detail">
        <b>
          {manual
            ? "Practice pace · unverified"
            : props.stage === "reference"
              ? "Measure 3 comfortable reps"
              : measured
                ? `${seconds(window.minMs)}–${seconds(window.maxMs)}s / rep`
                : "Camera pace not measured yet"}
        </b>
        <small>
          {manual
            ? "Timer resets on confirmation. Manual reps do not earn a speed bonus."
            : measured && elapsed > 0
              ? elapsed > window.maxMs
                ? "Take a breath; restart this rep when ready."
                : `${seconds(Math.max(0, window.maxMs - elapsed))}s left in this rep’s window`
              : props.stage === "battle" && !measured
                ? "Retry your Flash trial with the camera to measure your pace."
                : "Rest freely between reps."}
        </small>
        {!manual && props.lastCycleMs !== null && (
          <small>Last rep: {seconds(props.lastCycleMs)}s</small>
        )}
        {props.feedback && <small role="status">{props.feedback}</small>}
      </div>
    </section>
  );
}

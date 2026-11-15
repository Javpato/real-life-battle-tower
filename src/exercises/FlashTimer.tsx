import { useEffect, useState } from "react";
import { flashCadenceWindow } from "../tower/flash";
import type { Series } from "../tower/model";

export type FlashTiming = {
  stage: "reference" | "test" | "battle";
  cadenceMs?: number;
  legacy?: boolean;
  set?: Series["flash"];
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
  const [elapsed, setElapsed] = useState(props.elapsedMs);
  useEffect(() => {
    setElapsed(props.elapsedMs);
    if (!props.active || props.elapsedMs <= 0) return;
    const anchor = performance.now();
    const timer = setInterval(
      () => setElapsed(props.elapsedMs + performance.now() - anchor),
      50,
    );
    return () => clearInterval(timer);
  }, [props.elapsedMs, props.active, props.stage]);
  const reference = props.stage === "reference";
  const budget = props.set?.budgetMs;
  const remaining = budget == null ? null : Math.max(0, budget - elapsed);
  const interrupted = props.set?.status === "interrupted";
  const expired = props.set?.status === "expired" || remaining === 0;
  const manual = props.mode === "manual";
  if (props.legacy) {
    const window = flashCadenceWindow(props.cadenceMs);
    return (
      <section className="exercise-flash-timer" aria-label="Flash timer">
        <div className="flash-timer-readout">
          <span>LEGACY FLASH · PER REP</span>
          <strong role="timer" aria-label="Observed repetition time">
            {(elapsed / 1000).toFixed(1)}
            <small>s</small>
          </strong>
        </div>
        <div className="flash-timer-detail">
          <b>
            {manual
              ? "Manual practice · unverified"
              : `${(window.minMs / 1000).toFixed(1)}–${(window.maxMs / 1000).toFixed(1)}s / rep`}
          </b>
          <small>
            This saved set keeps its original timing rules. New sets use a
            whole-set countdown.
          </small>
        </div>
      </section>
    );
  }
  return (
    <section
      className="exercise-flash-timer"
      aria-label="Flash timer"
      data-mode={manual ? "manual" : "camera"}
    >
      <div className="flash-timer-readout">
        <span>{reference ? "MEASURE YOUR PACE" : "FLASH · WHOLE SET"}</span>
        <strong role="timer" aria-label="Set countdown">
          {reference || remaining == null ? "—" : (remaining / 1000).toFixed(1)}
          <small>s</small>
        </strong>
      </div>
      <div className="flash-timer-detail">
        <b>
          {reference
            ? "3 comfortable repetitions"
            : interrupted
              ? "Rest taken · normal damage"
              : expired
                ? "Time’s up · normal damage"
                : props.set?.source === "custom"
                  ? "Your custom target"
                  : "Personal target · 20% less time"}
        </b>
        <small>
          {manual
            ? "Manual confirmations are unverified and earn no speed bonus."
            : reference
              ? "Complete the same movement at your comfortable pace."
              : props.stage === "test" && (expired || interrupted)
                ? "Practice freely, then retry the timed set at no cost."
                : remaining == null
                  ? "Measure your pace in a camera Flash trial first."
                  : expired || interrupted
                    ? "Keep moving when ready. Every accepted repetition still counts."
                    : elapsed === 0
                      ? "Countdown starts with your first movement."
                      : "Complete the set before zero for Flash damage."}
        </small>
        {props.lastCycleMs !== null && (
          <small>Last rep: {(props.lastCycleMs / 1000).toFixed(1)}s</small>
        )}
        {props.feedback && <small role="status">{props.feedback}</small>}
      </div>
    </section>
  );
}

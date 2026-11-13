import { useEffect, useRef, useState } from "react";
import type { ExerciseHudProps } from "./exerciseUi";
import {
  ExerciseCuePlanner,
  armExerciseAudio,
  playExerciseCue,
  speakExercise,
  stopExerciseSpeech,
} from "../audio/exerciseFeedback";
import { EXERCISE_GUIDES } from "./ExerciseDemo";
const labels: Record<ExerciseHudProps["status"], string> = {
  "no-body": "I CAN’T SEE YOU",
  partial: "PARTLY IN VIEW",
  insufficient: "ADJUST THE CAMERA",
  ready: "READY TO BEGIN",
  moving: "KEEP GOING",
  return: "RETURN TO START",
  valid: "NICE WORK!",
  incomplete: "TRY THE FULL MOVEMENT",
  hold: "HOLD STEADY",
  paused: "REST — NO TIME LIMIT",
  off: "CAMERA IS OFF",
  loading: "STARTING CAMERA",
  error: "CAMERA NEEDS ATTENTION",
  countdown: "GET READY",
};
export default function ExerciseHUD(props: ExerciseHudProps) {
  const {
    exerciseId,
    progress,
    target,
    status,
    message,
    nextSide,
    quality,
    countdown,
    paused,
    muted,
    active,
    complete,
  } = props;
  const [voice, VOICE] = useState(() => {
      try {
        return localStorage.getItem("everstride-exercise-voice") === "on";
      } catch {
        return false;
      }
    }),
    [pulse, PULSE] = useState(false);
  const current = useRef(props);
  current.current = props;
  const last = useRef(progress),
    planner = useRef(new ExerciseCuePlanner(progress));
  useEffect(() => {
    planner.current = new ExerciseCuePlanner(progress);
    last.current = progress;
  }, [exerciseId]);
  useEffect(() => {
    if (progress > last.current) {
      PULSE(true);
      const t = setTimeout(() => PULSE(false), 420);
      last.current = progress;
      return () => clearTimeout(t);
    }
    last.current = progress;
  }, [progress]);
  useEffect(() => {
    const unlock = () => {
      if (!current.current.muted) armExerciseAudio();
    };
    document.addEventListener("pointerdown", unlock);
    document.addEventListener("keydown", unlock);
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, []);
  useEffect(() => {
    const tick = () => {
      const p = current.current;
      const cues = planner.current.update(
        { ...p, seconds: p.exerciseId === "superman" },
        performance.now(),
      );
      if (p.muted) return;
      for (const cue of cues) {
        playExerciseCue(cue.kind);
      }
      if (voice && cues.length) speakExercise(cues.at(-1)!.speech);
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [voice, progress, target, status, message, nextSide, active, complete]);
  useEffect(() => {
    if (muted || !voice) stopExerciseSpeech();
  }, [muted, voice]);
  useEffect(() => () => stopExerciseSpeech(), []);
  const seconds = exerciseId === "superman",
    alternating = exerciseId === "lunge" || exerciseId === "birddog";
  const effective = paused ? "paused" : complete ? "valid" : status;
  const title = complete ? "SERIES COMPLETE" : labels[effective];
  return (
    <section
      className={`exercise-hud state-${effective}${pulse ? " rep-pulse" : ""}`}
      aria-label="Exercise progress"
    >
      <div
        className="exercise-counter"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <strong data-testid="exercise-count">{progress}</strong>
        <span className="exercise-counter-target">
          / {target}
          <small>{seconds ? "SECONDS" : "REPETITIONS"}</small>
        </span>
      </div>
      <div
        className="exercise-progress-track"
        role="progressbar"
        aria-label={seconds ? "Verified seconds" : "Exercise repetitions"}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={progress}
      >
        <span
          style={{
            width: `${Math.min(100, target ? (progress / target) * 100 : 0)}%`,
          }}
        />
      </div>
      {alternating && (
        <div className="exercise-next-side" aria-live="polite">
          <small>
            NEXT {exerciseId === "birddog" ? "ARM + OPPOSITE LEG" : "LEG"}
          </small>
          <strong>{nextSide ? nextSide.toUpperCase() : "EITHER SIDE"}</strong>
        </div>
      )}
      <div className="exercise-big-feedback" aria-live="polite">
        <strong>
          {status === "countdown" && countdown !== undefined && !paused
            ? `${title} · ${countdown}`
            : title}
        </strong>
        <p>
          {paused
            ? "Keep resting. Your completed repetitions and damage are saved."
            : message}
        </p>
      </div>
      <div className="exercise-start-position">
        <span>STARTING POSITION</span>
        <p>{EXERCISE_GUIDES[exerciseId].setup}</p>
      </div>
      <footer>
        <span>
          {quality === null
            ? "Movement quality —"
            : `Last movement · ${quality}% quality`}
        </span>
        <label>
          <input
            type="checkbox"
            checked={voice}
            onChange={(e) => {
              const enabled = e.target.checked;
              VOICE(enabled);
              try {
                localStorage.setItem(
                  "everstride-exercise-voice",
                  enabled ? "on" : "off",
                );
              } catch {}
              if (enabled && !muted) {
                armExerciseAudio();
                speakExercise("Voice coach on. Follow the starting position.");
              }
            }}
          />{" "}
          Voice coach
        </label>
      </footer>
    </section>
  );
}

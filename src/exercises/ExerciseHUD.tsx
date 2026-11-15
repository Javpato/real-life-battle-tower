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
import { STARTING_CUES, exerciseHeadline } from "./exercisePresentation";
import FlashTimer from "./FlashTimer";
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
  const voice = props.voiceEnabled ?? false;
  const [pulse, PULSE] = useState(false);
  const current = useRef(props);
  current.current = props;
  const last = useRef(progress),
    planner = useRef(new ExerciseCuePlanner(progress));
  useEffect(() => {
    planner.current = new ExerciseCuePlanner(progress);
    last.current = progress;
  }, [exerciseId, props.sessionId]);
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
        {
          ...p,
          seconds: p.unit ? p.unit === "seconds" : p.exerciseId === "superman",
        },
        performance.now(),
      );
      if (p.muted) return;
      for (const cue of cues) {
        playExerciseCue(cue.kind);
      }
      if (voice && cues.length) {
        const cue = cues.at(-1)!;
        speakExercise(cue.speech, cue.kind === "complete");
      }
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [voice, progress, target, status, message, nextSide, active, complete]);
  useEffect(() => {
    if (muted || !voice) stopExerciseSpeech();
  }, [muted, voice]);
  useEffect(() => () => stopExerciseSpeech(), []);
  const seconds = props.unit
      ? props.unit === "seconds"
      : exerciseId === "superman",
    alternating =
      props.alternating ?? (exerciseId === "lunge" || exerciseId === "birddog");
  const paired = props.skillId
    ? [
        "birddog",
        "alternating-birddog",
        "pause-birddog",
        "advanced-birddog",
        "alternating-superman",
      ].includes(props.skillId)
    : exerciseId === "birddog";
  const sidePart = props.skillId ? "SIDE" : "LEG";
  const effective =
    status === "error"
      ? "error"
      : paused
        ? "paused"
        : complete
          ? "valid"
          : status;
  const title = exerciseHeadline(props);
  return (
    <section
      className={`exercise-hud state-${effective}${pulse ? " rep-pulse" : ""}`}
      aria-label="Exercise progress"
    >
      <div className="exercise-hud-heading">
        <span>YOUR PROGRESS</span>
        <small>
          {props.assisted
            ? "ASSISTED · ESTIMATE"
            : quality === null
              ? "AT YOUR PACE"
              : `${quality}% QUALITY`}
        </small>
      </div>
      {props.flash && <FlashTimer {...props.flash} />}
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
        aria-label={seconds ? "Exercise seconds" : "Exercise repetitions"}
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
        <div
          className={`exercise-next-side${paired ? " is-pair" : ""}`}
          aria-live="polite"
        >
          <small>NEXT {paired ? "ARM + OPPOSITE LEG" : sidePart}</small>
          <strong>
            {nextSide
              ? paired
                ? `${nextSide.toUpperCase()} ARM + ${nextSide === "left" ? "RIGHT" : "LEFT"} LEG`
                : `${nextSide.toUpperCase()} ${sidePart}`
              : "EITHER SIDE"}
          </strong>
        </div>
      )}
      <div className="exercise-big-feedback" aria-live="polite">
        <strong>
          {(status === "countdown" || status === "recalibrating") &&
          countdown !== undefined &&
          countdown > 0 &&
          !paused
            ? `${title} · ${countdown}`
            : title}
        </strong>
        <p>
          {paused && effective !== "error"
            ? "Keep resting. Your completed repetitions and damage are saved."
            : message}
        </p>
      </div>
      <details className="exercise-start-position">
        <summary>
          <span>STARTING POSITION</span>
          <strong>{props.startingPosition ?? STARTING_CUES[exerciseId]}</strong>
          <i aria-hidden="true">＋</i>
        </summary>
        <div className="exercise-posture-popover">
          <p>{props.guideSetup ?? EXERCISE_GUIDES[exerciseId].setup}</p>
          <small className="exercise-camera-angle">
            CAMERA · {props.guideCamera ?? EXERCISE_GUIDES[exerciseId].camera}
          </small>
          <footer>
            <span>
              {quality === null
                ? "Movement quality —"
                : `Last movement · ${quality}% quality`}
            </span>
          </footer>
        </div>
      </details>
    </section>
  );
}

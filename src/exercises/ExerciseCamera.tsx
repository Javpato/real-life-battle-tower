import { useEffect, useRef, useState } from "react";
import type { ExerciseCameraProps } from "../core/contracts";
import { ExerciseDetector, observePose, type PoseFrame } from "./detectors";
import ExerciseDemo, { EXERCISE_GUIDES } from "./ExerciseDemo";
import "./exercises.css";

type Stage =
  | "off"
  | "loading"
  | "framing"
  | "practice"
  | "countdown"
  | "running"
  | "error";
function needsGuide(id: string) {
  try {
    return localStorage.getItem("everstride-guide-" + id) !== "seen";
  } catch {
    return true;
  }
}
const LINKS = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
];

export default function ExerciseCamera(props: ExerciseCameraProps) {
  const video = useRef<HTMLVideoElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const worker = useRef<Worker | null>(null),
    stream = useRef<MediaStream | null>(null);
  const detector = useRef(new ExerciseDetector(props.exerciseId));
  const stageRef = useRef<Stage>("off"),
    pausedRef = useRef(false),
    issued = useRef(props.progress);
  const busy = useRef(false),
    stableSince = useRef<number | undefined>(undefined),
    countdownAt = useRef<number | undefined>(undefined);
  const loop = useRef(0),
    lastFrame = useRef(-1),
    lastCapture = useRef(0);
  const generation = useRef(0);
  const [stage, setStage] = useState<Stage>("off"),
    [message, setMessage] = useState("Your camera stays on this device.");
  const [demo, setDemo] = useState(() => needsGuide(props.exerciseId)),
    [paused, setPaused] = useState(false),
    [countdown, setCountdown] = useState(3);
  const [quality, setQuality] = useState<number | null>(null),
    [rejections, setRejections] = useState(0);
  const [autoStart, setAutoStart] = useState(true);
  const autoRef = useRef(true);
  autoRef.current = autoStart;
  const setPhase = (next: Stage) => {
    stageRef.current = next;
    setStage(next);
  };
  const stop = () => {
    generation.current++;
    cancelAnimationFrame(loop.current);
    worker.current?.terminate();
    worker.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    busy.current = false;
    if (video.current) video.current.srcObject = null;
  };
  const fail = (detail: string) => {
    stop();
    setPhase("error");
    const text = `Camera recognition unavailable: ${detail}. You can continue with manual mode.`;
    setMessage(text);
    latest.current.onError?.(text);
  };
  useEffect(() => () => stop(), []);
  useEffect(() => {
    detector.current = new ExerciseDetector(props.exerciseId);
    stableSince.current = undefined;
    countdownAt.current = undefined;
    issued.current = props.progress;
    setQuality(null);
    setRejections(0);
    setDemo(needsGuide(props.exerciseId));
    if (stream.current) {
      setPhase("framing");
      setMessage("Reposition for the new exercise.");
    }
  }, [props.exerciseId]);
  useEffect(() => {
    detector.current.pause();
    issued.current = props.progress;
    stableSince.current = undefined;
    if (props.active && stageRef.current === "running") {
      setPhase("countdown");
      countdownAt.current = undefined;
    }
  }, [props.active]);
  const beginCountdown = () => {
    detector.current.pause();
    countdownAt.current = undefined;
    setCountdown(3);
    setPhase("countdown");
  };
  const receivePose = (frame: PoseFrame) => {
    busy.current = false;
    const context = canvas.current?.getContext("2d");
    if (context && canvas.current) {
      canvas.current.width = frame.width;
      canvas.current.height = frame.height;
      context.strokeStyle = "#8affbe";
      context.lineWidth = 3;
      for (const [a, b] of LINKS) {
        const p = frame.landmarks[a],
          q = frame.landmarks[b];
        if (
          !p ||
          !q ||
          (p.visibility ?? 0) < 0.55 ||
          (q.visibility ?? 0) < 0.55
        )
          continue;
        context.beginPath();
        context.moveTo(p.x * frame.width, p.y * frame.height);
        context.lineTo(q.x * frame.width, q.y * frame.height);
        context.stroke();
      }
    }
    if (
      pausedRef.current ||
      !latest.current.active ||
      issued.current >= latest.current.target
    )
      return;
    const o = observePose(latest.current.exerciseId, frame);
    if (!o.visible) {
      detector.current.pause();
      stableSince.current = undefined;
      countdownAt.current = undefined;
      setMessage(
        "Required joints are hidden. Reposition; your progress is safe.",
      );
      return;
    }
    if (stageRef.current === "framing") {
      if (o.ready) {
        stableSince.current ??= frame.timestamp;
        setMessage("Starting position visible. Hold steady for two seconds.");
        if (frame.timestamp - stableSince.current >= 2000) {
          detector.current.pause();
          setPhase("practice");
          setMessage(
            "Calibration: perform one practice repetition. It causes no damage.",
          );
        }
      } else {
        stableSince.current = undefined;
        setMessage(
          "Show your whole body and settle into the starting position.",
        );
      }
      return;
    }
    if (stageRef.current === "countdown") {
      if (!o.ready) {
        countdownAt.current = undefined;
        setMessage("Return to the starting position for the countdown.");
        return;
      }
      if (!autoRef.current && countdownAt.current === undefined) {
        setMessage("Ready. Press Start series when comfortable.");
        return;
      }
      countdownAt.current ??= frame.timestamp;
      const remaining = Math.max(
        0,
        3 - Math.floor((frame.timestamp - countdownAt.current) / 1000),
      );
      setCountdown(remaining);
      setMessage(`Get ready · ${remaining}`);
      if (remaining === 0) {
        detector.current.pause();
        setPhase("running");
        setMessage("Begin when ready. There is no time limit.");
      }
      return;
    }
    if (stageRef.current !== "practice" && stageRef.current !== "running")
      return;
    const result = detector.current.update(frame);
    if (stageRef.current === "practice") {
      setMessage(`Practice only · ${result.message}`);
      if (result.unit) beginCountdown();
      return;
    }
    setMessage(result.message);
    if (result.rejected) setRejections((n) => n + 1);
    if (
      result.unit &&
      latest.current.active &&
      issued.current < latest.current.target
    ) {
      issued.current = Math.max(issued.current, latest.current.progress) + 1;
      setQuality(Math.round(result.unit.quality * 100));
      latest.current.onUnit(result.unit);
    }
  };
  const receiveRef = useRef(receivePose);
  receiveRef.current = receivePose;
  const startCamera = async () => {
    stop();
    try {
      localStorage.setItem("everstride-guide-" + props.exerciseId, "seen");
    } catch {}
    setDemo(false);
    setPhase("loading");
    setMessage("Loading local pose recognition…");
    pausedRef.current = false;
    setPaused(false);
    const attempt = generation.current;
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "A secure HTTPS page and camera permission are required",
        );
      const media = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 24, max: 30 },
        },
      });
      if (attempt !== generation.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      if (!video.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      video.current.srcObject = media;
      await video.current.play();
      if (attempt !== generation.current) return;
      const poseWorker = new Worker(
        new URL("./pose.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.current = poseWorker;
      poseWorker.onerror = () => fail("The local vision worker could not run");
      poseWorker.onmessage = (event: MessageEvent) => {
        if (worker.current !== poseWorker) return;
        if (event.data.type === "error") {
          fail(event.data.message);
          return;
        }
        if (event.data.type === "pose")
          receiveRef.current(event.data as PoseFrame);
        if (event.data.type === "ready") {
          setPhase("framing");
          setMessage(
            "Show your whole body, then settle into the starting position.",
          );
          const tick = async () => {
            if (worker.current !== poseWorker) return;
            loop.current = requestAnimationFrame(tick);
            const v = video.current,
              now = performance.now();
            if (
              !v ||
              v.readyState < 2 ||
              busy.current ||
              v.currentTime === lastFrame.current ||
              now - lastCapture.current < 65
            )
              return;
            lastFrame.current = v.currentTime;
            lastCapture.current = now;
            busy.current = true;
            try {
              const bitmap = await createImageBitmap(v);
              if (worker.current !== poseWorker) {
                bitmap.close();
                return;
              }
              poseWorker.postMessage(
                { type: "frame", bitmap, timestamp: now },
                [bitmap],
              );
            } catch {
              busy.current = false;
              fail("Camera frames could not be processed");
            }
          };
          loop.current = requestAnimationFrame(tick);
        }
      };
      const base = new URL(import.meta.env.BASE_URL, location.href);
      poseWorker.postMessage({
        type: "init",
        modelUrl: new URL("models/pose_landmarker_lite.task", base).href,
        wasmUrl: new URL("models/wasm", base).href,
      });
    } catch (error) {
      if (attempt === generation.current)
        fail(error instanceof Error ? error.message : "Permission was denied");
    }
  };
  const togglePause = () => {
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    detector.current.pause();
    if (!next && stageRef.current === "running") beginCountdown();
    setMessage(
      next
        ? "Rest as long as you need. Your progress is safe."
        : "Return to the starting position.",
    );
  };
  return (
    <section className="exercise-camera" aria-label="Exercise camera">
      <header>
        <span className="exercise-tag">LOCAL BODY TRACKING</span>
        <button type="button" onClick={() => setDemo((v) => !v)}>
          {demo ? "Hide guide" : "Show guide"}
        </button>
      </header>
      {demo && <ExerciseDemo exerciseId={props.exerciseId} />}
      <div className={`exercise-feed ${stream.current ? "is-live" : ""}`}>
        <video
          ref={video}
          muted
          autoPlay
          playsInline
          aria-label="Mirrored camera preview"
        />
        <canvas ref={canvas} aria-hidden="true" />
        {!stream.current && (
          <div className="exercise-placeholder">
            <span>◉</span>
            <strong>{EXERCISE_GUIDES[props.exerciseId].camera}</strong>
            <small>Video is processed locally and is never uploaded.</small>
          </div>
        )}
        {stage === "countdown" && (
          <div className="exercise-countdown">{countdown}</div>
        )}
        {paused && <div className="exercise-countdown">REST</div>}
      </div>
      <div className="exercise-readout">
        <strong>
          {props.progress} / {props.target}{" "}
          {props.exerciseId === "superman" ? "seconds" : "reps"}
        </strong>
        <span>{quality === null ? "Quality —" : `Quality ${quality}%`}</span>
      </div>
      <p className="exercise-feedback" role="status" aria-live="polite">
        {message}
      </p>
      {stage === "off" || stage === "error" ? (
        <button
          className="exercise-primary"
          type="button"
          onClick={startCamera}
        >
          {stage === "error" ? "Retry camera" : "Enable camera · skip guide"}
        </button>
      ) : (
        <div className="exercise-actions">
          <button
            type="button"
            onClick={togglePause}
            disabled={stage === "loading"}
          >
            {paused ? "Resume" : "Pause / rest"}
          </button>
          <button
            type="button"
            onClick={() => {
              detector.current.pause();
              stableSince.current = undefined;
              setPhase("framing");
              setRejections(0);
              setMessage("Recalibrating. Your completed units are safe.");
            }}
          >
            Recalibrate
          </button>
          <button
            type="button"
            onClick={() => {
              stop();
              detector.current.pause();
              setPhase("off");
              setMessage(
                "Camera stopped. Use the battle controls to cancel or continue manually.",
              );
            }}
          >
            Stop camera
          </button>
        </div>
      )}
      <label className="exercise-auto">
        <input
          type="checkbox"
          checked={autoStart}
          onChange={(e) => setAutoStart(e.target.checked)}
        />{" "}
        Start automatically after calibration
      </label>
      {!autoStart && stage === "countdown" && (
        <button
          type="button"
          className="exercise-primary"
          onClick={() => {
            countdownAt.current = performance.now();
          }}
        >
          Start series
        </button>
      )}
      {rejections >= 3 && (
        <p className="exercise-note">
          Several movements were not verified. Try recalibration or the battle's
          manual continuation. Verified progress is retained.
        </p>
      )}
      <small className="exercise-note">
        Stop if you feel discomfort. Camera feedback is a game estimate, not a
        medical assessment.
      </small>
    </section>
  );
}

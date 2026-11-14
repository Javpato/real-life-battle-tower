import { useEffect, useRef, useState } from "react";
import type { ExerciseCameraProps, ExerciseUnit } from "../core/contracts";
import {
  ExerciseDetector,
  observePose,
  type PoseFrame,
  type Observation,
  type DetectorFeedback,
} from "./detectors";
import {
  CameraLifecycle,
  type CameraSelection,
  type CameraSnapshot,
} from "./cameraLifecycle";
import ExerciseDemo, { EXERCISE_GUIDES } from "./ExerciseDemo";
import ExerciseHUD from "./ExerciseHUD";
import type { ExerciseVisualState } from "./exerciseUi";
import "./exercises.css";

type Props = Omit<ExerciseCameraProps, "onUnit"> & {
  onUnit: (unit: ExerciseUnit) => void | boolean | Promise<boolean>;
  lastSide?: "left" | "right";
  sessionId?: string;
  muted?: boolean;
  mode?: "camera" | "manual";
  paused?: boolean;
  sessionComplete?: boolean;
};
type Stage =
  "off" | "loading" | "framing" | "ready" | "countdown" | "running" | "error";
type RichObservation = Observation & {
  status?: ExerciseVisualState;
  message?: string;
  fresh?: boolean;
  missingJoints?: string[];
};
type RichFeedback = DetectorFeedback & {
  status?: ExerciseVisualState;
  nextSide?: "left" | "right";
};
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
const initialCamera: CameraSnapshot = {
  status: "off",
  message: "Your camera stays on this device.",
  stream: null,
};
const calibrationGroup = (id: Props["exerciseId"]) =>
  id === "diamond" ? "pushup" : id;
function needsGuide(id: string) {
  try {
    return localStorage.getItem("everstride-guide-" + id) !== "seen";
  } catch {
    return true;
  }
}
function sessionKey(props: Props) {
  return `${props.exerciseId}:${props.sessionId ?? "default-session"}`;
}

export default function ExerciseCamera(props: Props) {
  const video = useRef<HTMLVideoElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const lifecycle = useRef<CameraLifecycle | null>(null);
  const detector = useRef(
    new ExerciseDetector(props.exerciseId, props.sessionId, props.lastSide),
  );
  const detectorSession = useRef(sessionKey(props));
  const stageRef = useRef<Stage>("off"),
    pausedRef = useRef(false);
  const pendingUnit = useRef<{ session: string } | null>(null);
  const issued = useRef(props.progress),
    calibrated = useRef(new Set<string>());
  const stableSince = useRef<number | null>(null),
    countdownAt = useRef<number | null>(null),
    lastObservation = useRef<number | null>(null);
  const manualCountdown = useRef(false),
    autoRef = useRef(true);
  const [camera, setCamera] = useState(initialCamera),
    [stage, setStage] = useState<Stage>("off");
  const [status, setStatus] = useState<ExerciseVisualState>("off"),
    [message, setMessage] = useState(initialCamera.message);
  const [demo, setDemo] = useState(() => needsGuide(props.exerciseId)),
    [paused, setPaused] = useState(false);
  const [countdown, setCountdown] = useState(3),
    [quality, setQuality] = useState<number | null>(null),
    [nextSide, setNextSide] = useState<"left" | "right" | undefined>();
  const [rejections, setRejections] = useState(0),
    [autoStart, setAutoStart] = useState(true);
  const [selection, setSelection] = useState<CameraSelection>({
      facingMode: "user",
    }),
    [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceNotice, setDeviceNotice] = useState("");
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  autoRef.current = autoStart;
  const setPhase = (value: Stage) => {
    stageRef.current = value;
    setStage(value);
  };
  const resetTiming = () => {
    stableSince.current = null;
    countdownAt.current = null;
    lastObservation.current = null;
    manualCountdown.current = false;
    setCountdown(3);
  };
  const beginCountdown = (manual = false) => {
    setDemo(false);
    detector.current.pause();
    lifecycle.current?.invalidateFrames();
    countdownAt.current = null;
    manualCountdown.current = manual;
    setCountdown(3);
    setPhase("countdown");
    setStatus("countdown");
    setMessage("Starting position ready. Breathe and get comfortable.");
  };
  const draw = (frame: PoseFrame) => {
    const c = canvas.current,
      context = c?.getContext("2d");
    if (!c || !context) return;
    c.width = frame.width;
    c.height = frame.height;
    context.clearRect(0, 0, c.width, c.height);
    context.strokeStyle = "#8affbe";
    context.lineWidth = 3;
    for (const [a, b] of LINKS) {
      const p = frame.landmarks[a],
        q = frame.landmarks[b];
      if (!p || !q || (p.visibility ?? 0) < 0.55 || (q.visibility ?? 0) < 0.55)
        continue;
      context.beginPath();
      context.moveTo(p.x * frame.width, p.y * frame.height);
      context.lineTo(q.x * frame.width, q.y * frame.height);
      context.stroke();
    }
  };
  const receivePose = (frame: PoseFrame) => {
    draw(frame);
    const p = latest.current;
    // Render may have changed props before React effects run. Never credit a frame into the next session.
    if (detectorSession.current !== sessionKey(p)) return;
    if (pendingUnit.current) {
      setStatus("paused");
      setMessage(
        "Saving this repetition. Rest while your adventure confirms it.",
      );
      return;
    }
    const o = observePose(p.exerciseId, frame) as RichObservation;
    const fresh = o.fresh !== false;
    if (
      pausedRef.current ||
      p.paused ||
      !p.active ||
      p.mode === "manual" ||
      issued.current >= p.target ||
      p.sessionComplete
    )
      return;
    const previous = lastObservation.current;
    lastObservation.current = frame.timestamp;
    if (
      previous !== null &&
      (frame.timestamp <= previous || frame.timestamp - previous > 400)
    ) {
      stableSince.current = null;
      countdownAt.current = null;
      if (frame.timestamp <= previous) return;
    }
    if (stageRef.current === "running") {
      // Let the detector handle brief occlusion. It must see missing frames to pause held time safely.
      const result = detector.current.update(frame) as RichFeedback;
      setNextSide(result.nextSide ?? detector.current.expectedSide);
      setStatus(
        result.unit
          ? "valid"
          : result.rejected
            ? "incomplete"
            : (result.status ??
              (result.state === "tracking-lost"
                ? (o.status ?? "partial")
                : result.state)),
      );
      setMessage(result.message || o.message || "Move at your own pace.");
      if (result.rejected) setRejections((n) => n + 1);
      if (
        result.unit &&
        fresh &&
        o.visible &&
        latest.current.active &&
        !latest.current.paused &&
        latest.current.mode !== "manual" &&
        !pausedRef.current &&
        !latest.current.sessionComplete &&
        detectorSession.current === sessionKey(latest.current) &&
        issued.current < latest.current.target
      ) {
        issued.current = Math.max(issued.current, latest.current.progress) + 1;
        const unit = result.unit;
        const pending = { session: detectorSession.current };
        pendingUnit.current = pending;
        detector.current.pause();
        const settled = (accepted: boolean) => {
          if (
            pendingUnit.current !== pending ||
            !lifecycle.current ||
            detectorSession.current !== pending.session
          )
            return;
          pendingUnit.current = null;
          if (accepted) {
            setQuality(Math.round(unit.quality * 100));
            setStatus("valid");
            setMessage("Repetition saved. Nice work — continue when ready.");
          } else {
            // A canonical rejection must not spend the remaining local unit budget
            // or change which anatomical side the adventure expects.
            const current = latest.current;
            issued.current = current.progress;
            detector.current = new ExerciseDetector(
              current.exerciseId,
              current.sessionId,
              current.lastSide,
            );
            lifecycle.current.invalidateFrames();
            setNextSide(detector.current.expectedSide);
            setStatus("incomplete");
            setMessage(
              "That repetition was not accepted by the adventure. Your saved progress is kept; return to the starting position.",
            );
          }
        };
        try {
          const receipt = latest.current.onUnit(unit);
          if (receipt && typeof receipt === "object" && "then" in receipt) {
            setStatus("paused");
            setMessage(
              "Saving this repetition. Rest while your adventure confirms it.",
            );
            void receipt.then(
              (accepted) => settled(accepted),
              () => settled(false),
            );
          } else {
            settled(receipt !== false);
          }
        } catch {
          settled(false);
        }
      }
      return;
    }
    if (!o.visible || !fresh) {
      stableSince.current = null;
      countdownAt.current = null;
      setCountdown(3);
      setStatus(o.status ?? (frame.landmarks.length ? "partial" : "no-body"));
      setMessage(
        o.message ??
          "Move the required joints into view. Your completed units are kept.",
      );
      return;
    }
    if (stageRef.current === "framing") {
      setStatus(o.status ?? (o.ready ? "ready" : "insufficient"));
      if (!o.ready) {
        stableSince.current = null;
        setMessage(o.message ?? EXERCISE_GUIDES[p.exerciseId].setup);
        return;
      }
      stableSince.current ??= frame.timestamp;
      setMessage("Starting position visible. Hold comfortably for a moment.");
      if (
        calibrated.current.has(calibrationGroup(p.exerciseId)) ||
        frame.timestamp - stableSince.current >= 700
      ) {
        calibrated.current.add(calibrationGroup(p.exerciseId));
        detector.current.pause();
        setPhase("ready");
        setStatus("ready");
        setMessage(
          autoRef.current
            ? "Ready. The countdown will begin automatically."
            : "Ready. Use Start without automatic calibration when comfortable.",
        );
        if (autoRef.current) beginCountdown();
      }
      return;
    }
    if (stageRef.current === "ready") {
      setStatus(o.ready ? "ready" : (o.status ?? "insufficient"));
      setMessage(
        o.ready
          ? "Ready. Use Start without automatic calibration when comfortable."
          : (o.message ?? EXERCISE_GUIDES[p.exerciseId].setup),
      );
      if (autoRef.current && o.ready) beginCountdown();
      return;
    }
    if (stageRef.current === "countdown") {
      if (!o.ready) {
        countdownAt.current = null;
        setCountdown(3);
        setStatus(o.status ?? "insufficient");
        setMessage(
          o.message ??
            "Return to the starting position. The countdown will restart when ready.",
        );
        return;
      }
      if (!autoRef.current && !manualCountdown.current) {
        setPhase("ready");
        setStatus("ready");
        return;
      }
      countdownAt.current ??= frame.timestamp;
      const remaining = Math.max(
        0,
        3 - Math.floor((frame.timestamp - countdownAt.current) / 1000),
      );
      setCountdown(remaining);
      setStatus("countdown");
      setMessage(
        remaining
          ? `Get ready · ${remaining}`
          : "Begin when ready. There is no time limit.",
      );
      if (remaining === 0) {
        detector.current.pause();
        setPhase("running");
        setStatus("ready");
      }
    }
  };
  const receiveRef = useRef(receivePose);
  receiveRef.current = receivePose;
  const cameraStateRef = useRef<(snapshot: CameraSnapshot) => void>(() => {});
  cameraStateRef.current = (snapshot) => {
    setCamera(snapshot);
    if (snapshot.status === "requesting") {
      calibrated.current.clear();
      detector.current.pause();
      resetTiming();
      setPhase("loading");
      setStatus("loading");
    } else if (
      snapshot.status === "starting" ||
      snapshot.status === "recovering"
    ) {
      detector.current.pause();
      resetTiming();
      setPhase("loading");
      setStatus("loading");
    } else if (snapshot.status === "ready") {
      resetTiming();
      setPhase("framing");
      setStatus("ready");
      void refreshDevices();
    } else if (snapshot.status === "off" || snapshot.status === "error") {
      detector.current.pause();
      calibrated.current.clear();
      resetTiming();
      setPhase(snapshot.status);
      setStatus(snapshot.status);
      const c = canvas.current;
      c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
      if (snapshot.status === "error")
        latest.current.onError?.(snapshot.message);
    }
    setMessage(snapshot.message);
  };
  async function refreshDevices() {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const list = (await navigator.mediaDevices.enumerateDevices()).filter(
        (d) => d.kind === "videoinput",
      );
      if (lifecycle.current) setDevices(list);
    } catch {
      if (lifecycle.current)
        setDeviceNotice(
          "Camera names could not be refreshed. Front/back selection is still available.",
        );
    }
  }
  useEffect(() => {
    const base = new URL(import.meta.env.BASE_URL, location.href);
    const controller = new CameraLifecycle({
      dependencies: {
        getUserMedia: (constraints) => {
          if (!navigator.mediaDevices?.getUserMedia)
            return Promise.reject(
              new Error(
                "A secure HTTPS page and camera permission are required.",
              ),
            );
          return navigator.mediaDevices.getUserMedia(constraints);
        },
        createWorker: () =>
          new Worker(new URL("./pose.worker.ts", import.meta.url), {
            type: "module",
          }),
        captureFrame: (v) => createImageBitmap(v),
        requestFrame: (callback) => requestAnimationFrame(callback),
        cancelFrame: (id) => cancelAnimationFrame(id),
        setTimer: (callback, ms) => setTimeout(callback, ms),
        clearTimer: (timer) => clearTimeout(timer),
        now: () => performance.now(),
      },
      init: {
        type: "init",
        modelUrl: new URL("models/pose_landmarker_lite.task", base).href,
        wasmUrl: new URL("models/wasm", base).href,
      },
      onState: (snapshot) => cameraStateRef.current(snapshot),
      onPose: (frame) => receiveRef.current(frame),
    });
    lifecycle.current = controller;
    const change = async () => {
      await refreshDevices();
      if (lifecycle.current !== controller) return;
      const media = controller.currentStream;
      const currentId = media?.getVideoTracks()[0]?.getSettings?.().deviceId;
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        if (
          lifecycle.current !== controller ||
          controller.currentStream !== media
        )
          return;
        if (
          currentId &&
          !list.some((d) => d.kind === "videoinput" && d.deviceId === currentId)
        ) {
          controller.stop(
            "The selected camera disconnected. Choose another camera, then enable it.",
          );
          setSelection({ facingMode: selectionRef.current.facingMode });
          setDeviceNotice("Camera connection changed. Your progress is kept.");
        } else
          setDeviceNotice(
            "Camera list updated. You can choose a different camera.",
          );
      } catch {
        if (
          lifecycle.current !== controller ||
          controller.currentStream !== media
        )
          return;
        setDeviceNotice(
          "A camera changed. If the preview stopped, choose a camera and restart.",
        );
      }
    };
    navigator.mediaDevices?.addEventListener?.("devicechange", change);
    void refreshDevices();
    return () => {
      navigator.mediaDevices?.removeEventListener?.("devicechange", change);
      controller.dispose();
      if (lifecycle.current === controller) lifecycle.current = null;
    };
  }, []);
  useEffect(() => {
    pendingUnit.current = null;
    detectorSession.current = sessionKey(props);
    detector.current = new ExerciseDetector(
      props.exerciseId,
      props.sessionId,
      props.lastSide,
    );
    lifecycle.current?.invalidateFrames();
    issued.current = props.progress;
    resetTiming();
    setQuality(null);
    setNextSide(detector.current.expectedSide);
    setRejections(0);
    setDemo(needsGuide(props.exerciseId));
    if (lifecycle.current?.currentStatus === "ready") {
      setPhase("framing");
      setStatus("ready");
      setMessage(EXERCISE_GUIDES[props.exerciseId].setup);
    }
  }, [props.exerciseId, props.sessionId]);
  useEffect(() => {
    detector.current.pause();
    lifecycle.current?.invalidateFrames();
    issued.current = props.progress;
    resetTiming();
    if (
      props.active &&
      !props.paused &&
      props.mode !== "manual" &&
      !pausedRef.current &&
      lifecycle.current?.currentStatus === "ready"
    ) {
      setPhase("framing");
      setStatus("ready");
      setMessage("Return to the starting position. Your calibration is kept.");
    }
  }, [props.active, props.paused, props.mode]);
  useEffect(() => {
    issued.current = Math.max(issued.current, props.progress);
  }, [props.progress]);
  useEffect(() => {
    if (props.mode === "manual")
      lifecycle.current?.stop(
        "Manual mode selected. Camera stopped. Enable it again for a preview if you wish.",
      );
  }, [props.mode]);
  const startCamera = async (next = selectionRef.current) => {
    if (!video.current) return;
    try {
      localStorage.setItem(
        "everstride-guide-" + latest.current.exerciseId,
        "seen",
      );
    } catch {
      /* Guides remain skippable without storage. */
    }
    setDemo(false);
    setDeviceNotice("");
    pausedRef.current = false;
    setPaused(false);
    detector.current.pause();
    await lifecycle.current?.start(video.current, next);
  };
  const changeSelection = (next: CameraSelection) => {
    setSelection(next);
    selectionRef.current = next;
    if (
      lifecycle.current &&
      !["off", "error"].includes(lifecycle.current.currentStatus)
    )
      void startCamera(next);
  };
  const togglePause = () => {
    const value = !pausedRef.current;
    pausedRef.current = value;
    setPaused(value);
    detector.current.pause();
    lifecycle.current?.invalidateFrames();
    resetTiming();
    if (!value && lifecycle.current?.currentStatus === "ready")
      setPhase("framing");
    setMessage(
      value
        ? "Rest as long as you need. Your progress and calibration are kept."
        : "Return to the starting position.",
    );
  };
  const inactive =
    paused || props.paused || !props.active || props.mode === "manual";
  const transportInactive = [
    "off",
    "error",
    "requesting",
    "starting",
    "recovering",
  ].includes(camera.status);
  const hudStatus: ExerciseVisualState = transportInactive
    ? camera.status === "off"
      ? "off"
      : camera.status === "error"
        ? "error"
        : "loading"
    : inactive
      ? "paused"
      : status;
  const hudMessage =
    !transportInactive && inactive
      ? props.mode === "manual"
        ? "Manual mode · preview only. No camera repetitions are credited."
        : paused || props.paused
          ? "Paused. Your completed units are kept."
          : "Preview only between turns. Choose an exercise to begin."
      : message;
  const mirrored =
    (camera.facingMode ?? selection.facingMode) !== "environment";
  const guide = EXERCISE_GUIDES[props.exerciseId];
  const [showSkeleton, setShowSkeleton] = useState(true);
  return (
    <section
      className="exercise-camera"
      aria-label="Exercise camera"
      data-camera-state={camera.status}
      data-exercise-stage={stage}
    >
      <header>
        <div className="exercise-camera-title">
          <span className="exercise-tag">LOCAL BODY TRACKING</span>
          <strong>{guide.title.split(" · ")[1] ?? guide.title}</strong>
        </div>
        <button
          type="button"
          aria-expanded={demo}
          onClick={() => setDemo((v) => !v)}
        >
          {demo ? "Hide guide" : "Show guide"}
        </button>
      </header>
      {demo && (
        <section
          className="exercise-guide-popover"
          role="dialog"
          aria-label={`${guide.title} guide`}
          aria-modal="false"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              setDemo(false);
            }
          }}
        >
          <div className="exercise-guide-heading">
            <strong>
              Your next move · {props.target}{" "}
              {props.exerciseId === "superman" ? "seconds" : "repetitions"}
            </strong>
            <button type="button" onClick={() => setDemo(false)}>
              Close exercise guide
            </button>
          </div>
          <ExerciseDemo exerciseId={props.exerciseId} />
        </section>
      )}
      <div className={`exercise-feed ${camera.stream ? "is-live" : ""}`}>
        <video
          ref={video}
          muted
          autoPlay
          playsInline
          aria-label="Camera preview"
          style={{ transform: mirrored ? "scaleX(-1)" : "none" }}
        />
        <canvas
          ref={canvas}
          aria-hidden="true"
          style={{
            transform: mirrored ? "scaleX(-1)" : "none",
            visibility: showSkeleton ? "visible" : "hidden",
          }}
        />
        {!camera.stream && (
          <div className="exercise-placeholder">
            <div className="exercise-prep-art" aria-hidden="true">
              <ExerciseDemo exerciseId={props.exerciseId} />
            </div>
            <strong>{guide.camera}</strong>
            <small>Enable the camera when you are ready.</small>
          </div>
        )}
      </div>
      <ExerciseHUD
        exerciseId={props.exerciseId}
        progress={props.progress}
        target={props.target}
        status={hudStatus}
        message={hudMessage}
        nextSide={nextSide}
        quality={quality}
        countdown={hudStatus === "countdown" ? countdown : undefined}
        paused={Boolean(!transportInactive && (paused || props.paused))}
        muted={props.muted}
        active={props.active && props.mode !== "manual" && !paused}
        complete={props.sessionComplete}
      />
      <div className="exercise-camera-controls" aria-label="Camera controls">
        <div className="exercise-actions">
          <button
            type="button"
            className="exercise-primary"
            onClick={() => void startCamera()}
          >
            {camera.status === "error"
              ? "Retry camera"
              : camera.status === "off"
                ? "Enable camera"
                : "Restart camera"}
          </button>
          <button
            type="button"
            onClick={() => lifecycle.current?.stop()}
            disabled={camera.status === "off"}
          >
            Stop camera
          </button>
          <button type="button" onClick={togglePause}>
            {paused ? "Resume recognition" : "Pause / rest"}
          </button>
          <button
            type="button"
            onClick={() => {
              detector.current.pause();
              lifecycle.current?.invalidateFrames();
              calibrated.current.delete(calibrationGroup(props.exerciseId));
              resetTiming();
              setRejections(0);
              if (lifecycle.current?.currentStatus === "ready")
                setPhase("framing");
              setMessage(
                "Recalibrate from the starting position. Completed units are kept.",
              );
            }}
          >
            Recalibrate
          </button>
          <button
            type="button"
            className="exercise-primary exercise-start-manual"
            aria-label="Start without automatic calibration"
            disabled={
              camera.status !== "ready" ||
              inactive ||
              Boolean(pendingUnit.current) ||
              props.sessionComplete ||
              props.progress >= props.target
            }
            onClick={() => {
              setDemo(false);
              detector.current.pause();
              lifecycle.current?.invalidateFrames();
              resetTiming();
              setPhase("running");
              setStatus("ready");
              setMessage(
                "Series started. Move into position; only observed full reps count.",
              );
            }}
          >
            Start now
          </button>
        </div>
        <details className="exercise-camera-settings">
          <summary>Camera settings</summary>
          <div className="exercise-settings-popover">
            <div className="exercise-camera-selectors">
              <label>
                Camera facing
                <select
                  aria-label="Camera facing"
                  value={selection.facingMode}
                  onChange={(e) =>
                    changeSelection({
                      facingMode: e.target
                        .value as CameraSelection["facingMode"],
                    })
                  }
                >
                  <option value="user">Front / selfie camera</option>
                  <option value="environment">Back / outward camera</option>
                </select>
              </label>
              <label>
                Camera device
                <select
                  aria-label="Camera device"
                  value={selection.deviceId ?? ""}
                  onChange={(e) =>
                    changeSelection({
                      facingMode: selection.facingMode,
                      deviceId: e.target.value || undefined,
                    })
                  }
                >
                  <option value="">Automatic camera selection</option>
                  {devices.map((device, i) => (
                    <option
                      key={device.deviceId || `camera-${i}`}
                      value={device.deviceId}
                    >
                      {device.label || `Camera ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {deviceNotice && (
              <p className="exercise-note" role="status">
                {deviceNotice}
              </p>
            )}
            <label className="exercise-auto">
              <input
                type="checkbox"
                checked={autoStart}
                onChange={(e) => setAutoStart(e.target.checked)}
              />{" "}
              Start automatically after calibration
            </label>
            <label className="exercise-auto">
              <input
                type="checkbox"
                checked={showSkeleton}
                onChange={(event) => setShowSkeleton(event.target.checked)}
              />{" "}
              Show skeleton overlay
            </label>
            <small className="exercise-note">
              Stop if you feel discomfort. Camera feedback is a game estimate,
              not a medical assessment.
            </small>
          </div>
        </details>
      </div>
      {rejections >= 3 && (
        <p className="exercise-note exercise-rejection-note">
          Several movements were not verified. Recalibrate or use manual
          continuation. Verified progress is kept.
        </p>
      )}
    </section>
  );
}

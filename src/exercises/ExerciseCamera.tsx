import { useEffect, useRef, useState } from "react";
import type { ExerciseCameraProps, ExerciseUnit } from "../core/contracts";
import {
  type PoseFrame,
  type Observation,
  type DetectorFeedback,
} from "./detectors";
import {
  CameraLifecycle,
  type CameraSelection,
  type CameraSnapshot,
  type CameraMetrics,
} from "./cameraLifecycle";
import ExerciseDemo, {
  EXERCISE_GUIDES,
  getExerciseGuide,
} from "./ExerciseDemo";
import ExerciseHUD from "./ExerciseHUD";
import { createExerciseDetector } from "./assistedDetector";
import { exerciseProfile, recognitionLabel } from "../tower/exerciseProfiles";
import { SKILL_BY_ID } from "../tower/catalog";
import type { ExerciseVisualState } from "./exerciseUi";
import "./exercises.css";
import { RecalibrationGate } from "./preparation";
import { PoseFilter } from "./poseFilter";
import { FeedbackDwell } from "./feedbackDwell";
import { STARTING_CUES } from "./exercisePresentation";
import type { FlashTiming } from "./FlashTimer";
import { UnitQueue } from "./unitQueue";
import {
  armExerciseAudio,
  speakExercise,
  stopExerciseSpeech,
} from "../audio/exerciseFeedback";

type Props = Omit<ExerciseCameraProps, "onUnit"> & {
  skillId?: string;
  recognitionProfile?: "mini-squat" | "knee-pushup";
  flash?: FlashTiming;
  onFlashInterrupted?: () => void;
  onReceiptQueueReady?: (flush: () => Promise<void>) => void;
  suspended?: boolean;
  guideOverride?: (typeof EXERCISE_GUIDES)["squat"];
  hideIllustration?: boolean;
  onUnit: (unit: ExerciseUnit) => void | boolean | Promise<boolean>;
  lastSide?: "left" | "right";
  sessionId?: string;
  muted?: boolean;
  mode?: "camera" | "manual";
  paused?: boolean;
  sessionComplete?: boolean;
  onRequestCameraMode?: () => void;
  source?: "webcam" | "phone";
  externalPoseFrame?: PoseFrame | null;
  externalPreview?: MediaStream | null;
};
type Stage =
  | "off"
  | "loading"
  | "framing"
  | "ready"
  | "countdown"
  | "running"
  | "recalibrating"
  | "error";
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
const calibrationGroup = (id: string) => id;
function needsGuide(id: string) {
  try {
    return localStorage.getItem("everstride-guide-" + id) !== "seen";
  } catch {
    return true;
  }
}
function sessionKey(props: Props) {
  return `${props.skillId ?? props.exerciseId}:${props.sessionId ?? "default-session"}`;
}

export default function ExerciseCamera(props: Props) {
  const video = useRef<HTMLVideoElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const lifecycle = useRef<CameraLifecycle | null>(null);
  const [fullModelUrl, setFullModelUrl] = useState<string | null>(null),
    [model, setModel] = useState<"lite" | "full">("lite"),
    [modelBusy, setModelBusy] = useState(false),
    [modelNotice, setModelNotice] = useState("");
  const fullUrlRef = useRef<string | null>(null),
    downloadRef = useRef<AbortController | null>(null),
    metricsAt = useRef(0);
  const [metrics, setMetrics] = useState<CameraMetrics | null>(null);
  useEffect(
    () => () => {
      downloadRef.current?.abort();
      if (fullUrlRef.current) URL.revokeObjectURL(fullUrlRef.current);
    },
    [],
  );
  const chooseModel = async (next: "lite" | "full") => {
    if (latest.current.source === "phone") return;
    let url = fullUrlRef.current;
    if (next === "full" && !url) {
      setModelBusy(true);
      setModelNotice(
        "Downloading the larger Full camera model. Your camera images stay on this device.",
      );
      const controller = new AbortController();
      downloadRef.current = controller;
      try {
        const remote =
          "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";
        const cache =
          typeof caches !== "undefined"
            ? await caches.open("everstride-optional-pose-model-v1")
            : null;
        let response = await cache?.match(remote);
        if (!response) {
          response = await fetch(remote, { signal: controller.signal });
          if (!response.ok) throw new Error("Model download failed");
          await cache?.put(remote, response.clone());
        }
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(blob);
        fullUrlRef.current = url;
        setFullModelUrl(url);
      } catch {
        if (!controller.signal.aborted)
          setModelNotice(
            "Full could not download. Fast (Lite) is still available. Try again when connected.",
          );
        return;
      } finally {
        if (!controller.signal.aborted) setModelBusy(false);
      }
    }
    lifecycle.current?.stop();
    detector.current.beginCalibration();
    calibrated.current.clear();
    poseFilter.current.reset();
    setModel(next);
    setMetrics(null);
    setModelNotice(
      `${next === "full" ? "Full" : "Fast (Lite)"} selected. Enable camera and calibrate again. The exercise movement stays the same.`,
    );
  };
  const poseFilter = useRef(new PoseFilter()),
    phoneTimestamp = useRef(-Infinity),
    phoneArrival = useRef(-Infinity);
  const [partialSquat, setPartialSquat] = useState(false);
  const detector = useRef(
    createExerciseDetector(props.exerciseId, props.sessionId, props.lastSide, {
      allowPartialSquat: partialSquat,
      profile: props.recognitionProfile,
      skillId: props.skillId,
      tolerance: props.flash ? "flash" : "standard",
    }),
  );
  const detectorSession = useRef(sessionKey(props));
  const [flashElapsed, setFlashElapsed] = useState(0),
    [flashLast, setFlashLast] = useState<number | null>(null),
    [flashFeedback, setFlashFeedback] = useState("");
  const recalibration = useRef(new RecalibrationGate());
  const dismissedGuide = useRef(new Set<string>());
  const dismissGuide = () => {
    dismissedGuide.current.add(sessionKey(latest.current));
    setDemo(false);
  };
  const stageRef = useRef<Stage>("off"),
    pausedRef = useRef(false);
  const unitQueue = useRef(
    new UnitQueue<{ unit: ExerciseUnit; deliver: Props["onUnit"] }>((entry) =>
      entry.deliver(entry.unit),
    ),
  );
  const flashStart = useRef<number | null>(null);
  const flashInterrupted = useRef(false);
  const issued = useRef(props.progress),
    calibrated = useRef(new Set<string>());
  const stableSince = useRef<number | null>(null),
    countdownAt = useRef<number | null>(null),
    lastObservation = useRef<number | null>(null);
  const manualCountdown = useRef(false),
    autoRef = useRef(true);
  const [voice, setVoice] = useState(() => {
    try {
      return localStorage.getItem("everstride-exercise-voice") !== "off";
    } catch {
      return true;
    }
  });
  const [camera, setCamera] = useState(initialCamera),
    [stage, setStage] = useState<Stage>("off");
  const [status, setStatus] = useState<ExerciseVisualState>("off"),
    [message, setMessage] = useState(initialCamera.message);
  const [demo, setDemo] = useState(() =>
      needsGuide(props.skillId ?? props.exerciseId),
    ),
    [paused, setPaused] = useState(false);
  const [countdown, setCountdown] = useState(3),
    [quality, setQuality] = useState<number | null>(null),
    [nextSide, setNextSide] = useState<"left" | "right" | undefined>();
  const [missingJoints, setMissingJoints] = useState<string[]>([]);
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
    setFlashElapsed(0);
    recalibration.current.cancel();
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
  const receivePose = (rawFrame: PoseFrame) => {
    const frame = poseFilter.current.process(rawFrame);
    draw(frame);
    const p = latest.current;
    // Render may have changed props before React effects run. Never credit a frame into the next session.
    if (detectorSession.current !== sessionKey(p)) return;
    if (unitQueue.current.size >= unitQueue.current.limit) {
      detector.current.pause();
      if (!flashInterrupted.current && flashStart.current !== null) {
        flashInterrupted.current = true;
        latest.current.onFlashInterrupted?.();
      }
      setStatus("paused");
      setMessage(
        "Connection is catching up. Your completed repetitions are being saved.",
      );
      return;
    }
    const o = detector.current.observe(frame) as RichObservation;
    const fresh = o.fresh !== false;
    setMissingJoints(o.visible && fresh ? [] : (o.missingJoints ?? []));
    if (
      pausedRef.current ||
      p.paused ||
      !p.active ||
      p.suspended ||
      p.mode === "manual" ||
      issued.current >= p.target ||
      p.sessionComplete
    )
      return;
    if (stageRef.current === "recalibrating") {
      const remaining = recalibration.current.remaining(performance.now());
      setCountdown(remaining);
      setStatus("recalibrating");
      setMessage(
        remaining
          ? `Move back into position. Recalibration in ${remaining}.`
          : !o.visible || !fresh
            ? (o.message ?? guide.camera)
            : !o.ready
              ? guide.setup
              : "Starting position visible. Hold steady for one second.",
      );
      if (
        recalibration.current.observe(
          o.ready && o.visible,
          fresh,
          frame.timestamp,
          performance.now(),
        ) &&
        detector.current.recalibrate(frame)
      ) {
        calibrated.current.add(calibrationGroup(p.skillId ?? p.exerciseId));
        beginCountdown();
        setMessage(
          "Calibration complete. Get ready to continue; your progress is kept.",
        );
      }
      return;
    }
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
      if (p.flash) {
        if (p.flash.set?.startedAt !== undefined)
          flashStart.current = p.flash.set.startedAt;
        const cycleStart =
          detector.current.cycleStartedAt ?? result.unit?.cycle?.startedAt;
        if (p.flash.legacy) {
          setFlashElapsed(
            cycleStart == null ? 0 : Math.max(0, frame.timestamp - cycleStart),
          );
        } else if (p.flash.stage === "reference") {
          flashStart.current = null;
          setFlashElapsed(0);
        } else {
          if (flashStart.current === null && cycleStart != null)
            flashStart.current = cycleStart;
          if (flashStart.current !== null)
            setFlashElapsed(Math.max(0, frame.timestamp - flashStart.current));
          if (
            result.state === "tracking-lost" &&
            flashStart.current !== null &&
            !flashInterrupted.current
          ) {
            flashInterrupted.current = true;
            p.onFlashInterrupted?.();
          }
        }
        if (result.unit?.cycle)
          setFlashLast(result.unit.cycle.endedAt - result.unit.cycle.startedAt);
      }
      setNextSide(result.nextSide ?? detector.current.expectedSide);
      setMissingJoints(result.missingJoints ?? []);
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
        const unit: ExerciseUnit = {
          ...result.unit,
          ...(p.skillId ? { skillId: p.skillId } : {}),
        };
        issued.current = Math.max(issued.current, latest.current.progress) + 1;
        const session = detectorSession.current;
        const settled = (accepted: boolean) => {
          if (detectorSession.current !== session) return;
          if (accepted) {
            setQuality(unit.verified ? Math.round(unit.quality * 100) : null);
            setStatus("valid");
            const flashNote = p.flash
              ? "Repetition saved. Flash damage follows the set countdown."
              : "";
            setFlashFeedback(flashNote);
            setMessage(
              flashNote ||
                (unit.evidence === "assisted"
                  ? "Assisted movement saved. Continue when ready; technique is not verified."
                  : "Movement saved. Nice work — continue when ready."),
            );
          } else {
            // A canonical rejection must not spend the remaining local unit budget
            // or change which anatomical side the adventure expects.
            const current = latest.current;
            issued.current = current.progress;
            detector.current = createExerciseDetector(
              current.exerciseId,
              current.sessionId,
              current.lastSide,
              {
                allowPartialSquat: partialSquat,
                profile: current.recognitionProfile,
                skillId: current.skillId,
                tolerance: current.flash ? "flash" : "standard",
              },
            );
            lifecycle.current?.invalidateFrames();
            setNextSide(detector.current.expectedSide);
            setStatus("incomplete");
            setFlashFeedback(
              "Repetition not saved. Return to position and try again.",
            );
            setMessage(
              "That repetition was not accepted by the adventure. Your saved progress is kept; return to the starting position.",
            );
          }
        };
        unitQueue.current.push(
          { unit, deliver: latest.current.onUnit },
          settled,
        );
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
        setMessage(
          o.message ??
            (
              p.guideOverride ??
              getExerciseGuide(p.exerciseId, p.recognitionProfile)
            ).setup,
        );
        return;
      }
      stableSince.current ??= frame.timestamp;
      setMessage("Starting position visible. Hold comfortably for a moment.");
      if (
        calibrated.current.has(calibrationGroup(p.skillId ?? p.exerciseId)) ||
        frame.timestamp - stableSince.current >= 700
      ) {
        if (!detector.current.recalibrate(frame)) return;
        calibrated.current.add(calibrationGroup(p.skillId ?? p.exerciseId));
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
          : (o.message ??
              (
                p.guideOverride ??
                getExerciseGuide(p.exerciseId, p.recognitionProfile)
              ).setup),
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
    if (latest.current.source === "phone") return;
    setCamera(snapshot);
    if (snapshot.status === "requesting") {
      detector.current.beginCalibration();
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
      poseFilter.current.reset();
      setPhase("framing");
      setStatus("insufficient");
      void refreshDevices();
    } else if (snapshot.status === "off" || snapshot.status === "error") {
      detector.current.pause();
      detector.current.beginCalibration();
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
        modelUrl:
          model === "full" && fullModelUrl
            ? fullModelUrl
            : new URL("models/pose_landmarker_lite.task", base).href,
        wasmUrl: new URL("models/wasm", base).href,
      },
      onState: (snapshot) => cameraStateRef.current(snapshot),
      onPose: (frame) => receiveRef.current(frame),
      onMetrics: (value) => {
        const now = performance.now();
        if (now - metricsAt.current > 500) {
          metricsAt.current = now;
          setMetrics(value);
        }
      },
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
  }, [model, fullModelUrl]);
  useEffect(() => {
    unitQueue.current.reset();
    flashStart.current = null;
    flashInterrupted.current = false;
    detectorSession.current = sessionKey(props);
    detector.current = createExerciseDetector(
      props.exerciseId,
      props.sessionId,
      props.lastSide,
      {
        allowPartialSquat: partialSquat,
        profile: props.recognitionProfile,
        skillId: props.skillId,
        tolerance: props.flash ? "flash" : "standard",
      },
    );
    lifecycle.current?.invalidateFrames();
    poseFilter.current.reset();
    issued.current = props.progress;
    resetTiming();
    setQuality(null);
    setFlashLast(null);
    setFlashFeedback("");
    setNextSide(detector.current.expectedSide);
    setRejections(0);
    setDemo(
      !dismissedGuide.current.has(sessionKey(props)) &&
        needsGuide(props.skillId ?? props.exerciseId),
    );
    if (
      lifecycle.current?.currentStatus === "ready" ||
      props.source === "phone"
    ) {
      setPhase("framing");
      setStatus("insufficient");
      setMessage(
        (
          props.guideOverride ??
          getExerciseGuide(props.exerciseId, props.recognitionProfile)
        ).setup,
      );
    }
  }, [
    props.exerciseId,
    props.skillId,
    props.sessionId,
    partialSquat,
    props.recognitionProfile,
    !!props.flash,
  ]);
  useEffect(() => {
    // Manual confirmation may have advanced the anatomical side while recognition was off.
    detector.current = createExerciseDetector(
      props.exerciseId,
      props.sessionId,
      props.lastSide,
      {
        allowPartialSquat: partialSquat,
        profile: props.recognitionProfile,
        skillId: props.skillId,
        tolerance: props.flash ? "flash" : "standard",
      },
    );
    setNextSide(detector.current.expectedSide);
    calibrated.current.clear();
    lifecycle.current?.invalidateFrames();
    poseFilter.current.reset();
    issued.current = Math.max(issued.current, props.progress);
    resetTiming();
    if (
      props.active &&
      !props.paused &&
      props.mode !== "manual" &&
      !pausedRef.current &&
      (lifecycle.current?.currentStatus === "ready" || props.source === "phone")
    ) {
      setPhase("framing");
      setStatus("insufficient");
      setMessage(
        "Return to the starting position for fresh calibration. Your progress is kept.",
      );
    }
  }, [props.active, props.paused, props.mode]);
  useEffect(() => {
    flashStart.current = null;
    flashInterrupted.current = false;
    setFlashElapsed(0);
  }, [props.flash?.stage]);
  useEffect(() => {
    props.onReceiptQueueReady?.(() => unitQueue.current.flush());
    return () => {
      unitQueue.current.reset();
      props.onReceiptQueueReady?.(() => Promise.resolve());
    };
  }, []);
  useEffect(() => {
    issued.current = Math.max(issued.current, props.progress);
  }, [props.progress]);
  useEffect(() => {
    if (props.mode === "manual")
      lifecycle.current?.stop(
        "Manual mode selected. Camera stopped. Enable it again for a preview if you wish.",
      );
  }, [props.mode]);
  useEffect(() => {
    if (!props.suspended) return;
    latest.current.onFlashInterrupted?.();
    detector.current.pause();
    lifecycle.current?.stop(
      "Exercise camera stopped while the journal is open. Enable it again when ready.",
    );
  }, [props.suspended]);
  useEffect(() => {
    if (stage !== "recalibrating") return;
    let lastRemaining = 5;
    const tick = () => {
      if (!recalibration.current.active) return;
      const remaining = recalibration.current.remaining(performance.now());
      setCountdown(remaining);
      if (remaining)
        setMessage(`Move back into position. Recalibration in ${remaining}.`);
      else if (lastRemaining)
        setMessage(
          "Looking for your starting position. Hold steady for one second; Start now is available if you need it.",
        );
      lastRemaining = remaining;
    };
    const timer = setInterval(tick, 100);
    return () => clearInterval(timer);
  }, [stage]);
  useEffect(() => {
    detector.current.pause();
    poseFilter.current.reset();
    resetTiming();
    detector.current.beginCalibration();
    calibrated.current.clear();
    phoneTimestamp.current = -Infinity;
    phoneArrival.current = -Infinity;
    if (props.source === "phone") {
      lifecycle.current?.stop();
      setCamera({
        status: "ready",
        stream: null,
        message: "Phone pose source selected. Waiting for a fresh frame.",
      });
      setPhase("framing");
      setStatus("no-body");
      setMessage("Connect your phone camera and move into its view.");
    } else {
      setCamera(initialCamera);
      setPhase("off");
      setStatus("off");
      setMessage(initialCamera.message);
    }
  }, [props.source]);
  useEffect(() => {
    if (props.source !== "phone") return;
    const frame = props.externalPoseFrame,
      now = performance.now();
    if (
      !frame ||
      !Number.isFinite(frame.timestamp) ||
      frame.timestamp > now + 50 ||
      now - frame.timestamp > 500 ||
      frame.timestamp <= phoneTimestamp.current ||
      frame.landmarks.length !== 33 ||
      !Number.isFinite(frame.width) ||
      !Number.isFinite(frame.height) ||
      frame.width <= 0 ||
      frame.height <= 0
    ) {
      if (
        !frame ||
        !Number.isFinite(frame?.timestamp) ||
        now - (frame?.timestamp ?? 0) > 500
      ) {
        detector.current.pause();
        poseFilter.current.reset();
        detector.current.beginCalibration();
        calibrated.current.clear();
        stableSince.current = null;
        countdownAt.current = null;
        setPhase("framing");
        setStatus("no-body");
        setMessage("Phone tracking paused. Reconnect or move back into view.");
      }
      return;
    }
    phoneTimestamp.current = frame.timestamp;
    phoneArrival.current = now;
    receiveRef.current({
      timestamp: frame.timestamp,
      width: frame.width,
      height: frame.height,
      landmarks: frame.landmarks,
      receivedAt: now,
      inferenceMs: frame.inferenceMs,
    });
  }, [props.source, props.externalPoseFrame]);
  useEffect(() => {
    if (props.source !== "phone") return;
    const timer = setInterval(() => {
      if (performance.now() - phoneArrival.current > 500) {
        detector.current.pause();
        poseFilter.current.reset();
        detector.current.beginCalibration();
        calibrated.current.clear();
        stableSince.current = null;
        countdownAt.current = null;
        setPhase("framing");
        setStatus("no-body");
        setMessage(
          "Waiting for fresh phone tracking. Your completed units are kept.",
        );
      }
    }, 200);
    return () => clearInterval(timer);
  }, [props.source]);
  // A phone preview is opt-in and display-only; accepted evidence still arrives as pose events.
  useEffect(() => {
    if (props.source !== "phone" || !video.current) return;
    const node = video.current;
    node.srcObject = props.externalPreview ?? null;
    if (props.externalPreview) void node.play().catch(() => {});
    return () => {
      if (node.srcObject === props.externalPreview) node.srcObject = null;
    };
  }, [props.source, props.externalPreview]);
  const startCamera = async (next = selectionRef.current) => {
    if (
      !video.current ||
      latest.current.source === "phone" ||
      latest.current.suspended
    )
      return;
    if (latest.current.mode === "manual")
      latest.current.onRequestCameraMode?.();
    try {
      localStorage.setItem(
        "everstride-guide-" +
          (latest.current.skillId ?? latest.current.exerciseId),
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
    if (value) latest.current.onFlashInterrupted?.();
    setPaused(value);
    detector.current.pause();
    lifecycle.current?.invalidateFrames();
    resetTiming();
    detector.current.beginCalibration();
    calibrated.current.clear();
    poseFilter.current.reset();
    if (
      !value &&
      (lifecycle.current?.currentStatus === "ready" || props.source === "phone")
    )
      setPhase("framing");
    setMessage(
      value
        ? "Rest as long as you need. Your progress is kept; resume to calibrate again."
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
  useEffect(() => {
    if (
      (inactive || transportInactive) &&
      flashStart.current !== null &&
      !flashInterrupted.current
    ) {
      flashInterrupted.current = true;
      latest.current.onFlashInterrupted?.();
    }
    if (stage !== "running" || inactive || transportInactive)
      setFlashElapsed(0);
  }, [stage, inactive, transportInactive]);
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
    camera.status === "off"
      ? props.mode === "manual"
        ? "Manual mode is unverified. Enable the camera for a preview if you wish."
        : "Enable the camera, then follow the starting position. Start now is available when the camera is ready."
      : !transportInactive && inactive
        ? props.mode === "manual"
          ? "Manual mode · preview only. No camera repetitions are credited."
          : paused || props.paused
            ? "Paused. Your completed units are kept."
            : "Preview only between turns. Choose an exercise to begin."
        : message;
  const dwell = useRef(new FeedbackDwell());
  const [stableMessage, setStableMessage] = useState(hudMessage);
  useEffect(() => {
    const update = () =>
      setStableMessage(
        dwell.current.update(hudMessage, hudStatus, performance.now()),
      );
    update();
    const timer = setInterval(update, 100);
    return () => clearInterval(timer);
  }, [hudMessage, hudStatus]);
  const mirrored =
    (camera.facingMode ?? selection.facingMode) !== "environment";
  const guide =
    props.guideOverride ??
    getExerciseGuide(props.exerciseId, props.recognitionProfile);
  const preparationState = props.sessionComplete
    ? "completed"
    : transportInactive
      ? camera.status === "off"
        ? "off"
        : camera.status === "error"
          ? "error"
          : "starting"
      : inactive
        ? "paused"
        : stage === "recalibrating"
          ? "recalibrating"
          : stage === "running"
            ? "active"
            : stage === "countdown"
              ? "countdown"
              : status === "no-body"
                ? "searching"
                : status === "partial"
                  ? "partial"
                  : status === "ready"
                    ? "recognized"
                    : missingJoints.length
                      ? "framing"
                      : "waiting-posture";
  const [showSkeleton, setShowSkeleton] = useState(true);
  return (
    <section
      className="exercise-camera"
      aria-label="Exercise camera"
      data-camera-state={camera.status}
      data-skill-id={props.skillId ?? props.exerciseId}
      data-recognition-method={
        props.skillId ? exerciseProfile(props.skillId)?.method : "existing"
      }
      data-exercise-stage={stage}
      data-preparation-state={preparationState}
    >
      <header>
        <div className="exercise-camera-title">
          <span className="exercise-tag">
            {props.skillId
              ? recognitionLabel(props.skillId)
              : "LOCAL BODY TRACKING"}
          </span>
          <strong>{guide.title.split(" · ")[1] ?? guide.title}</strong>
        </div>
        <div className="exercise-header-actions">
          <button
            type="button"
            aria-pressed={voice}
            aria-label="Voice coach"
            data-guide="camera-voice"
            onClick={() => {
              const enabled = !voice;
              setVoice(enabled);
              try {
                localStorage.setItem(
                  "everstride-exercise-voice",
                  enabled ? "on" : "off",
                );
              } catch {
                /* Optional preference. */
              }
              if (enabled && !props.muted) {
                armExerciseAudio();
                speakExercise(`${guide.camera}. ${guide.setup}`, true);
              } else stopExerciseSpeech();
            }}
          >
            Voice {voice ? "on" : "off"}
          </button>
          <button
            type="button"
            aria-expanded={demo}
            data-guide="camera-guide"
            onClick={() => (demo ? dismissGuide() : setDemo(true))}
          >
            {demo ? "Hide guide" : "Show guide"}
          </button>
        </div>
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
              dismissGuide();
            }
          }}
        >
          <div className="exercise-guide-heading">
            <strong>
              Your next move · {props.target}{" "}
              {props.exerciseId === "superman" ? "seconds" : "repetitions"}
            </strong>
            <button type="button" onClick={dismissGuide}>
              Close exercise guide
            </button>
          </div>
          <ExerciseDemo
            exerciseId={props.exerciseId}
            skillId={props.skillId}
            recognitionProfile={props.recognitionProfile}
            guideOverride={props.guideOverride}
            hideIllustration={props.hideIllustration}
          />
        </section>
      )}
      <div
        className={`exercise-feed ${camera.stream || props.externalPreview ? "is-live" : ""}`}
      >
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
        {props.source === "phone" && !props.externalPreview && (
          <div className="exercise-placeholder">
            <strong>Phone pose tracking</strong>
            <small>
              Enable the optional video preview on your phone to see it here.
              Tracking does not require sharing video.
            </small>
          </div>
        )}
        {!camera.stream && props.source !== "phone" && (
          <div className="exercise-placeholder">
            <div className="exercise-prep-art" aria-hidden="true">
              <ExerciseDemo
                exerciseId={props.exerciseId}
                skillId={props.skillId}
                recognitionProfile={props.recognitionProfile}
                guideOverride={props.guideOverride}
                hideIllustration={props.hideIllustration}
              />
            </div>
            <strong>{guide.camera}</strong>
            <small>Enable the camera when you are ready.</small>
          </div>
        )}
      </div>
      {props.source === "phone" && (
        <p className="exercise-note">
          Phone tracking · video stays on your phone unless you explicitly share
          its preview.
        </p>
      )}
      {props.exerciseId === "squat" &&
        (!props.skillId ||
          exerciseProfile(props.skillId)?.method === "existing") &&
        !partialSquat &&
        (status === "partial" || status === "insufficient") && (
          <button
            type="button"
            onClick={() => {
              setPartialSquat(true);
              detector.current.beginCalibration();
              calibrated.current.clear();
            }}
          >
            Feet out of frame? Count visible hip movement (estimated)
          </button>
        )}
      {partialSquat &&
        props.exerciseId === "squat" &&
        (!props.skillId ||
          exerciseProfile(props.skillId)?.method === "existing") && (
          <p className="exercise-note">
            Cropped squat estimate · feet and knee depth are not verified. Stand
            tall for a fresh reference.{" "}
            <button type="button" onClick={() => setPartialSquat(false)}>
              Use full-leg tracking
            </button>
          </p>
        )}
      {props.source !== "phone" && (
        <details className="exercise-model-options">
          <summary>
            Camera tracking · {model === "full" ? "Full" : "Fast (Lite)"}
          </summary>
          <p>These are camera models, not exercise difficulty levels.</p>
          <p>
            <strong>Fast (Lite) — recommended:</strong> the smaller model,
            already included. Start here, especially if the skeleton feels
            delayed.
          </p>
          <p>
            <strong>Full:</strong> a larger download to try if tracking is
            unreliable. It needs more processing and may respond more slowly;
            better counts are not guaranteed.
          </p>
          <p>Both run on this device. Neither changes how far you must move.</p>
          <div>
            <button
              type="button"
              disabled={modelBusy || model === "lite"}
              onClick={() => void chooseModel("lite")}
            >
              Use Fast (Lite)
            </button>
            <button
              type="button"
              disabled={modelBusy || model === "full"}
              onClick={() => void chooseModel("full")}
            >
              {modelBusy
                ? "Downloading…"
                : fullModelUrl
                  ? "Use Full"
                  : "Download Full"}
            </button>
            <button
              type="button"
              aria-label="Close camera model options"
              onClick={(event) => {
                const options = event.currentTarget.closest("details");
                if (options) options.open = false;
              }}
            >
              Done
            </button>
          </div>
          {modelNotice && <p role="status">{modelNotice}</p>}
          {metrics && (
            <p>
              Last capture-to-result: {Math.round(metrics.captureLatencyMs)} ms
              {metrics.inferenceMs !== undefined
                ? ` · inference: ${Math.round(metrics.inferenceMs)} ms`
                : ""}{" "}
              · stale frames discarded: {metrics.droppedStale}. No inference
              queue.
            </p>
          )}
        </details>
      )}
      <ExerciseHUD
        unit={props.skillId ? SKILL_BY_ID[props.skillId]?.unit : undefined}
        alternating={
          props.skillId ? SKILL_BY_ID[props.skillId]?.alternating : undefined
        }
        assisted={
          props.mode !== "manual" &&
          !!props.skillId &&
          exerciseProfile(props.skillId)?.method === "assisted"
        }
        flash={
          props.flash && props.mode !== "manual"
            ? {
                ...props.flash,
                mode: "camera",
                elapsedMs: flashElapsed,
                lastCycleMs: flashLast,
                progress: props.progress,
                active:
                  stage === "running" &&
                  !inactive &&
                  !transportInactive &&
                  !props.sessionComplete,
                feedback: flashFeedback,
              }
            : undefined
        }
        guideSetup={guide.setup}
        guideCamera={guide.camera}
        startingPosition={
          props.skillId
            ? guide.setup.split(".")[0]
            : props.recognitionProfile === "knee-pushup"
              ? "Knees supported · hands under shoulders"
              : undefined
        }
        exerciseId={props.exerciseId}
        skillId={props.skillId}
        progress={
          props.flash?.stage === "test" && props.target === 9
            ? Math.max(0, props.progress - 3)
            : props.progress
        }
        target={
          props.flash?.stage === "reference"
            ? 3
            : props.flash?.stage === "test" && props.target === 9
              ? 6
              : props.target
        }
        status={hudStatus}
        message={stableMessage}
        missingJoints={missingJoints}
        nextSide={nextSide}
        quality={quality}
        countdown={
          hudStatus === "countdown" || hudStatus === "recalibrating"
            ? countdown
            : undefined
        }
        paused={Boolean(!transportInactive && (paused || props.paused))}
        muted={props.muted}
        voiceEnabled={voice}
        active={props.active && props.mode !== "manual" && !paused}
        complete={props.sessionComplete}
        sessionId={props.sessionId}
      />
      <div className="exercise-camera-controls" aria-label="Camera controls">
        <div className="exercise-actions">
          {props.mode === "manual" && props.onRequestCameraMode && (
            <button
              type="button"
              className="exercise-primary"
              data-guide="camera-use-mode"
              onClick={props.onRequestCameraMode}
            >
              Use camera for this turn
            </button>
          )}
          <button
            type="button"
            className="exercise-primary"
            data-guide="camera-setup"
            disabled={props.source === "phone"}
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
            disabled={camera.status === "off" || props.source === "phone"}
          >
            Stop camera
          </button>
          <button type="button" data-guide="camera-pause" onClick={togglePause}>
            {paused ? "Resume recognition" : "Pause / rest"}
          </button>
          <button
            type="button"
            data-guide="camera-recalibrate"
            onClick={() => {
              detector.current.beginCalibration();
              lifecycle.current?.invalidateFrames();
              calibrated.current.delete(
                calibrationGroup(props.skillId ?? props.exerciseId),
              );
              resetTiming();
              setRejections(0);
              setDemo(false);
              recalibration.current.start(performance.now());
              setCountdown(5);
              setPhase("recalibrating");
              setStatus("recalibrating");
              setMessage(
                "Prepare to recalibrate. Move back into position. You have five seconds.",
              );
            }}
            disabled={
              camera.status !== "ready" ||
              inactive ||
              Boolean(unitQueue.current.size) ||
              props.sessionComplete ||
              props.progress >= props.target
            }
          >
            Recalibrate
          </button>
          <button
            type="button"
            className="exercise-primary exercise-start-manual"
            aria-label="Start without automatic calibration"
            data-guide="camera-start"
            disabled={
              camera.status !== "ready" ||
              inactive ||
              Boolean(unitQueue.current.size) ||
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
          <summary data-guide="camera-settings">Camera settings</summary>
          <div className="exercise-settings-popover">
            <div className="exercise-camera-selectors">
              <label>
                Camera facing
                <select
                  aria-label="Camera facing"
                  disabled={props.source === "phone"}
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
                  disabled={props.source === "phone"}
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

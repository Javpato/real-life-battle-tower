import { useEffect, useRef, useState } from "react";
import type { ExerciseCameraProps, ExerciseUnit } from "../core/contracts";
import {
  ExerciseDetector,
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
import ExerciseDemo, { EXERCISE_GUIDES } from "./ExerciseDemo";
import ExerciseHUD from "./ExerciseHUD";
import type { ExerciseVisualState } from "./exerciseUi";
import "./exercises.css";
import { RecalibrationGate } from "./preparation";
import {PoseFilter} from "./poseFilter";
import {FeedbackDwell} from "./feedbackDwell";
import { STARTING_CUES } from "./exercisePresentation";
import {
  armExerciseAudio,
  speakExercise,
  stopExerciseSpeech,
} from "../audio/exerciseFeedback";

type Props = Omit<ExerciseCameraProps, "onUnit"> & {
  onUnit: (unit: ExerciseUnit) => void | boolean | Promise<boolean>;
  lastSide?: "left" | "right";
  sessionId?: string;
  muted?: boolean;
  mode?: "camera" | "manual";
  paused?: boolean;
  sessionComplete?: boolean;
  onRequestCameraMode?:()=>void;
  source?:"webcam"|"phone";
  externalPoseFrame?:PoseFrame|null;
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
  const [fullModelUrl,setFullModelUrl]=useState<string|null>(null),[model,setModel]=useState<'lite'|'full'>('lite'),[modelBusy,setModelBusy]=useState(false),[modelNotice,setModelNotice]=useState('');
  const fullUrlRef=useRef<string|null>(null),downloadRef=useRef<AbortController|null>(null),metricsAt=useRef(0);
  const [metrics,setMetrics]=useState<CameraMetrics|null>(null);
  useEffect(()=>()=>{downloadRef.current?.abort();if(fullUrlRef.current)URL.revokeObjectURL(fullUrlRef.current);},[]);
  const chooseModel=async(next:'lite'|'full')=>{
    if(latest.current.source==='phone')return;
    let url=fullUrlRef.current;
    if(next==='full'&&!url){
      setModelBusy(true);setModelNotice('Downloading optional Full model. Camera images are never uploaded.');
      const controller=new AbortController();downloadRef.current=controller;
      try{
        const remote='https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';
        const cache=typeof caches!=='undefined'?await caches.open('everstride-optional-pose-model-v1'):null;
        let response=await cache?.match(remote);
        if(!response){response=await fetch(remote,{signal:controller.signal});if(!response.ok)throw new Error('Model download failed');await cache?.put(remote,response.clone());}
        const blob=await response.blob();if(controller.signal.aborted)return;
        url=URL.createObjectURL(blob);fullUrlRef.current=url;setFullModelUrl(url);
      }catch{if(!controller.signal.aborted)setModelNotice('Full model could not download. Lite remains available; retry when connected.');return;}
      finally{if(!controller.signal.aborted)setModelBusy(false);}
    }
    lifecycle.current?.stop();detector.current.pause();calibrated.current.clear();poseFilter.current.reset();
    setModel(next);setMetrics(null);setModelNotice(`${next==='full'?'Full':'Lite'} selected. Enable camera for fresh calibration. Compare on your device; performance is not guaranteed.`);
  };
  const poseFilter=useRef(new PoseFilter()),phoneTimestamp=useRef(-Infinity),phoneArrival=useRef(-Infinity);
  const [partialSquat,setPartialSquat]=useState(false);
  const detector = useRef(
    new ExerciseDetector(props.exerciseId, props.sessionId, props.lastSide,{allowPartialSquat:partialSquat}),
  );
  const detectorSession = useRef(sessionKey(props));
  const recalibration = useRef(new RecalibrationGate());
  const dismissedGuide = useRef(new Set<string>());
  const dismissGuide = () => {
    dismissedGuide.current.add(sessionKey(latest.current));
    setDemo(false);
  };
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
  const [demo, setDemo] = useState(() => needsGuide(props.exerciseId)),
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
    const frame=poseFilter.current.process(rawFrame);
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
    const o = detector.current.observe(frame) as RichObservation;
    const fresh = o.fresh !== false;
    setMissingJoints(o.visible && fresh ? [] : (o.missingJoints ?? []));
    if (
      pausedRef.current ||
      p.paused ||
      !p.active ||
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
        calibrated.current.add(calibrationGroup(p.exerciseId));
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
              {allowPartialSquat:partialSquat},
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
        if(!detector.current.recalibrate(frame)) return;
        calibrated.current.add(calibrationGroup(p.exerciseId));
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
    if(latest.current.source === "phone") return;
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
      poseFilter.current.reset();
      setPhase("framing");
      setStatus("insufficient");
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
        modelUrl: model === "full" && fullModelUrl ? fullModelUrl : new URL("models/pose_landmarker_lite.task", base).href,
        wasmUrl: new URL("models/wasm", base).href,
      },
      onState: (snapshot) => cameraStateRef.current(snapshot),
      onPose: (frame) => receiveRef.current(frame),
      onMetrics: value=>{const now=performance.now();if(now-metricsAt.current>500){metricsAt.current=now;setMetrics(value);}},
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
  }, [model,fullModelUrl]);
  useEffect(() => {
    pendingUnit.current = null;
    detectorSession.current = sessionKey(props);
    detector.current = new ExerciseDetector(
      props.exerciseId,
      props.sessionId,
      props.lastSide,
      {allowPartialSquat:partialSquat},
    );
    lifecycle.current?.invalidateFrames();
    poseFilter.current.reset();
    issued.current = props.progress;
    resetTiming();
    setQuality(null);
    setNextSide(detector.current.expectedSide);
    setRejections(0);
    setDemo(
      !dismissedGuide.current.has(sessionKey(props)) &&
        needsGuide(props.exerciseId),
    );
    if (lifecycle.current?.currentStatus === "ready" || props.source === "phone") {
      setPhase("framing");
      setStatus("insufficient");
      setMessage(EXERCISE_GUIDES[props.exerciseId].setup);
    }
  }, [props.exerciseId, props.sessionId, partialSquat]);
  useEffect(() => {
    detector.current.pause();
    calibrated.current.clear();
    lifecycle.current?.invalidateFrames();
    poseFilter.current.reset();
    issued.current = props.progress;
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
      setMessage("Return to the starting position for fresh calibration. Your progress is kept.");
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
  useEffect(()=>{
    detector.current.pause();poseFilter.current.reset();resetTiming();calibrated.current.clear();phoneTimestamp.current=-Infinity;phoneArrival.current=-Infinity;
    if(props.source==='phone'){
      lifecycle.current?.stop();setCamera({status:'ready',stream:null,message:'Phone pose source selected. Waiting for a fresh frame.'});setPhase('framing');setStatus('no-body');setMessage('Connect your phone camera and move into its view.');
    }else{setCamera(initialCamera);setPhase('off');setStatus('off');setMessage(initialCamera.message);}
  },[props.source]);
  useEffect(()=>{
    if(props.source!=='phone')return;
    const frame=props.externalPoseFrame,now=performance.now();
    if(!frame||!Number.isFinite(frame.timestamp)||frame.timestamp>now+50||now-frame.timestamp>500||frame.timestamp<=phoneTimestamp.current||frame.landmarks.length!==33||!Number.isFinite(frame.width)||!Number.isFinite(frame.height)||frame.width<=0||frame.height<=0){
      if(!frame||!Number.isFinite(frame?.timestamp)||now-(frame?.timestamp??0)>500){detector.current.pause();poseFilter.current.reset();calibrated.current.clear();stableSince.current=null;countdownAt.current=null;setPhase('framing');setStatus('no-body');setMessage('Phone tracking paused. Reconnect or move back into view.');}
      return;
    }
    phoneTimestamp.current=frame.timestamp;phoneArrival.current=now;
    receiveRef.current({timestamp:frame.timestamp,width:frame.width,height:frame.height,landmarks:frame.landmarks,receivedAt:now,inferenceMs:frame.inferenceMs});
  },[props.source,props.externalPoseFrame]);
  useEffect(()=>{
    if(props.source!=='phone')return;
    const timer=setInterval(()=>{if(performance.now()-phoneArrival.current>500){detector.current.pause();poseFilter.current.reset();calibrated.current.clear();stableSince.current=null;countdownAt.current=null;setPhase('framing');setStatus('no-body');setMessage('Waiting for fresh phone tracking. Your completed units are kept.');}},200);
    return()=>clearInterval(timer);
  },[props.source]);
  const startCamera = async (next = selectionRef.current) => {
    if (!video.current || latest.current.source === "phone") return;
    if(latest.current.mode === "manual") latest.current.onRequestCameraMode?.();
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
    calibrated.current.clear();
    poseFilter.current.reset();
    if (!value && (lifecycle.current?.currentStatus === "ready" || props.source === "phone"))
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
  const dwell=useRef(new FeedbackDwell());
  const [stableMessage,setStableMessage]=useState(hudMessage);
  useEffect(()=>{const update=()=>setStableMessage(dwell.current.update(hudMessage,hudStatus,performance.now()));update();const timer=setInterval(update,100);return()=>clearInterval(timer);},[hudMessage,hudStatus]);
  const mirrored =
    (camera.facingMode ?? selection.facingMode) !== "environment";
  const guide = EXERCISE_GUIDES[props.exerciseId];
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
      data-exercise-stage={stage}
      data-preparation-state={preparationState}
    >
      <header>
        <div className="exercise-camera-title">
          <span className="exercise-tag">LOCAL BODY TRACKING</span>
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
                speakExercise(
                  `${guide.camera}. ${STARTING_CUES[props.exerciseId]}.`,
                  true,
                );
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
        {!camera.stream && props.source !== "phone" && (
          <div className="exercise-placeholder">
            <div className="exercise-prep-art" aria-hidden="true">
              <ExerciseDemo exerciseId={props.exerciseId} />
            </div>
            <strong>{guide.camera}</strong>
            <small>Enable the camera when you are ready.</small>
          </div>
        )}
      </div>
      {props.source==='phone'&&<p className="exercise-note">Phone tracking · video stays on your phone unless you explicitly share its preview.</p>}
      {props.exerciseId==='squat'&&!partialSquat&&(status==='partial'||status==='insufficient')&&<button type="button" onClick={()=>{setPartialSquat(true);calibrated.current.clear();}}>Feet out of frame? Count visible hip movement (estimated)</button>}
      {partialSquat&&props.exerciseId==='squat'&&<p className="exercise-note">Cropped squat estimate · feet and knee depth are not verified. Stand tall for a fresh reference. <button type="button" onClick={()=>setPartialSquat(false)}>Use full-leg tracking</button></p>}
      {props.source!=='phone'&&<details className="exercise-model-options"><summary>Recognition model · {model==='full'?'Full':'Lite'}</summary><p>Lite is included. Full is an optional download, processed on this device. Compare measured latency; neither model guarantees correct repetitions.</p><div><button type="button" disabled={modelBusy||model==='lite'} onClick={()=>void chooseModel('lite')}>Use Lite</button><button type="button" disabled={modelBusy||model==='full'} onClick={()=>void chooseModel('full')}>{modelBusy?'Downloading…':fullModelUrl?'Use Full':'Download and use Full'}</button></div>{modelNotice&&<p role="status">{modelNotice}</p>}{metrics&&<p>Last capture-to-result: {Math.round(metrics.captureLatencyMs)} ms{metrics.inferenceMs!==undefined?` · inference: ${Math.round(metrics.inferenceMs)} ms`:''} · stale frames discarded: {metrics.droppedStale}. No inference queue.</p>}</details>}
      <ExerciseHUD
        exerciseId={props.exerciseId}
        progress={props.progress}
        target={props.target}
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
          {props.mode==='manual'&&props.onRequestCameraMode&&<button type="button" className="exercise-primary" data-guide="camera-use-mode" onClick={props.onRequestCameraMode}>Use camera for this turn</button>}
          <button
            type="button"
            className="exercise-primary"
            data-guide="camera-setup"
            disabled={props.source==='phone'}
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
              detector.current.pause();
              lifecycle.current?.invalidateFrames();
              calibrated.current.delete(calibrationGroup(props.exerciseId));
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
              Boolean(pendingUnit.current) ||
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
          <summary data-guide="camera-settings">Camera settings</summary>
          <div className="exercise-settings-popover">
            <div className="exercise-camera-selectors">
              <label>
                Camera facing
                <select
                  aria-label="Camera facing"
                  disabled={props.source==='phone'}
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
                  disabled={props.source==='phone'}
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

import type { PoseFrame } from "./detectors";

export type CameraStatus =
  "off" | "requesting" | "starting" | "ready" | "recovering" | "error";
export type CameraSelection = {
  facingMode: "user" | "environment";
  deviceId?: string;
};
export type CameraSnapshot = {
  status: CameraStatus;
  message: string;
  stream: MediaStream | null;
  facingMode?: string;
};
export interface CameraWorker {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  terminate(): void;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
}
export type CameraDependencies = {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  createWorker: () => CameraWorker;
  captureFrame: (video: HTMLVideoElement) => Promise<ImageBitmap>;
  requestFrame: (callback: FrameRequestCallback) => number;
  cancelFrame: (id: number) => void;
  setTimer: (
    callback: () => void,
    milliseconds: number,
  ) => ReturnType<typeof setTimeout>;
  clearTimer: (timer: ReturnType<typeof setTimeout>) => void;
  now: () => number;
};
export type CameraMetrics = {
  accepted: number;
  droppedStale: number;
  captureLatencyMs: number;
  inferenceMs?: number;
};
export type CameraLifecycleOptions = {
  dependencies: CameraDependencies;
  init: { type: "init"; modelUrl: string; wasmUrl: string };
  onState: (snapshot: CameraSnapshot) => void;
  onPose: (frame: PoseFrame) => void;
  onMetrics?: (metrics: CameraMetrics) => void;
  maxFrameAgeMs?: number;
  startupTimeoutMs?: number;
  frameTimeoutMs?: number;
  minFrameIntervalMs?: number;
};
export function cameraErrorMessage(error: unknown): string {
  const name =
    error && typeof error === "object" && "name" in error
      ? String(error.name)
      : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError")
    return "Camera permission was not granted. Allow camera access in your browser or app settings, then retry.";
  if (name === "NotFoundError" || name === "DevicesNotFoundError")
    return "No camera is available. Connect a camera or continue manually.";
  if (name === "NotReadableError" || name === "TrackStartError")
    return "The camera is busy or unavailable. Close other apps using it, then retry.";
  if (name === "OverconstrainedError")
    return "That camera is no longer available. Choose another camera and retry.";
  if (name === "SecurityError")
    return "Camera access requires a secure page and browser permission.";
  return error instanceof Error
    ? error.message
    : "The camera could not start. You can retry or continue manually.";
}

/** Owns transport only. No exercise state, credited units, fitness estimates or game rules. */
export class CameraLifecycle {
  private generation = 0;
  private workerGeneration = 0;
  private evaluationEpoch = 0;
  private disposed = false;
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private worker: CameraWorker | null = null;
  private frameHandle: number | undefined;
  private startupTimer: ReturnType<typeof setTimeout> | undefined;
  private frameTimer: ReturnType<typeof setTimeout> | undefined;
  private inflight: {
    workerGeneration: number;
    epoch: number;
    capturedAt: number;
    requestId: number;
  } | null = null;
  private requestId = 0;
  private metrics: CameraMetrics = {
    accepted: 0,
    droppedStale: 0,
    captureLatencyMs: 0,
  };
  private lastVideoTime = -1;
  private lastCapture = -Infinity;
  private recoveries = 0;
  private stoppedStreams = new WeakSet<MediaStream>();
  private trackListeners: Array<{
    track: MediaStreamTrack;
    ended: EventListener;
  }> = [];
  private status: CameraStatus = "off";
  constructor(private options: CameraLifecycleOptions) {}
  get currentStatus() {
    return this.status;
  }
  get currentStream() {
    return this.stream;
  }
  private emit(status: CameraStatus, message: string) {
    this.status = status;
    if (!this.disposed)
      this.options.onState({
        status,
        message,
        stream: this.stream,
        facingMode: this.stream?.getVideoTracks()[0]?.getSettings?.()
          .facingMode,
      });
  }
  /** Invalidates already captured images when a turn, pause or manual-mode boundary changes. */
  invalidateFrames() {
    this.evaluationEpoch++;
  }
  private clearTimer(which: "startupTimer" | "frameTimer") {
    const timer = this[which];
    if (timer !== undefined) this.options.dependencies.clearTimer(timer);
    this[which] = undefined;
  }
  private releaseWorker() {
    this.workerGeneration++;
    if (this.frameHandle !== undefined)
      this.options.dependencies.cancelFrame(this.frameHandle);
    this.frameHandle = undefined;
    this.clearTimer("startupTimer");
    this.clearTimer("frameTimer");
    if (this.worker) {
      this.worker.onmessage = null;
      this.worker.onerror = null;
      this.worker.onmessageerror = null;
      this.worker.terminate();
    }
    this.worker = null;
    this.inflight = null;
    this.lastVideoTime = -1;
    this.lastCapture = -Infinity;
  }
  private releaseStream(media: MediaStream) {
    if (this.stoppedStreams.has(media)) return;
    this.stoppedStreams.add(media);
    for (const track of media.getTracks()) track.stop();
  }
  private releaseAll() {
    this.generation++;
    this.invalidateFrames();
    this.releaseWorker();
    for (const { track, ended } of this.trackListeners)
      track.removeEventListener("ended", ended);
    this.trackListeners = [];
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
    }
    if (this.stream) this.releaseStream(this.stream);
    this.stream = null;
  }
  stop(message = "Camera stopped. Your completed units are kept.") {
    this.releaseAll();
    this.emit("off", message);
  }
  dispose() {
    this.disposed = true;
    this.releaseAll();
    this.video = null;
  }
  private fail(error: unknown) {
    this.releaseAll();
    this.emit("error", cameraErrorMessage(error));
  }
  async start(video: HTMLVideoElement, selection: CameraSelection) {
    if (this.disposed) return;
    this.releaseAll();
    this.video = video;
    this.recoveries = 0;
    const generation = this.generation;
    this.emit(
      "requesting",
      "Waiting for camera permission. You can stop or retry at any time.",
    );
    try {
      const media = await this.options.dependencies.getUserMedia({
        audio: false,
        video: {
          ...(selection.deviceId
            ? { deviceId: { exact: selection.deviceId } }
            : { facingMode: { ideal: selection.facingMode } }),
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 24, max: 30 },
        },
      });
      if (this.disposed || generation !== this.generation) {
        this.releaseStream(media);
        return;
      }
      this.stream = media;
      if (
        !media.getVideoTracks().some((track) => track.readyState === "live")
      ) {
        this.fail(
          new Error(
            "The selected camera did not provide a live video track. Choose another camera and retry.",
          ),
        );
        return;
      }
      for (const track of media.getVideoTracks()) {
        const ended = () => {
          if (generation === this.generation && !this.disposed)
            this.fail(
              new Error(
                "The camera disconnected. Reconnect it, choose a camera, then retry.",
              ),
            );
        };
        track.addEventListener("ended", ended);
        this.trackListeners.push({ track, ended });
      }
      // Set DOM properties as well as JSX attributes before attaching a stream.
      // Safari requires muted inline playback; never ask for microphone access.
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.srcObject = media;
      this.emit(
        "starting",
        "Camera connected. Loading local body recognition…",
      );
      this.startupTimer = this.options.dependencies.setTimer(() => {
        if (generation === this.generation)
          this.fail(
            new Error("The camera preview did not start. Retry the camera."),
          );
      }, this.options.startupTimeoutMs ?? 20000);
      await video.play();
      if (this.disposed || generation !== this.generation) return;
      this.beginWorker(generation, false);
    } catch (error) {
      if (!this.disposed && generation === this.generation) this.fail(error);
    }
  }
  private beginWorker(generation: number, recovery: boolean) {
    this.releaseWorker();
    this.invalidateFrames();
    if (this.disposed || generation !== this.generation || !this.stream) return;
    const workerGeneration = this.workerGeneration;
    this.emit(
      recovery ? "recovering" : "starting",
      recovery
        ? "Restarting local recognition. Your progress is kept."
        : "Loading local body recognition…",
    );
    try {
      const worker = this.options.dependencies.createWorker();
      this.worker = worker;
      const current = () =>
        !this.disposed &&
        this.generation === generation &&
        this.workerGeneration === workerGeneration &&
        this.worker === worker;
      const recover = (reason: string) => {
        if (!current()) return;
        if (this.recoveries++ < 1) this.beginWorker(generation, true);
        else
          this.fail(
            new Error(
              reason +
                " Press Retry camera to start again, or continue manually.",
            ),
          );
      };
      worker.onerror = (event) => {
        event.preventDefault?.();
        recover("The local recognition worker stopped.");
      };
      worker.onmessageerror = () =>
        recover("The local recognition worker returned an unreadable frame.");
      worker.onmessage = (event: MessageEvent) => {
        if (!current()) return;
        const message = event.data;
        if (message?.type === "error") {
          recover(
            typeof message.message === "string"
              ? message.message
              : "Recognition failed.",
          );
          return;
        }
        if (message?.type === "ready") {
          if (this.status === "ready") return;
          this.clearTimer("startupTimer");
          this.emit(
            "ready",
            "Camera ready. Settle into the starting position.",
          );
          this.scheduleTick(worker, workerGeneration, generation);
          return;
        }
        if (message?.type === "pose" && this.inflight) {
          const pending = this.inflight;
          if (
            message.requestId !== undefined &&
            message.requestId !== pending.requestId
          )
            return;
          this.inflight = null;
          this.clearTimer("frameTimer");
          if (
            pending.workerGeneration !== workerGeneration ||
            pending.epoch !== this.evaluationEpoch
          )
            return;
          if (
            !Array.isArray(message.landmarks) ||
            !Number.isFinite(message.timestamp) ||
            !Number.isFinite(message.width) ||
            !Number.isFinite(message.height)
          )
            return;
          const receivedAt = this.options.dependencies.now(),
            captureLatencyMs = Math.max(0, receivedAt - pending.capturedAt);
          this.metrics = {
            ...this.metrics,
            captureLatencyMs,
            inferenceMs: Number.isFinite(message.inferenceMs)
              ? message.inferenceMs
              : undefined,
          };
          if (captureLatencyMs > (this.options.maxFrameAgeMs ?? 500)) {
            this.metrics.droppedStale++;
            this.options.onMetrics?.({ ...this.metrics });
            // Deliver loss, never stale body coordinates. This cancels held/cycle evidence.
            this.options.onPose({
              timestamp: receivedAt,
              width: message.width,
              height: message.height,
              landmarks: [],
              receivedAt,
              captureLatencyMs,
            });
            return;
          }
          this.metrics.accepted++;
          this.options.onMetrics?.({ ...this.metrics });
          this.options.onPose({
            ...message,
            receivedAt,
            captureLatencyMs,
          } as PoseFrame);
        }
      };
      this.startupTimer = this.options.dependencies.setTimer(
        () => recover("Local recognition took too long to load."),
        this.options.startupTimeoutMs ?? 20000,
      );
      worker.postMessage(this.options.init);
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    }
  }
  private scheduleTick(
    worker: CameraWorker,
    workerGeneration: number,
    generation: number,
  ) {
    const current = () =>
      !this.disposed &&
      generation === this.generation &&
      workerGeneration === this.workerGeneration &&
      worker === this.worker;
    const tick = async () => {
      if (!current()) return;
      this.frameHandle = this.options.dependencies.requestFrame(() => {
        void tick();
      });
      const video = this.video,
        now = this.options.dependencies.now();
      if (
        !video ||
        video.readyState < 2 ||
        this.inflight ||
        video.currentTime === this.lastVideoTime ||
        now - this.lastCapture < (this.options.minFrameIntervalMs ?? 65)
      )
        return;
      this.lastVideoTime = video.currentTime;
      this.lastCapture = now;
      const pending = {
        workerGeneration,
        epoch: this.evaluationEpoch,
        capturedAt: now,
        requestId: ++this.requestId,
      };
      this.inflight = pending;
      this.frameTimer = this.options.dependencies.setTimer(() => {
        if (!current() || this.inflight !== pending) return;
        if (this.recoveries++ < 1) this.beginWorker(generation, true);
        else
          this.fail(
            new Error(
              "Local recognition stopped responding. Retry the camera to reconnect.",
            ),
          );
      }, this.options.frameTimeoutMs ?? 8000);
      let bitmap: ImageBitmap | undefined;
      try {
        bitmap = await this.options.dependencies.captureFrame(video);
        if (
          !current() ||
          this.inflight !== pending ||
          pending.epoch !== this.evaluationEpoch
        ) {
          bitmap.close();
          if (this.inflight === pending) {
            this.inflight = null;
            this.clearTimer("frameTimer");
          }
          return;
        }
        worker.postMessage(
          {
            type: "frame",
            bitmap,
            timestamp: now,
            requestId: pending.requestId,
          },
          [bitmap],
        );
      } catch (error) {
        bitmap?.close();
        if (current())
          this.fail(
            new Error(
              "The camera frame could not be read. " +
                cameraErrorMessage(error),
            ),
          );
      }
    };
    this.frameHandle = this.options.dependencies.requestFrame(() => {
      void tick();
    });
  }
}

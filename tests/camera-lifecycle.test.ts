import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CameraLifecycle,
  cameraErrorMessage,
  type CameraSnapshot,
  type CameraWorker,
} from "../src/exercises/cameraLifecycle";

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
class Track extends EventTarget {
  readyState = "live";
  stop = vi.fn(() => {
    this.readyState = "ended";
  });
  getSettings = () => ({ deviceId: "camera-1", facingMode: "user" });
}
function stream() {
  const track = new Track();
  return {
    media: {
      getTracks: () => [track],
      getVideoTracks: () => [track],
    } as unknown as MediaStream,
    track,
  };
}
class WorkerMock implements CameraWorker {
  onmessage: CameraWorker["onmessage"] = null;
  onerror: CameraWorker["onerror"] = null;
  onmessageerror: CameraWorker["onmessageerror"] = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  send(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
}
function setup() {
  vi.useFakeTimers();
  const workers: WorkerMock[] = [],
    states: CameraSnapshot[] = [],
    frames = new Map<number, FrameRequestCallback>();
  let frameId = 0,
    clock = 0;
  const media = stream(),
    getUserMedia = vi.fn().mockResolvedValue(media.media);
  const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
  const captureFrame = vi.fn().mockResolvedValue(bitmap);
  const video = {
    srcObject: null,
    readyState: 2,
    currentTime: 1,
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
  } as unknown as HTMLVideoElement;
  const onPose = vi.fn(), onMetrics=vi.fn();
  const camera = new CameraLifecycle({
    dependencies: {
      getUserMedia,
      createWorker: () => {
        const worker = new WorkerMock();
        workers.push(worker);
        return worker;
      },
      captureFrame,
      requestFrame: (callback) => {
        frames.set(++frameId, callback);
        return frameId;
      },
      cancelFrame: (id) => {
        frames.delete(id);
      },
      setTimer: (callback, ms) => setTimeout(callback, ms),
      clearTimer: (timer) => clearTimeout(timer),
      now: () => clock,
    },
    init: { type: "init", modelUrl: "/model.task", wasmUrl: "/wasm" },
    onState: (state) => states.push(state),
    onPose,
    onMetrics,
    startupTimeoutMs: 1000,
    frameTimeoutMs: 500,
  });
  const tick = async () => {
    clock += 100;
    video.currentTime += 0.1;
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((callback) => callback(clock));
    await Promise.resolve();
    await Promise.resolve();
  };
  const start = async () => {
    await camera.start(video, { facingMode: "user" });
    workers.at(-1)!.send({ type: "ready" });
  };
  const pose = {
    type: "pose",
    landmarks: [],
    timestamp: 100,
    width: 640,
    height: 480,
  };
  return {
    camera,
    workers,
    states,
    frames,
    media,
    getUserMedia,
    bitmap,
    captureFrame,
    video,
    onPose,
    onMetrics,
    tick,
    start,
    pose,
  };
}
afterEach(() => {
  vi.useRealTimers();
});

describe("camera lifecycle ownership and races", () => {
  it("stops every track, detaches preview and terminates recognition; can enable repeatedly", async () => {
    const f = setup();
    for (let i = 0; i < 4; i++) {
      const media = stream();
      f.getUserMedia.mockResolvedValueOnce(media.media);
      await f.start();
      expect(f.video.srcObject).toBe(media.media);
      expect(f.frames.size).toBe(1);
      f.camera.stop();
      f.camera.stop();
      expect(media.track.stop).toHaveBeenCalledTimes(1);
      expect(f.video.srcObject).toBeNull();
      expect(f.frames.size).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
      expect(f.workers.at(-1)!.terminate).toHaveBeenCalledTimes(1);
    }
  });
  it("releases a permission request resolving after Stop without starting its worker", async () => {
    const f = setup(),
      pending = deferred<MediaStream>();
    f.getUserMedia.mockReturnValueOnce(pending.promise);
    const start = f.camera.start(f.video, { facingMode: "user" });
    f.camera.stop();
    pending.resolve(f.media.media);
    await start;
    expect(f.media.track.stop).toHaveBeenCalledOnce();
    expect(f.video.srcObject).toBeNull();
    expect(f.workers).toHaveLength(0);
    expect(f.camera.currentStatus).toBe("off");
  });
  it("old permission result cannot replace a newer active camera", async () => {
    const f = setup(),
      old = deferred<MediaStream>(),
      next = stream();
    f.getUserMedia
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(next.media);
    const pending = f.camera.start(f.video, { facingMode: "user" });
    await f.start();
    old.resolve(f.media.media);
    await pending;
    expect(f.media.track.stop).toHaveBeenCalledOnce();
    expect(next.track.stop).not.toHaveBeenCalled();
    expect(f.video.srcObject).toBe(next.media);
    expect(f.camera.currentStatus).toBe("ready");
  });
  it("old permission denial cannot overwrite newer success", async () => {
    const f = setup(),
      old = deferred<MediaStream>();
    f.getUserMedia.mockReturnValueOnce(old.promise);
    const pending = f.camera.start(f.video, { facingMode: "user" });
    await f.start();
    old.reject(new DOMException("Denied", "NotAllowedError"));
    await pending;
    expect(f.camera.currentStatus).toBe("ready");
  });
  it("permission denial is actionable and retry works", async () => {
    const f = setup();
    f.getUserMedia.mockRejectedValueOnce(
      new DOMException("Denied", "NotAllowedError"),
    );
    await f.camera.start(f.video, { facingMode: "user" });
    expect(f.states.at(-1)?.message).toContain("permission");
    expect(f.camera.currentStatus).toBe("error");
    await f.start();
    expect(f.camera.currentStatus).toBe("ready");
  });
  it("late video.play completion cannot start a worker after stopping", async () => {
    const f = setup(),
      play = deferred<void>();
    vi.mocked(f.video.play).mockReturnValueOnce(play.promise);
    const pending = f.camera.start(f.video, { facingMode: "user" });
    await Promise.resolve();
    f.camera.stop();
    play.resolve();
    await pending;
    expect(f.workers).toHaveLength(0);
    expect(f.media.track.stop).toHaveBeenCalledOnce();
    expect(f.video.srcObject).toBeNull();
  });
  it("times out a stuck video preview and releases its stream", async () => {
    const f = setup(),
      play = deferred<void>();
    vi.mocked(f.video.play).mockReturnValueOnce(play.promise);
    const pending = f.camera.start(f.video, { facingMode: "user" });
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1000);
    expect(f.camera.currentStatus).toBe("error");
    expect(f.media.track.stop).toHaveBeenCalledOnce();
    play.resolve();
    await pending;
    expect(f.workers).toHaveLength(0);
  });
  it("closes a bitmap captured after Stop without transferring it", async () => {
    const f = setup(),
      capture = deferred<ImageBitmap>();
    f.captureFrame.mockReturnValueOnce(capture.promise);
    await f.start();
    await f.tick();
    f.camera.stop();
    capture.resolve(f.bitmap);
    await Promise.resolve();
    expect(f.bitmap.close).toHaveBeenCalledOnce();
    expect(f.workers[0].postMessage).toHaveBeenCalledTimes(1);
    expect(f.onPose).not.toHaveBeenCalled();
  });
  it("does not publish a captured frame across a pause/session boundary", async () => {
    const f = setup(),
      capture = deferred<ImageBitmap>();
    f.captureFrame.mockReturnValueOnce(capture.promise);
    await f.start();
    await f.tick();
    f.camera.invalidateFrames();
    capture.resolve(f.bitmap);
    await Promise.resolve();
    expect(f.bitmap.close).toHaveBeenCalledOnce();
    expect(f.workers[0].postMessage).toHaveBeenCalledTimes(1);
    await f.tick();
    expect(f.workers[0].postMessage).toHaveBeenCalledTimes(2);
  });
  it("discards returned pose crossing evaluation epoch, then accepts a fresh frame", async () => {
    const f = setup();
    await f.start();
    await f.tick();
    f.camera.invalidateFrames();
    f.workers[0].send(f.pose);
    expect(f.onPose).not.toHaveBeenCalled();
    await f.tick();
    f.workers[0].send({ ...f.pose, timestamp: 200 });
    expect(f.onPose).toHaveBeenCalledOnce();
  });
  it("sends at most one pending frame and rejects malformed poses", async () => {
    const f = setup();
    await f.start();
    await f.tick();
    await f.tick();
    expect(f.captureFrame).toHaveBeenCalledOnce();
    f.workers[0].send({ ...f.pose, timestamp: NaN });
    expect(f.onPose).not.toHaveBeenCalled();
    await f.tick();
    expect(f.captureFrame).toHaveBeenCalledTimes(2);
  });
  it("rebuilds a stalled worker once without asking permission again; second timeout releases stream", async () => {
    const f = setup();
    await f.camera.start(f.video, { facingMode: "user" });
    const stale = f.workers[0].onmessage;
    await vi.advanceTimersByTimeAsync(1000);
    expect(f.workers).toHaveLength(2);
    expect(f.getUserMedia).toHaveBeenCalledOnce();
    expect(f.media.track.stop).not.toHaveBeenCalled();
    expect(f.camera.currentStatus).toBe("recovering");
    stale?.({ data: { type: "ready" } } as MessageEvent);
    expect(f.camera.currentStatus).toBe("recovering");
    await vi.advanceTimersByTimeAsync(1000);
    expect(f.camera.currentStatus).toBe("error");
    expect(f.video.srcObject).toBeNull();
    expect(f.media.track.stop).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("recovers stalled inference, ignores old worker output, and accepts fresh worker output", async () => {
    const f = setup();
    await f.start();
    await f.tick();
    const stale = f.workers[0].onmessage;
    await vi.advanceTimersByTimeAsync(500);
    expect(f.workers).toHaveLength(2);
    stale?.({ data: f.pose } as MessageEvent);
    expect(f.onPose).not.toHaveBeenCalled();
    f.workers[1].send({ type: "ready" });
    await f.tick();
    f.workers[1].send(f.pose);
    expect(f.onPose).toHaveBeenCalledOnce();
    expect(f.getUserMedia).toHaveBeenCalledOnce();
  });
  it("reports disconnect and permits choosing a new camera", async () => {
    const f = setup();
    await f.start();
    f.media.track.dispatchEvent(new Event("ended"));
    expect(f.camera.currentStatus).toBe("error");
    expect(f.states.at(-1)?.message).toContain("disconnected");
    const next = stream();
    f.getUserMedia.mockResolvedValueOnce(next.media);
    await f.camera.start(f.video, {
      facingMode: "environment",
      deviceId: "rear",
    });
    expect(f.getUserMedia).toHaveBeenLastCalledWith(
      expect.objectContaining({
        audio: false,
        video: expect.objectContaining({ deviceId: { exact: "rear" } }),
      }),
    );
  });
  it("requests facing preference without an exact device constraint by default", async () => {
    const f = setup();
    await f.camera.start(f.video, { facingMode: "environment" });
    expect(f.getUserMedia).toHaveBeenLastCalledWith(
      expect.objectContaining({
        audio: false,
        video: expect.objectContaining({
          facingMode: { ideal: "environment" },
        }),
      }),
    );
  });
  it("dispose releases a late permission grant without emitting state or restarting", async () => {
    const f = setup(),
      permission = deferred<MediaStream>();
    f.getUserMedia.mockReturnValueOnce(permission.promise);
    const pending = f.camera.start(f.video, { facingMode: "user" });
    f.camera.dispose();
    const count = f.states.length;
    permission.resolve(f.media.media);
    await pending;
    await f.camera.start(f.video, { facingMode: "user" });
    expect(f.states).toHaveLength(count);
    expect(f.media.track.stop).toHaveBeenCalledOnce();
    expect(f.workers).toHaveLength(0);
  });
  it("maps browser hardware and security errors without claiming recognition worked", () => {
    expect(cameraErrorMessage(new DOMException("", "NotFoundError"))).toContain(
      "No camera",
    );
    expect(
      cameraErrorMessage(new DOMException("", "NotReadableError")),
    ).toContain("busy");
    expect(cameraErrorMessage(new DOMException("", "SecurityError"))).toContain(
      "secure",
    );
    expect(
      cameraErrorMessage(new DOMException("", "OverconstrainedError")),
    ).toContain("another camera");
  });
});

describe('camera freshness and measured latency',()=>{
 it('allows only one in-flight inference and drops a slow result as lost evidence',async()=>{
  const f=setup();await f.start();await f.tick();
  for(let i=0;i<6;i++)await f.tick();
  expect(f.captureFrame).toHaveBeenCalledTimes(1);
  f.workers[0].send(f.pose);
  expect(f.onPose).toHaveBeenLastCalledWith(expect.objectContaining({landmarks:[],captureLatencyMs:600}));
  expect(f.onMetrics).toHaveBeenLastCalledWith(expect.objectContaining({accepted:0,droppedStale:1}));
  await f.tick();expect(f.captureFrame).toHaveBeenCalledTimes(2);
 });
 it('does not let a late response consume the current request',async()=>{
  const f=setup();await f.start();await f.tick();
  f.workers[0].send({...f.pose,requestId:999});expect(f.onPose).not.toHaveBeenCalled();
  f.workers[0].send({...f.pose,requestId:1,inferenceMs:21});
  expect(f.onMetrics).toHaveBeenLastCalledWith(expect.objectContaining({accepted:1,inferenceMs:21,captureLatencyMs:0}));
 });
});

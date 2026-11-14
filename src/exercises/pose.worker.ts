import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

let detector: PoseLandmarker | undefined;
self.onmessage = async (event: MessageEvent) => {
  const message = event.data;
  try {
    if (message.type === "init") {
      detector?.close();
      detector = undefined;
      const vision = await FilesetResolver.forVisionTasks(
        message.wasmUrl,
        true,
      );
      detector = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: message.modelUrl, delegate: "CPU" },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.4,
        minPosePresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
        outputSegmentationMasks: false,
      });
      self.postMessage({ type: "ready" });
    } else if (message.type === "frame") {
      try {
        if (!detector) throw new Error("Recognition is not ready yet.");
        if (
          !Number.isFinite(message.timestamp) ||
          message.bitmap.width <= 0 ||
          message.bitmap.height <= 0
        )
          throw new Error("The camera frame is not ready yet.");
        const inferenceStarted = performance.now();
        const result = detector.detectForVideo(
          message.bitmap,
          message.timestamp,
        );
        self.postMessage({
          type: "pose",
          requestId: message.requestId,
          inferenceMs: performance.now() - inferenceStarted,
          landmarks: result.landmarks[0] ?? [],
          timestamp: message.timestamp,
          width: message.bitmap.width,
          height: message.bitmap.height,
        });
      } finally {
        message.bitmap?.close();
      }
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      message:
        error instanceof Error
          ? error.message
          : "Pose recognition could not start.",
    });
  }
};

import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

let detector: PoseLandmarker | undefined;
self.onmessage = async (event: MessageEvent) => {
  const message = event.data;
  try {
    if (message.type === 'init') {
      const vision = await FilesetResolver.forVisionTasks(message.wasmUrl, true);
      detector = await PoseLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: message.modelUrl, delegate: 'CPU' }, runningMode: 'VIDEO', numPoses: 1, minPoseDetectionConfidence: .55, minPosePresenceConfidence: .55, minTrackingConfidence: .55, outputSegmentationMasks: false });
      self.postMessage({ type: 'ready' });
    } else if (message.type === 'frame' && detector) {
      try {
        const result = detector.detectForVideo(message.bitmap, message.timestamp);
        self.postMessage({ type: 'pose', landmarks: result.landmarks[0] ?? [], timestamp: message.timestamp, width: message.bitmap.width, height: message.bitmap.height });
      } finally { message.bitmap.close(); }
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Pose recognition could not start.' });
  }
};

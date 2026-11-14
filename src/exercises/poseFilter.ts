import type { Landmark, PoseFrame } from "./detectors";
/** Original implementation of Casiez et al.'s speed-adaptive 1€ recurrence. */
export class OneEuro {
  private value?: number;
  private raw?: number;
  private derivative = 0;
  private at?: number;
  constructor(
    readonly minimumCutoff = 1.7,
    readonly beta = 1.2,
    readonly derivativeCutoff = 1,
  ) {}
  reset() {
    this.value = this.raw = this.at = undefined;
    this.derivative = 0;
  }
  update(value: number, at: number) {
    if (this.at === undefined || at <= this.at || at - this.at > 300) {
      this.value = this.raw = value;
      this.at = at;
      this.derivative = 0;
      return value;
    }
    const dt = (at - this.at) / 1000,
      alpha = (cutoff: number) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
    this.derivative +=
      alpha(this.derivativeCutoff) *
      ((value - this.raw!) / dt - this.derivative);
    this.value! +=
      alpha(this.minimumCutoff + this.beta * Math.abs(this.derivative)) *
      (value - this.value!);
    this.raw = value;
    this.at = at;
    return this.value!;
  }
}
type Joint = {
  x: OneEuro;
  y: OneEuro;
  raw?: Landmark;
  at?: number;
  candidate?: Landmark;
};
/** Never fills missing joints. Filtered coordinates retain current raw confidence. */
export class PoseFilter {
  private joints: Joint[] = [];
  private last?: number;
  reset() {
    this.joints = [];
    this.last = undefined;
  }
  process(frame: PoseFrame): PoseFrame {
    if (frame.rawLandmarks) return frame;
    if (this.last !== undefined && frame.timestamp <= this.last)
      return {
        ...frame,
        rawLandmarks: frame.landmarks,
        landmarks: frame.landmarks.map((p) => ({
          ...p,
          visibility: 0,
          presence: 0,
        })),
      };
    if (this.last !== undefined && frame.timestamp - this.last > 300)
      this.reset();
    this.last = frame.timestamp;
    const aspect = frame.width / frame.height,
      spikes: number[] = [];
    const landmarks = frame.landmarks.map((point, index) => {
      const joint = (this.joints[index] ??= {
        x: new OneEuro(),
        y: new OneEuro(),
      });
      const visible =
        Number.isFinite(point.x) &&
        Number.isFinite(point.y) &&
        Math.min(point.visibility ?? 0, point.presence ?? 1) >= 0.35;
      if (!visible) {
        joint.x.reset();
        joint.y.reset();
        joint.raw = undefined;
        joint.candidate = undefined;
        return { ...point };
      }
      const distance = (a: Landmark, b: Landmark) =>
        Math.hypot((a.x - b.x) * aspect, a.y - b.y);
      const dt =
        joint.at === undefined ? 0 : (frame.timestamp - joint.at) / 1000;
      if (
        joint.raw &&
        dt > 0 &&
        distance(point, joint.raw) > Math.max(0.22, dt * 3)
      ) {
        if (!joint.candidate || distance(point, joint.candidate) > 0.055) {
          joint.candidate = point;
          spikes.push(index);
          return { ...point, visibility: 0, presence: 0 };
        }
        joint.x.reset();
        joint.y.reset();
      }
      joint.raw = point;
      joint.at = frame.timestamp;
      joint.candidate = undefined;
      return {
        ...point,
        x: joint.x.update(point.x * aspect, frame.timestamp) / aspect,
        y: joint.y.update(point.y, frame.timestamp),
      };
    });
    return {
      ...frame,
      rawLandmarks: frame.landmarks,
      landmarks,
      spikeJoints: spikes,
    };
  }
}

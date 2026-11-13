import type { ExerciseId, ExerciseUnit } from '../core/contracts';

export type Landmark = { x: number; y: number; z?: number; visibility?: number; presence?: number };
export type PoseFrame = { timestamp: number; landmarks: Landmark[]; width: number; height: number };
export type Side = 'left' | 'right';
export type Observation = { visible: boolean; ready: boolean; extended: boolean; side?: Side; amplitude: number; confidence: number; motion: number };
export type DetectorFeedback = { state: 'ready' | 'moving' | 'return' | 'tracking-lost' | 'hold'; message: string; unit?: ExerciseUnit; rejected?: boolean };
export const DETECTOR_CONFIG = { visibility: .55, stableMs: 180, returnMs: 140, minimumCycleMs: 650, maximumFrameGapMs: 250, smoothingMs: 65 };
const clamp = (n: number, low = 0, high = 1) => Math.max(low, Math.min(high, n));
const required: Record<ExerciseId, number[]> = {
  squat: [11, 12, 23, 24, 25, 26, 27, 28], lunge: [11, 12, 23, 24, 25, 26, 27, 28],
  pushup: [11, 12, 13, 14, 15, 16, 23, 24, 27, 28], diamond: [11, 12, 13, 14, 15, 16, 23, 24, 27, 28],
  superman: [11, 12, 15, 16, 23, 24, 27, 28], birddog: [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28],
};
export function angle(a: Landmark, b: Landmark, c: Landmark): number {
  const ax = a.x - b.x, ay = a.y - b.y, cx = c.x - b.x, cy = c.y - b.y;
  const length = Math.hypot(ax, ay) * Math.hypot(cx, cy);
  return length < 1e-8 ? 0 : Math.acos(clamp((ax * cx + ay * cy) / length, -1, 1)) * 180 / Math.PI;
}

/** Anatomical indexes remain unchanged when the preview is mirrored. */
export function observePose(exercise: ExerciseId, frame: PoseFrame): Observation {
  const empty = { visible: false, ready: false, extended: false, amplitude: 0, confidence: 0, motion: 0 };
  if (frame.landmarks.length < 33 || frame.width <= 0 || frame.height <= 0) return empty;
  const indexes = required[exercise];
  const confidence = Math.min(...indexes.map(i => Math.min(frame.landmarks[i].visibility ?? 0, frame.landmarks[i].presence ?? 1)));
  if (confidence < DETECTOR_CONFIG.visibility || indexes.some(i => !Number.isFinite(frame.landmarks[i].x) || !Number.isFinite(frame.landmarks[i].y) || frame.landmarks[i].x < .01 || frame.landmarks[i].x > .99 || frame.landmarks[i].y < .01 || frame.landmarks[i].y > .99)) return empty;
  const p = frame.landmarks.map(a => ({ ...a, x: a.x * frame.width / frame.height }));
  const avg = (a: number, b: number) => ({ x: (p[a].x + p[b].x) / 2, y: (p[a].y + p[b].y) / 2 });
  const shoulder = avg(11, 12), hip = avg(23, 24);
  const scale = Math.max(.06, Math.hypot(shoulder.x - hip.x, shoulder.y - hip.y));
  const knees = [angle(p[23], p[25], p[27]), angle(p[24], p[26], p[28])];
  const elbows = [angle(p[11], p[13], p[15]), angle(p[12], p[14], p[16])];
  const horizontal = Math.abs(shoulder.x - hip.x) > Math.abs(shoulder.y - hip.y) * 1.3;
  const base = { visible: true, ready: false, extended: false, amplitude: 0, confidence, motion: hip.y / scale };
  if (exercise === 'squat') {
    const bend = Math.min(...knees);
    return { ...base, ready: knees.every(a => a > 155), extended: knees.every(a => a < 115) && shoulder.y < hip.y, amplitude: clamp((165 - bend) / 80) };
  }
  if (exercise === 'lunge') {
    const which = knees[0] < knees[1] ? 0 : 1;
    const distinguishable = Math.abs(knees[0] - knees[1]) > 10;
    return { ...base, ready: knees.every(a => a > 150), extended: distinguishable && knees[which] < 115 && Math.abs(p[27].x - p[28].x) > scale * .5, side: distinguishable ? (which === 0 ? 'left' : 'right') : undefined, amplitude: clamp((165 - knees[which]) / 80) };
  }
  if (exercise === 'pushup' || exercise === 'diamond') {
    const alignment = Math.max(angle(p[11], p[23], p[27]), angle(p[12], p[24], p[28]));
    return { ...base, ready: horizontal && elbows.every(a => a > 150) && alignment > 145, extended: horizontal && elbows.every(a => a < 112) && alignment > 140, amplitude: clamp((165 - Math.max(...elbows)) / 80), motion: shoulder.y / scale };
  }
  if (exercise === 'superman') {
    const arms = Math.min((p[11].y - p[15].y) / scale, (p[12].y - p[16].y) / scale);
    const legs = Math.min((p[23].y - p[27].y) / scale, (p[24].y - p[28].y) / scale);
    return { ...base, ready: horizontal, extended: horizontal && arms > .07 && legs > .035, amplitude: clamp(Math.min(arms / .18, legs / .12)), motion: (arms + legs) / 2 };
  }
  const armExtended = [0, 1].map(i => elbows[i] > 150 && Math.abs(p[15 + i].y - p[11 + i].y) < scale * .32 && Math.abs(p[15 + i].x - p[11 + i].x) > scale * .5);
  const legExtended = [0, 1].map(i => knees[i] > 150 && Math.abs(p[27 + i].y - p[23 + i].y) < scale * .35 && Math.abs(p[27 + i].x - p[23 + i].x) > scale * .65);
  const left = armExtended[0] && legExtended[1] && !armExtended[1];
  const right = armExtended[1] && legExtended[0] && !armExtended[0];
  return { ...base, ready: horizontal && knees.every(a => a < 135) && p[15].y > p[11].y + scale * .35 && p[16].y > p[12].y + scale * .35, extended: horizontal && (left || right), side: left ? 'left' : right ? 'right' : undefined, amplitude: left || right ? 1 : 0 };
}

/** Pure state machine. It reports observed movement, never HP, rewards, or medical form approval. */
export class ExerciseDetector {
  private filtered?: Landmark[];
  private lastFrame?: number;
  private phase: 'initial' | 'ready' | 'moving' | 'return' = 'initial';
  private stableSince?: number;
  private start = 0;
  private peak = 0;
  private side?: Side;
  private lastSide?: Side;
  private motionStart = 0;
  private movement = 0;
  private lastMotion?: number;
  private totalMotion = 0;
  private holdMs = 0;
  private lastObservation?: number;
  private holding = false;
  private sequence = 0;
  private prefix: string;
  constructor(readonly exerciseId: ExerciseId, sessionId: string = globalThis.crypto?.randomUUID?.() ?? `session-${Date.now()}-${Math.random()}`) { this.prefix = sessionId; }
  get expectedSide(): Side | undefined { return this.lastSide ? (this.lastSide === 'left' ? 'right' : 'left') : undefined; }
  /** Pause invalidates an unfinished cycle but preserves completed units, hold fractions and alternation. */
  pause() {
    this.phase = 'initial'; this.stableSince = undefined; this.lastObservation = undefined;
    this.lastFrame = undefined; this.filtered = undefined; this.holding = false; this.lastMotion = undefined;
  }
  update(frame: PoseFrame): DetectorFeedback {
    if (this.lastFrame !== undefined && frame.timestamp <= this.lastFrame) return { state: 'ready', message: 'Waiting for a new camera frame.' };
    const raw = observePose(this.exerciseId, frame);
    if (!raw.visible) { this.pause(); return { state: 'tracking-lost', message: 'Move back into view. Your progress is safe.' }; }
    const gap = this.lastFrame === undefined ? 0 : frame.timestamp - this.lastFrame;
    if (gap > DETECTOR_CONFIG.maximumFrameGapMs) this.pause();
    const alpha = gap ? 1 - Math.exp(-gap / DETECTOR_CONFIG.smoothingMs) : 1;
    this.filtered = frame.landmarks.map((p, i) => ({ ...p, x: this.filtered ? this.filtered[i].x + alpha * (p.x - this.filtered[i].x) : p.x, y: this.filtered ? this.filtered[i].y + alpha * (p.y - this.filtered[i].y) : p.y }));
    this.lastFrame = frame.timestamp;
    return this.updateObservation(observePose(this.exerciseId, { ...frame, landmarks: this.filtered }), frame.timestamp);
  }
  updateObservation(o: Observation, now: number): DetectorFeedback {
    if (!o.visible) { this.pause(); return { state: 'tracking-lost', message: 'Required joints are hidden. Reposition the camera.' }; }
    if (this.lastObservation !== undefined && now <= this.lastObservation) return { state: 'ready', message: 'Waiting for a new frame.' };
    let dt = this.lastObservation === undefined ? 0 : now - this.lastObservation;
    if (dt > DETECTOR_CONFIG.maximumFrameGapMs) { this.pause(); dt = 0; }
    this.lastObservation = now;
    if (this.exerciseId === 'superman') {
      if (o.extended) {
        this.stableSince ??= now;
        if (now - this.stableSince >= DETECTOR_CONFIG.stableMs) {
          if (this.holding) this.holdMs += dt;
          this.holding = true;
          if (this.holdMs >= 1000) { this.holdMs -= 1000; return { state: 'hold', message: 'One verified second.', unit: this.unit(now, o, .5 + .5 * o.amplitude) }; }
        }
        return { state: 'hold', message: 'Hold steady. Breathe normally.' };
      }
      this.stableSince = undefined; this.holding = false;
      return { state: 'ready', message: 'Lift arms and legs into view. Valid time is saved.' };
    }
    if (this.phase === 'initial') {
      if (o.ready) { this.stableSince ??= now; if (now - this.stableSince >= DETECTOR_CONFIG.stableMs) { this.phase = 'ready'; this.stableSince = undefined; } }
      else this.stableSince = undefined;
      return { state: 'ready', message: 'Settle into the starting position.' };
    }
    if (this.phase === 'ready') {
      this.motionStart = o.motion; this.lastMotion = o.motion;
      if (!o.ready) { this.phase = 'moving'; this.start = now; this.peak = o.amplitude; this.side = undefined; this.movement = 0; this.totalMotion = 0; }
      return { state: 'moving', message: this.expectedSide ? `Next: ${this.expectedSide} side.` : 'Begin one controlled repetition.' };
    }
    this.peak = Math.max(this.peak, o.amplitude);
    this.movement = Math.max(this.movement, Math.abs(o.motion - this.motionStart));
    this.totalMotion += Math.abs(o.motion - (this.lastMotion ?? o.motion)); this.lastMotion = o.motion;
    if (this.phase === 'moving') {
      if (o.extended) {
        if (this.stableSince === undefined || this.side !== o.side) { this.stableSince = now; this.side = o.side; }
        if (now - this.stableSince >= DETECTOR_CONFIG.stableMs) { this.phase = 'return'; this.stableSince = undefined; }
      } else {
        this.stableSince = undefined;
        if (o.ready) { this.phase = 'ready'; return { state: 'ready', rejected: true, message: 'Incomplete movement. Try a full controlled repetition.' }; }
      }
      return { state: 'moving', message: 'Move through a comfortable full range.' };
    }
    if (o.ready) {
      this.stableSince ??= now;
      if (now - this.stableSince >= DETECTOR_CONFIG.returnMs) {
        this.phase = 'ready'; this.stableSince = undefined;
        if (now - this.start < DETECTOR_CONFIG.minimumCycleMs) return { state: 'ready', rejected: true, message: 'Slow down and complete the full movement.' };
        if ((this.exerciseId === 'lunge' || this.exerciseId === 'birddog') && (!this.side || this.side === this.lastSide)) return { state: 'ready', rejected: true, message: `Alternate sides. Next: ${this.expectedSide ?? 'either clearly visible side'}.` };
        if ((this.exerciseId === 'squat' || this.exerciseId === 'pushup' || this.exerciseId === 'diamond') && this.movement < .08) return { state: 'ready', rejected: true, message: 'Keep the camera still and move your torso through the repetition.' };
        const rhythm = clamp((now - this.start) / 1800, .4, 1);
        const control = this.totalMotion > 0 ? clamp(2 * this.movement / this.totalMotion, .4, 1) : .8;
        const quality = clamp(.5 * this.peak + .3 * control + .2 * rhythm, .35, 1);
        const unit = this.unit(now, o, quality, this.side); this.lastSide = this.side;
        return { state: 'ready', unit, message: 'Verified repetition. Well done.' };
      }
    } else this.stableSince = undefined;
    return { state: 'return', message: 'Return fully to the starting position.' };
  }
  private unit(timestamp: number, o: Observation, quality: number, side?: Side): ExerciseUnit {
    return { id: `${this.prefix}:${++this.sequence}`, exerciseId: this.exerciseId, quality: clamp(quality), confidence: o.confidence, side, verified: true, timestamp };
  }
}

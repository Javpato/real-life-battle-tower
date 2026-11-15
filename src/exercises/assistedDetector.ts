import type { ExerciseId, ExerciseUnit } from "../core/contracts";
import {
  exerciseProfile,
  type ExerciseProfile,
} from "../tower/exerciseProfiles";
import { SKILL_BY_ID } from "../tower/catalog";
import {
  angle,
  ExerciseDetector,
  type PoseFrame,
  type Observation,
  type DetectorFeedback,
  type RecognitionOptions,
  type Side,
} from "./detectors";

/** These measurements assist counting; they never certify technique. All component
 * landmarks must be visible in the current raw AND filtered frame. */
export type AssistedMeasurement = {
  values: [number, number];
  features: [number[], number[]];
  confidence: number;
  visible: boolean;
  posture: boolean;
  hold: boolean;
  scale: number;
  missing: string[];
  usable: [boolean, boolean];
  bilateral: boolean;
  legGeometry?: { hipY: number; shoulderY: number; ankleY: number }[];
};
const opposite = (side: Side): Side => (side === "left" ? "right" : "left");
const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const limb = (side: 0 | 1) => ({
  s: 11 + side,
  e: 13 + side,
  w: 15 + side,
  h: 23 + side,
  k: 25 + side,
  a: 27 + side,
  heel: 29 + side,
  toe: 31 + side,
});
const jointNames: Record<number, string> = {
  11: "left shoulder",
  12: "right shoulder",
  13: "left elbow",
  14: "right elbow",
  15: "left wrist",
  16: "right wrist",
  23: "left hip",
  24: "right hip",
  25: "left knee",
  26: "right knee",
  27: "left ankle",
  28: "right ankle",
  29: "left heel",
  30: "right heel",
  31: "left toe",
  32: "right toe",
};
const BOTH = [0, 1] as const;
const EMPTY: AssistedMeasurement = {
  values: [0, 0],
  features: [[0], [0]],
  confidence: 0,
  visible: false,
  posture: false,
  hold: false,
  scale: 0,
  missing: [],
  usable: [false, false],
  bilateral: false,
};
export const ASSISTED_TIMING = {
  calibrateMs: 700,
  readyMs: 90,
  returnMs: 60,
  minimumCycleMs: 300,
  maximumGapMs: 250,
  maximumLatencyMs: 1000,
} as const;

export function measureAssistedPose(
  profile: ExerciseProfile,
  frame: PoseFrame,
  alternating = false,
): AssistedMeasurement {
  if (
    frame.landmarks.length !== 33 ||
    !Number.isFinite(frame.width) ||
    !Number.isFinite(frame.height) ||
    frame.width <= 0 ||
    frame.height <= 0 ||
    !Number.isFinite(frame.timestamp) ||
    (frame.captureLatencyMs !== undefined &&
      (!Number.isFinite(frame.captureLatencyMs) ||
        frame.captureLatencyMs > ASSISTED_TIMING.maximumLatencyMs))
  )
    return EMPTY;
  const raw = frame.rawLandmarks ?? frame.landmarks;
  const confidence = (i: number) =>
    Math.min(
      ...[frame.landmarks[i], raw[i]].map((p) =>
        p &&
        Number.isFinite(p.x) &&
        Number.isFinite(p.y) &&
        p.x > 0.005 &&
        p.x < 0.995 &&
        p.y > 0.005 &&
        p.y < 0.995 &&
        Number.isFinite(p.visibility) &&
        Number.isFinite(p.presence ?? 1) &&
        !frame.spikeJoints?.includes(i)
          ? clamp(Math.min(p.visibility ?? 0, p.presence ?? 1))
          : 0,
      ),
    );
  const p = frame.landmarks.map((v) => ({
    ...v,
    x: (v.x * frame.width) / frame.height,
  }));
  const distance = (a: number, b: number) =>
    Math.hypot(p[a].x - p[b].x, p[a].y - p[b].y);
  const legs = [
    "knee-bend",
    "lunge",
    "hinge",
    "leg-out",
    "calf",
    "hip-lift",
    "knee-lift",
    "knee-extend",
    "heel-slide",
    "jack",
    "step",
    "plank",
    "wall-sit",
    "tabletop",
    "opposite-reach",
  ];
  const arms = [
    "elbow-bend",
    "arm-lift",
    "arm-open",
    "tap",
    "jack",
    "punch",
    "uppercut",
    "plank",
    "rock",
    "opposite-reach",
  ];
  const oppositeArm =
    profile.id === "standing-climber" || profile.id === "standing-cross-knee";
  const groups = BOTH.map((i) => {
    const c = limb(i);
    return [
      ...new Set([
        c.s,
        c.h,
        ...(legs.includes(profile.strategy) ? [c.k, c.a] : []),
        ...((arms.includes(profile.strategy) &&
          profile.id !== "standing-ankle-rock") ||
        oppositeArm
          ? [c.e, c.w]
          : []),
        ...(["curl", "rock"].includes(profile.strategy) ? [c.k] : []),
        ...(profile.strategy === "calf" || profile.id === "standing-ankle-rock"
          ? [c.a, c.heel, c.toe]
          : []),
      ]),
    ];
  });
  const good = (ids: number[]) =>
    ids.every((i) => confidence(i) >= 0.4) &&
    ids.reduce((n, i) => n + confidence(i), 0) / ids.length >= 0.55;
  const bilateral =
    !alternating &&
    (profile.view === "front" ||
      ["jack", "arm-open", "tabletop"].includes(profile.strategy) ||
      profile.id.startsWith("prone-") ||
      profile.id === "wall-arm-slide");
  const both =
    alternating ||
    profile.view === "front" ||
    bilateral ||
    profile.strategy === "opposite-reach";
  const usable: [boolean, boolean] = [good(groups[0]), good(groups[1])];
  const ids = both
    ? groups.flat()
    : usable[0]
      ? groups[0]
      : usable[1]
        ? groups[1]
        : groups[0];
  if (!good(ids))
    return {
      ...EMPTY,
      missing: ids.filter((i) => confidence(i) < 0.4).map((i) => jointNames[i]),
    };
  const scales = BOTH.filter((i) => usable[i]).map((i) =>
    distance(limb(i).s, limb(i).h),
  );
  const scale = scales.reduce((a, b) => a + b, 0) / scales.length;
  if (!Number.isFinite(scale) || scale < 0.06 || scale > 0.9) return EMPTY;
  const values: [number, number] = [0, 0],
    features: [number[], number[]] = [[], []];
  let posture = true,
    hold = true;
  const floor = profile.view.startsWith("low");
  const screenLeft = Math.sign(p[11].x - p[12].x) || -1;
  for (const i of BOTH) {
    if (!usable[i]) continue;
    const { s, e, w, h, k, a, heel, toe } = limb(i),
      other = limb(i === 0 ? 1 : 0);
    const knee = angle(p[h], p[k], p[a]),
      elbow = angle(p[s], p[e], p[w]),
      hip = angle(p[s], p[h], p[k]);
    const horizontal = Math.abs(p[s].y - p[h].y) < scale * 0.75;
    const upright = p[h].y - p[s].y > scale * 0.5;
    const armHeight = (p[s].y - p[w].y) / scale,
      kneeHeight = (p[h].y - p[k].y) / scale;
    let valid = true,
      held = false;
    switch (profile.strategy) {
      case "knee-bend":
        values[i] = (180 - knee) / 180;
        valid = upright;
        break;
      case "lunge":
        values[i] = (180 - knee) / 180;
        valid = upright;
        break;
      case "elbow-bend":
        values[i] = (180 - elbow) / 180;
        valid = profile.id.includes("wall")
          ? upright
          : profile.id === "incline-pushup"
            ? p[w].y > p[s].y
            : horizontal;
        break;
      case "hinge":
        values[i] = (180 - hip) / 180;
        valid = knee > 125;
        break;
      case "leg-out":
        values[i] = Math.abs(p[a].x - p[h].x) / scale;
        valid = upright;
        break;
      case "calf":
        values[i] = (p[toe].y - p[heel].y) / scale;
        valid = upright && knee > 140 && distance(toe, heel) > 0.025;
        break;
      case "hip-lift":
        values[i] = ((p[s].y + p[k].y) / 2 - p[h].y) / scale;
        valid = horizontal && knee < 155;
        break;
      case "arm-lift":
        values[i] =
          profile.id === "quadruped-thoracic-rotation"
            ? (p[s].y - p[e].y) / scale
            : armHeight;
        valid = floor ? horizontal : upright;
        break;
      case "arm-open":
        values[i] = angle(p[w], p[s], p[h]) / 180;
        valid = floor ? horizontal : upright;
        break;
      case "knee-lift":
        values[i] = floor ? (180 - hip) / 180 : kneeHeight;
        valid = floor ? horizontal : upright;
        if (oppositeArm)
          features[i] = [
            values[i],
            profile.id === "standing-climber"
              ? (p[other.s].y - p[other.w].y) / scale
              : -distance(k, other.e) / scale,
          ];
        break;
      case "knee-extend":
        values[i] = knee / 180;
        valid = floor ? horizontal : upright;
        break;
      case "heel-slide":
        values[i] = distance(h, a) / scale;
        valid = floor ? horizontal : upright;
        break;
      case "tap":
        values[i] = -distance(w, other.s) / scale;
        valid = horizontal;
        break;
      case "opposite-reach":
        valid = horizontal;
        // Side always names the reaching ARM; the leg component belongs to the opposite chain.
        features[i] =
          profile.id === "alternating-superman"
            ? [armHeight, (p[other.h].y - p[other.a].y) / scale]
            : [
                angle(p[w], p[s], p[h]) / 180,
                angle(p[other.s], p[other.h], p[other.k]) / 180,
              ];
        values[i] = Math.min(...features[i]);
        break;
      case "jack":
        features[i] = [armHeight, Math.abs(p[a].x - p[h].x) / scale];
        values[i] = Math.min(...features[i]);
        valid = upright;
        break;
      case "step":
        values[i] =
          ((p[a].x - p[h].x) / scale) * (i === 0 ? screenLeft : -screenLeft);
        valid = upright;
        break;
      case "punch":
        values[i] = elbow / 180;
        valid = upright;
        break;
      case "uppercut":
        values[i] = armHeight;
        valid = upright && elbow < 155;
        break;
      case "curl":
        values[i] = (p[h].y - p[s].y) / scale;
        valid = horizontal;
        break;
      case "rock":
        values[i] =
          profile.id === "standing-ankle-rock"
            ? Math.abs(p[k].x - p[a].x) / scale
            : profile.id === "quadruped-wrist-rock"
              ? Math.abs(p[s].x - p[w].x) / scale
              : distance(h, w) / scale;
        valid = profile.id === "standing-ankle-rock" ? upright : horizontal;
        break;
      case "side-bend":
        values[i] =
          ((p[s].x - p[h].x) / scale) * (i === 0 ? screenLeft : -screenLeft);
        valid = upright;
        break;
      case "plank":
        values[i] = hip / 180;
        valid = horizontal;
        held =
          horizontal &&
          hip > 140 &&
          knee > 140 &&
          p[e].y > p[s].y &&
          (profile.id === "high-plank"
            ? elbow > 140
            : elbow > 50 && elbow < 130);
        break;
      case "wall-sit":
        values[i] = (180 - knee) / 180;
        valid = upright;
        held = upright && knee > 65 && knee < 145;
        break;
      case "tabletop":
        values[i] = kneeHeight;
        valid = horizontal;
        held =
          horizontal &&
          p[k].y < p[h].y - scale * 0.25 &&
          knee > 55 &&
          knee < 135;
        break;
      case "legacy":
      case "confirmation":
        valid = false;
        break;
    }
    if (!features[i].length) features[i] = [values[i]];
    if (features[i].some((v) => !Number.isFinite(v))) valid = false;
    posture = posture && valid;
    hold = hold && held;
  }
  return {
    values,
    features,
    scale,
    posture,
    hold,
    visible: true,
    confidence: Math.min(...ids.map(confidence)),
    missing: [],
    usable,
    bilateral,
    ...(profile.strategy === "knee-bend"
      ? {
          legGeometry: BOTH.map((i) => ({
            hipY: p[23 + i].y,
            shoulderY: p[11 + i].y,
            ankleY: p[27 + i].y,
          })),
        }
      : {}),
  };
}

function featureDifference(a: AssistedMeasurement, b: AssistedMeasurement) {
  return Math.max(
    ...BOTH.flatMap((i) =>
      a.usable[i] && b.usable[i]
        ? a.features[i].map((v, j) => Math.abs(v - b.features[i][j]))
        : [0],
    ),
  );
}
function sameChains(a: AssistedMeasurement, b: AssistedMeasurement) {
  return a.usable.every((v, i) => v === b.usable[i]);
}

export class AssistedExerciseDetector {
  private reference?: AssistedMeasurement;
  private candidate?: AssistedMeasurement;
  private candidateAt?: number;
  private calibrationTimestamp?: number;
  private lastTimestamp?: number;
  private phase: "start" | "out" | "away" = "start";
  private readyAt?: number;
  private startedAt?: number;
  private awayAt?: number;
  private returnAt?: number;
  private pauseAt?: number;
  private pauseQualified = false;
  private descentQualified = false;
  private previousRange = 0;
  private outwardMs = 0;
  private heldMs = 0;
  private wasHolding = false;
  private sequence = 0;
  private activeIndex?: 0 | 1;
  private lastSide?: Side;
  private prefix: string;
  private profile: ExerciseProfile;
  private alternating: boolean;
  private hold: boolean;
  constructor(
    readonly skillId: string,
    readonly exerciseId: ExerciseId,
    sessionId?: string,
    lastSide?: Side,
  ) {
    const profile = exerciseProfile(skillId),
      skill = SKILL_BY_ID[skillId];
    if (
      !profile ||
      profile.method !== "assisted" ||
      !skill ||
      skill.exercise !== exerciseId
    )
      throw Error("UNKNOWN_ASSISTED_PROFILE");
    this.profile = profile;
    this.alternating = skill.alternating;
    this.hold = skill.unit === "seconds";
    this.lastSide = lastSide;
    this.prefix = `${sessionId ?? "exercise"}:${crypto.randomUUID()}`;
  }
  get expectedSide() {
    return this.alternating
      ? this.lastSide
        ? opposite(this.lastSide)
        : "left"
      : undefined;
  }
  /** Assisted movement never establishes Flash pace. */
  get cycleStartedAt(): null {
    return null;
  }
  pause() {
    this.phase = "start";
    this.readyAt =
      this.startedAt =
      this.awayAt =
      this.returnAt =
      this.pauseAt =
        undefined;
    this.candidate = this.candidateAt = undefined;
    this.heldMs = 0;
    this.wasHolding = false;
    this.activeIndex = undefined;
    this.pauseQualified = this.descentQualified = false;
    this.previousRange = 0;
    this.outwardMs = 0;
  }
  beginCalibration() {
    this.pause();
    this.reference = undefined;
  }
  recalibrate(frame: PoseFrame) {
    const m = this.measure(frame);
    if (!m.visible || !m.posture) return false;
    this.pause();
    this.reference = m;
    this.readyAt = frame.timestamp;
    return true;
  }
  private measure(frame: PoseFrame) {
    return measureAssistedPose(this.profile, frame, this.alternating);
  }
  private calibrationReady(m: AssistedMeasurement, timestamp: number) {
    const gap =
      this.calibrationTimestamp === undefined
        ? 0
        : timestamp - this.calibrationTimestamp;
    this.calibrationTimestamp = timestamp;
    if (
      !m.visible ||
      !m.posture ||
      gap > ASSISTED_TIMING.maximumGapMs ||
      gap < 0
    ) {
      this.candidate = this.candidateAt = undefined;
      return false;
    }
    if (
      !this.candidate ||
      this.candidateAt === undefined ||
      timestamp < this.candidateAt ||
      !sameChains(m, this.candidate) ||
      featureDifference(m, this.candidate) > this.profile.minimum * 0.25 ||
      Math.abs(m.scale / this.candidate.scale - 1) > 0.08
    ) {
      this.candidate = m;
      this.candidateAt = timestamp;
    }
    return timestamp - this.candidateAt >= ASSISTED_TIMING.calibrateMs;
  }
  private hipRange(m: AssistedMeasurement, i: number) {
    const ref = this.reference;
    if (!ref?.legGeometry || !m.legGeometry) return 0;
    const a = ref.legGeometry[i],
      b = m.legGeometry[i];
    // A planted ankle anchors image travel: camera movement or raising a foot
    // cannot substitute for moving the torso over the supporting leg.
    if (Math.abs(b.ankleY - a.ankleY) > ref.scale * 0.12) return 0;
    const sign = this.profile.direction === "decrease" ? -1 : 1;
    const hip = (sign * (b.hipY - a.hipY)) / ref.scale;
    const shoulder = (sign * (b.shoulderY - a.shoulderY)) / ref.scale;
    return Math.max(0, Math.min(hip, shoulder * 1.5)) * 0.65;
  }
  private ranges(m: AssistedMeasurement): [number, number] {
    return BOTH.map((i) =>
      !m.usable[i] || !this.reference?.usable[i]
        ? 0
        : Math.max(
            this.hipRange(m, i),
            Math.min(
              ...m.features[i].map((v, j) => {
                const d = v - this.reference!.features[i][j];
                return this.profile.direction === "decrease"
                  ? -d
                  : this.profile.direction === "either"
                    ? Math.abs(d)
                    : d;
              }),
            ),
          ),
    ) as [number, number];
  }
  private returnRange(m: AssistedMeasurement, index: number) {
    return Math.max(
      this.hipRange(m, index),
      ...m.features[index].map((v, j) =>
        Math.abs(v - this.reference!.features[index][j]),
      ),
    );
  }
  observe(frame: PoseFrame): Observation {
    const m = this.measure(frame),
      range = this.reference ? Math.max(...this.ranges(m)) : 0;
    const calibratedReady = this.reference
      ? this.hold || range < this.profile.minimum * 0.4
      : this.calibrationReady(m, frame.timestamp);
    const ready = m.visible && m.posture && calibratedReady;
    return {
      visible: m.visible,
      ready,
      extended:
        m.visible &&
        m.posture &&
        (this.hold ? m.hold : range >= this.profile.minimum),
      amplitude: clamp(range),
      confidence: m.confidence,
      motion: range,
      fresh: m.visible,
      estimated: true,
      status: !m.visible
        ? "partial"
        : !m.posture
          ? "insufficient"
          : ready
            ? "ready"
            : "moving",
      missingJoints: m.missing,
      message: !m.visible
        ? `Show ${m.missing.join(", ") || this.profile.joints}.`
        : !m.posture
          ? "Match the illustrated starting position; use a comfortable range."
          : !this.reference
            ? "Hold the illustrated start steady to calibrate."
            : this.hold
              ? "Hold comfortably. Only visible posture time is estimated."
              : "Complete a comfortable movement, then return to your calibrated start.",
    };
  }
  update(frame: PoseFrame): DetectorFeedback {
    if (
      !Number.isFinite(frame.timestamp) ||
      (this.lastTimestamp !== undefined &&
        frame.timestamp <= this.lastTimestamp)
    ) {
      this.pause();
      return { state: "ready", message: "Waiting for a fresh frame." };
    }
    const delta =
      this.lastTimestamp === undefined
        ? 0
        : frame.timestamp - this.lastTimestamp;
    if (delta > ASSISTED_TIMING.maximumGapMs) this.pause();
    this.lastTimestamp = frame.timestamp;
    const m = this.measure(frame);
    const feedback = (
      state: DetectorFeedback["state"],
      message: string,
    ): DetectorFeedback => ({
      state,
      message,
      nextSide: this.expectedSide,
      missingJoints: m.missing,
    });
    if (!m.visible || !m.posture) {
      this.pause();
      return feedback(
        "tracking-lost",
        !m.visible
          ? `Keep ${m.missing.join(", ") || this.profile.joints} visible.`
          : "Return to the illustrated posture. Rest does not count.",
      );
    }
    if (!this.reference) {
      if (!this.calibrationReady(m, frame.timestamp))
        return feedback("ready", "Hold your starting position steady.");
      this.recalibrate(frame);
      return feedback(
        "ready",
        "Starting position calibrated · use a comfortable range.",
      );
    }
    if (
      !BOTH.some((i) => m.usable[i] && this.reference!.usable[i]) ||
      (this.profile.strategy !== "knee-bend" &&
        Math.abs(m.scale / this.reference.scale - 1) > 0.3)
    ) {
      this.beginCalibration();
      return feedback(
        "ready",
        "Camera angle or distance changed. Recalibrate your starting position.",
      );
    }
    if (this.hold) {
      if (!m.hold) {
        this.heldMs = 0;
        this.wasHolding = false;
        return feedback(
          "ready",
          "Settle into the illustrated hold, or rest freely.",
        );
      }
      if (this.wasHolding && delta <= ASSISTED_TIMING.maximumGapMs)
        this.heldMs += delta;
      this.wasHolding = true;
      if (this.heldMs < 1000)
        return feedback("hold", "Assisted posture time · keep breathing.");
      this.heldMs -= 1000;
      return {
        ...feedback(
          "hold",
          "One assisted second · internal effort is not verified.",
        ),
        unit: this.unit(frame.timestamp, m.confidence),
      };
    }
    const movement = this.ranges(m),
      minimum = this.profile.minimum;
    let index = (this.expectedSide === "right" ? 1 : 0) as 0 | 1;
    if (this.profile.reverseSide) index = (1 - index) as 0 | 1;
    if (!this.alternating) index = movement[1] > movement[0] ? 1 : 0;
    index = this.activeIndex ?? index;
    let value = m.bilateral ? Math.min(...movement) : movement[index];
    if (this.profile.id === "single-leg-squat" && m.legGeometry) {
      const support = m.legGeometry[index],
        lifted = m.legGeometry[1 - index];
      const footRaised =
        support.ankleY - lifted.ankleY > this.reference.scale * 0.08;
      // The announced side is the supporting leg, not the lifted leg. Once
      // returning, placing the other foot down does not erase the completed bend.
      if (!footRaised && this.phase !== "away") value = 0;
    }
    const returned = m.bilateral
      ? BOTH.every((i) => this.returnRange(m, i) < minimum * 0.4)
      : this.returnRange(m, index) < minimum * 0.4;
    if (this.phase === "start") {
      if (returned && value < minimum * 0.12) {
        this.readyAt ??= frame.timestamp;
        return feedback(
          "ready",
          `Ready${this.expectedSide ? ` · next ${this.expectedSide} side` : ""}. Move when comfortable.`,
        );
      }
      if (
        this.readyAt === undefined ||
        frame.timestamp - this.readyAt < ASSISTED_TIMING.readyMs
      )
        return feedback(
          "ready",
          "Return completely to the starting position first.",
        );
      if (value >= minimum * 0.12) {
        this.phase = "out";
        this.startedAt = frame.timestamp;
        this.activeIndex = index;
        this.previousRange = value;
      }
      // Process a peak in this same frame; a fast reversal may have only one
      // observed peak. Three distinct start/out/return frames still are required.
    }
    if (this.phase === "out") {
      const change = value - this.previousRange;
      if (change > minimum * 0.001 && change < minimum * 0.5)
        this.outwardMs += Math.min(delta, ASSISTED_TIMING.maximumGapMs);
      else if (change < -minimum * 0.1) this.outwardMs = 0;
      this.previousRange = value;
    }
    if (this.phase === "out" && value >= minimum) {
      this.phase = "away";
      this.awayAt = frame.timestamp;
      this.descentQualified =
        !this.profile.descentMs || this.outwardMs >= this.profile.descentMs;
      this.pauseAt = frame.timestamp;
      this.previousRange = value;
    }
    if (this.phase === "away" && value >= minimum) {
      if (Math.abs(value - this.previousRange) > minimum * 0.22)
        this.pauseAt = frame.timestamp;
      this.pauseAt ??= frame.timestamp;
      if (frame.timestamp - this.pauseAt >= (this.profile.pauseMs ?? 0))
        this.pauseQualified = true;
      this.previousRange = value;
      this.returnAt = undefined;
      return feedback(
        "moving",
        this.profile.pauseMs
          ? "Hold this comfortable position briefly, then return."
          : "Now return to your starting position.",
      );
    }
    // A pause has to be a continuous stable interval away from the starting pose.
    if (value < minimum && !this.pauseQualified) this.pauseAt = undefined;
    if (returned && (this.phase === "away" || value < minimum * 0.12)) {
      if (this.phase !== "away") {
        this.pause();
        return {
          ...feedback(
            "ready",
            "Make one comfortable complete movement before returning.",
          ),
          rejected: true,
        };
      }
      this.returnAt ??= frame.timestamp;
      // Clear geometric hysteresis already proves the return. Requiring a
      // stationary endpoint drops continuous fast repetitions.
      if (frame.timestamp <= this.awayAt!)
        return feedback("return", "Finish returning to the starting position.");
      const duration = frame.timestamp - this.startedAt!;
      const qualified =
        duration >= ASSISTED_TIMING.minimumCycleMs &&
        this.descentQualified &&
        (!this.profile.pauseMs || this.pauseQualified);
      const side = this.profile.reverseSide
        ? opposite(index === 0 ? "left" : "right")
        : index === 0
          ? "left"
          : "right";
      this.pause();
      this.readyAt = frame.timestamp;
      if (!qualified)
        return {
          ...feedback(
            "ready",
            "Complete the illustrated pause or slow lowering, then return. Rest is always allowed.",
          ),
          rejected: true,
        };
      if (this.alternating) this.lastSide = side;
      return {
        ...feedback(
          "ready",
          "Assisted repetition · movement estimated, technique not certified.",
        ),
        unit: this.unit(frame.timestamp, m.confidence, side),
      };
    }
    this.returnAt = undefined;
    return feedback("return", "Finish the return before the next repetition.");
  }
  private unit(
    timestamp: number,
    confidence: number,
    side?: Side,
  ): ExerciseUnit {
    return {
      id: `${this.prefix}:${++this.sequence}`,
      exerciseId: this.exerciseId,
      skillId: this.skillId,
      profileId: `assisted-v1:${this.skillId}`,
      evidence: "assisted",
      quality: 1,
      confidence,
      verified: false,
      timestamp,
      ...(this.alternating ? { side } : {}),
    };
  }
}

/** A camera preview is never allowed to fall back to an unrelated transport alias. */
export class PreviewExerciseDetector {
  get expectedSide(): Side | undefined {
    return undefined;
  }
  get cycleStartedAt(): null {
    return null;
  }
  pause() {}
  beginCalibration() {}
  recalibrate(_frame: PoseFrame) {
    return false;
  }
  observe(_frame: PoseFrame): Observation {
    return {
      visible: false,
      ready: false,
      extended: false,
      amplitude: 0,
      confidence: 0,
      motion: 0,
      fresh: false,
      estimated: true,
      status: "insufficient",
      message: "Camera preview only. Confirm each completed movement manually.",
    };
  }
  update(_frame: PoseFrame): DetectorFeedback {
    return {
      state: "ready",
      message: "Camera preview only. Confirm each completed movement manually.",
    };
  }
}

/** Only an exact configured skill may reuse legacy camera logic. */
export function createExerciseDetector(
  exerciseId: ExerciseId,
  sessionId?: string,
  lastSide?: Side,
  options: RecognitionOptions & { skillId?: string } = {},
) {
  if (options.skillId) {
    const profile = exerciseProfile(options.skillId),
      skill = SKILL_BY_ID[options.skillId];
    if (
      !profile ||
      !skill ||
      skill.exercise !== exerciseId ||
      profile.method === "confirmation"
    )
      return new PreviewExerciseDetector();
    if (profile.method === "assisted")
      return new AssistedExerciseDetector(
        options.skillId,
        exerciseId,
        sessionId,
        lastSide,
      );
    const exactProfile =
      options.skillId === "mini-squat" || options.skillId === "knee-pushup"
        ? options.skillId
        : undefined;
    return new ExerciseDetector(exerciseId, sessionId, lastSide, {
      ...options,
      profile: exactProfile,
    });
  }
  return new ExerciseDetector(exerciseId, sessionId, lastSide, options);
}

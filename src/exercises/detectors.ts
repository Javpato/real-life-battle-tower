import { PoseFilter } from "./poseFilter";
import type { ExerciseId, ExerciseUnit } from "../core/contracts";

export type Landmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
  presence?: number;
};
export type PoseFrame = {
  timestamp: number;
  landmarks: Landmark[];
  width: number;
  height: number;
  rawLandmarks?: Landmark[];
  spikeJoints?: number[];
  captureLatencyMs?: number;
  inferenceMs?: number;
  receivedAt?: number;
};
export type Side = "left" | "right";
export type ObservationStatus =
  "no-body" | "partial" | "insufficient" | "ready" | "moving" | "hold";
export type Observation = {
  visible: boolean;
  ready: boolean;
  extended: boolean;
  side?: Side;
  amplitude: number;
  confidence: number;
  motion: number;
  status?: ObservationStatus;
  message?: string;
  missingJoints?: string[];
  observedSide?: Side;
  fresh?: boolean;
  estimated?: boolean;
};
export type DetectorFeedback = {
  state: "ready" | "moving" | "return" | "tracking-lost" | "hold";
  message: string;
  unit?: ExerciseUnit;
  rejected?: boolean;
  status?: ObservationStatus | "return" | "valid" | "incomplete";
  nextSide?: Side;
  missingJoints?: string[];
};
export const DETECTOR_CONFIG = {
  visibility: 0.5,
  alternatingVisibility: 0.55,
  stableMs: 180,
  returnMs: 140,
  minimumCycleMs: 650,
  maximumFrameGapMs: 250,
  occlusionRetentionMs: 400,
  smoothingMs: 65,
};
const clamp = (n: number, low = 0, high = 1) =>
  Math.max(low, Math.min(high, n));
const sides: Side[] = ["left", "right"];
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
};
const chain = (side: Side) => {
  const i = side === "left" ? 0 : 1;
  return {
    shoulder: 11 + i,
    elbow: 13 + i,
    wrist: 15 + i,
    hip: 23 + i,
    knee: 25 + i,
    ankle: 27 + i,
  };
};
export function angle(a: Landmark, b: Landmark, c: Landmark): number {
  const ax = a.x - b.x,
    ay = a.y - b.y,
    cx = c.x - b.x,
    cy = c.y - b.y;
  const length = Math.hypot(ax, ay) * Math.hypot(cx, cy);
  return length < 1e-8
    ? 0
    : (Math.acos(clamp((ax * cx + ay * cy) / length, -1, 1)) * 180) / Math.PI;
}

/** Fresh exercise-specific anatomical evidence; mirroring is a display operation only.
 * preferredObservedSide locks the measured chain during a cycle, never inventing a hidden side.
 */
export type PoseReference = {
  side?: Side;
  scale: number;
  hipY: number;
  hipAngle: number;
  kneeAngle?: number;
};
export type RecognitionOptions = {
  allowPartialSquat?: boolean;
  reference?: PoseReference;
};
export function observePose(
  exercise: ExerciseId,
  frame: PoseFrame,
  preferredObservedSide?: Side,
  options: RecognitionOptions = {},
): Observation {
  const empty: Observation = {
    visible: false,
    ready: false,
    extended: false,
    amplitude: 0,
    confidence: 0,
    motion: 0,
    fresh: false,
    status: "no-body",
    message: "Move into the camera view.",
    missingJoints: [],
  };
  if (
    frame.landmarks.length < 33 ||
    !Number.isFinite(frame.width) ||
    !Number.isFinite(frame.height) ||
    frame.width <= 0 ||
    frame.height <= 0
  )
    return empty;
  const p = frame.landmarks.map((a) => ({
    ...a,
    x: (a.x * frame.width) / frame.height,
  }));
  const confidence = (i: number) => {
    const a = frame.landmarks[i];
    return a &&
      Number.isFinite(a.x) &&
      Number.isFinite(a.y) &&
      a.x > 0.005 &&
      a.x < 0.995 &&
      a.y > 0.005 &&
      a.y < 0.995
      ? Math.min(a.visibility ?? 0, a.presence ?? 1)
      : 0;
  };
  // A mildly uncertain distal joint need not hide an otherwise clear body.
  // Floors reject inferred/absent points; aggregate evidence and strong anchors
  // remain separate requirements before any verified event is permitted.
  const floor = (i: number) =>
    [11, 12, 23, 24].includes(i)
      ? 0.45
      : [13, 14, 25, 26].includes(i)
        ? 0.4
        : 0.35;
  const good = (i: number, threshold = floor(i)) => confidence(i) >= threshold;
  const score = (ids: number[]) => {
    const values = ids.map(confidence),
      mean = values.reduce((a, b) => a + b, 0) / values.length;
    return 0.65 * mean + 0.35 * Math.min(...values);
  };
  const all = (ids: number[], threshold = DETECTOR_CONFIG.visibility) => {
    const anchors = ids.filter((i) => [11, 12, 23, 24, 25, 26].includes(i));
    return (
      ids.every((i) => good(i)) &&
      score(ids) >= threshold &&
      anchors.filter((i) => confidence(i) >= 0.55).length >=
        Math.min(2, anchors.length)
    );
  };
  const distance = (a: number, b: number) =>
    Math.hypot(p[a].x - p[b].x, p[a].y - p[b].y);
  const hasBody = [11, 12, 23, 24, 25, 26].some((i) => good(i));
  const unavailable = (groups: number[][], message: string): Observation => {
    const threshold =
      exercise === "lunge" || exercise === "birddog"
        ? DETECTOR_CONFIG.alternatingVisibility
        : DETECTOR_CONFIG.visibility;
    const relevant = preferredObservedSide
      ? groups.filter((ids) =>
          ids.every(
            (i) => i % 2 === (preferredObservedSide === "left" ? 1 : 0),
          ),
        )
      : groups;
    const missing =
      relevant
        .map((ids) => ids.filter((i) => !good(i)))
        .sort((a, b) => a.length - b.length)[0] ?? [];
    return {
      ...empty,
      status: hasBody
        ? missing.length
          ? "partial"
          : "insufficient"
        : "no-body",
      message: hasBody
        ? preferredObservedSide
          ? `Keep the ${preferredObservedSide} side visible during this repetition. ${message}`
          : message
        : empty.message,
      missingJoints: missing.map((i) => jointNames[i]),
    };
  };
  const candidates = sides.map((side) => ({ side, ...chain(side) }));
  const select = (groups: { side: Side; ids: number[] }[]) =>
    groups
      .filter(
        (g) =>
          (!preferredObservedSide || g.side === preferredObservedSide) &&
          all(g.ids),
      )
      .sort((a, b) => score(b.ids) - score(a.ids))[0];
  const base = (ids: number[], side?: Side): Observation => ({
    ...empty,
    visible: true,
    fresh: true,
    confidence: score(ids),
    observedSide: side,
    status: "insufficient",
    message: "Settle into the illustrated starting position.",
  });
  const finish = (o: Observation): Observation => ({
    ...o,
    status: o.extended
      ? exercise === "superman"
        ? "hold"
        : "moving"
      : o.ready
        ? "ready"
        : (o.status ?? "insufficient"),
    message: o.extended
      ? exercise === "superman"
        ? "Hold the visible arm and leg raised."
        : "Range reached. Return with control."
      : o.ready
        ? "Starting position visible."
        : o.message,
  });
  if (exercise === "sitstand") {
    const groups = candidates.map((c) => ({
        side: c.side,
        ids: [c.hip, c.knee, c.ankle],
      })),
      g = select(groups);
    if (!g)
      return unavailable(
        groups.map((g) => g.ids),
        "Show one hip, knee and ankle. Start seated on a stable chair, feet on the floor.",
      );
    const c = chain(g.side),
      bend = angle(p[c.hip], p[c.knee], p[c.ankle]);
    const scale =
      options.reference?.side === g.side
        ? options.reference.scale
        : Math.max(
            0.06,
            (distance(c.hip, c.knee) + distance(c.knee, c.ankle)) * 0.6,
          );
    const upright = !good(c.shoulder) || p[c.shoulder].y < p[c.hip].y;
    const reference =
      options.reference?.side === g.side ? options.reference : undefined;
    // Recognize a seated leg, including higher chairs, without asking for squat depth.
    // The visible thigh must still differ from a standing vertical leg.
    const seatedCandidate =
      upright &&
      bend > 55 &&
      bend < 153 &&
      Math.abs(p[c.hip].x - p[c.knee].x) > scale * 0.22 &&
      p[c.hip].y < p[c.knee].y + scale * 0.4;
    const kneeBaseline = reference?.kneeAngle;
    const rise = reference ? (reference.hipY - p[c.hip].y) / scale : 0;
    const returnedToSeat =
      reference && kneeBaseline !== undefined
        ? Math.abs(rise) <= 0.12 && Math.abs(bend - kneeBaseline) <= 18
        : seatedCandidate;
    const standing =
      upright &&
      bend >= Math.max(155, (kneeBaseline ?? 90) + 15) &&
      p[c.hip].y < p[c.knee].y - scale * 0.35 &&
      (!reference || rise >= 0.08);
    return finish({
      ...base(g.ids, g.side),
      ready: upright && seatedCandidate && Boolean(returnedToSeat),
      extended: standing,
      amplitude: clamp(
        (bend - (kneeBaseline ?? 90)) /
          Math.max(20, 175 - (kneeBaseline ?? 90)),
      ),
      motion: p[c.hip].y / scale,
      message: reference
        ? "Stand upright, then return to your calibrated chair height. You do not need to sit lower."
        : "Sit naturally on your stable chair and hold still to learn its height. Then stand and return to the same seat.",
    });
  }
  if (exercise === "wallpushup") {
    const groups = candidates.map((c) => ({
        side: c.side,
        ids: [c.shoulder, c.elbow, c.wrist, c.hip],
      })),
      g = select(groups);
    if (!g)
      return unavailable(
        groups.map((g) => g.ids),
        "Show one shoulder, elbow, wrist and hip from the side. Start with your arms extended against the wall.",
      );
    const c = chain(g.side),
      scale = Math.max(0.06, distance(c.shoulder, c.hip)),
      bend = angle(p[c.shoulder], p[c.elbow], p[c.wrist]);
    const standing =
      p[c.hip].y > p[c.shoulder].y &&
      Math.abs(p[c.hip].y - p[c.shoulder].y) >
        Math.abs(p[c.hip].x - p[c.shoulder].x) * 0.8;
    const handAtChest =
      Math.abs(p[c.wrist].y - p[c.shoulder].y) < scale * 0.65 &&
      Math.abs(p[c.wrist].x - p[c.shoulder].x) > scale * 0.2;
    return finish({
      ...base(g.ids, g.side),
      ready: standing && handAtChest && bend > 140,
      extended: standing && handAtChest && bend < 120,
      amplitude: clamp((160 - bend) / 70),
      motion: p[c.shoulder].x / scale,
      message:
        "Keep hands against the wall; bend your elbows as your torso approaches, then return.",
    });
  }
  if (exercise === "bridge") {
    const groups = candidates.map((c) => ({
        side: c.side,
        ids: [c.shoulder, c.hip, c.knee],
      })),
      g = select(groups);
    if (!g)
      return unavailable(
        groups.map((g) => g.ids),
        "Use a low side view showing one shoulder, hip and knee. Feet are not checked when outside the frame. Start with hips down.",
      );
    const c = chain(g.side),
      scale =
        options.reference?.side === g.side
          ? options.reference.scale
          : Math.max(0.06, distance(c.shoulder, c.hip)),
      hipAngle = angle(p[c.shoulder], p[c.hip], p[c.knee]),
      kneeAngle = angle(p[c.hip], p[c.knee], p[c.ankle]);
    const floorPosture =
      Math.abs(p[c.shoulder].x - p[c.hip].x) >
        Math.abs(p[c.shoulder].y - p[c.hip].y) * 0.75 &&
      p[c.knee].y < p[c.shoulder].y - scale * 0.2 &&
      (!good(c.ankle) ||
        (kneeAngle > 40 &&
          kneeAngle < 140 &&
          p[c.ankle].y > p[c.shoulder].y - scale * 0.2));
    return finish({
      ...base(good(c.ankle) ? [...g.ids, c.ankle] : g.ids, g.side),
      ready:
        floorPosture &&
        p[c.hip].y >= p[c.shoulder].y - scale * 0.12 &&
        hipAngle < 150,
      extended:
        floorPosture &&
        p[c.hip].y < p[c.shoulder].y - scale * 0.18 &&
        hipAngle > 155,
      amplitude: clamp((hipAngle - 120) / 55),
      motion: (p[c.hip].y - p[c.shoulder].y) / scale,
      message: good(c.ankle)
        ? "Start with hips down and knees bent. Lift the hips, then lower back to the starting position."
        : "Hip-lift tracking: show shoulder, hip and knee. Feet are not checked.",
    });
  }
  if (exercise === "squat") {
    const groups = candidates.map((c) => ({
      side: c.side,
      ids: [c.hip, c.knee, c.ankle],
    }));
    const g = select(groups);
    if (!g && options.allowPartialSquat) {
      const upper = select(
        candidates.map((c) => ({
          side: c.side,
          ids: [c.shoulder, c.hip, c.knee],
        })),
      );
      if (upper) {
        const c = chain(upper.side),
          ref =
            options.reference?.side === upper.side
              ? options.reference
              : undefined;
        const scale = ref?.scale ?? Math.max(0.06, distance(c.shoulder, c.hip)),
          bend = angle(p[c.shoulder], p[c.hip], p[c.knee]);
        const upright =
          p[c.shoulder].y < p[c.hip].y && p[c.hip].y < p[c.knee].y;
        const descent = ref ? (p[c.hip].y - ref.hipY) / scale : 0;
        return {
          ...finish({
            ...base(upper.ids, upper.side),
            estimated: true,
            ready: upright && bend > 155 && (!ref || Math.abs(descent) < 0.12),
            extended: Boolean(ref && bend < 115 && descent > 0.25),
            amplitude: clamp((165 - bend) / 65),
            motion: p[c.hip].y / scale,
          }),
          message: ref
            ? "Cropped squat estimate. Lower your hips, then stand tall; feet and knee depth are not verified."
            : "Cropped squat estimate. Stand tall for fresh calibration before moving.",
        };
      }
    }
    if (!g)
      return unavailable(
        groups.map((g) => g.ids),
        "Show one hip, knee and ankle together. Arms and the far leg may be hidden.",
      );
    const c = chain(g.side),
      bend = angle(p[c.hip], p[c.knee], p[c.ankle]);
    const scale =
      options.reference?.side === g.side
        ? options.reference.scale
        : Math.max(
            0.06,
            (distance(c.hip, c.knee) + distance(c.knee, c.ankle)) * 0.6,
          );
    const upright =
      p[c.hip].y < p[c.knee].y + scale * 0.2 &&
      (!good(c.shoulder) || p[c.shoulder].y < p[c.hip].y);
    return finish({
      ...base(g.ids, g.side),
      ready: upright && bend > 145,
      extended: upright && bend < 115,
      amplitude: clamp((165 - bend) / 80),
      motion: p[c.hip].y / scale,
    });
  }
  if (exercise === "pushup" || exercise === "diamond") {
    const groups = candidates.flatMap((c) =>
      [c.ankle, c.knee].map((end) => ({
        side: c.side,
        ids: [c.shoulder, c.elbow, c.wrist, c.hip, end],
      })),
    );
    const g = select(groups);
    if (!g)
      return unavailable(
        groups.map((g) => g.ids),
        "Show the near shoulder, elbow, wrist and hip, plus a knee or ankle. The far arm may be hidden.",
      );
    const c = chain(g.side),
      end = g.ids[4],
      scale = Math.max(0.06, distance(c.shoulder, c.hip));
    const horizontal =
      Math.abs(p[c.shoulder].x - p[c.hip].x) >
      Math.abs(p[c.shoulder].y - p[c.hip].y) * 0.9;
    const alignment = angle(p[c.shoulder], p[c.hip], p[end]),
      bend = angle(p[c.shoulder], p[c.elbow], p[c.wrist]);
    return finish({
      ...base(g.ids, g.side),
      ready: horizontal && alignment > 135 && bend > 140,
      extended: horizontal && alignment > 130 && bend < 118,
      amplitude: clamp((165 - bend) / 80),
      motion: p[c.shoulder].y / scale,
    });
  }
  if (exercise === "superman") {
    const groups = candidates.map((c) => ({
      side: c.side,
      ids: [c.shoulder, c.wrist, c.hip, c.ankle],
    }));
    const g = select(groups);
    if (!g)
      return unavailable(
        groups.map((g) => g.ids),
        "Show one shoulder, wrist, hip and ankle from the low side view. Far limbs may be hidden.",
      );
    const c = chain(g.side),
      scale = Math.max(0.06, distance(c.shoulder, c.hip)),
      direction = Math.sign(p[c.hip].x - p[c.shoulder].x);
    const horizontal =
      Math.abs(p[c.shoulder].x - p[c.hip].x) >
      Math.abs(p[c.shoulder].y - p[c.hip].y) * 1.1;
    const arms = (p[c.shoulder].y - p[c.wrist].y) / scale,
      legs = (p[c.hip].y - p[c.ankle].y) / scale;
    const reach =
      (p[c.shoulder].x - p[c.wrist].x) * direction > scale * 0.4 &&
      (p[c.ankle].x - p[c.hip].x) * direction > scale * 0.5;
    return finish({
      ...base(g.ids, g.side),
      ready: horizontal && reach,
      extended: horizontal && reach && arms > 0.07 && legs > 0.035,
      amplitude: clamp(Math.min(arms / 0.18, legs / 0.12)),
      motion: (arms + legs) / 2,
    });
  }
  if (exercise === "lunge") {
    // The active anatomical leg must be measured in full; the other ankle is a
    // real stance reference. A hidden far hip does not invalidate the front leg.
    const groups = candidates.map((c) => ({
      side: c.side,
      ids: [
        c.hip,
        c.knee,
        c.ankle,
        chain(c.side === "left" ? "right" : "left").ankle,
      ],
    }));
    const usable = groups.filter((g) =>
      all(g.ids, DETECTOR_CONFIG.alternatingVisibility),
    );
    if (!usable.length)
      return unavailable(
        groups.map((g) => g.ids),
        "Show a hip–knee–ankle chain and both feet so the active side can be identified.",
      );
    const measured = usable.map((g) => {
      const c = chain(g.side),
        other = chain(g.side === "left" ? "right" : "left");
      const scale = Math.max(
        0.06,
        (distance(c.hip, c.knee) + distance(c.knee, c.ankle)) * 0.6,
      );
      const bend = angle(p[c.hip], p[c.knee], p[c.ankle]);
      const otherBend = all([other.hip, other.knee, other.ankle], 0.55)
        ? angle(p[other.hip], p[other.knee], p[other.ankle])
        : undefined;
      const split = Math.abs(p[c.ankle].x - p[other.ankle].x) > scale * 0.65;
      const kneeOverFoot = Math.abs(p[c.knee].x - p[c.ankle].x) < scale * 0.5;
      const forward = Math.abs(p[c.knee].x - p[c.hip].x) > scale * 0.25;
      const distinct = otherBend !== undefined && otherBend - bend > 10;
      return {
        g,
        c,
        scale,
        bend,
        extended:
          bend < 118 && split && (distinct || (forward && kneeOverFoot)),
        strength:
          Math.abs(p[c.knee].x - p[c.hip].x) / scale + (distinct ? 0.5 : 0),
      };
    });
    const active = measured
      .filter((m) => m.extended)
      .sort((a, b) => b.strength - a.strength);
    const selected = active[0] ?? measured[0],
      known =
        active.length === 1 ||
        (active.length === 2 && active[0].strength - active[1].strength > 0.3);
    const legs = candidates.map((c) =>
      all([c.hip, c.knee, c.ankle], 0.55)
        ? angle(p[c.hip], p[c.knee], p[c.ankle])
        : undefined,
    );
    const standing =
      measured.some((m) => m.bend > 140) &&
      legs.every((a) => a === undefined || a > 140) &&
      candidates.every(
        (c) =>
          all([c.knee, c.ankle], 0.55) &&
          p[c.knee].y < p[c.ankle].y &&
          Math.abs(p[c.knee].x - p[c.ankle].x) < selected.scale * 0.45,
      );
    return finish({
      ...base(selected.g.ids),
      ready: standing,
      extended: active.length > 0 && known,
      side: active.length > 0 && known ? selected.g.side : undefined,
      amplitude: clamp((165 - selected.bend) / 80),
      motion: p[selected.c.hip].y / selected.scale,
      message:
        active.length && !known
          ? "Side unclear. Turn slightly so the front knee and both feet are distinguishable."
          : "Stand tall with both feet visible.",
    });
  }
  // Bird Dog uses only a complete opposite arm/leg pair and two support points;
  // support elbows and support ankles are irrelevant and may be floor-occluded.
  const torso = [11, 12, 23, 24];
  const startIds = [...torso, 15, 16, 25, 26];
  const groups = candidates.map((c) => {
    const other = chain(c.side === "left" ? "right" : "left");
    return {
      side: c.side,
      ids: [
        ...torso,
        c.elbow,
        c.wrist,
        other.knee,
        other.ankle,
        other.wrist,
        c.knee,
      ],
    };
  });
  const usable = groups.filter((g) => all(g.ids, 0.55));
  if (!usable.length && !all(startIds, 0.55))
    return unavailable(
      [startIds, ...groups.map((g) => g.ids)],
      "Show the extending arm and opposite leg, plus the supporting hand and knee.",
    );
  const shoulder = { x: (p[11].x + p[12].x) / 2, y: (p[11].y + p[12].y) / 2 },
    hip = { x: (p[23].x + p[24].x) / 2, y: (p[23].y + p[24].y) / 2 };
  const scale = Math.max(
      0.06,
      Math.hypot(hip.x - shoulder.x, hip.y - shoulder.y),
    ),
    direction = Math.sign(hip.x - shoulder.x),
    horizontal =
      Math.abs(hip.x - shoulder.x) > Math.abs(hip.y - shoulder.y) * 0.7;
  const active = usable.filter((g) => {
    const c = chain(g.side),
      other = chain(g.side === "left" ? "right" : "left");
    return (
      horizontal &&
      angle(p[c.shoulder], p[c.elbow], p[c.wrist]) > 145 &&
      angle(p[other.hip], p[other.knee], p[other.ankle]) > 145 &&
      Math.abs(p[c.wrist].y - p[c.shoulder].y) < scale * 0.45 &&
      Math.abs(p[other.ankle].y - p[other.hip].y) < scale * 0.45 &&
      (p[c.shoulder].x - p[c.wrist].x) * direction > scale * 0.4 &&
      (p[other.ankle].x - p[other.hip].x) * direction > scale * 0.5 &&
      p[other.wrist].y > p[other.shoulder].y + scale * 0.25 &&
      p[c.knee].y > p[c.hip].y + scale * 0.25
    );
  });
  const ready =
    all(startIds, 0.55) &&
    horizontal &&
    candidates.every(
      (c) =>
        p[c.wrist].y > p[c.shoulder].y + scale * 0.35 &&
        p[c.knee].y > p[c.hip].y + scale * 0.3,
    );
  const selected = active.length === 1 ? active[0] : undefined;
  const ids = selected?.ids ?? (all(startIds, 0.55) ? startIds : usable[0].ids);
  return finish({
    ...base(ids),
    ready: ready && !selected,
    extended: !!selected,
    side: selected?.side,
    amplitude: selected ? 1 : 0,
    motion: hip.y / scale,
    message:
      "Extend one arm and the opposite leg; keep the other hand and knee supporting you.",
  });
}

/** Raw visibility and pose phases must support the smoothed display geometry. */
export function observeEvidence(
  exercise: ExerciseId,
  frame: PoseFrame,
  side?: Side,
  options: RecognitionOptions = {},
): Observation {
  const observed = observePose(exercise, frame, side, options);
  if (!frame.rawLandmarks) return observed;
  const raw = observePose(
    exercise,
    { ...frame, landmarks: frame.rawLandmarks, rawLandmarks: undefined },
    side,
    options,
  );
  return {
    ...observed,
    visible: raw.visible && observed.visible,
    fresh: raw.fresh !== false && observed.fresh !== false,
    ready: raw.ready && observed.ready,
    extended: raw.extended && observed.extended,
    confidence: Math.min(raw.confidence, observed.confidence),
    missingJoints: raw.visible ? observed.missingJoints : raw.missingJoints,
  };
}
/** Pure state machine. It reports observed movement, never HP, rewards, or medical form approval. */
export class ExerciseDetector {
  private filter = new PoseFilter();
  private reference?: PoseReference;
  private estimatedCycle = false;
  private seatedCandidate?: {
    at: number;
    hipY: number;
    kneeAngle: number;
    side: Side;
    scale: number;
  };
  private lastFrame?: number;
  private lostAt?: number;
  private observedSide?: Side;
  private phase: "initial" | "ready" | "moving" | "return" = "initial";
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
  constructor(
    readonly exerciseId: ExerciseId,
    sessionId: string = globalThis.crypto?.randomUUID?.() ??
      `session-${Date.now()}-${Math.random()}`,
    previousSide?: Side,
    private options: RecognitionOptions = {},
  ) {
    // A paused session may remount after a journal visit or reload. Its accepted
    // side comes from canonical state; its new unit IDs must not collide with
    // the old detector's sequence in that same session.
    const instance =
      globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    this.prefix = `${sessionId}:${instance}`;
    if (
      (exerciseId === "lunge" || exerciseId === "birddog") &&
      (previousSide === "left" || previousSide === "right")
    )
      this.lastSide = previousSide;
  }
  get expectedSide(): Side | undefined {
    return this.lastSide
      ? this.lastSide === "left"
        ? "right"
        : "left"
      : undefined;
  }
  /** Pause invalidates an unfinished cycle but preserves completed units, hold fractions and alternation. */
  pause() {
    this.phase = "initial";
    this.seatedCandidate = undefined;
    this.stableSince = undefined;
    this.lastObservation = undefined;
    this.lastFrame = undefined;
    this.filter.reset();
    this.holding = false;
    this.lastMotion = undefined;
    this.lostAt = undefined;
    this.observedSide = undefined;
  }
  /** Explicitly begin fresh calibration after repositioning or changing chairs.
   * Unlike ordinary pause, removes the old pose from preparation eligibility.
   * Completed unit IDs and accepted anatomical alternation remain untouched.
   */
  beginCalibration(): void {
    this.pause();
    this.reference = undefined;
    this.holdMs = 0;
    this.start = this.peak = this.motionStart = 0;
    this.movement = this.totalMotion = 0;
    this.estimatedCycle = false;
    this.side = undefined;
  }
  /** Acquire a fresh starting reference without changing accepted units or alternation. */
  recalibrate(frame: PoseFrame): boolean {
    const reference = observeEvidence(
      this.exerciseId,
      frame,
      undefined,
      this.options,
    );
    if (
      !reference.visible ||
      !reference.fresh ||
      !reference.ready ||
      !Number.isFinite(frame.timestamp)
    )
      return false;
    this.pause();
    this.holdMs = 0; // Uncredited fractions belong to the old posture.
    this.start = this.peak = reference.amplitude;
    this.motionStart = reference.motion;
    this.movement = this.totalMotion = 0;
    this.side = undefined;
    const side = reference.observedSide,
      c = chain(side ?? "left"),
      p = frame.landmarks.map((v) => ({
        ...v,
        x: (v.x * frame.width) / frame.height,
      }));
    const distance = (a: number, b: number) =>
      Math.hypot(p[a].x - p[b].x, p[a].y - p[b].y);
    const scale =
      this.exerciseId === "sitstand" ||
      (this.exerciseId === "squat" && !reference.estimated)
        ? (distance(c.hip, c.knee) + distance(c.knee, c.ankle)) * 0.6
        : distance(c.shoulder, c.hip);
    this.reference = {
      side,
      scale: Math.max(0.06, scale),
      hipY: p[c.hip].y,
      hipAngle: angle(p[c.shoulder], p[c.hip], p[c.knee]),
      kneeAngle: angle(p[c.hip], p[c.knee], p[c.ankle]),
    };
    this.lastFrame = frame.timestamp;
    this.lastObservation = frame.timestamp;
    this.observedSide = reference.observedSide;
    return true;
  }
  observe(frame: PoseFrame): Observation {
    return observeEvidence(this.exerciseId, frame, this.observedSide, {
      ...this.options,
      reference: this.reference,
    });
  }
  update(frame: PoseFrame): DetectorFeedback {
    if (this.lastFrame !== undefined && frame.timestamp <= this.lastFrame)
      return { state: "ready", message: "Waiting for a new camera frame." };
    if (
      this.lastFrame !== undefined &&
      frame.timestamp - this.lastFrame > DETECTOR_CONFIG.maximumFrameGapMs
    )
      this.pause();
    const processed = this.filter.process(frame),
      observation = this.observe(processed);
    this.lastFrame = frame.timestamp;
    if (observation.visible && observation.fresh)
      this.observedSide ??= observation.observedSide;
    // Chair height is learned only after a stable seated interval. A single passing
    // frame during a descent must not establish an artificially low seat reference.
    if (this.exerciseId === "sitstand" && !this.reference) {
      if (
        !observation.ready ||
        !observation.fresh ||
        !observation.visible ||
        !observation.observedSide
      ) {
        this.seatedCandidate = undefined;
        return this.updateObservation(
          { ...observation, ready: false, extended: false },
          frame.timestamp,
        );
      }
      const side = observation.observedSide,
        c = chain(side),
        p = processed.landmarks.map((v) => ({
          ...v,
          x: (v.x * processed.width) / processed.height,
        }));
      const kneeAngle = angle(p[c.hip], p[c.knee], p[c.ankle]);
      const scale = Math.max(
        0.06,
        (Math.hypot(p[c.hip].x - p[c.knee].x, p[c.hip].y - p[c.knee].y) +
          Math.hypot(p[c.knee].x - p[c.ankle].x, p[c.knee].y - p[c.ankle].y)) *
          0.6,
      );
      const candidate = this.seatedCandidate;
      if (
        !candidate ||
        candidate.side !== side ||
        Math.abs(candidate.hipY - p[c.hip].y) > candidate.scale * 0.06 ||
        Math.abs(candidate.kneeAngle - kneeAngle) > 8
      ) {
        this.seatedCandidate = {
          at: frame.timestamp,
          hipY: p[c.hip].y,
          kneeAngle,
          side,
          scale,
        };
      } else if (frame.timestamp - candidate.at >= DETECTOR_CONFIG.stableMs) {
        this.recalibrate(processed);
        this.phase = "ready";
        this.lastObservation = undefined;
        return this.updateObservation(this.observe(processed), frame.timestamp);
      }
      return {
        state: "ready",
        status: "insufficient",
        message:
          "Sit still on your chair while its starting height is calibrated.",
      };
    }
    // Normal startup also captures body proportions once a valid initial pose exists.
    if (
      !this.reference &&
      observation.ready &&
      observation.fresh &&
      !observation.estimated
    ) {
      this.recalibrate(processed);
      this.lastObservation = undefined;
    }
    return this.updateObservation(observation, frame.timestamp);
  }
  updateObservation(o: Observation, now: number): DetectorFeedback {
    if (!Number.isFinite(now))
      return {
        state: "tracking-lost",
        status: "insufficient",
        message: "Waiting for a valid camera timestamp.",
      };
    if (
      !o.visible ||
      o.fresh === false ||
      !Number.isFinite(o.confidence) ||
      o.confidence < DETECTOR_CONFIG.visibility
    ) {
      this.lostAt ??= now;
      if (now - this.lostAt > DETECTOR_CONFIG.occlusionRetentionMs) {
        this.pause();
        this.lostAt = now;
      }
      // Brief occlusion retains cycle state, not evidence or elapsed valid time.
      this.stableSince = undefined;
      this.lastObservation = undefined;
      this.holding = false;
      this.lastMotion = undefined;
      return {
        state: "tracking-lost",
        status: o.status ?? "partial",
        message:
          o.message ?? "Required joints are hidden. Reposition the camera.",
        missingJoints: o.missingJoints,
        nextSide: this.expectedSide,
      };
    }
    if (this.lostAt !== undefined) {
      if (now - this.lostAt > DETECTOR_CONFIG.occlusionRetentionMs)
        this.pause();
      this.lostAt = undefined;
    }
    if (this.lastObservation !== undefined && now <= this.lastObservation)
      return { state: "ready", message: "Waiting for a new frame." };
    let dt =
      this.lastObservation === undefined ? 0 : now - this.lastObservation;
    if (dt > DETECTOR_CONFIG.maximumFrameGapMs) {
      this.pause();
      dt = 0;
    }
    this.lastObservation = now;
    if (this.exerciseId === "superman") {
      if (o.extended) {
        this.stableSince ??= now;
        if (now - this.stableSince >= DETECTOR_CONFIG.stableMs) {
          if (this.holding) this.holdMs += dt;
          this.holding = true;
          if (this.holdMs >= 1000) {
            this.holdMs -= 1000;
            return {
              state: "hold",
              status: "valid",
              message: "One verified second.",
              unit: this.unit(now, o, 0.5 + 0.5 * o.amplitude),
            };
          }
        }
        return { state: "hold", message: "Hold steady. Breathe normally." };
      }
      this.stableSince = undefined;
      this.holding = false;
      return {
        state: "ready",
        message: "Lift arms and legs into view. Valid time is saved.",
      };
    }
    if (this.phase === "initial") {
      if (o.ready) {
        this.stableSince ??= now;
        if (now - this.stableSince >= DETECTOR_CONFIG.stableMs) {
          this.phase = "ready";
          this.stableSince = undefined;
        }
      } else this.stableSince = undefined;
      return { state: "ready", message: "Settle into the starting position." };
    }
    if (this.phase === "ready") {
      this.motionStart = o.motion;
      this.lastMotion = o.motion;
      if (!o.ready) {
        this.phase = "moving";
        this.start = now;
        this.peak = o.amplitude;
        this.side = undefined;
        this.estimatedCycle = Boolean(o.estimated);
        this.movement = 0;
        this.totalMotion = 0;
      }
      return {
        state: "moving",
        message: this.expectedSide
          ? `Next: ${this.expectedSide} side.`
          : "Begin one controlled repetition.",
      };
    }
    this.estimatedCycle ||= Boolean(o.estimated);
    this.peak = Math.max(this.peak, o.amplitude);
    this.movement = Math.max(
      this.movement,
      Math.abs(o.motion - this.motionStart),
    );
    this.totalMotion += Math.abs(o.motion - (this.lastMotion ?? o.motion));
    this.lastMotion = o.motion;
    if (this.phase === "moving") {
      if (o.extended) {
        if (this.stableSince === undefined || this.side !== o.side) {
          this.stableSince = now;
          this.side = o.side;
        }
        if (now - this.stableSince >= DETECTOR_CONFIG.stableMs) {
          this.phase = "return";
          this.stableSince = undefined;
        }
      } else {
        this.stableSince = undefined;
        if (o.ready) {
          this.phase = "ready";
          return {
            state: "ready",
            rejected: true,
            message: "Incomplete movement. Try a full controlled repetition.",
          };
        }
      }
      return {
        state: "moving",
        message: "Move through a comfortable full range.",
      };
    }
    if (
      (this.exerciseId === "lunge" || this.exerciseId === "birddog") &&
      o.extended &&
      o.side &&
      this.side &&
      o.side !== this.side
    ) {
      this.phase = "initial";
      this.stableSince = undefined;
      return {
        state: "ready",
        status: "incomplete",
        rejected: true,
        message: "Return to the starting position before changing sides.",
        nextSide: this.expectedSide,
      };
    }
    if (o.ready) {
      this.stableSince ??= now;
      if (now - this.stableSince >= DETECTOR_CONFIG.returnMs) {
        this.phase = "ready";
        this.stableSince = undefined;
        if (now - this.start < DETECTOR_CONFIG.minimumCycleMs)
          return {
            state: "ready",
            rejected: true,
            message: "Slow down and complete the full movement.",
          };
        if (
          (this.exerciseId === "lunge" || this.exerciseId === "birddog") &&
          (!this.side || this.side === this.lastSide)
        )
          return {
            state: "ready",
            rejected: true,
            message: `Alternate sides. Next: ${this.expectedSide ?? "either clearly visible side"}.`,
          };
        if (
          (this.exerciseId === "squat" ||
            this.exerciseId === "pushup" ||
            this.exerciseId === "diamond" ||
            this.exerciseId === "sitstand" ||
            this.exerciseId === "wallpushup" ||
            this.exerciseId === "bridge") &&
          this.movement < 0.08
        )
          return {
            state: "ready",
            rejected: true,
            message:
              "Keep the camera still and move your torso through the repetition.",
          };
        const rhythm = clamp((now - this.start) / 1800, 0.4, 1);
        const control =
          this.totalMotion > 0
            ? clamp((2 * this.movement) / this.totalMotion, 0.4, 1)
            : 0.8;
        const quality = clamp(
          0.5 * this.peak + 0.3 * control + 0.2 * rhythm,
          0.35,
          1,
        );
        const unit = this.unit(now, o, quality, this.side);
        this.lastSide = this.side;
        return {
          state: "ready",
          status: "valid",
          unit,
          nextSide: this.expectedSide,
          message: "Verified repetition. Well done.",
        };
      }
    } else this.stableSince = undefined;
    return {
      state: "return",
      message:
        this.exerciseId === "sitstand"
          ? "Sit back on the same chair and pause briefly. No need to go lower."
          : "Return fully to the starting position.",
    };
  }
  private unit(
    timestamp: number,
    o: Observation,
    quality: number,
    side?: Side,
  ): ExerciseUnit {
    return {
      id: `${this.prefix}:${++this.sequence}`,
      exerciseId: this.exerciseId,
      quality: clamp(quality),
      confidence: o.confidence,
      side,
      verified: !this.estimatedCycle && !o.estimated,
      timestamp,
    };
  }
}

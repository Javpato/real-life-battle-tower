import type { ExerciseId } from "../core/contracts";
/** Short distance-readable cues; complete original guidance stays one action away. */
export const STARTING_CUES: Record<ExerciseId, string> = {
  squat: "Stand tall · feet planted",
  lunge: "Stand tall · both feet in view",
  pushup: "High plank · arms extended",
  diamond: "High plank · hands close together",
  superman: "Lie face down · reach arms and legs long",
  birddog: "Hands under shoulders · knees under hips",
  sitstand: "Sit tall · feet flat · stable chair",
  wallpushup: "Face the wall · palms at chest height",
  bridge: "On your back · knees bent · feet planted",
};

import type { ExerciseHudProps } from "./exerciseUi";
/** One actionable headline, based only on current observation metadata. */
export function exerciseHeadline(
  p: Pick<
    ExerciseHudProps,
    | "exerciseId"
    | "skillId"
    | "startingPosition"
    | "assisted"
    | "status"
    | "message"
    | "nextSide"
    | "paused"
    | "complete"
    | "missingJoints"
  >,
): string {
  if (p.status === "error") return "CAMERA NEEDS ATTENTION";
  if (p.paused || p.status === "paused") return "REST — NO TIME LIMIT";
  if (p.complete) return "SERIES COMPLETE";
  if (p.status === "off") return "CAMERA IS OFF";
  if (p.status === "loading") return "STARTING CAMERA";
  if (p.status === "no-body") return "MOVE INTO CAMERA VIEW";
  if (p.status === "partial" || p.status === "insufficient") {
    // Recognizer names are anatomical. Never infer a hidden side from the mirrored image.
    const joint = p.missingJoints?.find((j) =>
      /^(left|right) (shoulder|elbow|wrist|hip|knee|ankle)$/.test(j),
    );
    if (joint) return `SHOW YOUR ${joint.toUpperCase()}`;
    const observedInstruction = p.message.match(
      /(?:^|\. )((?:Show|Keep) [^.]+)\./,
    )?.[1];
    if (observedInstruction && observedInstruction.length <= 64)
      return observedInstruction.toUpperCase();
    if (
      /^(Settle into the illustrated starting position|Begin seated|Start with hips down|Keep hands against the wall|Stand tall with both feet visible|Extend one arm and the opposite leg)/i.test(
        p.message,
      )
    )
      return (p.startingPosition ?? STARTING_CUES[p.exerciseId]).toUpperCase();
    if (/^Side unclear\./i.test(p.message))
      return "SHOW YOUR FRONT KNEE + BOTH FEET";
    return "KEEP REQUIRED JOINTS IN VIEW";
  }
  if (p.status === "recalibrating") return "PREPARE TO RECALIBRATE";
  if (p.status === "countdown") return "GET READY";
  if (p.status === "ready")
    return p.skillId
      ? "READY · MOVE WHEN COMFORTABLE"
      : STARTING_CUES[p.exerciseId].toUpperCase();
  if (p.assisted && p.status === "moving") return "MOVE WITH CONTROL";
  if (p.assisted && p.status === "return") return "RETURN TO YOUR START";
  if (p.status === "return") return RETURN_CUES[p.exerciseId];
  if (p.status === "moving") return MOVEMENT_CUES[p.exerciseId];
  if (p.status === "hold") return "HOLD STEADY";
  if (p.nextSide && (p.status === "valid" || p.status === "incomplete"))
    return p.skillId
      ? `${p.nextSide.toUpperCase()} SIDE NEXT`
      : p.exerciseId === "birddog"
        ? `${p.nextSide.toUpperCase()} ARM + OPPOSITE LEG NEXT`
        : `${p.nextSide.toUpperCase()} LEG NEXT`;
  if (p.status === "incomplete")
    return /slow down/i.test(p.message)
      ? "SLOW DOWN · COMPLETE THE MOVEMENT"
      : "TRY THE FULL MOVEMENT";
  if (p.status === "valid") return "NICE WORK!";
  return "KEEP GOING";
}

export const MOVEMENT_CUES: Record<ExerciseId, string> = {
  squat: "LOWER YOUR HIPS WITH CONTROL",
  lunge: "BEND YOUR FRONT KNEE",
  pushup: "LOWER YOUR TORSO",
  diamond: "LOWER YOUR TORSO",
  superman: "LIFT ARMS AND LEGS GENTLY",
  birddog: "EXTEND ARM + OPPOSITE LEG",
  sitstand: "STAND UP FROM YOUR CHAIR",
  wallpushup: "BRING YOUR CHEST TOWARD THE WALL",
  bridge: "RAISE YOUR HIPS",
};
export const RETURN_CUES: Record<ExerciseId, string> = {
  squat: "NOW STAND TALL",
  lunge: "RETURN BEFORE CHANGING LEGS",
  pushup: "PRESS UP · EXTEND YOUR ARMS",
  diamond: "PRESS UP · EXTEND YOUR ARMS",
  superman: "LOWER GENTLY TO REST",
  birddog: "RETURN TO HANDS AND KNEES",
  sitstand: "SIT DOWN WITH CONTROL",
  wallpushup: "PRESS AWAY FROM THE WALL",
  bridge: "LOWER YOUR HIPS TO THE FLOOR",
};

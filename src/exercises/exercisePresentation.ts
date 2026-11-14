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
export function exerciseHeadline(p: Pick<ExerciseHudProps, "exerciseId" | "status" | "message" | "nextSide" | "paused" | "complete" | "missingJoints">): string {
  if (p.status === "error") return "CAMERA NEEDS ATTENTION";
  if (p.paused || p.status === "paused") return "REST — NO TIME LIMIT";
  if (p.complete) return "SERIES COMPLETE";
  if (p.status === "off") return "CAMERA IS OFF";
  if (p.status === "loading") return "STARTING CAMERA";
  if (p.status === "no-body") return "MOVE INTO CAMERA VIEW";
  if (p.status === "partial" || p.status === "insufficient") {
    // Recognizer names are anatomical. Never infer a hidden side from the mirrored image.
    const joint = p.missingJoints?.find(j => /^(left|right) (shoulder|elbow|wrist|hip|knee|ankle)$/.test(j));
    if (joint) return `SHOW YOUR ${joint.toUpperCase()}`;
    const observedInstruction = p.message.match(/(?:^|\. )((?:Show|Keep) [^.]+)\./)?.[1];
    if (observedInstruction && observedInstruction.length <= 64) return observedInstruction.toUpperCase();
    return "KEEP REQUIRED JOINTS IN VIEW";
  }
  if (p.status === "countdown") return "GET READY";
  if (p.status === "ready") return STARTING_CUES[p.exerciseId].toUpperCase();
  if (p.status === "return") return "RETURN TO START";
  if (p.status === "hold") return "HOLD STEADY";
  if (p.nextSide && (p.status === "valid" || p.status === "incomplete"))
    return p.exerciseId === "birddog" ? `${p.nextSide.toUpperCase()} ARM + OPPOSITE LEG NEXT` : `${p.nextSide.toUpperCase()} LEG NEXT`;
  if (p.status === "incomplete") return /slow down/i.test(p.message) ? "SLOW DOWN · COMPLETE THE MOVEMENT" : "TRY THE FULL MOVEMENT";
  if (p.status === "valid") return "NICE WORK!";
  return "KEEP GOING";
}

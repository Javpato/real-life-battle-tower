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

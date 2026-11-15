import type { ExerciseId } from "../core/contracts";
import type { FlashTimerProps } from "./FlashTimer";
export type ExerciseVisualState =
  | "no-body"
  | "partial"
  | "insufficient"
  | "ready"
  | "moving"
  | "return"
  | "valid"
  | "incomplete"
  | "hold"
  | "paused"
  | "off"
  | "loading"
  | "error"
  | "countdown"
  | "recalibrating";
export type ExerciseHudProps = {
  flash?: FlashTimerProps;
  exerciseId: ExerciseId;
  guideSetup?: string;
  guideCamera?: string;
  startingPosition?: string;
  sessionId?: string;
  progress: number;
  target: number;
  status: ExerciseVisualState;
  message: string;
  missingJoints?: string[];
  nextSide?: "left" | "right";
  quality: number | null;
  countdown?: number;
  paused: boolean;
  muted?: boolean;
  voiceEnabled?: boolean;
  active: boolean;
  complete?: boolean;
};

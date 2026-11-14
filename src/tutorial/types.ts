/** Targets are exact data-guide attribute values. Hosts own progression and persistence. */
export type GuideStep = {
  id: string;
  target?: string;
  title: string;
  body: string;
  /** Omit for steps completed only by the real gameplay action. */
  actionLabel?: string;
  /** Instruction shown if the target is hidden, absent, or outside the viewport. */
  missingTargetBody?: string;
};
export type GuideScope =
  | "battle"
  | "camera"
  | "inventory"
  | "map"
  | "shop"
  | "alchemy"
  | "quest"
  | "settings"
  | "devices"
  | "journal-today"
  | "journal-food"
  | "journal-activity"
  | "journal-progress"
  | "journal-reports"
  | "journal-settings";
export type GuideSection = {
  id: GuideScope;
  title: string;
  introduction: string;
  steps: readonly GuideStep[];
};

import type { ExerciseId } from "../core/contracts";
import ExercisePoseArt from "../tower/ExercisePoseArt";

export type HomeExerciseId = "sitstand" | "wallpushup" | "bridge";
export const EXERCISE_GUIDES: Record<
  ExerciseId | HomeExerciseId,
  {
    title: string;
    setup: string;
    movement: string;
    camera: string;
    note: string;
    source?: string;
  }
> = {
  sitstand: {
    title: "Root Rise · Chair sit-to-stand",
    setup:
      "Sit near the front of a firm chair, feet flat and about hip-width apart. Put the chair against a wall so it cannot slide. Begin resting on the seat and hold still so the camera can learn your chair height.",
    movement:
      "Lean slightly forward, stand up, then sit back onto the same seat and pause briefly. You do not need to lower your hips below the seat. One seated → standing → seated cycle counts once.",
    camera:
      "Side view · show one shoulder, hip, knee and ankle; the far arm may be hidden",
    note: "Use a stable chair without wheels. Rest whenever you need; this game does not verify the chair itself.",
    source: "https://www.nhs.uk/live-well/exercise/strength-exercises/",
  },
  wallpushup: {
    title: "Wall Pulse · Wall push-up",
    setup:
      "Face a clear wall at about arm’s length. Place your palms against it around chest height, feet planted, and begin with your elbows comfortably extended.",
    movement:
      "Bend your elbows to bring your chest toward the wall, then push back to your starting position. Move your shoulders and torso together; a head nod alone does not count.",
    camera:
      "Side view · near shoulder, elbow, wrist and hip visible; camera around waist height",
    note: "Choose a comfortable distance from the wall. Keep your movement controlled and stop when you need to.",
    source: "https://www.nhs.uk/live-well/exercise/strength-exercises/",
  },
  bridge: {
    title: "Meadow Bridge · Glute bridge",
    setup:
      "Lie on your back with knees bent and feet planted about hip-width apart. Let your shoulders and hips rest on the floor, with arms relaxed beside you.",
    movement:
      "Raise your hips gently while your shoulders and feet stay supported, then lower to the floor. One lift and complete return counts once.",
    camera:
      "Low side view · show one shoulder, hip and knee. Feet are not checked when outside the frame",
    note: "Lift through a comfortable range without forcing your back into an arch. This is a game exercise, not a rehabilitation prescription.",
    source:
      "https://www.cuh.nhs.uk/patient-information/general-stability-exercises1/",
  },
  squat: {
    title: "Earthbound · Squat",
    setup:
      "Stand upright with feet about shoulder-width apart, knees comfortably straight and hands in front of your chest. Keep the visible hip, knee and ankle in view.",
    movement:
      "Lower your hips, then return to standing. Keep the movement controlled.",
    camera:
      "Side or slight three-quarter view · one hip, knee and ankle visible",
    note: "Small bounces do not count. Stay within a comfortable range.",
  },
  lunge: {
    title: "Trailblazer · Lunge",
    setup:
      "Stand upright with feet under your hips and both knees comfortably straight. Leave space to step forward with either leg, then return to this position.",
    movement: "Step, lower, and return. Alternate your left and right legs.",
    camera: "Side / slight three-quarter view · both legs visible",
    note: "The camera must distinguish both anatomical sides. Reposition if a leg is hidden.",
  },
  pushup: {
    title: "Iron Pulse · Push-up",
    setup:
      "Begin at the top of a push-up: palms under your shoulders, elbows extended, toes on the floor and shoulders, hips and heels roughly in one line.",
    movement: "Lower your torso by bending your elbows, then press back up.",
    camera: "Low side view · near shoulder, elbow, wrist and body line visible",
    note: "Moving only your head does not count. You can stop at any time.",
  },
  diamond: {
    title: "Diamond Strike · Diamond push-up",
    setup:
      "Begin at the top of a push-up with hands close together under your chest, elbows extended and your body in a straight line. Finger placement is your choice and is not camera-verified.",
    movement: "Lower your torso with control, then press back to the top.",
    camera: "Low side view · near arm and body line visible",
    note: "Hand and finger placement is demonstrated, but not verified by the camera.",
  },
  superman: {
    title: "Skykeeper · Superman",
    setup:
      "Lie face down, legs extended behind you and arms reaching forward. Begin with arms and legs resting, then gently raise them without lifting your abdomen. Keep your gaze toward the floor.",
    movement:
      "Gently lift your arms and legs. Each visibly held second counts.",
    camera: "Camera near floor height · visible wrist, shoulder, hip and ankle",
    note: "Breathe normally. Lowering or leaving the frame pauses valid time.",
  },
  birddog: {
    title: "Wild Balance · Bird Dog",
    setup:
      "Start on all fours: palms under shoulders, knees under hips and back steady. Both hands and knees begin on the floor. Extend the named arm with the opposite leg, then return to all fours.",
    movement:
      "Extend one arm and the opposite leg, hold briefly, then return. Alternate sides.",
    camera: "Three-quarter view · both arms and legs visible",
    note: "The indicated side names the extended arm. Same-side arm and leg do not count.",
  },
};

export default function ExerciseDemo({
  exerciseId,
}: {
  exerciseId: ExerciseId | HomeExerciseId;
}) {
  const guide = EXERCISE_GUIDES[exerciseId];
  return (
    <div className="exercise-demo">
      <ExercisePoseArt exerciseId={exerciseId} title={guide.title}/>
      <strong>{guide.title}</strong>
      <p>
        <b>Starting position:</b> {guide.setup}
      </p>
      <p>
        <b>Movement:</b> {guide.movement}
      </p>
      <p className="exercise-note">{guide.camera}</p>
      <small>{guide.note}</small>
      {guide.source && (
        <p className="exercise-source">
          <a href={guide.source} target="_blank" rel="noreferrer">
            Exercise reference · NHS
          </a>{" "}
          · original game illustration
        </p>
      )}
    </div>
  );
}

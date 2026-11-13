import type { ExerciseId } from "../core/contracts";

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
      "Sit near the front of a firm chair, feet flat and about hip-width apart. Put the chair against a wall so it cannot slide. Begin with your hips on the seat and hands resting comfortably.",
    movement:
      "Lean your chest slightly forward, stand up smoothly, then lower back onto the chair. A complete seated → standing → seated cycle counts once.",
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
    camera: "Low side view · show one shoulder, hip, knee and ankle",
    note: "Lift through a comfortable range without forcing your back into an arch. This is a game exercise, not a rehabilitation prescription.",
    source:
      "https://www.cuh.nhs.uk/patient-information/general-stability-exercises1/",
  },
  squat: {
    title: "Groundbreaker · Squat",
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
    title: "Diamond Strike",
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
    title: "Balance Arc · Bird Dog",
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
  const standing = exerciseId === "squat" || exerciseId === "lunge";
  const hold = exerciseId === "superman";
  return (
    <div className="exercise-demo">
      <svg
        viewBox="0 0 280 120"
        aria-label={`${guide.title} starting and exercise position`}
        role="img"
      >
        <path d="M12 108H268" stroke="#314855" strokeWidth="3" />
        <g
          stroke="#7fe6b1"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        >
          {exerciseId === "sitstand" ? (
            <>
              <path d="M28 72H70V108M28 72V108M28 44V72" stroke="#d9b773" />
              <circle cx="47" cy="27" r="8" />
              <path d="M47 37V69L83 71L84 105M47 46L67 62" />
              <circle cx="207" cy="19" r="8" />
              <path d="M207 29V67L192 105M207 67L222 105M207 42L225 60" />
            </>
          ) : exerciseId === "wallpushup" ? (
            <>
              <path d="M111 13V108M267 13V108" stroke="#d9b773" />
              <circle cx="60" cy="25" r="8" />
              <path d="M62 35L52 69L42 105M62 40L110 40" />
              <circle cx="229" cy="30" r="8" />
              <path d="M230 40L213 72L193 105M232 45L246 66L265 42" />
            </>
          ) : exerciseId === "bridge" ? (
            <>
              <circle cx="23" cy="99" r="7" />
              <path d="M33 104L72 104L94 70L120 104M40 104L61 105" />
              <circle cx="174" cy="99" r="7" />
              <path d="M184 104L215 75L240 63L266 104M190 104L211 105" />
            </>
          ) : standing ? (
            <>
              <circle cx="60" cy="18" r="8" />
              <path d="M60 28V65M60 40L40 60M60 40L80 60M60 65L45 105M60 65L75 105" />
              <circle cx="205" cy="35" r="8" />
              <path
                d={
                  exerciseId === "lunge"
                    ? "M205 45L200 65L175 77L175 105M200 65L225 95L245 105M205 48L175 52"
                    : "M205 45L195 70L225 78L215 105M195 70L175 82L180 105M205 49L235 55"
                }
              />
            </>
          ) : hold ? (
            <>
              <circle cx="28" cy="91" r="7" />
              <path d="M38 99L88 100L124 103M40 99L12 101" />
              <circle cx="180" cy="85" r="7" />
              <path d="M191 94L230 95L267 79M194 94L160 78" />
            </>
          ) : exerciseId === "birddog" ? (
            <>
              <circle cx="30" cy="57" r="8" />
              <path d="M42 66L91 66M45 67L45 104M91 66L91 103L121 104" />
              <circle cx="181" cy="59" r="8" />
              <path d="M193 69L230 70L267 70M195 69L157 69M200 71L200 104M230 71L230 104" />
            </>
          ) : (
            <>
              <circle cx="29" cy="54" r="8" />
              <path d="M41 62L86 78L124 101M44 63L44 104" />
              <circle cx="176" cy="76" r="8" />
              <path d="M187 84L225 93L264 103M192 85L212 96L190 104" />
            </>
          )}
        </g>
        <path
          d="M130 56H146M141 51L146 56L141 61"
          stroke="#e8c16e"
          strokeWidth="3"
          fill="none"
        />
      </svg>
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

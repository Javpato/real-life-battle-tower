import type { ExerciseId } from '../core/contracts';

export const EXERCISE_GUIDES: Record<ExerciseId, { title: string; setup: string; movement: string; camera: string; note: string }> = {
  squat: { title: 'Groundbreaker · Squat', setup: 'Stand with feet comfortably apart.', movement: 'Lower your hips, then return to standing. Keep the movement controlled.', camera: 'Side or three-quarter view · whole body visible', note: 'Small bounces do not count. Stay within a comfortable range.' },
  lunge: { title: 'Trailblazer · Lunge', setup: 'Begin standing. Leave room to step forward.', movement: 'Step, lower, and return. Alternate your left and right legs.', camera: 'Side / slight three-quarter view · both legs visible', note: 'The camera must distinguish both anatomical sides. Reposition if a leg is hidden.' },
  pushup: { title: 'Iron Pulse · Push-up', setup: 'Begin in a high push-up position.', movement: 'Lower your torso by bending your elbows, then press back up.', camera: 'Low side view · hands, shoulders, hips and feet visible', note: 'Moving only your head does not count. You can stop at any time.' },
  diamond: { title: 'Diamond Strike', setup: 'Begin a push-up with your hands close together.', movement: 'Lower your torso with control, then press back to the top.', camera: 'Low side view · whole body visible', note: 'Hand and finger placement is demonstrated, but not verified by the camera.' },
  superman: { title: 'Skykeeper · Superman', setup: 'Lie face down with room for arms and legs.', movement: 'Gently lift your arms and legs. Each visibly held second counts.', camera: 'Low side view · wrists, shoulders, hips and ankles visible', note: 'Breathe normally. Lowering or leaving the frame pauses valid time.' },
  birddog: { title: 'Balance Arc · Bird Dog', setup: 'Start on hands and knees.', movement: 'Extend one arm and the opposite leg, hold briefly, then return. Alternate sides.', camera: 'Three-quarter view · both arms and legs visible', note: 'The indicated side names the extended arm. Same-side arm and leg do not count.' },
};

export default function ExerciseDemo({ exerciseId }: { exerciseId: ExerciseId }) {
  const guide = EXERCISE_GUIDES[exerciseId];
  const standing = exerciseId === 'squat' || exerciseId === 'lunge';
  const hold = exerciseId === 'superman';
  return <div className="exercise-demo">
    <svg viewBox="0 0 280 120" aria-label={`${guide.title} starting and exercise position`} role="img">
      <path d="M12 108H268" stroke="#314855" strokeWidth="3" />
      <g stroke="#7fe6b1" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {standing ? <><circle cx="60" cy="18" r="8" /><path d="M60 28V65M60 40L40 60M60 40L80 60M60 65L45 105M60 65L75 105" /><circle cx="205" cy="35" r="8" /><path d={exerciseId === 'lunge' ? 'M205 45L200 65L175 77L175 105M200 65L225 95L245 105M205 48L175 52' : 'M205 45L195 70L225 78L215 105M195 70L175 82L180 105M205 49L235 55'} /></> : <><circle cx="30" cy="51" r="8" /><path d="M40 56L90 65L115 95M42 57L44 100M90 65L80 96" /><circle cx="174" cy={hold ? 70 : 55} r="8" /><path d={hold ? 'M182 78L224 80L260 66M185 78L155 64' : exerciseId === 'birddog' ? 'M182 60L218 65L260 65M185 60L150 61M187 60L190 100M218 65L212 98' : 'M183 65L225 76L260 98M188 66L178 88L200 101'} /></>}
      </g><path d="M130 56H146M141 51L146 56L141 61" stroke="#e8c16e" strokeWidth="3" fill="none" />
    </svg>
    <strong>{guide.title}</strong><p>{guide.setup} {guide.movement}</p><p className="exercise-note">{guide.camera}</p><small>{guide.note}</small>
  </div>;
}

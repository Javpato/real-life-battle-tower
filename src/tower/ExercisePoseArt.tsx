import { skillGuide } from "./skillGuides";
import "./exercise-pose-art.css";
/** Text-only until a reviewed illustration of this exact movement exists.
 * Never reuse a generic pose as if it demonstrated another exercise. */
export default function ExercisePoseArt({
  exerciseId,
  title,
}: {
  exerciseId: string;
  title: string;
}) {
  const aliases: Record<string, string> = {
    wallpushup: "wall-pushup",
    diamond: "diamond",
    sitstand: "sitstand",
    bridge: "glute-bridge",
  };
  const guide = skillGuide(aliases[exerciseId] ?? exerciseId);
  return (
    <figure
      className="tower-exercise-pose"
      aria-label={`${title} movement guide`}
    >
      <figcaption>{title} · movement guide</figcaption>
      <ol>
        <li>
          <strong>01 · START</strong>
          <p>{guide.setup}</p>
        </li>
        <li>
          <strong>02 · MOVE</strong>
          <p>{guide.movement}</p>
        </li>
      </ol>
    </figure>
  );
}

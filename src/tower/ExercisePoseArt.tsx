import { useEffect, useRef, useState } from "react";
import { skillGuide } from "./skillGuides";
import { exerciseMotionMap, type Pose } from "./exerciseMotionMaps";
import { exerciseProfile, CAMERA_VIEWS } from "./exerciseProfiles";
import "./exercise-pose-art.css";

const aliases: Record<string, string> = {
  wallpushup: "wall-pushup",
  bridge: "glute-bridge",
};
const leftEdges: Array<[keyof Pose, keyof Pose]> = [
  ["ls", "le"],
  ["le", "lw"],
  ["lh", "lk"],
  ["lk", "la"],
];
const rightEdges: Array<[keyof Pose, keyof Pose]> = [
  ["rs", "re"],
  ["re", "rw"],
  ["rh", "rk"],
  ["rk", "ra"],
];
function Body({ pose, ghost = false }: { pose: Pose; ghost?: boolean }) {
  const shoulder = [
    (pose.ls[0] + pose.rs[0]) / 2,
    (pose.ls[1] + pose.rs[1]) / 2,
  ];
  const hip = [(pose.lh[0] + pose.rh[0]) / 2, (pose.lh[1] + pose.rh[1]) / 2];
  const spine = pose.spine ?? [
    (shoulder[0] + hip[0]) / 2,
    (shoulder[1] + hip[1]) / 2,
  ];
  return (
    <g className={ghost ? "motion-body motion-ghost" : "motion-body"}>
      <path
        className="motion-trunk"
        d={`M${pose.head.join(",")} L${shoulder.join(",")} Q${spine.join(",")} ${hip.join(",")}`}
      />
      <path
        className="motion-trunk"
        d={`M${pose.ls.join(",")} L${pose.rs.join(",")} M${pose.lh.join(",")} L${pose.rh.join(",")}`}
      />
      {[rightEdges, leftEdges].map((edges, side) => (
        <g key={side} className={side === 0 ? "motion-right" : "motion-left"}>
          {edges.map(([a, b]) => (
            <line
              key={a + b}
              x1={pose[a]![0]}
              y1={pose[a]![1]}
              x2={pose[b]![0]}
              y2={pose[b]![1]}
            />
          ))}
          {(side === 0
            ? ["rs", "re", "rw", "rh", "rk", "ra"]
            : ["ls", "le", "lw", "lh", "lk", "la"]
          ).map((k) => (
            <circle
              key={k}
              cx={pose[k as keyof Pose]![0]}
              cy={pose[k as keyof Pose]![1]}
              r="3.5"
            />
          ))}
        </g>
      ))}
      <circle
        className="motion-head"
        cx={pose.head[0]}
        cy={pose.head[1]}
        r="10"
      />
    </g>
  );
}

/** A labelled kinematic teaching diagram, not a character sprite, measured pose,
 * technique score, or demand to match the illustrated range. */
export default function ExercisePoseArt({
  exerciseId,
  title,
}: {
  exerciseId: string;
  title: string;
}) {
  const id = aliases[exerciseId] ?? exerciseId;
  const guide = skillGuide(id),
    map = exerciseMotionMap(id),
    profile = exerciseProfile(id)!;
  const figure = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0),
    [playing, setPlaying] = useState(false),
    [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      const reduce =
        query.matches || !!figure.current?.closest(".bt-reduced-motion");
      setReducedMotion(reduce);
      if (reduce) setPlaying(false);
    };
    sync();
    query.addEventListener("change", sync);
    const root = figure.current?.closest(".bt");
    const observer = new MutationObserver(sync);
    if (root)
      observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => {
      query.removeEventListener("change", sync);
      observer.disconnect();
    };
  }, []);
  useEffect(() => {
    setIndex(0);
    setPlaying(false);
  }, [id]);
  useEffect(() => {
    if (!playing || reducedMotion) return;
    const timer = window.setInterval(
      () => setIndex((value) => (value + 1) % map.frames.length),
      1800,
    );
    return () => window.clearInterval(timer);
  }, [playing, reducedMotion, map.frames.length]);
  const active = map.frames[index % map.frames.length],
    start = map.frames[0].pose;
  const wallX = id === "wall-sit" ? 96 : 239;
  function select(value: number) {
    setPlaying(false);
    setIndex(value);
  }
  return (
    <figure
      ref={figure}
      className="tower-exercise-pose"
      aria-label={`${title} movement guide`}
      data-motion-skill={id}
    >
      <figcaption>
        <span>VISUAL LEARN</span>
        <strong>{title}</strong>
        <small>Movement map · comfortable range</small>
      </figcaption>
      <div className="motion-layout">
        <div className="motion-stage">
          <span className="motion-view">{map.view}</span>
          <svg
            viewBox="0 0 320 218"
            role="img"
            aria-label={`${title}: ${active.label}. ${active.cue}`}
          >
            <g className="motion-environment">
              <path d="M24 194 H296" />
              {map.support === "wall" && (
                <path d={`M${wallX} 18 V194 M${wallX + 5} 18 V194`} />
              )}
              {map.support === "chair" && (
                <path d="M100 86 V139 H164 M107 139 V194 M158 139 V194" />
              )}
              {map.support === "bench" && (
                <path d="M143 148 H181 V194 M149 148 V194" />
              )}
              {map.support === "rail" && (
                <path d="M49 116 H90 M55 116 V194 M84 116 V194" />
              )}
              {map.support === "floor" && <path d="M31 200 H288" />}
            </g>
            {index > 0 && <Body pose={start} ghost />}
            <Body pose={active.pose} />
            {id === "calf-raise" && (
              <path
                className="motion-trunk"
                d={`M${active.pose.la.join(",")} L172,194`}
              />
            )}
            {map.view.startsWith("Top schematic") &&
              active.label === "LIFT" && (
                <text
                  x="160"
                  y="212"
                  textAnchor="middle"
                  className="motion-svg-note"
                >
                  ↑ SMALL LIFT AWAY FROM FLOOR
                </text>
              )}
          </svg>
          <div className="motion-legend">
            <span>
              <i className="is-left" />
              Your left
            </span>
            <span>
              <i className="is-right" />
              Your right
            </span>
            <span className="motion-ghost-key">Dotted = start</span>
          </div>
        </div>
        <div className="motion-explanation">
          <span className="motion-phase">
            {String(index + 1).padStart(2, "0")} · {active.label}
          </span>
          <p>{active.cue}</p>
          <small>
            {map.detail ??
              "The diagram explains direction and order. Your comfortable range may be smaller."}
          </small>
          <p className="motion-camera-angle">
            <b>Camera</b>
            {CAMERA_VIEWS[profile.view]}
          </p>
        </div>
      </div>
      <div className="motion-controls" aria-label="Movement diagram controls">
        {!reducedMotion && (
          <button
            type="button"
            onClick={() => setPlaying((value) => !value)}
            aria-pressed={playing}
          >
            {playing ? "Pause sequence" : "Play sequence"}
          </button>
        )}
        {map.frames.map((f, i) => (
          <button
            type="button"
            key={i}
            onClick={() => select(i)}
            className={i === index ? "is-selected" : ""}
            aria-pressed={i === index}
            aria-label={`Step ${i + 1}: ${f.label}`}
          >
            {i + 1}
            <span>{f.label}</span>
          </button>
        ))}
      </div>
      <details className="motion-instructions">
        <summary>Read the complete movement</summary>
        <ol>
          <li>
            <strong>START</strong>
            <p>{guide.setup}</p>
          </li>
          <li>
            <strong>MOVE AND RETURN</strong>
            <p>{guide.movement}</p>
          </li>
        </ol>
      </details>
      <small className="motion-disclaimer">
        Teaching schematic · not measured anatomy or proof of technique.{" "}
        {profile.method === "confirmation"
          ? "This movement needs your manual confirmation."
          : "Camera estimates have limits; rest whenever you need."}
      </small>
    </figure>
  );
}

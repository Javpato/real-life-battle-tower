import { useMemo, useState } from "react";
import type { Element, PlayerSave, Skill } from "./model";
import { INITIAL_SKILLS, SKILLS, SKILL_BY_ID } from "./catalog";
import { canLearnSkill, trialRequirement, FLASH_SKILLS } from "./engine";
import { skillTypes } from "./typeChart";
import { PixelIcon } from "./PixelScene";
import ExerciseDemo from "../exercises/ExerciseDemo";
import { skillGuide } from "./skillGuides";
import { DISCIPLINES, SkillTypes, TypeCodex } from "./TypeCodex";
import "./skill-academy.css";
const disciplines: Record<Element, { name: string; description: string }> = {
  leg: { name: "Legs", description: "Strength from the ground up." },
  arm: { name: "Arms", description: "Power shaped by control." },
  back: { name: "Back", description: "Stability and quiet strength." },
  core: { name: "Core", description: "A steady centre for every movement." },
  cardio: { name: "Cardio", description: "Find a rhythm you can sustain." },
  mobility: {
    name: "Mobility",
    description: "Explore your range with control.",
  },
};
type Node = { skill: Skill; x: number; y: number };
function arrange(skills: Skill[]) {
  const roots = skills.filter(
    (s) => !s.prerequisite || !skills.some((p) => p.id === s.prerequisite),
  );
  const children = (id: string) => skills.filter((s) => s.prerequisite === id);
  let nextLeaf = 0,
    maxDepth = 0;
  const nodes: Node[] = [];
  function visit(skill: Skill, depth: number): number {
    maxDepth = Math.max(maxDepth, depth);
    const centers = children(skill.id).map((child) => visit(child, depth + 1));
    const x = centers.length
      ? (centers[0] + centers.at(-1)!) / 2
      : nextLeaf++ * 186 + 98;
    nodes.push({ skill, x, y: depth * 124 + 24 });
    return x;
  }
  roots.forEach((s) => visit(s, 0));
  return {
    nodes,
    width: Math.max(380, nextLeaf * 186 + 10),
    height: (maxDepth + 1) * 124 + 12,
  };
}
function detectorLabel(s: Skill) {
  return s.detector === "manual"
    ? "Guided / manual"
    : s.detectorStatus === "experimental"
      ? "Experimental camera"
      : "Configured camera";
}
type Props = {
  save: PlayerSave;
  onTrial: (id: string) => void;
  onPractice: (id: string) => void;
  onFlashTrial: (id: string) => void;
  onEquipFlash: (id: string, enabled: boolean) => void;
  onEquip: (id: string, slot: number) => void;
  practiceAvailable?: boolean;
  canEquip?: (id: string) => boolean;
};
export default function SkillAcademy({
  save,
  onTrial,
  onPractice,
  onFlashTrial,
  onEquipFlash,
  onEquip,
  practiceAvailable = true,
  canEquip = () => true,
}: Props) {
  const [type, setType] = useState<Element>("leg"),
    [selected, setSelected] = useState("mini-squat"),
    [tab, setTab] = useState<"tree" | "codex">("tree");
  const [equipSlot, setEquipSlot] = useState(0);
  const skill = SKILL_BY_ID[selected],
    progress = save.skills[selected],
    available = canLearnSkill(save, selected);
  const tree = useMemo(
    () => arrange(SKILLS.filter((s) => s.type === type)),
    [type],
  );
  const learned = SKILLS.filter((s) => save.skills[s.id]?.unlocked).length;
  const tokens = save.progression?.trialTokens ?? 0,
    flashTokens = save.progression?.flashTokens ?? 0,
    flashKnown = save.progression?.flashSkills.includes(selected) ?? false;
  const priorKnown =
    !skill.prerequisite || save.skills[skill.prerequisite]?.unlocked;
  const eligibleFlash =
    (FLASH_SKILLS as readonly string[]).includes(selected) &&
    !!progress?.unlocked;
  function inspect(id: string) {
    setSelected(id);
    setType(SKILL_BY_ID[id].type);
  }
  function selectType(next: Element) {
    setType(next);
    setSelected(
      SKILLS.find((s) => s.type === next && !s.prerequisite)?.id ??
        SKILLS.find((s) => s.type === next)!.id,
    );
  }
  return (
    <section className="skill-academy" aria-label="Skill Academy">
      <header className="academy-heading">
        <div>
          <span className="eyebrow">THE SKILL ACADEMY</span>
          <h1>Choose your next strength.</h1>
          <p>Six disciplines. Every technique has a path.</p>
        </div>
        <span className="bt-chip">
          {learned} / {SKILLS.length} learned
        </span>
      </header>
      <nav className="bt-tabs" aria-label="Academy sections">
        <button aria-pressed={tab === "tree"} onClick={() => setTab("tree")}>
          Skill trees
        </button>
        <button aria-pressed={tab === "codex"} onClick={() => setTab("codex")}>
          Type codex
        </button>
      </nav>
      {tab === "codex" ? (
        <TypeCodex />
      ) : (
        <>
          <div className="academy-opportunities">
            <div>
              <strong>{tokens}</strong>
              <span>skill trial opportunities</span>
            </div>
            <div>
              <strong>{flashTokens}</strong>
              <span>Flash trial opportunities</span>
            </div>
            <p>
              Earn a skill trial every three floors. A boss every five floors
              offers a power-up or Flash trial. Failed trials keep your
              opportunity.
            </p>
          </div>
          <details className="academy-starters">
            <summary>Your four starting techniques</summary>
            <div className="academy-candidates">
              {INITIAL_SKILLS.map((id) => {
                const s = SKILL_BY_ID[id];
                return (
                  <article
                    key={id}
                    className={`academy-candidate discipline-${s.type}`}
                  >
                    <strong>{s.name}</strong>
                    <SkillTypes skill={s} />
                    <small>
                      Starting technique · no camera verification assumed
                    </small>
                    {practiceAvailable && (
                      <button onClick={() => onPractice(id)}>Practise</button>
                    )}
                  </article>
                );
              })}
            </div>
          </details>
          <div className="academy-columns">
            <section
              className={`academy-map discipline-${type}`}
              aria-label={`${disciplines[type].name} skill tree`}
            >
              <nav
                className="academy-disciplines"
                aria-label="Skill disciplines"
              >
                {DISCIPLINES.map((t) => (
                  <button
                    key={t}
                    aria-pressed={type === t}
                    onClick={() => selectType(t)}
                  >
                    <PixelIcon name={t} />
                    {disciplines[t].name}
                  </button>
                ))}
              </nav>
              <div className="academy-map-caption">
                <span>{disciplines[type].description}</span>
                <small>✓ Learned · ◇ Trial available · ○ Locked</small>
              </div>
              <div
                className="academy-tree-scroll"
                tabIndex={0}
                aria-label="Scrollable technique branches"
              >
                <div
                  className="academy-tree"
                  style={{ width: tree.width, height: tree.height }}
                >
                  <svg
                    width={tree.width}
                    height={tree.height}
                    aria-hidden="true"
                    className="academy-connections"
                  >
                    {tree.nodes
                      .filter((n) => n.skill.prerequisite)
                      .map((n) => {
                        const parent = tree.nodes.find(
                          (p) => p.skill.id === n.skill.prerequisite,
                        );
                        if (!parent) return null;
                        const ready = !!save.skills[parent.skill.id]?.unlocked;
                        const y1 = parent.y + 84,
                          y2 = n.y;
                        return (
                          <g
                            key={n.skill.id}
                            className={
                              ready ? "connection-open" : "connection-locked"
                            }
                          >
                            <path
                              d={`M ${parent.x} ${y1} V ${(y1 + y2) / 2} H ${n.x} V ${y2 - 7}`}
                            />
                            <path
                              d={`M ${n.x - 4} ${y2 - 10} L ${n.x} ${y2 - 5} L ${n.x + 4} ${y2 - 10}`}
                            />
                          </g>
                        );
                      })}
                  </svg>
                  {tree.nodes.map((n) => {
                    const known = save.skills[n.skill.id]?.unlocked,
                      ready = canLearnSkill(save, n.skill.id),
                      equipped = save.loadout.includes(n.skill.id);
                    return (
                      <button
                        key={n.skill.id}
                        className={`academy-node ${known ? "is-learned" : ready ? "is-ready" : "is-locked"} ${selected === n.skill.id ? "is-selected" : ""}`}
                        style={{ left: n.x - 80, top: n.y }}
                        aria-pressed={selected === n.skill.id}
                        aria-label={`${n.skill.name} · ${equipped ? "equipped" : known ? "learned" : ready ? "trial available" : "locked"}`}
                        onClick={() => setSelected(n.skill.id)}
                      >
                        <span className="academy-node-status">
                          {known ? "✓" : ready ? "◇" : "○"}
                        </span>
                        <strong>{n.skill.name}</strong>
                        <small>
                          {n.skill.units} {n.skill.unit} · Tier {n.skill.tier}
                          {skillTypes(n.skill).length === 2 ? " · Dual" : ""}
                          {equipped ? " · Equipped" : ""}
                        </small>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
            <aside
              className={`academy-inspector discipline-${skill.type}`}
              aria-label="Selected skill details"
            >
              <header>
                <PixelIcon name={skill.type} />
                <div>
                  <span className="eyebrow">
                    {progress?.unlocked ? "LEARNED TECHNIQUE" : "NEXT LESSON"}
                  </span>
                  <h2>{skill.name}</h2>
                </div>
              </header>
              <SkillTypes skill={skill} />
              <div className="academy-facts">
                <span>
                  <b>{skill.damage}</b>power
                </span>
                <span>
                  <b>{skill.units}</b>
                  {skill.unit}
                </span>
                <span>
                  <b>{skill.tier}</b>difficulty tier
                </span>
              </div>
              <div className={`academy-detection ${skill.detectorStatus}`}>
                <strong>{detectorLabel(skill)}</strong>
                <small>
                  {skill.detector === "manual"
                    ? "This exact variation is not camera-verified. Manual effort is recorded separately."
                    : skill.detectorStatus === "experimental"
                      ? "Experimental movement profile; physical accuracy has not been validated."
                      : "Recognition is configured for this movement. A counted repetition is not a technique assessment."}
                </small>
              </div>
              <p className="academy-prerequisite">
                {skill.prerequisite ? (
                  <>
                    Path:{" "}
                    <button onClick={() => inspect(skill.prerequisite!)}>
                      {SKILL_BY_ID[skill.prerequisite]?.name}
                    </button>{" "}
                    → {skill.name}
                  </>
                ) : (
                  "No prerequisite technique"
                )}
              </p>
              <div className="academy-actions">
                {!progress?.unlocked && (
                  <button
                    className="primary academy-trial"
                    disabled={!available}
                    onClick={() => onTrial(skill.id)}
                  >
                    {available
                      ? `Trial · ${trialRequirement(skill.id)} ${skill.unit}`
                      : !priorKnown
                        ? `Learn ${SKILL_BY_ID[skill.prerequisite!]?.name} first`
                        : "Earn a trial at floor 3, 6, 9…"}
                  </button>
                )}
                {practiceAvailable && (
                  <button onClick={() => onPractice(skill.id)}>
                    Practise freely
                  </button>
                )}
              </div>
              <p className="academy-mastery">
                {practiceAvailable
                  ? "Training is always available, even before learning a battle technique."
                  : "Free practice is available in Training Grounds outside your ascent."}
              </p>
              {progress?.unlocked && (
                <p className="academy-mastery">
                  {progress.mastery} practice units · {progress.verifiedUnits}{" "}
                  camera / {progress.manualUnits} manual. Practice does not
                  increase battle stats.
                </p>
              )}
              {progress?.unlocked && (
                <section className="academy-equipment">
                  <h3>Battle loadout</h3>
                  {save.loadout.includes(selected) ? (
                    <p>
                      Equipped in slot {save.loadout.indexOf(selected) + 1} of
                      4.
                    </p>
                  ) : (
                    <>
                      <label>
                        Replace a slot
                        <select
                          aria-label="Replace a battle slot"
                          value={equipSlot}
                          onChange={(e) => setEquipSlot(Number(e.target.value))}
                        >
                          {[0, 1, 2, 3].map((i) => (
                            <option key={i} value={i}>
                              Slot {i + 1} ·{" "}
                              {SKILL_BY_ID[save.loadout[i]]?.name ?? "Empty"}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="primary"
                        disabled={!canEquip(selected)}
                        onClick={() => onEquip(selected, equipSlot)}
                      >
                        {canEquip(selected)
                          ? `Equip in slot ${equipSlot + 1}`
                          : "Available in your next ascent"}
                      </button>
                    </>
                  )}
                </section>
              )}
              {eligibleFlash && (
                <section className="academy-flash">
                  <h3>Flash technique</h3>
                  <p>
                    Controlled full repetitions, not maximum speed. A personal
                    reference sets your cadence.
                  </p>
                  {flashKnown ? (
                    <button
                      disabled={!save.loadout.includes(selected)}
                      aria-pressed={
                        save.flashEquipped?.includes(selected) ?? false
                      }
                      onClick={() =>
                        onEquipFlash(
                          selected,
                          !save.flashEquipped?.includes(selected),
                        )
                      }
                    >
                      {save.flashEquipped?.includes(selected)
                        ? "Use normal variant"
                        : "Equip Flash variant"}
                    </button>
                  ) : (
                    <button
                      disabled={flashTokens < 1}
                      onClick={() => onFlashTrial(selected)}
                    >
                      {flashTokens
                        ? "Attempt Flash trial"
                        : "Earn a Flash opportunity from a boss"}
                    </button>
                  )}
                  <small>
                    {flashKnown
                      ? "Flash replaces the normal version in the same slot."
                      : "Three reference cycles, then six valid repetitions. Manual mode never fabricates a detected speed bonus."}
                  </small>
                </section>
              )}
              <details className="academy-guide" open>
                <summary>How to perform this technique</summary>
                <ExerciseDemo
                  exerciseId={skill.exercise}
                  recognitionProfile={
                    skill.id === "mini-squat" || skill.id === "knee-pushup"
                      ? skill.id
                      : undefined
                  }
                  guideOverride={skillGuide(skill.id)}
                  hideIllustration={skill.detector === "manual"}
                />
              </details>
            </aside>
          </div>
        </>
      )}
    </section>
  );
}

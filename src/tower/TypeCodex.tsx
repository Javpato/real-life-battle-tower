import { useState } from "react";
import type { Element, Skill } from "./model";
import { TYPE_CHART, TYPE_NAMES, skillTypes } from "./typeChart";
import { effectiveness, stab } from "./engine";
export const DISCIPLINES: Element[] = [
  "leg",
  "arm",
  "back",
  "core",
  "cardio",
  "mobility",
];
export function TypeBadge({ type }: { type: Element }) {
  return <span className={`bt-type ${type}`}>{TYPE_NAMES[type]}</span>;
}
export function SkillTypes({ skill }: { skill: Skill }) {
  return (
    <span
      className="bt-types"
      aria-label={`Types: ${skillTypes(skill)
        .map((t) => TYPE_NAMES[t])
        .join(" and ")}`}
    >
      {skillTypes(skill).map((t) => (
        <TypeBadge key={t} type={t} />
      ))}
    </span>
  );
}
export function TypeCodex() {
  const [attack, setAttack] = useState<Element>("leg"),
    [secondary, setSecondary] = useState<Element | "">(""),
    [defense, setDefense] = useState<Element>("arm"),
    [secondDefense, setSecondDefense] = useState<Element | "">(""),
    [specialization, setSpecialization] = useState<Element | "">("");
  const attacks: Element[] = secondary ? [attack, secondary] : [attack],
    defenders: Element[] = secondDefense ? [defense, secondDefense] : [defense];
  const multiplier = effectiveness(attacks, defenders),
    bonus = stab(attacks, specialization || null);
  const options = (excluded?: Element) =>
    DISCIPLINES.filter((t) => t !== excluded).map((t) => (
      <option key={t} value={t}>
        {TYPE_NAMES[t]}
      </option>
    ));
  return (
    <section className="bt-type-codex" aria-label="Type codex">
      <header>
        <span className="eyebrow">SIX DISCIPLINES · ONE STRATEGY</span>
        <h2>Know your matchup</h2>
        <p>
          These are game rules, not claims about which exercise is physically
          stronger.
        </p>
      </header>
      <div
        className="bt-chart-scroll"
        tabIndex={0}
        aria-label="Type effectiveness chart"
      >
        <table className="bt-type-chart">
          <caption>Attack down · Defence across</caption>
          <thead>
            <tr>
              <th scope="col">Attack / defence</th>
              {DISCIPLINES.map((t) => (
                <th key={t} scope="col">
                  <TypeBadge type={t} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DISCIPLINES.map((a) => (
              <tr key={a}>
                <th scope="row">
                  <button
                    onClick={() => {
                      setAttack(a);
                      if (secondary === a) setSecondary("");
                    }}
                    aria-pressed={attack === a}
                  >
                    <TypeBadge type={a} />
                  </button>
                </th>
                {DISCIPLINES.map((d) => (
                  <td
                    key={d}
                    className={
                      TYPE_CHART[a][d] > 1
                        ? "strong"
                        : TYPE_CHART[a][d] < 1
                          ? "resisted"
                          : "neutral"
                    }
                  >
                    ×{TYPE_CHART[a][d]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bt-matchup-inputs">
        <label>
          Attack type
          <select
            aria-label="Attack type"
            value={attack}
            onChange={(e) => {
              setAttack(e.target.value as Element);
              if (e.target.value === secondary) setSecondary("");
            }}
          >
            {options()}
          </select>
        </label>
        <label>
          Second attack type
          <select
            aria-label="Second attack type"
            value={secondary}
            onChange={(e) => setSecondary(e.target.value as Element | "")}
          >
            <option value="">Single type</option>
            {options(attack)}
          </select>
        </label>
        <label>
          Defender type
          <select
            aria-label="Defender type"
            value={defense}
            onChange={(e) => {
              setDefense(e.target.value as Element);
              if (e.target.value === secondDefense) setSecondDefense("");
            }}
          >
            {options()}
          </select>
        </label>
        <label>
          Second defender type
          <select
            aria-label="Second defender type"
            value={secondDefense}
            onChange={(e) => setSecondDefense(e.target.value as Element | "")}
          >
            <option value="">Single type</option>
            {options(defense)}
          </select>
        </label>
        <label>
          Your specialization
          <select
            aria-label="Your specialization"
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value as Element | "")}
          >
            <option value="">Neutral</option>
            {options()}
          </select>
        </label>
      </div>
      <output className="bt-matchup-result" aria-live="polite">
        <strong>×{Number(multiplier.toFixed(4))}</strong> effectiveness{" "}
        <span>· STAB ×{bonus}</span>
        <small>
          Combined modifier ×{Number((multiplier * bonus).toFixed(4))}
        </small>
      </output>
      <p>
        <small>
          Dual defence multiplies matchups. Dual attacks average both results.
          STAB applies once when either attack type matches your specialization.
        </small>
      </p>
    </section>
  );
}

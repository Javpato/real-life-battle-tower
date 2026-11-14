import { useState } from "react";
import {
  ArrowLeft,
  Backpack,
  Flame,
  Leaf,
  Mountain,
  Pause,
  Shield,
  Swords,
} from "lucide-react";
import {
  attackFor,
  effectiveness,
  stab,
  type Battle,
  type Player,
} from "../core/game";
import type { AdventureCommand } from "../core/commands";
import type { Element } from "../core/contracts";
import { ItemSprite } from "../game/BattleSprite";
import { EXERCISE_GUIDES } from "../exercises/ExerciseDemo";

export default function BattleCommandMenu({
  player: p,
  battle: b,
  camera,
  onCamera: C,
  dispatch,
  onItem: item,
}: {
  player: Player;
  battle: Battle;
  camera: boolean;
  onCamera: (enabled: boolean) => void;
  dispatch: (command: AdventureCommand) => Promise<boolean>;
  onItem: (id: string) => void;
}) {
  const [battleMenu, setBattleMenu] = useState<"actions" | "attacks" | "items">(
    "actions",
  );
  const iconType = (type: Element) => (
    <span className={"type-tag " + type}>
      {type === "leg" ? (
        <Mountain size={12} />
      ) : type === "arm" ? (
        <Flame size={12} />
      ) : (
        <Leaf size={12} />
      )}{" "}
      {{ leg: "Leg", arm: "Arm", back: "Back" }[type]}
    </span>
  );
  return (
    <div
      className="rpg-command-menu"
      onKeyDown={(event) => {
        if (
          !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
            event.key,
          )
        )
          return;
        const buttons = Array.from(
          event.currentTarget.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ),
        );
        const index = buttons.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        if (index < 0) return;
        event.preventDefault();
        const step =
          event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
        buttons[(index + step + buttons.length) % buttons.length]?.focus();
      }}
    >
      <div className="battle-menu-heading">
        <strong>
          {battleMenu === "attacks"
            ? "Choose your movement"
            : battleMenu === "items"
              ? "Reach into your satchel"
              : "Your turn. Find your rhythm."}
        </strong>
        {battleMenu !== "actions" && (
          <button onClick={() => setBattleMenu("actions")}>
            <ArrowLeft size={16} />
            Back
          </button>
        )}
        <small>
          {battleMenu === "attacks"
            ? "Type advantage and STAB apply to each accepted unit."
            : "Your opponent waits while you choose."}
        </small>
      </div>
      {battleMenu === "attacks" ? (
        <div className="attack-grid">
          {(b.enemy.id==='tutorial-moss'?['squat']:p.equipped).map((id) => {
            const a = attackFor(id, p);
            const multiplier = effectiveness(a.type, b.enemy.phases[b.phase]);
            const sameType = stab(a.type, b.type ? [b.type] : []) > 1;
            return (
              <button
                className={"attack-card " + a.type}
                key={id}
                onClick={() =>
                  void dispatch({ kind: "beginAttack", attackId: a.id })
                }
              >
                <span>
                  {iconType(a.type)}
                  <small>
                    Lv. {(p.upgrades[id] ?? 0) + 1} · {Math.round(a.damage)}{" "}
                    power
                  </small>
                </span>
                <strong>{a.name}</strong>
                <small>
                  {b.enemy.id==='tutorial-moss'?3:a.units}{" "}
                  {a.exercise === "superman" ? "seconds" : "repetitions"} ·{" "}
                  {EXERCISE_GUIDES[a.exercise].title.split(" · ")[1]}
                </small>
                <span className="attack-matchup">
                  <b>
                    {multiplier > 1
                      ? "Advantage"
                      : multiplier < 1
                        ? "Resisted"
                        : "Neutral"}{" "}
                    ×{Number(multiplier.toFixed(3))}
                  </b>
                  {sameType && <em>STAB ×1.25</em>}
                </span>
              </button>
            );
          })}
        </div>
      ) : battleMenu === "items" ? (
        <div className="rpg-action-grid item-command-grid">
          <button disabled={!p.items.potion} onClick={() => item("potion")}>
            <ItemSprite id="potion" />
            <strong>Potion ({p.items.potion})</strong>
            <small>Restore vitality</small>
          </button>
          <button disabled={!p.items.shield} onClick={() => item("shield")}>
            <ItemSprite id="shield" />
            <strong>Guard ({p.items.shield})</strong>
            <small>Prepare protection</small>
          </button>
          <button disabled={!p.items.boost} onClick={() => item("boost")}>
            <ItemSprite id="boost" />
            <strong>Boost ({p.items.boost})</strong>
            <small>Strengthen your next series</small>
          </button>
        </div>
      ) : (
        <div className="rpg-action-grid">
          <button
            className="command-attack"
            onClick={() => setBattleMenu("attacks")}
          >
            <Swords size={24} />
            <strong>Attack</strong>
            <small>Choose an exercise</small>
          </button>
          <button onClick={() => void dispatch({ kind: "defend" })}>
            <Shield size={24} />
            <strong>Defend</strong>
            <small>Reduce the next hit</small>
          </button>
          <button onClick={() => setBattleMenu("items")}>
            <Backpack size={24} />
            <strong>Items</strong>
            <small>Use your supplies</small>
          </button>
          <button
            onClick={() =>
              void dispatch({
                kind: b.enemy.id.startsWith("trainer")
                  ? "leaveBattle"
                  : "stopSafely",
              })
            }
          >
            <ArrowLeft size={24} />
            <strong>
              {b.enemy.id.startsWith("trainer") ? "Flee" : "Stop safely"}
            </strong>
            <small>
              {b.enemy.id.startsWith("trainer")
                ? "Return to the village"
                : "Leave without a victory"}
            </small>
          </button>
        </div>
      )}
      <div className="battle-utilities">
        <button onClick={() => void dispatch({ kind: "pause", paused: true })}>
          <Pause size={15} />
          Pause
        </button>
        <label className="check compact">
          <input
            type="checkbox"
            checked={camera}
            onChange={(e) => C(e.target.checked)}
          />
          Camera
        </label>
        <small>
          {b.verified} verified · {b.unverified} manual units
        </small>
      </div>
    </div>
  );
}

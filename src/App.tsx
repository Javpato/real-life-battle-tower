import { useEffect, useRef, useState, lazy, Suspense } from "react";
import {
  BookOpen,
  Heart,
  Coins,
  Map,
  Backpack,
  Settings,
  ChevronRight,
  Shield,
  Swords,
  Footprints,
  Pause,
  Play,
  Volume2,
  VolumeX,
  Leaf,
  Flame,
  Mountain,
  ArrowLeft,
  Camera,
  Check,
  Star,
} from "lucide-react";
import World from "./game/World";
import DevicePanel from "./platform/DevicePanel";
import type { ImportedHealth } from "./platform/health";
import { startMusic, stopMusic, setVolume } from "./audio/music";
import Journal from "./nutrition/Journal";
import { defaultNutrition, type NutritionState } from "./nutrition/engine";
import {
  initialPlayer,
  type Player,
  type Battle,
  type Enemy,
  attacks,
  available,
  attackFor,
  enemyFor,
  startBattle,
  beginAttack,
  acceptUnit,
  cancelSeries,
  enemyTurn,
  win,
  lose,
  reward,
  questTarget,
  xpNeeded,
} from "./core/game";
import type { Element, ExerciseId, ExerciseUnit } from "./core/contracts";
import { readSave, writeSave } from "./services/storage";
import {useAdventure} from "./services/useAdventure";
import type {AdventureCommand} from "./core/commands";
const ExerciseCamera = lazy(() => import("./exercises/ExerciseCamera"));
const typeLabel = (t: Element | null) =>
  t ? { leg: "Leg", arm: "Arm", back: "Back" }[t] : "Neutral";
const uid = () => crypto.randomUUID();
function sound(kind = "click") {
  try {
    const a = new AudioContext(),
      o = a.createOscillator(),
      g = a.createGain();
    o.type = "triangle";
    o.frequency.value = kind === "hit" ? 330 : kind === "win" ? 660 : 440;
    g.gain.setValueAtTime(0.07, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.22);
    o.connect(g);
    g.connect(a.destination);
    o.start();
    o.stop(a.currentTime + 0.23);
    setTimeout(() => a.close(), 350);
  } catch {}
}
export default function App() {
  const adventure=useAdventure();
  const {player:p,battle:b,quest}=adventure.snapshot;
  const ready=adventure.ready;
  const [n,N]=useState<NutritionState>(defaultNutrition),[nutritionReady,NR]=useState(false),[panel,V]=useState<string|null>(null),[encounter,E]=useState<Enemy|null>(null),[chosen,CH]=useState<Element|null>(null),[camera,C]=useState(true),[muted,MU]=useState(false),[toast,TO]=useState(''),[welcome,W]=useState(false),[journalError,SE]=useState('');
  const saveError=adventure.error||journalError;
  const [pauseRequested,PR]=useState(false);
  const dispatch=async(command:AdventureCommand)=>{const stop=(command.kind==='pause'&&command.paused)||['cancelSeries','stopSafely','cancelQuest','leaveBattle'].includes(command.kind);if(stop)PR(true);const ok=await adventure.send(command);if(ok&&stop)PR(false);return ok;};
  useEffect(()=>{if(adventure.fresh)W(true);},[adventure.fresh]);
  useEffect(()=>{if(!adventure.error&&!adventure.busy)PR(false);},[adventure.error,adventure.busy]);
  const audioReady = useRef(false);
  useEffect(() => {
    setVolume(muted ? 0 : 0.25);
    if (audioReady.current)
      void startMusic(
        b?.turn === "won"
          ? "victory"
          : b?.enemy.id === "rival"
            ? "rival"
            : b?.enemy.badge
              ? "leader"
              : b
                ? "trainer"
                : "village",
      );
  }, [muted, b?.enemy.id, b?.turn === "won"]);
  useEffect(() => () => stopMusic(), []);
  useEffect(()=>{void readSave<NutritionState>('nutrition').then(saved=>{if(saved)N(saved);NR(true);}).catch(()=>{SE('Could not open the local journal.');NR(true);});},[]);
  useEffect(()=>{if(nutritionReady)void writeSave('nutrition',n).catch(()=>SE('Could not save the local journal.'));},[n,nutritionReady]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => TO(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(()=>{if(b?.turn!=='enemy'||b.paused||adventure.locked)return;const timer=setTimeout(()=>void dispatch({kind:'resolveEnemy'}),1100);return()=>clearTimeout(timer);},[b?.turn,b?.paused,adventure.locked]);
  useEffect(()=>{const listener=(e:KeyboardEvent)=>{if(e.key==='Escape'){if(b)void dispatch({kind:'pause',paused:!b.paused});else if(quest)void dispatch({kind:'cancelQuest'});else V(panel?null:'menu');}};window.addEventListener('keydown',listener);return()=>window.removeEventListener('keydown',listener);},[b,panel,quest,adventure.locked]);
  function notify(s: string) {
    TO(s);
    if (!muted) sound();
  }
  function interact(id: string) {
    if (b || panel || quest || adventure.locked) return;
    if (id.startsWith("trainer") || id.startsWith("leader") || id === "rival") {
      if (id === "rival" && p.badges.length < 3) {
        notify(
          "Rowan: Bring all three badges. Your adventure is just beginning.",
        );
        return;
      }
      E(enemyFor(id, p));
      CH(null);
      V("preview");
    } else if (id.startsWith("quest")) {
      const exercise = id.slice(6) as ExerciseId;
      void dispatch({kind:'startQuest',exercise});
    } else if (id === "healer") {
      void dispatch({kind:'heal'});

    } else V(id);
  }
  function onUnit(unit:ExerciseUnit,sessionId?:string){if(b)void dispatch({kind:'exerciseUnit',unit,sessionId:sessionId??b.sessionId});else if(quest)void dispatch({kind:'questUnit',unit,sessionId:quest.id});}
  function manualSeries(){if(b)void dispatch({kind:'manualRemaining',sessionId:b.sessionId});}
  async function finishBattle(){if(!b)return;const won=b.turn==='won',rival=b.enemy.id==='rival';if(await dispatch({kind:'finishBattle'})){notify(won?'Victory! Your effort is saved.':'Restored at the Rest House.');if(won&&!muted)sound('win');if(won&&rival)V('ending');}}
  function item(key:string){void dispatch({kind:'useItem',item:key as 'potion'|'shield'|'boost'});}
  function discover(barcode:string){void dispatch({kind:'discoverFood',barcode});}
  const iconType = (type: Element) => (
    <span className={"type-tag " + type}>
      {type === "leg" ? (
        <Mountain size={12} />
      ) : type === "arm" ? (
        <Flame size={12} />
      ) : (
        <Leaf size={12} />
      )}{" "}
      {typeLabel(type)}
    </span>
  );
  if (!ready)
    return (
      <div className="loading">
        <span className="brand-mark">✦</span>
        <h1>everstride</h1>
        <p>Opening your adventure…</p>
      </div>
    );
  if (panel === "journal")
    return (
      <Journal
        state={n}
        onChange={N}
        onClose={() => V(null)}
        onDiscover={discover}
      />
    );
  return (
    <div
      className="adventure-app"
      onPointerDown={() => {
        if (!audioReady.current) {
          audioReady.current = true;
          setVolume(muted ? 0 : 0.25);
          void startMusic("village");
        }
      }}
    >
      <header className="game-header">
        <button className="brand" onClick={() => V(null)}>
          <span className="brand-mark">✦</span>
          <span>
            everstride<small>YOUR EVERYDAY ADVENTURE</small>
          </span>
        </button>
        <nav>
          <button className="active">
            <Map size={17} />
            Adventure
          </button>
          <button
            onClick={() => {
              if (b) void dispatch({kind:'pause',paused:true});
              V("journal");
            }}
          >
            <BookOpen size={17} />
            Journal
          </button>
        </nav>
        <div className="header-right">
          <span className="local-pill">
            <i /> {adventure.mode==='cloud'?(adventure.error?'Cloud · stopped':adventure.readOnly?'Cloud · viewing':adventure.busy?'Cloud · saving':'Cloud · in control'):'Saved locally'}
          </span>
          <button
            className="icon-button"
            onClick={() => MU(!muted)}
            aria-label="Toggle sound"
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button
            className="icon-button"
            onClick={() => V("menu")}
            aria-label="Settings"
          >
            <Settings size={18} />
          </button>
          <span className="avatar">J</span>
        </div>
      </header>
      <fieldset disabled={adventure.locked} style={{border:0,padding:0,margin:0,minWidth:0}}><main className="game-main">
        <div className="game-title">
          <div>
            <div className="eyebrow">CHAPTER 01 · THE EVERYDAY ADVENTURE</div>
            <h1>
              {b ? "A little effort. Real power." : "Welcome to Willowmere."}
            </h1>
            <p>
              {b
                ? "Move at your own pace. Your opponent will wait."
                : "Your real life powers this little world. Let’s see where today takes you."}
            </p>
          </div>
          <div className="weather">
            ☀{" "}
            <span>
              A good day to begin<small>WILLOWMERE VALLEY</small>
            </span>
          </div>
        </div>
        <div className="game-layout">
          <section className="world-card">
            <div className="world-toolbar">
              <span>
                <i /> {b ? "TRAINING GROUNDS" : "WILLOWMERE VILLAGE"}
              </span>
              <span>
                {b
                  ? `${b.verified} verified · ${b.unverified} manual`
                  : "WASD to move · E to say hello"}
              </span>
            </div>
            {!b ? (
              <div className="world-frame">
                <World
                  paused={!!panel || !!quest || welcome || adventure.locked}
                  badges={p.badges}
                  position={p.position}
                  onMove={(position) => {if(!adventure.locked)void dispatch({kind:'move',...position});}}
                  onInteract={interact}
                />
                <div className="world-caption">
                  <span>✦</span>
                  <div>
                    <strong>A world of small beginnings</strong>
                    <small>Meet the villagers. Find your own rhythm.</small>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="battle-stage">
                  <div className="enemy-plate">
                    <div>
                      <strong>{b.enemy.name}</strong>
                      <small>
                        {b.enemy.title} · Phase {b.phase + 1}/
                        {b.enemy.phases.length}
                      </small>
                    </div>
                    <div className="type-row">
                      {b.enemy.phases[b.phase].map(iconType)}
                    </div>
                    <div className="hp-track">
                      <span
                        style={{ width: `${(b.enemyHp / b.enemy.hp) * 100}%` }}
                      />
                    </div>
                    <small>
                      {Math.ceil(b.enemyHp)} / {Math.ceil(b.enemy.hp)} HP
                    </small>
                  </div>
                  <div
                    className={
                      "combat-sprite enemy " + b.enemy.phases[b.phase][0]
                    }
                  >
                    <span>✦</span>
                    <div className="sprite-head" />
                    <div className="sprite-body" />
                    <div className="sprite-feet" />
                  </div>
                  <div className="combat-sprite hero">
                    <div className="sprite-head" />
                    <div className="sprite-body" />
                    <div className="sprite-feet" />
                  </div>
                  <div className="hero-plate">
                    <strong>
                      {p.name} <small>Lv. {p.level}</small>
                    </strong>
                    <div className="hp-track">
                      <span
                        style={{ width: `${(b.playerHp / p.maxHp) * 100}%` }}
                      />
                    </div>
                    <small>
                      {Math.ceil(b.playerHp)} / {p.maxHp} HP ·{" "}
                      {typeLabel(b.type)}
                    </small>
                  </div>
                  <div className="battle-log" aria-live="polite">
                    {b.log}
                  </div>
                </div>
                <div className="battle-actions">
                  {b.paused ? (
                    <div className="pause-message">
                      <h2>Take your time.</h2>
                      <p>
                        Your progress is safe. Nothing happens while you rest.
                      </p>
                      <button
                        className="primary"
                        onClick={() => void dispatch({kind:'pause',paused:false})}
                      >
                        <Play size={16} />
                        Resume
                      </button>
                      <button onClick={() => V("journal")}>Open journal</button>
                    </div>
                  ) : b.turn === "won" || b.turn === "lost" ? (
                    <div className="pause-message">
                      <h2>
                        {b.turn === "won"
                          ? "A well-earned victory."
                          : "A rest, then a fresh start."}
                      </h2>
                      <p>
                        {b.turn === "won"
                          ? `+${b.enemy.xp} XP · +${b.enemy.coins} coins`
                          : "Return to the Rest House. Your progress is kept."}
                      </p>
                      <button className="primary" onClick={finishBattle}>
                        Continue adventure <ChevronRight size={18} />
                      </button>
                    </div>
                  ) : b.turn === "transform" ? (
                    <div className="pause-message">
                      <h2>A new strength awakens.</h2>
                      <p>
                        Your series is complete. {b.enemy.name} changes type.
                      </p>
                      <button
                        className="primary"
                        onClick={() =>
                          void dispatch({kind:'continuePhase'})
                        }
                      >
                        Continue when ready
                      </button>
                    </div>
                  ) : b.turn === "exercise" ? (
                    <div className="exercise-actions">
                      <div>
                        <h2>{b.attack?.name}</h2>
                        <p>
                          {b.progress} / {b.attack?.units}{" "}
                          {b.attack?.exercise === "superman"
                            ? "seconds"
                            : "repetitions"}
                        </p>
                      </div>
                      {!camera && (
                        <button className="primary" onClick={manualSeries}>
                          <Check size={16} />I completed the remaining units
                        </button>
                      )}
                      <button
                        className="secondary"
                        onClick={() => void dispatch({kind:'pause',paused:true})}
                      >
                        <Pause size={16} />
                        Rest
                      </button>
                      <button onClick={() => void dispatch({kind:'cancelSeries'})}>
                        End series & turn
                      </button>
                      <p className="tiny">
                        {camera
                          ? "Every accepted movement causes damage."
                          : "Manual mode is unverified. Group fatigue applies."}
                      </p>
                    </div>
                  ) : b.turn === "enemy" ? (
                    <div className="pause-message">
                      <p>{b.enemy.name} is responding…</p>
                      <button onClick={() => void dispatch({kind:'pause',paused:true})}>
                        Pause safely
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="attack-grid">
                        {p.equipped.map((id) => {
                          const a = attackFor(id, p);
                          return (
                            <button
                              className={"attack-card " + a.type}
                              key={id}
                              onClick={() => void dispatch({kind:'beginAttack',attackId:a.id})}
                            >
                              <span>
                                {iconType(a.type)}
                                <small>{Math.round(a.damage)} power</small>
                              </span>
                              <strong>{a.name}</strong>
                              <small>{a.description}</small>
                            </button>
                          );
                        })}
                      </div>
                      <div className="button-row">
                        <button
                          onClick={() =>
                            void dispatch({kind:'defend'})
                          }
                        >
                          <Shield size={16} />
                          Defend
                        </button>
                        <button
                          disabled={!p.items.potion}
                          onClick={() => item("potion")}
                        >
                          Potion ({p.items.potion})
                        </button>
                        <button
                          disabled={!p.items.shield}
                          onClick={() => item("shield")}
                        >
                          Guard ({p.items.shield})
                        </button>
                        <button
                          disabled={!p.items.boost}
                          onClick={() => item("boost")}
                        >
                          Boost ({p.items.boost})
                        </button>
                        <button onClick={() => void dispatch({kind:'pause',paused:true})}>
                          <Pause size={15} />
                          Pause
                        </button>
                        {b.enemy.id.startsWith("trainer") && (
                          <button
                            onClick={() => {
                              void dispatch({kind:'leaveBattle'});
                            }}
                          >
                            Leave
                          </button>
                        )}
                        <label className="check compact">
                          <input
                            type="checkbox"
                            checked={camera}
                            onChange={(e) => C(e.target.checked)}
                          />
                          Camera
                        </label>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
            <div className="world-footer">
              <span>
                <Heart size={15} /> Rest whenever you need.
              </span>
              <button
                onClick={() => {
                  if (b) void dispatch({kind:'pause',paused:true});
                  V("journal");
                }}
              >
                <BookOpen size={16} />
                Open your journal <ChevronRight size={15} />
              </button>
            </div>
          </section>
          <aside className="adventure-sidebar">
            {b?.turn === "exercise" && camera && !b.paused ? (
              <section className="card camera-card">
                <Suspense fallback={<p>Preparing local pose model…</p>}>
                  <ExerciseCamera
                    key={b.sessionId}
                    exerciseId={b.attack!.exercise}
                    target={b.attack!.units}
                    progress={b.progress}
                    active={!adventure.readOnly&&!adventure.error&&!pauseRequested}
                    onUnit={(u) => onUnit(u, b.sessionId)}
                    onError={notify}
                  />
                </Suspense>
                <button onClick={() => C(false)}>
                  Detection trouble? Continue manually
                </button>
              </section>
            ) : (
              <>
                <section className="card player-card">
                  <div className="player-heading">
                    <div className="portrait">✦</div>
                    <div>
                      <small>YOUR ADVENTURER</small>
                      <h2>{p.name}</h2>
                      <span>
                        Level {p.level} ·{" "}
                        {p.badges.length
                          ? "Finding your stride"
                          : "A fresh beginning"}
                      </span>
                    </div>
                  </div>
                  <div className="stat-line">
                    <span>
                      <Heart size={15} /> Vitality
                    </span>
                    <strong>
                      {Math.ceil(b?.playerHp ?? p.hp)}{" "}
                      <small>/ {p.maxHp}</small>
                    </strong>
                  </div>
                  <div className="hp-track">
                    <span
                      style={{
                        width: `${((b?.playerHp ?? p.hp) / p.maxHp) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="stat-line">
                    <span>Next level</span>
                    <small>
                      {p.xp} / {xpNeeded(p.level)} XP
                    </small>
                  </div>
                  <div className="xp-track">
                    <span
                      style={{ width: `${(p.xp / xpNeeded(p.level)) * 100}%` }}
                    />
                  </div>
                  <div className="player-coins">
                    <span>
                      <Coins size={19} /> Your pocket
                    </span>
                    <strong>
                      {p.coins}
                      <small> coins</small>
                    </strong>
                  </div>
                </section>
                <section className="card quest-card">
                  <div className="eyebrow">THE PATH AHEAD</div>
                  <h2>Find your strength.</h2>
                  <p>
                    Three leaders. Three ways to move.
                    <br />
                    One adventure that’s yours.
                  </p>
                  {(["leg", "arm", "back"] as Element[]).map((t, i) => (
                    <div
                      className={
                        "badge-row " + (p.badges.includes(t) ? "earned" : "")
                      }
                      key={t}
                    >
                      <span className={"badge-icon " + t}>
                        {p.badges.includes(t) ? "✓" : ["⛰", "✹", "✧"][i]}
                      </span>
                      <div>
                        <strong>
                          {["Mountain", "Ember", "Wind"][i]} Badge
                        </strong>
                        <small>
                          {p.badges.includes(t)
                            ? "Earned · special unlocked"
                            : `${typeLabel(t)} Gym · waiting for you`}
                        </small>
                      </div>
                      <ChevronRight size={16} />
                    </div>
                  ))}
                  <div className="chapter-progress">
                    {p.badges.length}/3 badges{" "}
                    <span>
                      {p.ending
                        ? "Summit reached ✦"
                        : p.badges.length === 3
                          ? "The summit awaits"
                          : "Every journey starts somewhere"}
                    </span>
                  </div>
                </section>
                <button className="journal-teaser" onClick={() => V("journal")}>
                  <div className="journal-book">✧</div>
                  <div>
                    <strong>Your field journal</strong>
                    <small>Food, movement & little milestones</small>
                  </div>
                  <ChevronRight size={19} />
                </button>
              </>
            )}
          </aside>
        </div>
        <div className="quick-actions">
          <button onClick={() => V("inventory")}>
            <Backpack size={18} />
            Satchel & skills
          </button>
          <button disabled={!!b} onClick={() => interact("healer")}>
            <Heart size={18} />
            Rest House
          </button>
          <button onClick={() => V("devices")}>
            <Footprints size={18} />
            Devices & steps
          </button>
          <span>Made for the people who make everyday life an adventure.</span>
        </div>
      </main></fieldset>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      {(saveError||adventure.mode==='cloud')&&<section className="notice" style={{margin:20}} role="status"><strong>{adventure.mode==='cloud'?`Cloud adventure ${adventure.saveId?.slice(0,8)} · revision ${adventure.revision}`:'Adventure status'}</strong><p>{saveError||'Only server-accepted actions change this adventure. Your local adventure and journal remain separate.'}</p><p>{adventure.pending} pending action(s)</p><div className="button-row">{adventure.error&&adventure.pending>0&&<><button onClick={()=>void adventure.controller.retry().catch(e=>notify(String(e)))}>Retry pending actions</button><button onClick={()=>{if(confirm('Discard these unacknowledged actions and reload the cloud snapshot? A local audit copy is retained.'))void adventure.controller.discardPending();}}>Discard pending & refresh</button></>}{adventure.mode==='cloud'&&<><button onClick={()=>V('devices')}>Cloud controls</button><button disabled={adventure.busy} onClick={()=>void adventure.controller.returnLocal().catch(e=>notify(String(e)))}>Return to local adventure</button></>}</div></section>}
      {welcome && (
        <div className="modal-backdrop">
          <section className="modal welcome-modal">
            <div className="big-star">✦</div>
            <div className="eyebrow">
              FOR THE PEOPLE WHO MAKE LIFE AN ADVENTURE
            </div>
            <h1>
              Your everyday life.
              <br />
              An extraordinary journey.
            </h1>
            <p>
              Welcome to Everstride. Explore Willowmere, turn real movement into
              battle skills, and keep a thoughtful journal along the way.
            </p>
            <label>
              What should we call your adventurer?
              <input
                maxLength={20}
                value={p.name}
                onChange={(e) =>
                  void dispatch({kind:'rename',name:e.target.value||'Adventurer'})
                }
              />
            </label>
            <button className="primary" onClick={() => {W(false);void dispatch({kind:'initialize'});}}>
              Take the first step <ChevronRight size={18} />
            </button>
            <p className="tiny">
              Camera is optional. Pause any time. Your journal is never a score.
            </p>
          </section>
        </div>
      )}
      {panel && panel !== "journal" && (
        <div className="modal-backdrop">
          <section className="modal">
            <div className="card-title">
              <h2>
                {panel === "preview"
                  ? "Prepare for your next chapter"
                  : panel === "inventory"
                    ? "Your satchel"
                    : panel === "shop"
                      ? "The little supply shop"
                      : panel === "alchemy"
                        ? "The alchemist’s notebook"
                        : panel === "ending"
                          ? "You found your stride."
                          : panel === "devices"
                            ? "Your connected adventure"
                            : "Make yourself at home"}
              </h2>
              <button onClick={() => V(null)} aria-label="Close">
                ✕
              </button>
            </div>
            <fieldset disabled={adventure.locked && panel!=="devices"} style={{border:0,padding:0,margin:0,minWidth:0}}>
            {panel === "preview" && encounter && (
              <>
                <p>
                  <strong>{encounter.name}</strong> · {encounter.title}
                </p>
                <div className="phase-preview">
                  {encounter.phases.map((types, i) => (
                    <div key={i}>
                      <small>PHASE {i + 1}</small>
                      <div className="type-row">{types.map(iconType)}</div>
                    </div>
                  ))}
                </div>
                <p>
                  Choose a specialization. It stays fixed for this encounter.
                </p>
                <div className="button-row">
                  {[null, ...p.badges].map((t) => (
                    <button
                      className={chosen === t ? "primary" : "secondary"}
                      key={t ?? "neutral"}
                      onClick={() => CH(t)}
                    >
                      {typeLabel(t)}
                    </button>
                  ))}
                </div>
                <p className="tiny">
                  Leg beats Arm · Arm beats Back · Back beats Leg. Matching your
                  specialization gives ×1.25 power. Dual defenses multiply.
                </p>
                <p>
                  Your moves:{" "}
                  {p.equipped
                    .map((id) => attacks.find((a) => a.id === id)?.name)
                    .join(" · ")}
                </p>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={camera}
                    onChange={(e) => C(e.target.checked)}
                  />
                  Use camera verification
                </label>
                <div className="button-row">
                  <button
                    className="primary"
                    onClick={() => {
                      void dispatch({kind:'startBattle',enemyId:encounter.id,specialization:chosen});
                      V(null);
                    }}
                  >
                    <Swords size={17} />
                    Begin encounter
                  </button>
                  <button onClick={() => V("inventory")}>Change skills</button>
                </div>
              </>
            )}
            {panel === "inventory" && (
              <>
                <p>Equip up to four skills. Choose the mix that suits you.</p>
                <div className="attack-grid">
                  {available(p).map((a) => (
                    <button
                      key={a.id}
                      className={
                        "attack-card " +
                        a.type +
                        (p.equipped.includes(a.id) ? " equipped" : "")
                      }
                      onClick={() => {
                        if (b) {
                          notify("Change equipment between encounters.");
                          return;
                        }
                        if (p.equipped.includes(a.id)) {
                          if (p.equipped.length > 1)
                            void dispatch({kind:'equip',attackIds:p.equipped.filter(x=>x!==a.id)});
                        } else if (p.equipped.length < 4)
                          void dispatch({kind:'equip',attackIds:[...p.equipped,a.id]});
                        else
                          notify(
                            "Unequip a move first; four slots are available.",
                          );
                      }}
                    >
                      <span>
                        {iconType(a.type)}
                        <small>
                          {p.equipped.includes(a.id)
                            ? "✓ equipped"
                            : "available"}
                        </small>
                      </span>
                      <strong>{a.name}</strong>
                      <small>
                        Lv. {(p.upgrades[a.id] ?? 0) + 1} ·{" "}
                        {Math.round(attackFor(a.id, p).damage)} power
                      </small>
                    </button>
                  ))}
                </div>
                <p>
                  Potions {p.items.potion} · Guards {p.items.shield} · Boosts{" "}
                  {p.items.boost} · Ingredients {p.items.ingredient}
                </p>
              </>
            )}
            {panel === "shop" && (
              <>
                <p>
                  Your pocket: <strong>{p.coins} coins</strong>. The Rest House
                  heals for free.
                </p>
                {[
                  {
                    id: "potion",
                    name: "Willow tonic · restores 45 HP",
                    cost: 15,
                  },
                  {
                    id: "shield",
                    name: "Bark guard · halves one hit",
                    cost: 12,
                  },
                  {
                    id: "boost",
                    name: "Bright spark · next series +25%",
                    cost: 20,
                  },
                ].map((x) => (
                  <div className="food-row" key={x.id}>
                    <strong>{x.name}</strong>
                    <button
                      className="secondary"
                      disabled={p.coins < x.cost}
                      onClick={() => {
                        void dispatch({kind:'purchaseItem',item:x.id as 'potion'|'shield'|'boost'});

                      }}
                    >
                      {x.cost} coins
                    </button>
                  </div>
                ))}
                <h3>Grow your skills</h3>
                {available(p).map((a) => {
                  const level = p.upgrades[a.id] ?? 0,
                    cost = 25 * (level + 1);
                  return (
                    <div className="food-row" key={a.id}>
                      <span>
                        {a.name} · Lv. {level + 1}
                      </span>
                      <button
                        disabled={level >= 4 || p.coins < cost}
                        onClick={() =>
                          void dispatch({kind:'upgradeAttack',attackId:a.id})
                        }
                      >
                        {level >= 4 ? "Mastered" : `Upgrade · ${cost} coins`}
                      </button>
                    </div>
                  );
                })}
              </>
            )}
            {panel === "alchemy" && (
              <>
                <p>
                  Discover packaged foods through your journal’s scanner. Each
                  unique product reveals one fictional ingredient — scanning
                  never means eating.
                </p>
                <div className="soft-callout">
                  {p.discoveries.length} discoveries · {p.items.ingredient}{" "}
                  ingredients
                </div>
                <button className="primary" onClick={() => V("journal")}>
                  <BookOpen size={16} />
                  Open food journal
                </button>
                <h3>Brew something useful</h3>
                {[
                  ["potion", "Willow tonic", 1],
                  ["shield", "Bark guard", 1],
                  ["boost", "Bright spark", 2],
                ].map(([id, name, cost]) => (
                  <div className="food-row" key={id}>
                    <span>{name}</span>
                    <button
                      disabled={p.items.ingredient < Number(cost)}
                      onClick={() =>
                        void dispatch({kind:'craftItem',item:String(id) as 'potion'|'shield'|'boost'})
                      }
                    >
                      Craft · {cost} ingredient{Number(cost) > 1 ? "s" : ""}
                    </button>
                  </div>
                ))}
              </>
            )}
            {panel === "devices" && (
              <DevicePanel
                onOpenCloud={async saveId=>{await adventure.controller.openCloud(saveId);V(null);}}
                cloudStatus={adventure.mode==='cloud'?{saveId:adventure.saveId!,readOnly:adventure.readOnly,busy:adventure.busy,requesting:adventure.requesting,safe:b?.turn!=='exercise'&&!quest}:undefined}
                onRequestControl={()=>adventure.controller.requestControl()}
                onReleaseControl={()=>adventure.controller.release()}
                onRefreshCloud={()=>adventure.controller.refresh()}
                onActivityImport={(reading: ImportedHealth) => {
                  N((old) => {
                    const date = new Date(reading.startTime).toLocaleDateString(
                      "en-CA",
                    );
                    const id = "health-" + date;
                    return {
                      ...old,
                      healthImports: [
                        ...(old.healthImports ?? []).filter((x) => x.id !== id),
                        { ...reading, id, date },
                      ],
                      weights:
                        reading.weightKg === null
                          ? old.weights
                          : [
                              ...old.weights.filter((w) => w.id !== id),
                              { id, date, weight: reading.weightKg },
                            ],
                    };
                  });
                  notify(
                    "Reviewed health snapshot saved. No activity calories were automatically added twice.",
                  );
                }}
              />
            )}
            {panel === "menu" && (
              <>
                <div className="button-row">
                  <button className="secondary" onClick={() => V("inventory")}>
                    Skills & items
                  </button>
                  <button className="secondary" onClick={() => V("journal")}>
                    Nutrition journal
                  </button>
                  <button className="secondary" onClick={() => V("devices")}>
                    Devices
                  </button>
                </div>
                <label>
                  Adventure difficulty
                  <select
                    disabled={!!b}
                    value={p.difficulty}
                    onChange={(e) =>
                      void dispatch({kind:'setDifficulty',difficulty:e.target.value as Player['difficulty']})
                    }
                  >
                    <option value="easy">Easy · 85% enemy HP</option>
                    <option value="medium">Medium · standard HP</option>
                    <option value="hard">Hard · 135% enemy HP</option>
                  </select>
                </label>
                <p className="tiny">
                  Difficulty does not increase enemy attack. Movement:
                  WASD/arrows. Interact: E/Enter. Pause/menu: Escape. Your progress saves locally, or through acknowledged commands when a cloud adventure is open.
                </p>
                <p>
                  For Javpato’s girlfriend and Uriel’s brother — may your
                  everyday routines become little adventures.
                </p>
              </>
            )}
            {panel === "ending" && (
              <>
                <div className="big-star">✦</div>
                <p>
                  You crossed the valley, found three kinds of strength, and met
                  the summit with your own effort.
                </p>
                <h2>The greatest adventure was showing up.</h2>
                <p>
                  Willowmere is still here. Keep exploring, keep resting, and
                  keep making the journey your own.
                </p>
                <button className="primary" onClick={() => V(null)}>
                  Back to the village
                </button>
              </>
            )}
            </fieldset>
          </section>
        </div>
      )}
      {quest && (
        <div className="modal-backdrop">
          <section className="modal">
            <div className="card-title">
              <h2>A little village challenge</h2>
              <button onClick={() => void dispatch({kind:'cancelQuest'})} aria-label="Leave quest">
                ✕
              </button>
            </div>
            <p>
              {quest.exercise} · {quest.progress} / {quest.target} units · quest
              level {Math.min(5, (p.quests[quest.exercise] ?? 0) + 1)}
            </p>
            {quest.progress >= quest.target ? (
              <>
                <p>Thank you! Small efforts make a strong village.</p>
                <button
                  className="primary"
                  onClick={() => {
                    const count = p.quests[quest.exercise] ?? 0;
                    void dispatch({kind:'finishQuest'});

                  }}
                >
                  Collect reward
                </button>
              </>
            ) : (
              <>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={camera}
                    onChange={(e) => C(e.target.checked)}
                  />
                  Use camera
                </label>
                {camera ? (
                  <Suspense fallback={<p>Preparing camera…</p>}>
                    <ExerciseCamera
                      exerciseId={quest.exercise}
                      target={quest.target}
                      progress={quest.progress}
                      active={!adventure.readOnly&&!adventure.error&&!pauseRequested}
                      onUnit={onUnit}
                      onError={notify}
                    />
                  </Suspense>
                ) : (
                  <>
                    <p className="notice">
                      Manual confirmation is unverified. Take your time and stop
                      if you need to.
                    </p>
                    <button
                      className="primary"
                      onClick={() => void dispatch({kind:'manualQuest',sessionId:quest.id})}
                    >
                      I completed the exercise
                    </button>
                  </>
                )}
                <button onClick={() => void dispatch({kind:'cancelQuest'})}>Stop safely</button>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

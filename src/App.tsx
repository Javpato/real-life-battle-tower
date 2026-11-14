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
  Maximize2,
  Minimize2,
} from "lucide-react";
import World from "./game/World";
import {GuidedTutorial, HelpGuide, getGuideSteps, type GuideScope, type GuideStep} from "./tutorial";
import {RESIDENT_STORIES,residentText} from "./story/residents";
import Introduction from "./opening/Introduction";
import { WORLD_MAPS, ROOM_DETAILS } from "./core/worldMaps";
import { readSlotNutrition, writeSlotNutrition } from "./services/saveSlots";
import BattleCommandMenu from "./ui/BattleCommandMenu";
import BattleSprite, { ItemSprite } from "./game/BattleSprite";
import { battlefieldUrl } from "./game/assets";
import ExerciseLibrary from "./exercises/ExerciseLibrary";
import { EXERCISE_GUIDES } from "./exercises/ExerciseDemo";
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
  sortedAttacks,
  unlockDescription,
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
import { useAdventure } from "./services/useAdventure";
import { useNutritionSync } from "./services/useNutritionSync";
import NutritionSyncStatus from "./services/NutritionSyncStatus";
import type { AdventureCommand } from "./core/commands";
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
export default function App({localSaveId,onReturnToTitle,initialPanel=null}:{localSaveId?:string;onReturnToTitle?:()=>void;initialPanel?:string|null}) {
  const adventure = useAdventure(localSaveId);
  const journey=adventure.snapshot.journey;
  const heroId=journey?.avatar === "female" ? "hero-female" : "hero";
  const [helpOpen,setHelpOpen]=useState(false);
  const [tourScope,setTourScope]=useState<GuideScope|null>(null),[tourIndex,setTourIndex]=useState(0);
  const [journalTab,setJournalTab]=useState("Today");
  const [resident,setResident]=useState<string|null>(null),[detail,setDetail]=useState<{title:string;text:string}|null>(null);
  const [replayIntro,setReplayIntro]=useState(false);
  const { player: p, battle: b, quest } = adventure.snapshot;
  const ready = adventure.ready;
  const [n, N] = useState<NutritionState>(defaultNutrition),
    [nutritionReady, NR] = useState(false),
    [panel, V] = useState<string | null>(initialPanel),
    [encounter, E] = useState<Enemy | null>(null),
    [chosen, CH] = useState<Element | null>(null),
    [camera, C] = useState(true),
    [muted, MU] = useState(false),
    [toast, TO] = useState(""),
    [welcome, W] = useState(false),
    [journalError, SE] = useState("");
  const [fullscreen, setFullscreen] = useState(
    Boolean(document.fullscreenElement),
  );
  const [autoTour,setAutoTour]=useState<{scope:GuideScope;index:number}|null>(null);
  const [cameraExpanded, setCameraExpanded] = useState(false);
  const [hitDamage, setHitDamage] = useState(0);
  const previousHp = useRef<{ id: string; hp: number } | null>(null);
  useEffect(() => {
    const old = previousHp.current;
    previousHp.current = b ? { id: b.id, hp: b.enemyHp } : null;
    if (!b || !old || old.id !== b.id || old.hp <= b.enemyHp) return;
    setHitDamage(old.hp - b.enemyHp);
    const timer = setTimeout(() => setHitDamage(0), 650);
    return () => clearTimeout(timer);
  }, [b?.id, b?.enemyHp]);
  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  useEffect(() => setCameraExpanded(false), [b?.id, b?.turn]);
  async function useCameraMode(){C(true);setCameraExpanded(true);if(b?.paused)await dispatch({kind:'pause',paused:false});}
    async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen)
        await document.documentElement.requestFullscreen();
      else
        notify(
          "Your browser does not support fullscreen. The adventure still fills this window.",
        );
    } catch {
      notify(
        "Fullscreen is unavailable here. You can continue playing in this window.",
      );
    }
  }
  const cloudDiary = adventure.mode === "cloud";
  const nutritionCloud = useNutritionSync(
    cloudDiary ? adventure.saveId! : null,
  );
  const diary = cloudDiary ? nutritionCloud.state : n;
  const diaryReady = cloudDiary ? nutritionCloud.ready : nutritionReady;
  const localDiaryWrites=useRef<Promise<void>>(Promise.resolve());
  const [localDiaryPending,setLocalDiaryPending]=useState(0),[journalReadAttempt,retryJournalRead]=useState(0);
  const updateDiary = (next: NutritionState) => {
    if (cloudDiary) { nutritionCloud.update(next); return; }
    const snapshot=structuredClone(next),scope=localSaveId;
    setLocalDiaryPending(count=>count+1);
    // Show new records only after the atomic IndexedDB write has committed.
    // Hydrating a save must never write an empty/default journal over that save.
    localDiaryWrites.current=localDiaryWrites.current.catch(()=>{}).then(async()=>{
      await (scope?writeSlotNutrition(scope,snapshot):writeSave('nutrition',snapshot));
      N(snapshot);SE('');
    }).catch(()=>SE('The journal could not be saved. Please retry this change.')).finally(()=>setLocalDiaryPending(count=>count-1));
  };
  const saveError = adventure.error || journalError;
  const [pauseRequested, PR] = useState(false);
  const dispatch = async (command: AdventureCommand) => {
    const stop =
      (command.kind === "pause" && command.paused) ||
      ["cancelSeries", "stopSafely", "cancelQuest", "leaveBattle"].includes(
        command.kind,
      );
    if (stop) PR(true);
    const ok = await adventure.send(command);
    if (ok && stop) PR(false);
    return ok;
  };
  useEffect(() => {
    if (adventure.fresh && !localSaveId) W(true);
  }, [adventure.fresh]);
  useEffect(() => {
    if (!adventure.error && !adventure.busy) PR(false);
  }, [adventure.error, adventure.busy]);
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
  useEffect(() => {
    let alive=true;NR(false);
    void (localSaveId ? readSlotNutrition<NutritionState>(localSaveId) : readSave<NutritionState>('nutrition'))
      .then(saved=>{if(alive){N(saved??defaultNutrition());NR(true);}})
      .catch(()=>{if(alive){SE('Could not open the local journal. Your saved records have not been changed.');NR(false);}});
    return ()=>{alive=false;};
  }, [localSaveId,journalReadAttempt]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => TO(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (b?.turn !== "enemy" || b.paused || adventure.locked) return;
    const timer = setTimeout(
      () => void dispatch({ kind: "resolveEnemy" }),
      1100,
    );
    return () => clearTimeout(timer);
  }, [b?.turn, b?.paused, adventure.locked]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (panel) V(null);
        else if (b) void dispatch({ kind: "pause", paused: !b.paused });
        else if (quest) void dispatch({ kind: "cancelQuest" });
        else V(panel ? null : "menu");
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [b, panel, quest, adventure.locked]);
  function notify(s: string) {
    TO(s);
    if (!muted) sound();
  }
  function interact(id: string) {
    if (b || panel || quest || adventure.locked) return;
    setResident(id);
    if(id === "trainer-1" && (journey?.tutorialStage??6)<4){void dispatch({kind:"guideEvent",event:"talk"}); if((journey?.tutorialStage??0)===1)void dispatch({kind:"setTutorial",stage:2}); V("tutorial");return;}
    if((journey?.tutorialStage??6)<6 && (id.startsWith('trainer')||id.startsWith('leader')||id.startsWith('quest')||id==='rival')){V('resident');return;}
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
      void exercise; V("resident");
    } else if (id === "healer") {
      V("healer");
    } else V(id);
  }
  async function onUnit(
    unit: ExerciseUnit,
    sessionId?: string,
  ): Promise<boolean> {
    const captured = sessionId ?? b?.sessionId ?? quest?.id;
    if (!captured) return false;
    const accepted = b
      ? await dispatch({ kind: "exerciseUnit", unit, sessionId: captured })
      : quest
        ? await dispatch({ kind: "questUnit", unit, sessionId: captured })
        : false;
    if (!accepted) return false;
    const saved = adventure.controller.state.snapshot;
    return Boolean(
      (saved.battle?.sessionId === captured &&
        saved.battle.seen.includes(unit.id)) ||
      (saved.quest?.id === captured && saved.quest.seen.includes(unit.id)),
    );
  }
  function manualSeries() {
    if (b) void dispatch({ kind: "manualRemaining", sessionId: b.sessionId });
  }
  async function finishBattle() {
    if (!b) return;
    const won = b.turn === "won",
      rival = b.enemy.id === "rival";
    if (await dispatch({ kind: "finishBattle" })) {
      notify(
        won ? "Victory! Your effort is saved." : "Restored at the Rest House.",
      );
      if (won && !muted) sound("win");
      if (won && rival) V("ending");
    }
  }
  function item(key: string) {
    void dispatch({
      kind: "useItem",
      item: key as "potion" | "shield" | "boost",
    });
  }
  function discover(barcode: string) {
    void dispatch({ kind: "discoverFood", barcode });
  }
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
  useEffect(()=>{if(!ready)return;const timer=setInterval(()=>{if(!document.hidden&&!adventure.locked)void adventure.send({kind:'playTime',seconds:15})},15000);return()=>clearInterval(timer)},[ready,adventure.locked,adventure.controller]);
  useEffect(()=>{if(journey?.location.mapId==='starter_town'&&journey.tutorialStage===0)void adventure.send({kind:'setTutorial',stage:1})},[journey?.location.mapId,journey?.tutorialStage]);
  const previousPanel=useRef<string|null>(null),returnFocus=useRef<HTMLElement|null>(null);
  useEffect(()=>{if(panel&&!previousPanel.current)returnFocus.current=document.activeElement as HTMLElement;if(!panel&&previousPanel.current){requestAnimationFrame(()=>returnFocus.current?.focus())}previousPanel.current=panel},[panel]);
  function openHelp(){if(b)void dispatch({kind:"pause",paused:true});setHelpOpen(true);}
  const recordedGuidePanel=useRef<string|null>(null);
  useEffect(()=>{if(!ready)return;const previous=recordedGuidePanel.current;recordedGuidePanel.current=panel;if(['inventory','map','journal'].includes(panel??'')&&!journey?.guide?.completed.includes(panel!))void dispatch({kind:'guideEvent',event:panel!});if(previous&&!panel&&!journey?.guide?.completed.includes('close'))void dispatch({kind:'guideEvent',event:'close'});},[panel,ready]);
  const guideDone=(id:string)=>Boolean(journey?.guide?.completed.includes(id));
  const scope:GuideScope|null=panel==='journal'?({Today:'journal-today',Food:'journal-food',Activity:'journal-activity',Progress:'journal-progress',Profile:'journal-settings'} as Record<string,GuideScope>)[journalTab]??'journal-today':panel==='menu'?'settings':['inventory','map','shop','alchemy','devices'].includes(panel??'')?panel as GuideScope:quest?'quest':b?(b.turn==='exercise'?'camera':'battle'):null;
  const contextual=autoTour&&autoTour.scope===scope?getGuideSteps(autoTour.scope)[autoTour.index]:undefined;
  let mandatory:GuideStep|undefined;
  if(journey && journey.tutorialStage<6 && !b && !quest){
    if(panel==='tutorial')mandatory=!guideDone('close')?{id:'close',target:'modal-close',title:'Try closing a window',body:'Press the highlighted X once. Then speak to Moss again to begin your practice.'}:{id:'practice',target:'tutorial-practice',title:'Your first friendly match',body:'Choose Attack, then three squats or three chair rises. Camera and manual mode are both available.'};
    else if(!panel){
      if(journey.tutorialStage===0)mandatory=!guideDone('move')?{id:'move',target:'world-move',title:'Take a few steps',body:'Use WASD or arrow keys. On a touchscreen, hold a direction on the pad. Walk a short distance.'}:!guideDone('turn')?{id:'turn',target:'world-move',title:'Try another direction',body:'Turn left or right and walk a few more steps. You control the pace.'}:{id:'door',target:'world-door',title:'Find the door',body:'Walk to the lower doorway, then continue through your home to the front door. Press E or the interaction button near a doorway.'};
      else if(journey.tutorialStage<4)mandatory={id:'talk',target:'world-interact',title:'Meet Moss outside your home',body:'Follow the path to Moss, beside your home. Approach him, then press E or tap the interaction button.'};
      else if(journey.tutorialStage===5){const missing=['inventory','map','journal'].find(id=>!guideDone(id));if(missing)mandatory={id:missing,target:missing==='inventory'?'open-inventory':missing==='map'?'open-map':'open-journal',title:missing==='inventory'?'Open your satchel':missing==='map'?'Find your next destination':'Open your field journal',body:missing==='inventory'?'Open the highlighted button to see skills and supplies, then close it.':missing==='map'?'Open the map to locate the three gyms and the trail, then close it.':'Open the diary to see where food and movement are recorded. You do not need to enter any personal data.'};}
    }
  }
  if(b?.enemy.id==='tutorial-moss' && !panel){mandatory=b.turn==='player'?{id:'attack',target:'battle-actions',title:'Choose your first move',body:'Press Attack, then choose Squat or Root Rise. Both are a short practice of three movements. Uncheck Camera here if you prefer manual play.'}:b.turn==='exercise'?{id:'practice-movement',target:camera?'camera-setup':'manual-confirm',title:camera?'Prepare, then move at your pace':'Manual practice',body:camera?'Follow the starting-position guide. Each accepted movement deals damage. Rest pauses the series; Recalibrate gives you five seconds to move back into place. You can switch to manual continuation below.':'Try three comfortable movements. Press the highlighted confirmation when finished. Manual completion is recorded as unverified, and the reward is the same.'}:b.turn==='won'?{id:'reward',target:'battle-finish',title:'Your first victory',body:'These are your earned XP and coins. Continue to discover your skills, the map and your journal.'}:undefined;}
  useEffect(()=>{if(!ready||!scope||mandatory){setAutoTour(null);return;}if(!journey?.guide?.seen.includes('auto:'+scope)){setAutoTour({scope,index:0});void dispatch({kind:'guideSeen',id:'auto:'+scope});}else setAutoTour(null);},[scope,ready,Boolean(mandatory)]);
  const activeGuide=helpOpen?null:tourScope?getGuideSteps(tourScope)[tourIndex]:mandatory??contextual??null;
  const tutorialOverlay=<><GuidedTutorial step={activeGuide} onAcknowledge={id=>{if(tourScope){if(tourIndex+1<getGuideSteps(tourScope).length)setTourIndex(tourIndex+1);else setTourScope(null);}else if(autoTour){if(autoTour.index+1<getGuideSteps(autoTour.scope).length)setAutoTour({...autoTour,index:autoTour.index+1});else setAutoTour(null);void dispatch({kind:'guideSeen',id});}}} onDismiss={activeGuide?.actionLabel?()=>{setAutoTour(null);setTourScope(null);}:undefined} onHelp={()=>openHelp()}/>{helpOpen&&<HelpGuide scope={scope??'settings'} onClose={()=>setHelpOpen(false)} onStartGuide={next=>{setTourScope(next);setTourIndex(0);setHelpOpen(false);}}/>}</>;
  if(ready && journey && (!journey.introComplete || replayIntro))return <Introduction name={p.name} avatar={journey.avatar} onDone={()=>{setReplayIntro(false);if(!journey.introComplete)void dispatch({kind:'completeIntro'})}}/>;
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
      <>
        {tutorialOverlay}<button className="journal-guide-help" onClick={()=>openHelp()}>Help · Where is this button?</button>
        {diaryReady ? (
          <Journal
            state={diary}
            syncPanel={cloudDiary?<NutritionSyncStatus sync={nutritionCloud}/>:<p role="status">{journalError||(localDiaryPending?"Saving journal…":"Journal saved on this device")}</p>}
            onChange={updateDiary}
            storageScope={cloudDiary ? "cloud" : "local"}
            onDeleteJournal={cloudDiary ? nutritionCloud.deleteAll : undefined}
            onClose={() => V(null)}
            onDiscover={discover}
            onGuideEvent={event=>{if(event.startsWith("journal:tab:"))setJournalTab(event.slice(12));}}
          />
        ) : (
          <section className="loading">
            <h1>{journalError?"Journal unavailable":"Opening your journal…"}</h1>{journalError&&<><p>{journalError}</p><button onClick={()=>retryJournalRead(value=>value+1)}>Retry opening journal</button></>}
            <p>
              {cloudDiary
                ? nutritionCloud.status
                : "Loading the local journal."}
            </p>
            <button onClick={() => V(null)}>Return to adventure</button>
          </section>
        )}
      </>
    );
  return (
    <div
      className={`adventure-app immersive-game ${b ? "mode-battle" : "mode-explore"}${b?.turn === "exercise" ? " is-series" : ""} input-${camera ? "camera" : "manual"}${cameraExpanded ? " camera-expanded" : ""}`}
      onPointerDown={() => {
        if (!audioReady.current) {
          audioReady.current = true;
          setVolume(muted ? 0 : 0.25);
          void startMusic("village");
        }
      }}
    >
      {tutorialOverlay}
      <header className="game-header" inert={Boolean(panel || welcome || quest || helpOpen)}>
        <button className="brand" onClick={() => V(null)}>
          <span className="brand-mark">✦</span>
          <span>
            everstride<small>YOUR EVERYDAY ADVENTURE</small>
          </span>
        </button>
        <nav>
          <button data-guide="open-journal"
            onClick={() => {
              if (b) void dispatch({ kind: "pause", paused: true });
              V("journal");
            }}
          >
            <BookOpen size={17} />
            Journal
          </button>
        </nav>
        <div className="header-right">
          <span className="local-pill">
            <i />{" "}
            {adventure.mode === "cloud"
              ? adventure.error
                ? "Cloud · stopped"
                : adventure.readOnly
                  ? "Cloud · viewing"
                  : adventure.busy
                    ? "Cloud · saving"
                    : "Cloud · in control"
              : "Saved locally"}
          </span>
          <div className="game-hud-controls">
            {b && !(b.turn === "exercise" && camera) && (
              <button
                className="arena-toggle"
                aria-expanded={cameraExpanded}
                onClick={() => setCameraExpanded((value) => !value)}
              >
                <Camera size={18} />{" "}
                {cameraExpanded ? "Close camera controls" : "Camera controls"}
              </button>
            )}
            <button
              data-guide="fullscreen" className="icon-button fullscreen-toggle"
              onClick={() => void toggleFullscreen()}
              aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              title={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {fullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
          </div>
          <button
            className="icon-button"
            onClick={() => MU(!muted)}
            data-guide="sound" aria-label="Toggle sound"
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button
            className="icon-button"
            onClick={() => {
              if (b) void dispatch({ kind: "pause", paused: true });
              V("menu");
            }}
            data-guide="open-settings" aria-label="Settings"
          >
            <Settings size={18} />
          </button>
          <span className="avatar">{p.name.slice(0, 1).toUpperCase()}</span>
        </div>
      </header>
      {adventure.mode === "cloud" &&
        adventure.busy &&
        b?.turn === "exercise" &&
        !b.paused && (
          <div role="status" style={{ padding: "8px 24px" }}>
            <button
              className="secondary"
              onClick={() => void dispatch({ kind: "pause", paused: true })}
              disabled={pauseRequested}
            >
              {pauseRequested
                ? "Recognition stopped · saving pause…"
                : "Pause exercise now"}
            </button>
            <span>
              {" "}
              Recognition can stop immediately while the cloud confirms your
              progress.
            </span>
          </div>
        )}
      <main
        inert={Boolean(panel || welcome || quest || helpOpen)}
        className={
          "game-main" + (b?.turn === "exercise" ? " exercise-session" : "")
        }
      >
        {!b && (
          <>
            <section className="game-hud-player" aria-label="Your adventurer">
              <BattleSprite id={heroId} className="hud-portrait" />
              <div>
                <strong>
                  {p.name} <small>Lv. {p.level}</small>
                </strong>
                <div className="hp-track">
                  <span style={{ width: `${(p.hp / p.maxHp) * 100}%` }} />
                </div>
                <div
                  className="xp-track"
                  aria-label={`${p.xp} of ${xpNeeded(p.level)} XP`}
                >
                  <span
                    style={{ width: `${(p.xp / xpNeeded(p.level)) * 100}%` }}
                  />
                </div>
                <small>
                  <Heart size={12} /> {Math.ceil(p.hp)} / {p.maxHp}{" "}
                  <Coins size={12} /> {p.coins}
                </small>
              </div>
            </section>
            <button
              className="game-hud-objective"
              onClick={() => V("menu")}
              aria-label="Adventure progress"
            >
              <span>{WORLD_MAPS[journey?.location.mapId??"starter_town"]?.name??"Willowmere"}</span>
              <strong>
                {p.ending
                  ? "The summit is yours"
                  : p.badges.length === 3
                    ? "Challenge Rowan at the summit"
                    : "Find your strength"}
              </strong>
              <small>
                {p.coins} coins · {p.badges.length} / 3 badges ·{" "}
                {p.badges.length === 3
                  ? "Final rival unlocked"
                  : "Visit the three gyms"}
              </small>
            </button>
          </>
        )}
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
        <div
          className={
            "game-layout" +
            (b ? " is-battle" : "") +
            (b?.turn === "exercise" ? " is-exercising" : "")
          }
        >
          <section className="world-card">
            <div
              className="world-scene"
              inert={adventure.locked}
              style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
            >
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
                    key={adventure.mode + ":" + (adventure.saveId ?? "local") + ":" + journey?.location.mapId}
                    paused={!!panel || !!quest || welcome || helpOpen || adventure.locked}
                    badges={p.badges}
                    quests={p.quests}
                    defeated={p.defeated}
                    position={journey?.location ?? p.position}
                    mapId={journey?.location.mapId}
                    avatar={journey?.avatar}
                    tutorialStage={journey?.tutorialStage}
                    facing={journey?.location.facing}
                    onTransition={async(portalId)=>{const to=WORLD_MAPS[journey?.location.mapId??'starter_town']?.portals.find(p=>p.id===portalId)?.to;if((journey?.tutorialStage??6)<6&&to&&['training_route','rival_town','rival_arena'].includes(to)){notify('Finish your first training with Moss before exploring the trail.');return false;}return dispatch({kind:'portal',portalId})}}
                    onPosition={(position)=>{if(!adventure.locked&&!quest&&!b&&!panel)void dispatch({kind:'location',mapId:journey?.location.mapId??'starter_town',x:position.x,y:position.y,facing:position.facing??'down'})}}
                    onMove={(position)=>{if(!adventure.locked&&!quest&&!b&&!panel)void dispatch({kind:'location',mapId:journey?.location.mapId??'starter_town',x:position.x,y:position.y,facing:position.facing??'down'})}}
                    onInteract={interact}
                    onInspect={(id)=>{const object=ROOM_DETAILS[id];if(object){setDetail({title:object.title,text:object.text});V("detail");}}}
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
                  <div
                    className={`battle-stage${hitDamage > 0 ? " battle-hit" : ""}${b.turn === "transform" ? " battle-transform" : ""}${b.turn === "won" ? " battle-victory" : ""}`}
                    style={{ backgroundImage: `url("${battlefieldUrl()}")` }}
                  >
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
                          style={{
                            width: `${(b.enemyHp / b.enemy.hp) * 100}%`,
                          }}
                        />
                      </div>
                      <small>
                        {Math.ceil(b.enemyHp)} / {Math.ceil(b.enemy.hp)} HP
                      </small>
                    </div>
                    {hitDamage > 0 && (
                      <span
                        className="damage-burst"
                        aria-label={`${hitDamage.toFixed(1)} damage`}
                      >
                        −{Math.round(hitDamage)}
                      </span>
                    )}
                    <BattleSprite
                      id={b.enemy.id === "tutorial-moss" ? "trainer-1" : b.enemy.id}
                      className={
                        "combat-sprite enemy " + b.enemy.phases[b.phase][0]
                      }
                    />
                    <BattleSprite
                      id={heroId}
                      variant="back"
                      className="combat-sprite hero"
                    />
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
                    {b.turn === "exercise" && !camera && b.attack && (
                      <section
                        className="manual-exercise-guide"
                        aria-label="Manual exercise"
                      >
                        <span>MANUAL · UNVERIFIED</span>
                        <h2>{b.attack.name}</h2>
                        <strong>
                          {b.progress} / {b.attack.units}
                        </strong>
                        <p>
                          <b>Starting position:</b>{" "}
                          {EXERCISE_GUIDES[b.attack.exercise].setup}
                        </p>
                        <small>
                          Confirm when you have completed the remaining{" "}
                          {b.attack.exercise === "superman"
                            ? "seconds"
                            : "repetitions"}
                          . Rest whenever you need.
                        </small>
                      </section>
                    )}
                  </div>
                  <div className="battle-actions">
                    {b.paused && b.turn !== "exercise" ? (
                      <div className="pause-message">
                        <h2>Take your time.</h2>
                        <p>
                          Your progress is safe. Nothing happens while you rest.
                        </p>
                        <button
                          className="primary"
                          onClick={() =>
                            void dispatch({ kind: "pause", paused: false })
                          }
                        >
                          <Play size={16} />
                          Resume
                        </button>
                        <button onClick={() => V("journal")}>
                          Open journal
                        </button>
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
                        <button data-guide="battle-finish" className="primary" onClick={finishBattle}>
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
                            void dispatch({ kind: "continuePhase" })
                          }
                        >
                          Continue when ready
                        </button>
                      </div>
                    ) : b.turn === "exercise" ? null : b.turn === "enemy" ? (
                      <div className="pause-message">
                        <p>{b.enemy.name} is responding…</p>
                        <button
                          onClick={() =>
                            void dispatch({ kind: "pause", paused: true })
                          }
                        >
                          Pause safely
                        </button>
                      </div>
                    ) : (
                      <BattleCommandMenu
                        key={b.turn + ":" + b.paused}
                        player={p}
                        battle={b}
                        camera={camera}
                        onCamera={C}
                        dispatch={dispatch}
                        onItem={item}
                      />
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
                    if (b) void dispatch({ kind: "pause", paused: true });
                    V("journal");
                  }}
                >
                  <BookOpen size={16} />
                  Open your journal <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </section>
          <aside className="adventure-sidebar">
            {b ? (
              <section className="card camera-card">
                <div className="camera-card-meta">
                  <div className="exercise-battle-strip">
                    <strong>{b.enemy.name}</strong>
                    <span>
                      {Math.ceil(b.enemyHp)} / {Math.ceil(b.enemy.hp)} HP
                    </span>
                    <div className="hp-track">
                      <span
                        style={{ width: `${(b.enemyHp / b.enemy.hp) * 100}%` }}
                      />
                    </div>
                    <small>
                      Your HP: {Math.ceil(b.playerHp)} / {p.maxHp}
                    </small>
                  </div>
                  <div
                    className="exercise-mode-switch"
                    aria-label="Exercise input mode"
                  >
                    <button
                      aria-pressed={camera}
                      onClick={()=>void useCameraMode()}
                    >
                      Camera mode
                    </button>
                    <button
                      aria-pressed={!camera}
                      disabled={b.turn === "exercise"}
                      onClick={() => C(false)}
                    >
                      Manual mode
                    </button>
                    {b.turn === "exercise" && (
                      <small>
                        Input mode stays fixed during the series. Camera preview
                        can always be restarted.
                      </small>
                    )}
                  </div>
                </div>
                <Suspense fallback={<p>Preparing camera controls…</p>}>
                  <ExerciseCamera
                    key={b.id}
                    sessionId={b.sessionId}
                    lastSide={b.side}
                    exerciseId={
                      (b.attack ?? attackFor(p.equipped[0] ?? attacks[0].id, p))
                        .exercise
                    }
                    target={
                      (b.attack ?? attackFor(p.equipped[0] ?? attacks[0].id, p))
                        .units
                    }
                    progress={b.progress}
                    mode={camera ? "camera" : "manual"}
                    onRequestCameraMode={()=>void useCameraMode()}
                    muted={muted}
                    paused={b.paused || pauseRequested}
                    sessionComplete={Boolean(
                      b.attack &&
                      (b.progress >= b.attack.units ||
                        b.turn === "won" ||
                        b.turn === "transform"),
                    )}
                    active={
                      camera &&
                      b.turn === "exercise" &&
                      !b.paused &&
                      !adventure.readOnly &&
                      !adventure.error &&
                      !pauseRequested
                    }
                    onUnit={(u) => onUnit(u, b.sessionId)}
                    onError={notify}
                  />
                </Suspense>
              </section>
            ) : (
              <>
                <section className="card player-card">
                  <div className="player-heading">
                    <BattleSprite id={heroId} className="profile-portrait" />
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
                      {Math.ceil(p.hp)} <small>/ {p.maxHp}</small>
                    </strong>
                  </div>
                  <div className="hp-track">
                    <span
                      style={{
                        width: `${(p.hp / p.maxHp) * 100}%`,
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
        {b?.turn === "exercise" && (
          <section
            className="series-command-dock"
            aria-label="Exercise actions"
          >
            <div className="series-dock-title">
              <strong>{b.attack?.name}</strong>
              <small>
                {camera ? "Camera verification" : "Manual · unverified"} ·{" "}
                {b.progress} / {b.attack?.units}
              </small>
            </div>
            <button
              className="primary"
              onClick={() =>
                void dispatch({ kind: "pause", paused: !b.paused })
              }
            >
              <Pause size={18} />
              {b.paused ? "Resume" : "Rest"}
            </button>
            {!camera && (
              <button
                className="primary"
                disabled={b.paused || adventure.locked}
                data-guide="manual-confirm" onClick={manualSeries}
              >
                <Check size={18} />I completed the remaining units
              </button>
            )}
            <button
              className="secondary"
              onClick={() => void dispatch({ kind: "cancelSeries" })}
            >
              End series & turn
            </button>
            {camera && (
              <button
                className="manual-fallback"
                onClick={() => {
                  C(false);
                  notify(
                    "Manual continuation is unverified. Already earned damage is kept. Camera mode is available next turn.",
                  );
                }}
              >
                Detection trouble? Continue remaining units manually
              </button>
            )}
          </section>
        )}
        <div className="quick-actions"><button data-guide="open-map" onClick={()=>V("map")}><Map size={18}/> Map</button><button onClick={()=>openHelp()}>Help</button>
          <button data-guide="open-inventory" onClick={() => V("inventory")}>
            <Backpack size={18} />
            Satchel & skills
          </button>
          <button onClick={() => V("exercises")}>
            <Play size={18} />
            Exercise guide
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
      </main>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      {(saveError || adventure.mode === "cloud") && (
        <section className="notice adventure-cloud-status" style={{ margin: 20 }} role="status">
          <strong>
            {adventure.mode === "cloud"
              ? `Cloud adventure ${adventure.saveId?.slice(0, 8)} · revision ${adventure.revision}`
              : "Adventure status"}
          </strong>
          <p>
            {saveError ||
              "Only server-accepted actions change this adventure. Your local adventure and journal remain separate."}
          </p>
          <p>{adventure.pending} pending action(s)</p>
          <div className="button-row">
            {adventure.error && adventure.pending > 0 && (
              <>
                <button
                  onClick={() =>
                    void adventure.controller
                      .retry()
                      .catch((e) => notify(String(e)))
                  }
                >
                  Retry pending actions
                </button>
                <button
                  onClick={() => {
                    if (
                      confirm(
                        "Discard these unacknowledged actions and reload the cloud snapshot? A local audit copy is retained.",
                      )
                    )
                      void adventure.controller.discardPending();
                  }}
                >
                  Discard pending & refresh
                </button>
              </>
            )}
            {adventure.mode === "cloud" && (
              <>
                <button onClick={() => V("devices")}>Cloud controls</button>
                <button
                  disabled={adventure.busy}
                  onClick={() =>
                    void adventure.controller
                      .returnLocal()
                      .catch((e) => notify(String(e)))
                  }
                >
                  Return to local adventure
                </button>
              </>
            )}
          </div>
        </section>
      )}
      {!b && !panel && !quest && journey && journey.tutorialStage>=4 && journey.tutorialStage<6 && !mandatory && <aside className="tutorial-ribbon"><strong>{journey.tutorialStage===0?(journey.location.mapId==='starter_house_bedroom'?'WASD / ARROWS TO MOVE · FIND THE DOOR':'WALK TO THE FRONT DOOR'):journey.tutorialStage===1?'MEET MOSS OUTSIDE · PRESS E TO TALK':journey.tutorialStage<4?'TALK TO MOSS FOR YOUR FIRST BATTLE':journey.tutorialStage===4?'WELL DONE! YOU EARNED XP AND COINS':'THREE GYMS. THREE BADGES. YOUR OWN PATH.'}</strong>{journey.tutorialStage===4&&<p>Use coins at Jun’s shop to buy supplies and improve skills.</p>}{journey.tutorialStage===5&&<p>Visit Terra, Flint and Zephyr. Explore Fernway Trail, then meet Rowan at Summit Hollow.</p>}{journey.tutorialStage>=4&&<button disabled={journey.tutorialStage===5&&!['move','turn','door','talk','close','inventory','map','journal'].every(guideDone)} onClick={()=>void dispatch({kind:'setTutorial',stage:journey.tutorialStage+1})}>Continue</button>}</aside>}
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
                  void dispatch({
                    kind: "rename",
                    name: e.target.value || "Adventurer",
                  })
                }
              />
            </label>
            <button
              className="primary"
              onClick={() => {
                W(false);
                void dispatch({ kind: "initialize" });
              }}
            >
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
          <section data-guide={panel==='menu'?'settings':panel??undefined} className="modal">
            <div className="card-title">
              <h2>
                {panel === "exercises"
                  ? "Your home exercise guide"
                  : panel === "preview"
                    ? "Prepare for your next chapter"
                    : panel === "inventory"
                      ? "Your satchel"
                      : panel === "shop"
                        ? "The little supply shop"
                        : panel === "healer"
                          ? "The Rest House"
                          : panel === "alchemy"
                            ? "The alchemist’s notebook"
                            : panel === "ending"
                              ? "You found your stride."
                              : panel === "devices"
                                ? "Your connected adventure"
                                : "Make yourself at home"}
              </h2>
              <button data-guide="modal-close" onClick={() => V(null)} aria-label="Close">
                ✕
              </button>
            </div>
            <fieldset
              disabled={adventure.locked && panel !== "devices"}
              style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
            >
              {panel === 'map' && <section aria-label="Valley map"><svg viewBox="0 0 600 310" role="img" aria-label="Willowmere connected by Fernway Trail to Summit Hollow" style={{width:'100%',background:'#203c3b',borderRadius:8}}><path d="M95 220 Q200 290 295 165 T500 75" stroke="#d3b67a" strokeWidth="16" fill="none"/>{[[95,220,'Willowmere'],[295,165,'Fernway Trail'],[500,75,'Summit Hollow']].map(([x,y,name])=><g key={name}><rect x={Number(x)-30} y={Number(y)-30} width="60" height="50" fill="#eed5a0" stroke="#8a6142" strokeWidth="5"/><text x={x} y={Number(y)+45} textAnchor="middle" fill="#fff1ce" fontSize="17">{name}</text></g>)}</svg><p>You are in {WORLD_MAPS[journey?.location.mapId??'starter_town']?.name}. The three gyms are in Willowmere. Follow the southern trail to Summit Hollow; Rowan's arena requires all three badges.</p></section>}
              {resident && RESIDENT_STORIES[resident] && ['resident','preview','shop','alchemy','healer'].includes(panel) && <section className="resident-story"><BattleSprite id={resident} className="profile-portrait"/><h3>{RESIDENT_STORIES[resident].name} · {RESIDENT_STORIES[resident].role}</h3><p>{residentText(resident,p)}</p>{panel==='resident'&&((journey?.tutorialStage??6)<6?<p>Moss is waiting near your home. Finish your first practice together, then come back for this challenge.</p>:<button className="primary" onClick={async()=>{if(resident.startsWith('quest-')&&await dispatch({kind:'startQuest',exercise:resident.slice(6) as ExerciseId}))V(null)}}>Begin training challenge</button>)}</section>}
              {panel==='detail'&&detail&&<><h3>{detail.title}</h3><p>{detail.text}</p></>}
              {panel === 'tutorial'  && <><BattleSprite id="trainer-1" className="profile-portrait"/><h3>Moss · Your first steps</h3><p>Let's try a short practice battle. Choose Attack, then Squat or Root Rise (chair sit-to-stand). The guide will help you position your camera. Three complete movements are enough. You can also choose manual mode.</p><p>Every valid repetition deals damage immediately. Pause whenever you need a break.</p><button data-guide="tutorial-practice" className="primary" disabled={!guideDone("close")} onClick={async()=>{if(await dispatch({kind:'startTutorialBattle'}))V(null)}}>Practice with Moss</button></>}
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
                    Leg beats Arm · Arm beats Back · Back beats Leg. Matching
                    your specialization gives ×1.25 power. Dual defenses
                    multiply.
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
                        void dispatch({
                          kind: "startBattle",
                          enemyId: encounter.id,
                          specialization: chosen,
                        });
                        V(null);
                      }}
                    >
                      <Swords size={17} />
                      Begin encounter
                    </button>
                    <button onClick={() => V("inventory")}>
                      Change skills
                    </button>
                  </div>
                </>
              )}
              {panel === "exercises" && <ExerciseLibrary />}
              {panel === "inventory" && (
                <>
                  <p>Equip up to four skills. Choose the mix that suits you.</p>
                  <button className="secondary" onClick={() => V("exercises")}>
                    View exercises & starting positions
                  </button>
                  <div className="attack-grid">
                    {sortedAttacks(p,true).map((a) => (
                      <button
                        key={a.id}
                        disabled={!available(p).some(move=>move.id===a.id)}
                        aria-pressed={p.equipped.includes(a.id)}
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
                              void dispatch({
                                kind: "equip",
                                attackIds: p.equipped.filter((x) => x !== a.id),
                              });
                          } else if (p.equipped.length < 4)
                            void dispatch({
                              kind: "equip",
                              attackIds: [...p.equipped, a.id],
                            });
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
                              ? `✓ Slot ${p.equipped.indexOf(a.id)+1} · equipped`
                              : available(p).some(move=>move.id===a.id)?"available":"Locked"}
                          </small>
                        </span>
                        <strong>{a.name}</strong>
                        {!available(p).some(move=>move.id===a.id)&&<em>{unlockDescription[a.id]}</em>}
                        <small>
                          {a.description}
                          <br />
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
                    Your pocket: <strong>{p.coins} coins</strong>. The Rest
                    House heals for free.
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
                      <ItemSprite id={x.id} className="inventory-item-art" />
                      <strong>{x.name}</strong>
                      <button
                        className="secondary"
                        disabled={p.coins < x.cost}
                        onClick={() => {
                          void dispatch({
                            kind: "purchaseItem",
                            item: x.id as "potion" | "shield" | "boost",
                          });
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
                            void dispatch({
                              kind: "upgradeAttack",
                              attackId: a.id,
                            })
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
                          void dispatch({
                            kind: "craftItem",
                            item: String(id) as "potion" | "shield" | "boost",
                          })
                        }
                      >
                        Craft · {cost} ingredient{Number(cost) > 1 ? "s" : ""}
                      </button>
                    </div>
                  ))}
                </>
              )}
              {panel === "devices" && adventure.snapshot.testOnly && <p>This admin adventure is local for testing. Cloud linking is disabled; remove it from the save menu when finished.</p>}
              {panel === "devices" && !adventure.snapshot.testOnly && (
                <DevicePanel
                  localSaveId={localSaveId}
                  onOpenCloud={async (saveId) => {
                    await adventure.controller.openCloud(saveId);
                    V(null);
                  }}
                  cloudStatus={
                    adventure.mode === "cloud"
                      ? {
                          saveId: adventure.saveId!,
                          readOnly: adventure.readOnly,
                          busy: adventure.busy,
                          requesting: adventure.requesting,
                          safe: b?.turn !== "exercise" && !quest,
                        }
                      : undefined
                  }
                  onRequestControl={() => adventure.controller.requestControl()}
                  onReleaseControl={() => adventure.controller.release()}
                  onRefreshCloud={() => adventure.controller.refresh()}
                  onActivityImport={(reading: ImportedHealth) => {
                    if (!diaryReady) {
                      notify(
                        "Wait for the journal to load before importing health data.",
                      );
                      return;
                    }
                    const old = diary;
                    const date = new Date(reading.startTime).toLocaleDateString(
                      "en-CA",
                    );
                    const id = "health-" + date;
                    updateDiary({
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
                    });
                    notify(
                      cloudDiary
                        ? "Reviewed health snapshot queued for the shared journal."
                        : "Reviewed health snapshot saved. No activity calories were automatically added twice.",
                    );
                  }}
                />
              )}
              {panel === "menu" && (
                <>
                  <section
                    className="menu-character"
                    aria-label="Character and progress"
                  >
                    <BattleSprite
                      id={heroId}
                      className="menu-character-portrait"
                    />
                    <div>
                      <h3>
                        {p.name} · Level {p.level}
                      </h3>
                      <p>
                        {Math.ceil(p.hp)} / {p.maxHp} HP · {p.xp} /{" "}
                        {xpNeeded(p.level)} XP
                      </p>
                      <p>
                        Attack {p.attack} · Defense {p.defense} · Speed{" "}
                        {p.speed}
                      </p>
                      <p>
                        {p.coins} coins · {p.badges.length} / 3 badges
                      </p>
                    </div>
                  </section>
                  <div className="button-row"><button onClick={()=>openHelp()}>Help · Where is this button?</button><button onClick={()=>V("map")}>World map</button><button onClick={()=>{V(null);setReplayIntro(true)}}>Replay introduction</button><button disabled={localDiaryPending>0||adventure.busy||adventure.pending>0||(adventure.mode==='cloud'&&(b?.turn==='exercise'||!!quest))} onClick={async()=>{try{if(b&&!b.paused){if(!await dispatch({kind:'pause',paused:true}))return;}if(adventure.mode==='cloud')await adventure.controller.release();onReturnToTitle?.()}catch(e){notify(String(e))}}}>Save & return to title</button></div>
                  <div className="menu-badges">
                    {(["leg", "arm", "back"] as Element[]).map((type) => (
                      <span
                        key={type}
                        className={
                          p.badges.includes(type) ? "earned" : "unearned"
                        }
                      >
                        {iconType(type)}{" "}
                        {p.badges.includes(type)
                          ? "Badge earned"
                          : "Gym awaits"}
                      </span>
                    ))}
                  </div>
                  <div className="button-row">
                    <button
                      className="secondary"
                      onClick={() => V("inventory")}
                    >
                      Skills & items
                    </button>
                    <button className="secondary" onClick={() => V("journal")}>
                      Nutrition journal
                    </button>
                    <button className="secondary" onClick={() => V("devices")}>
                      Devices
                    </button>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => void toggleFullscreen()}
                  >
                    {fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                  </button>
                  <label>
                    Adventure difficulty
                    <select
                      disabled={!!b}
                      value={p.difficulty}
                      onChange={(e) =>
                        void dispatch({
                          kind: "setDifficulty",
                          difficulty: e.target.value as Player["difficulty"],
                        })
                      }
                    >
                      <option value="easy">Easy · 85% enemy HP</option>
                      <option value="medium">Medium · standard HP</option>
                      <option value="hard">Hard · 135% enemy HP</option>
                    </select>
                  </label>
                  <p className="tiny">
                    Difficulty does not increase enemy attack. Movement:
                    WASD/arrows. Hold Shift to run. Interact: E/Enter.
                    Pause/menu: Escape. Your progress saves locally, or through
                    acknowledged commands when a cloud adventure is open.
                  </p>
                  <p>
                    For Javpato’s girlfriend and Uriel’s brother — may your
                    everyday routines become little adventures.
                  </p>
                </>
              )}
              {panel === "healer" && (
                <section className="rest-scene">
                  <Heart size={56} />
                  <h3>A little rest goes a long way.</h3>
                  <p>
                    {Math.ceil(p.hp)} / {p.maxHp} vitality
                  </p>
                  <div className="hp-track">
                    <span style={{ width: `${(p.hp / p.maxHp) * 100}%` }} />
                  </div>
                  <p>
                    Recover all your HP, free of charge. Your adventure will be
                    here when you are ready.
                  </p>
                  <button
                    className="primary"
                    disabled={p.hp >= p.maxHp}
                    onClick={async () => {
                      if (await dispatch({ kind: "heal" }))
                        notify("Fully rested. Your vitality is restored.");
                    }}
                  >
                    {p.hp >= p.maxHp ? "Fully rested" : "Rest and recover"}
                  </button>
                  <button className="secondary" onClick={() => V(null)}>
                    Return to the village
                  </button>
                </section>
              )}
              {panel === "ending" && (
                <>
                  <div className="big-star">✦</div>
                  <p>
                    You crossed the valley, found three kinds of strength, and
                    met the summit with your own effort.
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
          <section className="modal exercise-quest-modal" role="dialog" aria-modal="true" aria-label="Village exercise challenge">
            <div className="card-title modal-top">
              <h2>A little village challenge</h2>
              <button
                type="button"
                onClick={() => {
                  if (quest.progress > 0 && !window.confirm("Leave this challenge? Its uncollected progress will be lost. Your adventure rewards already collected are kept.")) return;
                  void dispatch({ kind: "cancelQuest" });
                }}
                aria-label="Leave quest"
                aria-busy={pauseRequested}
                style={{minWidth:44,minHeight:44}}
              >✕</button>
            </div>
            <p>{quest.exercise} · {quest.progress} / {quest.target} units · quest level {Math.min(5, (p.quests[quest.exercise] ?? 0) + 1)}</p>
            {adventure.error && <section className="notice" role="alert"><strong>Your challenge is paused.</strong><p>{adventure.error}</p><button onClick={()=>void adventure.controller.retry().catch(error=>notify(String(error)))}>Retry saving</button></section>}
            {quest.progress < quest.target && <label className="check"><input type="checkbox" checked={camera} disabled={quest.progress > 0} onChange={event=>C(event.target.checked)}/>Use camera</label>}
            {!camera && quest.progress < quest.target && <section className="quest-manual-instructions" aria-label="Manual exercise instructions">
              <h3>Begin when you are ready</h3>
              <p><strong>{EXERCISE_GUIDES[quest.exercise].setup}</strong></p>
              <p>{EXERCISE_GUIDES[quest.exercise].movement}</p>
              <p>Complete {quest.target - quest.progress} remaining {quest.exercise === "superman" ? "seconds" : "repetitions"}, then confirm below. No camera start button is needed. Manual confirmation is unverified.</p>
              <button className="primary" disabled={adventure.locked || pauseRequested} onClick={()=>void dispatch({kind:"manualQuest",sessionId:quest.id})}>I completed the exercise</button>
            </section>}
            <details className="quest-camera-preview" open={camera}>
              <summary>{camera ? "Exercise camera and guide" : "Optional camera preview and exercise illustration"}</summary>
              <Suspense fallback={<p>Preparing camera controls…</p>}>
                <ExerciseCamera
                  key={quest.id}
                  sessionId={quest.id}
                  lastSide={quest.side}
                  exerciseId={quest.exercise}
                  target={quest.target}
                  progress={quest.progress}
                  mode={camera ? "camera" : "manual"}
                    onRequestCameraMode={()=>void useCameraMode()}
                  muted={muted}
                  paused={pauseRequested}
                  sessionComplete={quest.progress >= quest.target}
                  active={camera && quest.progress < quest.target && !adventure.readOnly && !adventure.error && !pauseRequested}
                  onUnit={onUnit}
                  onError={notify}
                />
              </Suspense>
            </details>
            {quest.progress >= quest.target ? <><p>Thank you! Small efforts make a strong village.</p><button className="primary" disabled={adventure.locked} onClick={()=>void dispatch({kind:"finishQuest"})}>Collect reward</button></> : <>
              {camera && quest.progress > 0 && <button onClick={()=>C(false)}>Detection trouble? Continue manually</button>}
              <button onClick={()=>{
                if (quest.progress > 0 && !window.confirm("Leave this challenge? Its uncollected progress will be lost. Your adventure rewards already collected are kept.")) return;
                void dispatch({kind:"cancelQuest"});
              }}>Stop safely</button>
            </>}
          </section>
        </div>
      )}
    </div>
  );
}

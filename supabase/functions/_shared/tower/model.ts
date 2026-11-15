// GENERATED. Edit src/tower, then run supabase/sync-core.mjs.
import type {Element, ExerciseId, ExerciseUnit} from '../contracts.ts';
export type {Element, ExerciseUnit};
export type Skill = {
 id:string; name:string; type:Element; types?:[Element]|[Element,Element]; equipment?:'none'|'wall'|'chair'|'support'; impact?:'none'|'low'|'jump'; detectorFamily?:string; demonstration?:string; alternativeId?:string; exercise:ExerciseId; tier:1|2|3; units:number;
 unit:'reps'|'seconds'; damage:number; trialTarget:number; prerequisite:string|null;
 description:string; cue:string; alternating:boolean; detector:'supported'|'manual'; detectorStatus:'configured'|'experimental'|'pending'; qualityMetric?:'movement-control'|'observed-amplitude'|'none';
};
export type SkillProgress={unlocked:boolean; mastery:number; totalUnits:number; verifiedUnits:number; manualUnits:number; trialVerification:'verified'|'manual'|'mixed'|null};
export type SeriesTelemetry={qualityCount:number;qualitySum:number;qualitySquares:number;qualityMin:number;observedSeconds:number;intervals:number;lastTimestamp?:number};
export type FlashSet={policyVersion:2;budgetMs:number|null;source:'personal'|'custom';status:'ready'|'active'|'expired'|'interrupted';startedAt?:number;lastEndedAt?:number;clockId?:string};
export type Series={flash?:FlashSet;id:string;skillId:string;target:number;progress:number;seen:string[];side?:'left'|'right';verified:number;manual:number;manualFactor:number;paused:boolean;cycleEnds?:Record<string,number>;telemetry?:SeriesTelemetry};
export type TowerEnemy={id:string;name:string;title:string;artId:string;hp:number;attack:number;defense:number;speed:number;phases:Element[][];thresholds:number[];boss:boolean};
export type TowerBattle={id:string;enemy:TowerEnemy;enemyHp:number;playerHp:number;maxHp:number;phase:number;turn:'player'|'exercise'|'enemy'|'transform'|'won'|'lost';series:Series|null;defending:boolean;fatigue:Record<Element,number>;rng:number;log:string;hitSerial:number;lastDamage:number;verified:number;manual:number};
export type RunMode='endless'|'challenge';
export type TowerRun={kind:'tower';id:string;mode:RunMode;challengeId?:string;challengeTier?:'easy'|'hard';seed:number;contentVersion:1|2;powerUps?:Record<string,number>;pendingBossReward?:{floor:number};flashEquipped?:string[];floor:number;lastSettledFloor:number;loadout:string[];specialization:Element|null;status:'ready'|'battle'|'between'|'lost'|'complete';battle:TowerBattle|null;hp:number;maxHp:number;verified:number;manual:number;cleared:number;startedAt:number;difficulty:'easy'|'normal'|'hard'};
export type TrialActivity={kind:'trial';id:string;skillId:string;series:Series;completed:boolean;returnRun?:TowerRun;trialKind?:'skill'|'flash';flashPolicyVersion?:2;flashCustomSeconds?:number;flashStage?:'reference'|'test';referenceCycles?:number[];cadenceMs?:number;legacy?:boolean};
export type WorkoutEntry={skillId:string;target:number};
export type Routine={id:string;name:string;entries:WorkoutEntry[];restSeconds:number};
export type QualityMetrics={samples:number;mean:number;minimum:number;standardDeviation:number;metric:'movement-control'|'observed-amplitude'};
export type WorkoutEntryResult={skillId:string;target:number;units:number;verified:number;manual:number;quality:QualityMetrics|null;completion:'complete'|'skipped'|'partial';stars:number;technicalStars:{control:boolean|null;consistency:boolean}|null;activeSecondsEstimate:number|null};
export type WorkoutTiming={elapsedSeconds:number;restSeconds:number;pausedSeconds:number;activeSecondsEstimate:number|null;lastTick:number};
export type WorkoutActivity={kind:'workout';id:string;name:string;entries:WorkoutEntry[];index:number;series:Series;completed:number;skipped:number;verified:number;manual:number;status:'active'|'rest'|'complete';restSeconds:number;startedAt:number;results?:WorkoutEntryResult[];timing?:WorkoutTiming};
export type Activity={kind:'idle'}|TrialActivity|TowerRun|WorkoutActivity;
export type RunRecord={bestFloor:number;bestVerifiedFloor:number;runs:number;wins:number};
export type HistoryEntry={id:string;kind:'tower'|'workout';name:string;completed:number;skipped:number;verified:number;manual:number;result:'complete'|'incomplete'|'lost'|'abandoned';at:number;seed?:number;workoutResults?:WorkoutEntryResult[];timing?:Omit<WorkoutTiming,'lastTick'>};
export type PlayerSave={version:1|2;progression?:{trialTokens:number;flashTokens:number;flashSkills:string[];flashCadence:Record<string,number>;flashVerification?:Record<string,'verified'|'manual'|'mixed'>};flashEquipped?:string[];migration?:{from:1;preservedActiveRules:boolean};name:string;avatar:'male'|'female';debug:boolean;skills:Record<string,SkillProgress>;loadout:string[];specialization:Element|null;availableSpecializations:Element[];activity:Activity;records:Record<string,RunRecord>;history:HistoryEntry[];routines:Routine[];settings:{muted:boolean;reducedMotion:boolean;difficulty:'easy'|'normal'|'hard'};completedTrials:number;lastOperationIds:string[];importProvenance?:'local-unverified'};
export type Challenge={id:string;name:string;description:string;floors:number;seed:number;types:Element[];skillIds:string[];specialization?:Element;bossEvery?:number;tier?:'easy'|'hard';prerequisiteId?:string;legacyId?:string;hpMultiplier?:number;attackMultiplier?:number};
/** Commands contain intent only. Stats, rewards, records and generated encounters are authoritative. */
export type TowerCommand = (
 |{kind:'rename';name:string}|{kind:'settings';muted?:boolean;reducedMotion?:boolean;difficulty?:'easy'|'normal'|'hard'}
 |{kind:'equip';skillIds:string[]}|{kind:'specialize';type:Element|null}
 |{kind:'startTrial';skillId:string}|{kind:'finishTrial'}|{kind:'startFlashTrial';skillId:string}|{kind:'equipFlash';skillId:string;enabled:boolean}|{kind:'chooseBossReward';choice:'power'|'flash'|'heal';skillId?:string}
 |{kind:'startRun';mode:RunMode;challengeId?:string;seed?:number;floor?:number}|{kind:'startFloor'}
 |{kind:'beginAttack';skillId:string}|{kind:'unit';sessionId:string;unit:ExerciseUnit}
 |{kind:'configureFlash';sessionId:string;seconds:number|null}|{kind:'interruptFlash';sessionId:string}|{kind:'retryFlashTrial'}
 |{kind:'manualUnit';sessionId:string}|{kind:'pause';paused:boolean}|{kind:'cancelSeries'}
 |{kind:'resolveEnemy'}|{kind:'continuePhase'}|{kind:'defend'}|{kind:'settleFloor';battleId:string}
 |{kind:'abandon'}|{kind:'closeActivity'}
 |{kind:'saveRoutine';routine:Routine}|{kind:'deleteRoutine';id:string}
 |{kind:'startWorkout';routineId?:string;name?:string;entries?:WorkoutEntry[];restSeconds?:number}
 |{kind:'skipWorkoutEntry'}|{kind:'continueWorkout'}
 ) & {operationId?:string};
export type EngineContext={uuid?:()=>string;now?:()=>number;seed?:()=>number};

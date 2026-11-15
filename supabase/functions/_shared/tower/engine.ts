// GENERATED. Edit src/tower, then run supabase/sync-core.mjs.
import type {Element,ExerciseUnit} from '../contracts.ts';
import type {PlayerSave,TowerCommand,EngineContext,Series,TowerRun,TowerBattle,WorkoutActivity,WorkoutEntry,Skill,HistoryEntry,WorkoutEntryResult,SeriesTelemetry} from './model.ts';
import {SKILLS,SKILL_BY_ID,CHALLENGES,canAttemptTrial,INITIAL_SKILLS} from './catalog.ts';
import {generateFloor,MAX_FLOOR,nextRandom,normalizeSeed,TYPES} from './generation.ts';
export {SKILLS,SKILL_BY_ID,CHALLENGES} from './catalog.ts';
export {generateFloor} from './generation.ts';
export type {PlayerSave,TowerCommand} from './model.ts';
import {effectiveness,stab,skillTypes} from './typeChart.ts';
import {migrateSave} from './migrateSave.ts';
import {assessFlashCycle,flashCadenceWindow,FLASH_TIMING} from './flash.ts';
import {exerciseProfile} from './exerciseProfiles.ts';
export {effectiveness,stab,skillTypes} from './typeChart.ts';
export {migrateSave} from './migrateSave.ts';
const LEGACY_SKILL_IDS=new Set(['mini-squat','squat','pause-squat','assisted-lunge','lunge','sumo-squat','wall-sit','reverse-lunge','tempo-squat','single-leg-squat','wall-pushup','incline-pushup','knee-pushup','high-plank','pushup','pause-pushup','diamond','eccentric-pushup','wide-pushup','archer-pushup','birddog','alternating-birddog','short-superman','superman','back-extension','snow-angels','pause-birddog','alternating-superman','tempo-extension','advanced-birddog']);
export const isLegacySkill=(id:string)=>LEGACY_SKILL_IDS.has(id);
export const FLASH_SKILLS=['mini-squat','squat','knee-pushup','pushup'] as const;
export function trialRequirement(id:string):number{
 const skill=Object.hasOwn(SKILL_BY_ID,id)?SKILL_BY_ID[id]:undefined;if(!skill)throw Error('UNKNOWN_SKILL');
 let depth=0,parent=skill.prerequisite;const seen=new Set([id]);
 while(parent){if(seen.has(parent))throw Error('PREREQUISITE_CYCLE');seen.add(parent);depth++;parent=SKILL_BY_ID[parent]?.prerequisite??null;}
 return (skill.unit==='seconds'?[6,10,15]:[4,6,8])[Math.min(2,depth)];
}
export const canLearnSkill=(save:PlayerSave,id:string)=>canAttemptTrial(save,id)&&(!!save.skills[id]?.unlocked||save.debug||(save.progression?.trialTokens??0)>0);
function cycleDuration(u:ExerciseUnit):number|null{
 const result=assessFlashCycle(u);return result.accepted?result.durationMs:null;
}
function requireRule(ok:unknown,message:string):asserts ok {if(!ok)throw Error(message);}
const freshProgress=()=>({unlocked:false,mastery:0,totalUnits:0,verifiedUnits:0,manualUnits:0,trialVerification:null as 'verified'|'manual'|'mixed'|null});
export function initialSave(name='Adventurer',avatar:'male'|'female'='male',debug=false):PlayerSave{
 requireRule(typeof name==='string'&&name.trim().length>0&&name.trim().length<=20,'INVALID_NAME');
 requireRule(avatar==='male'||avatar==='female','INVALID_AVATAR');
 const skills=Object.fromEntries(SKILLS.map(s=>[s.id,{...freshProgress(),unlocked:debug||INITIAL_SKILLS.includes(s.id as typeof INITIAL_SKILLS[number])}]));
 return {version:2,progression:{trialTokens:debug?99:0,flashTokens:debug?99:0,flashSkills:[],flashCadence:{},flashVerification:{}},flashEquipped:[],name:name.trim(),avatar,debug,skills,loadout:[...INITIAL_SKILLS],specialization:null,availableSpecializations:debug?[...TYPES]:[],activity:{kind:'idle'},records:{},history:[],routines:[],settings:{muted:false,reducedMotion:false,difficulty:'normal'},completedTrials:0,lastOperationIds:[]};
}
export const availableSlots=(_save:PlayerSave)=>4;
export const activeSeries=(save:PlayerSave):Series|null=>save.activity.kind==='tower'?save.activity.battle?.series??null:save.activity.kind==='trial'||save.activity.kind==='workout'?save.activity.series:null;
export const masteryLabel=(units:number)=>units>=500?'Mastered':units>=150?'Practiced':units>=30?'Familiar':'Learning';
/** No level/XP/stat progression: mastery only records deliberate practice. */
function credit(save:PlayerSave,skillId:string,verified:boolean){const p=save.skills[skillId];p.totalUnits++;p.mastery++;if(verified)p.verifiedUnits++;else p.manualUnits++;}
function validUnit(u:ExerciseUnit){return !!u&&typeof u.id==='string'&&u.id.length>0&&u.id.length<=200&&Number.isFinite(u.quality)&&u.quality>0&&u.quality<=1&&Number.isFinite(u.confidence)&&u.confidence>=0&&u.confidence<=1&&typeof u.verified==='boolean'&&(!u.verified||u.confidence>=.5)&&Number.isFinite(u.timestamp)&&u.timestamp>=0&&(u.side===undefined||u.side==='left'||u.side==='right')&&(u.skillId===undefined||typeof u.skillId==='string'&&u.skillId.length>0&&u.skillId.length<=80)&&(u.profileId===undefined||typeof u.profileId==='string'&&u.profileId.length>0&&u.profileId.length<=120)&&(u.evidence===undefined||['camera','assisted','confirmation','manual'].includes(u.evidence));}
/** A family ID alone is not evidence for a particular variation. Legacy clients
 * without provenance retain their prior rules; explicit provenance is never
 * silently downgraded when it contradicts its detector or claimed verification. */
function validateUnitEvidence(skill:Skill,u:ExerciseUnit){
 requireRule(u.skillId===undefined||u.skillId===skill.id,'WRONG_SKILL');
 const profile=exerciseProfile(skill.id);
 if(u.evidence==='assisted'||u.evidence==='confirmation'){
  requireRule(u.skillId===skill.id,'SKILL_EVIDENCE_REQUIRED');
  requireRule(profile?.method===u.evidence,'WRONG_EVIDENCE_PROFILE');
  requireRule(u.profileId===`${u.evidence}-v1:${skill.id}`,'WRONG_EVIDENCE_PROFILE');
  requireRule(!u.verified&&u.cycle===undefined&&u.quality===1,'INVALID_UNVERIFIED_EVIDENCE');
 }else if(u.evidence==='camera'){
  requireRule(u.verified&&skill.detector==='supported','INVALID_CAMERA_EVIDENCE');
  requireRule(u.profileId===undefined||u.profileId===`camera-v1:${skill.id}`,'WRONG_EVIDENCE_PROFILE');
 }else if(u.evidence==='manual'){
  requireRule(!u.verified&&u.cycle===undefined&&u.profileId===undefined,'INVALID_UNVERIFIED_EVIDENCE');
 }else requireRule(u.profileId===undefined,'EVIDENCE_KIND_REQUIRED');
}
/** Keep exact totals but put a rest boundary between reasonably sized series. */
export function normalizeWorkoutEntries(_s:PlayerSave,entries:WorkoutEntry[]):WorkoutEntry[]{
 requireRule(Array.isArray(entries)&&entries.length>0&&entries.length<=100,'INVALID_WORKOUT');
 const expanded:WorkoutEntry[]=[];
 for(const entry of entries){
  const skill=Object.hasOwn(SKILL_BY_ID,entry.skillId)?SKILL_BY_ID[entry.skillId]:undefined;requireRule(skill,'UNKNOWN_SKILL');
  requireRule(Number.isSafeInteger(entry.target)&&entry.target>=1&&entry.target<=1000&&(!skill.alternating||entry.target%2===0),'INVALID_WORKOUT_TARGET');
  const limit=skill.unit==='seconds'?30:12;
  for(let remaining=entry.target;remaining>0;remaining-=limit){expanded.push({skillId:entry.skillId,target:Math.min(limit,remaining)});requireRule(expanded.length<=100,'WORKOUT_TOO_MANY_SERIES');}
 }
 return expanded;
}
function history(s:PlayerSave,h:HistoryEntry){if(!s.history.some(x=>x.id===h.id))s.history=[structuredClone(h),...s.history].slice(0,200);}
const freshTelemetry=():SeriesTelemetry=>({qualityCount:0,qualitySum:0,qualitySquares:0,qualityMin:1,observedSeconds:0,intervals:0});
/** Bounded online statistics: no pose samples or video frames enter a save. */
function observeSeries(series:Series,skill:Skill,u:ExerciseUnit){
 const t=series.telemetry??=freshTelemetry();
 if(!u.verified){delete t.lastTimestamp;return;}
 t.qualityCount++;t.qualitySum+=u.quality;t.qualitySquares+=u.quality*u.quality;t.qualityMin=Math.min(t.qualityMin,u.quality);
 // Hold credit comes only from detector events, never the elapsed clock.
 if(skill.unit==='seconds'){t.observedSeconds++;t.intervals++;}
 else if(t.lastTimestamp!==undefined&&u.timestamp>t.lastTimestamp&&u.timestamp-t.lastTimestamp<=10000){t.observedSeconds+=(u.timestamp-t.lastTimestamp)/1000;t.intervals++;}
 t.lastTimestamp=u.timestamp;
}
export function workoutEntryResult(series:Series,completion:WorkoutEntryResult['completion']):WorkoutEntryResult{
 const skill=SKILL_BY_ID[series.skillId],t=series.telemetry;
 const metric=skill.qualityMetric??'none';
 const mean=t&&t.qualityCount?t.qualitySum/t.qualityCount:0;
 const sd=t&&t.qualityCount?Math.sqrt(Math.max(0,t.qualitySquares/t.qualityCount-mean*mean)):0;
 const quality=t&&t.qualityCount&&metric!=='none'?{samples:t.qualityCount,mean,minimum:t.qualityMin,standardDeviation:sd,metric}:null;
 // Completion is always recognized. Technical stars require enough genuine,
 // fully verified observations and a detector that emits a variable metric.
 const technical=completion==='complete'&&series.manual===0&&quality&&quality.samples>=3?
  {control:metric==='movement-control'?mean>=.8:null,consistency:sd<=.1}:null;
 return {skillId:series.skillId,target:series.target,units:series.progress,verified:series.verified,manual:series.manual,quality,completion,
  stars:(completion==='complete'?1:0)+(technical?.control?1:0)+(technical?.consistency?1:0),technicalStars:technical,
  activeSecondsEstimate:t&&t.intervals>0?t.observedSeconds:null};
}
function accountWorkoutTime(w:WorkoutActivity,now:number){
 const t=w.timing??={elapsedSeconds:Math.max(0,(now-w.startedAt)/1000),restSeconds:0,pausedSeconds:0,activeSecondsEstimate:null,lastTick:now};
 if(w.status==='complete')return;
 const delta=Math.max(0,(now-t.lastTick)/1000);t.elapsedSeconds+=delta;t.lastTick=Math.max(t.lastTick,now);
 if(w.status==='rest')t.restSeconds+=delta;else if(w.series.paused)t.pausedSeconds+=delta;
}
function workoutHistory(w:WorkoutActivity,now:number,result:HistoryEntry['result']):HistoryEntry{
 const results=w.results??[];
 const estimates=results.map(r=>r.activeSecondsEstimate).filter((x):x is number=>x!==null);
 const timing=w.timing?{elapsedSeconds:w.timing.elapsedSeconds,restSeconds:w.timing.restSeconds,pausedSeconds:w.timing.pausedSeconds,activeSecondsEstimate:estimates.length?estimates.reduce((a,b)=>a+b,0):null}:undefined;
 if(w.timing)w.timing.activeSecondsEstimate=timing?.activeSecondsEstimate??null;
 return {id:w.id,kind:'workout',name:w.name,completed:w.completed,skipped:w.skipped,verified:w.verified,manual:w.manual,result,at:now,workoutResults:results,timing};
}
function closeFatigue(b:TowerBattle){const series=b.series;if(!series)return;const type=SKILL_BY_ID[series.skillId].type,part=series.manual/series.target;for(const t of TYPES)b.fatigue[t]=Math.max(0,Math.min(3,(b.fatigue[t]??0)+(t===type?part:-part*.5)));}
function workoutNext(s:PlayerSave,w:WorkoutActivity,makeSeries:(id:string,n:number)=>Series,now:number){
 if(w.index>=w.entries.length){w.status='complete';history(s,workoutHistory(w,now,w.skipped?'incomplete':'complete'));return;}
 const entry=w.entries[w.index];w.series=makeSeries(entry.skillId,entry.target);w.status='active';
}
/** Immutable canonical reducer, shared by local controller and trusted server. */
export function applyCommand(save:PlayerSave,command:TowerCommand,context:EngineContext={}):PlayerSave{
 requireRule((save?.version===1||save?.version===2)&&command&&typeof command.kind==='string','INVALID_COMMAND');
 if(command.operationId){requireRule(typeof command.operationId==='string'&&command.operationId.length<=200,'INVALID_OPERATION');if(save.lastOperationIds.includes(command.operationId))return save;}
 const s=migrateSave(save),now=context.now?.()??Date.now();requireRule(Number.isFinite(now)&&now>=0,'INVALID_CLOCK');
 if(s.activity.kind==='workout')accountWorkoutTime(s.activity,now);
 const uuid=context.uuid??(()=>crypto.randomUUID());
 const makeSeries=(skillId:string,target:number):Series=>({id:uuid(),skillId,target,progress:0,seen:[],verified:0,manual:0,manualFactor:1,paused:false,telemetry:freshTelemetry()});
 const idle=()=>requireRule(s.activity.kind==='idle','FINISH_CURRENT_ACTIVITY');
 const loadoutSafePoint=()=>{
  if(s.activity.kind==='idle')return null;
  requireRule(s.activity.kind==='tower'&&s.activity.mode==='endless'&&(s.activity.status==='ready'||s.activity.status==='between')&&!s.activity.battle,'CHANGE_LOADOUT_AT_SAFE_POINT');
  return s.activity;
 };
 const run=()=>{requireRule(s.activity.kind==='tower','NO_TOWER');return s.activity;};
 const battle=()=>{const r=run();requireRule(r.status==='battle'&&r.battle,'NO_BATTLE');return r.battle;};
 const playerTurn=()=>{const b=battle();requireRule(b.turn==='player'&&!b.series?.paused,'NOT_PLAYER_TURN');return b;};
 function finishWorkoutEntry(w:WorkoutActivity,skipped=false){(w.results??=[]).push(workoutEntryResult(w.series,skipped?(w.series.progress?'partial':'skipped'):'complete'));if(skipped)w.skipped++;else w.completed++;w.index++;if(w.index>=w.entries.length)workoutNext(s,w,makeSeries,now);else w.status='rest';}
 function accept(sessionId:string,u:ExerciseUnit){
  const activity=s.activity,series=activeSeries(s);requireRule(series&&series.id===sessionId,'STALE_EXERCISE_SESSION');
  requireRule(validUnit(u),'INVALID_UNIT');
  const skill=SKILL_BY_ID[series.skillId];
  requireRule(u.exerciseId===skill.exercise,'WRONG_EXERCISE');
  validateUnitEvidence(skill,u);
  if(series.paused||series.progress>=series.target||series.seen.includes(u.id))return;
  if(activity.kind==='trial'&&activity.completed||activity.kind==='tower'&&(activity.status!=='battle'||activity.battle?.turn!=='exercise')||activity.kind==='workout'&&activity.status!=='active')return;
  if(skill.alternating&&(!u.side||u.side===series.side))return;
  const cycle=cycleDuration(u),clock=u.cycle?.clockId??'legacy-clock';
  const previousEnd=series.cycleEnds&&Object.hasOwn(series.cycleEnds,clock)?series.cycleEnds[clock]:undefined;
  if(cycle!==null&&previousEnd!==undefined&&u.cycle!.startedAt<previousEnd)return;
  if(activity.kind==='trial'&&activity.trialKind==='flash'&&u.verified&&!assessFlashCycle(u,activity.flashStage==='test'?activity.cadenceMs:undefined,previousEnd).accepted)return;
  // Unsupported variants can be practiced manually but cannot claim camera verification.
  requireRule(!u.verified||skill.detector==='supported','VARIANT_REQUIRES_MANUAL');
  series.seen.push(u.id);series.progress++;series.side=u.side;if(cycle!==null)series.cycleEnds={...series.cycleEnds,[clock]:u.cycle!.endedAt};
 if(u.verified)series.verified++;else series.manual++;
 observeSeries(series,skill,u);
  if(activity.kind!=='workout')credit(s,skill.id,u.verified);
  if(activity.kind==='trial'){
   if(activity.trialKind==='flash'){
    // A manual reference must not prevent later camera cycles from establishing
    // a baseline. Mixed trials remain explicitly mixed and do not store cadence.
    if(cycle!==null&&(activity.referenceCycles?.length??0)<FLASH_TIMING.referenceReps){
     (activity.referenceCycles??=[]).push(cycle);
     if(activity.referenceCycles.length===FLASH_TIMING.referenceReps)activity.cadenceMs=[...activity.referenceCycles].sort((a,b)=>a-b)[1];
    }
    if(series.progress>=FLASH_TIMING.referenceReps)activity.flashStage='test';
   }
   activity.completed=series.progress===series.target;return;
  }
  if(activity.kind==='workout'){if(u.verified)activity.verified++;else activity.manual++;if(series.progress===series.target)finishWorkoutEntry(activity);return;}
  if(activity.kind!=='tower')return;
  const b=activity.battle!;
  if(!u.verified&&series.manual===1)series.manualFactor=1-Math.min(.4,.15*(b.fatigue[skill.type]??0));
  if(u.verified){b.verified++;activity.verified++;}else {b.manual++;activity.manual++;}
  const types=activity.contentVersion===1?[skill.type]:skillTypes(skill);
  const power=activity.contentVersion===1?1:1+.1*(activity.powerUps?.[skill.id]??0);
  const cadence=s.progression?.flashCadence[skill.id];
  const flash=activity.contentVersion===2&&activity.flashEquipped?.includes(skill.id)&&flashCadenceWindow(cadence).referenceMs!==null&&assessFlashCycle(u,cadence).accepted?1.25:1;
  const raw=skill.damage/series.target*u.quality*effectiveness(types,b.enemy.phases[b.phase])*stab(types,activity.specialization)*power*flash*(u.verified?1:series.manualFactor);
  const threshold=b.enemy.thresholds[b.phase],before=b.enemyHp;b.enemyHp=Math.max(threshold,b.enemyHp-raw);
  b.lastDamage=before-b.enemyHp;b.hitSerial++;b.log=`${u.verified?'Verified':u.evidence==='assisted'?'Assisted':u.evidence==='confirmation'?'Manually confirmed':'Manual'} ${skill.unit==='seconds'?'second':'repetition'} · ${b.lastDamage.toFixed(1)} damage${flash>1?' · FLASH ×1.25':''}`;
  if(b.enemyHp<=threshold){closeFatigue(b);b.turn=threshold===0?'won':'transform';}
  else if(series.progress===series.target){closeFatigue(b);b.turn='enemy';}
 }
 switch(command.kind){
 case 'rename':idle();requireRule(typeof command.name==='string'&&command.name.trim().length>0&&command.name.trim().length<=20,'INVALID_NAME');s.name=command.name.trim();break;
 case 'settings':{if(command.muted!==undefined){requireRule(typeof command.muted==='boolean','INVALID_SETTING');s.settings.muted=command.muted;}if(command.reducedMotion!==undefined){requireRule(typeof command.reducedMotion==='boolean','INVALID_SETTING');s.settings.reducedMotion=command.reducedMotion;}if(command.difficulty!==undefined){idle();requireRule(['easy','normal','hard'].includes(command.difficulty),'INVALID_DIFFICULTY');s.settings.difficulty=command.difficulty;}break;}
 case 'equip':{const activeRun=loadoutSafePoint();requireRule(Array.isArray(command.skillIds)&&command.skillIds.length>=1&&command.skillIds.length<=availableSlots(s)&&new Set(command.skillIds).size===command.skillIds.length&&command.skillIds.every(id=>s.skills[id]?.unlocked),'INVALID_LOADOUT');requireRule(activeRun?.contentVersion!==1||command.skillIds.every(isLegacySkill),'LEGACY_RUN_SKILL_UNAVAILABLE');s.loadout=[...command.skillIds];if(activeRun)activeRun.loadout=[...command.skillIds];break;}
 case 'specialize':{const activeRun=loadoutSafePoint();requireRule(command.type===null||s.availableSpecializations.includes(command.type),'SPECIALIZATION_LOCKED');requireRule(activeRun?.contentVersion!==1||command.type===null||['leg','arm','back'].includes(command.type),'LEGACY_RUN_TYPE_UNAVAILABLE');s.specialization=command.type;if(activeRun)activeRun.specialization=command.type;break;}
 case 'startTrial':case 'startFlashTrial':{
  const returnRun=s.activity.kind==='tower'?structuredClone(loadoutSafePoint()!):undefined;if(!returnRun)idle();
  const flash=command.kind==='startFlashTrial';
  requireRule(flash?s.skills[command.skillId]?.unlocked&&FLASH_SKILLS.includes(command.skillId as typeof FLASH_SKILLS[number])&&((s.progression!.flashTokens>0)||s.progression!.flashSkills.includes(command.skillId)):canLearnSkill(s,command.skillId),'TRIAL_LOCKED');
  const skill=SKILL_BY_ID[command.skillId];s.activity={kind:'trial',id:uuid(),skillId:skill.id,series:makeSeries(skill.id,flash?FLASH_TIMING.referenceReps+FLASH_TIMING.testReps:trialRequirement(skill.id)),completed:false,trialKind:flash?'flash':'skill',...(returnRun?{returnRun}:{}),...(flash?{flashStage:'reference',referenceCycles:[]}: {})};
 }break;
 case 'finishTrial':{
  requireRule(s.activity.kind==='trial'&&s.activity.completed,'TRIAL_NOT_FINISHED');const a=s.activity,p=s.skills[a.skillId];
  const verification=a.series.manual===0?'verified':a.series.verified>0?'mixed':'manual';
  if(a.trialKind==='flash'){
   if(!s.progression!.flashSkills.includes(a.skillId)){requireRule(s.progression!.flashTokens>0,'NO_FLASH_OPPORTUNITY');s.progression!.flashTokens--;s.progression!.flashSkills.push(a.skillId);}
   const receipts=s.progression!.flashVerification??={};if(receipts[a.skillId]!=='verified')receipts[a.skillId]=verification;
   if(verification==='verified'&&a.cadenceMs)s.progression!.flashCadence[a.skillId]=a.cadenceMs;
  }else{
   if(!p.unlocked){if(!a.legacy&&!s.debug){requireRule(s.progression!.trialTokens>0,'NO_TRIAL_OPPORTUNITY');s.progression!.trialTokens--;}s.completedTrials++;p.unlocked=true;if(s.loadout.length<4)s.loadout.push(a.skillId);}
   if(verification==='verified')p.trialVerification='verified';else if(p.trialVerification!=='verified'&&verification==='mixed')p.trialVerification='mixed';else p.trialVerification??='manual';
  }
  s.activity=a.returnRun??{kind:'idle'};
 }break;
 case 'equipFlash':{const r=loadoutSafePoint();requireRule(typeof command.enabled==='boolean'&&s.skills[command.skillId]?.unlocked&&s.progression!.flashSkills.includes(command.skillId),'FLASH_LOCKED');s.flashEquipped=(s.flashEquipped??[]).filter(id=>id!==command.skillId);if(command.enabled)s.flashEquipped.push(command.skillId);if(r)r.flashEquipped=[...s.flashEquipped];break;}
 case 'chooseBossReward':{
  const r=run();requireRule(r.contentVersion===2&&r.pendingBossReward&&!r.battle&&['between','complete'].includes(r.status),'NO_BOSS_REWARD');
  r.powerUps??={};
  if(command.choice==='power'){requireRule(!!command.skillId&&r.loadout.includes(command.skillId)&&(r.powerUps[command.skillId]??0)<5,'POWER_UP_UNAVAILABLE');r.powerUps[command.skillId]=(r.powerUps[command.skillId]??0)+1;}
  else if(command.choice==='flash')s.progression!.flashTokens++;
  else {requireRule(command.choice==='heal'&&r.loadout.every(id=>(r.powerUps![id]??0)>=5),'HEAL_REWARD_UNAVAILABLE');r.hp=r.maxHp;}
  delete r.pendingBossReward;break;
 }
 case 'startRun':idle();requireRule(command.mode==='endless'||command.mode==='challenge','INVALID_RUN_MODE');{const challenge=command.mode==='challenge'?CHALLENGES.find(c=>c.id===command.challengeId):undefined;requireRule(command.mode==='endless'||challenge,'UNKNOWN_CHALLENGE');const loadout=challenge?.skillIds??s.loadout;requireRule((s.debug?loadout.length>=1:loadout.length===4)&&loadout.length<=4&&loadout.every(id=>s.skills[id]?.unlocked),'SKILL_LOCKED');if(challenge)requireRule(loadout.length===4,'CHALLENGE_NEEDS_FOUR_SKILLS');if(command.seed!==undefined)requireRule(Number.isSafeInteger(command.seed),'INVALID_SEED');if(command.floor!==undefined)requireRule(s.debug&&Number.isSafeInteger(command.floor)&&command.floor>=1&&command.floor<=MAX_FLOOR&&command.mode==='endless','DEBUG_FLOOR_ONLY');s.activity={kind:'tower',id:uuid(),mode:command.mode,challengeId:challenge?.id,seed:challenge?.seed??normalizeSeed(command.seed??context.seed?.()??Math.floor(Math.random()*2147483646)),contentVersion:2,powerUps:{},flashEquipped:challenge?[]:[...(s.flashEquipped??[])],floor:command.floor??1,lastSettledFloor:0,loadout:[...loadout],specialization:s.specialization,status:'ready',battle:null,hp:100,maxHp:100,verified:0,manual:0,cleared:0,startedAt:now,difficulty:s.settings.difficulty};}break;
 case 'startFloor':{const r=run();requireRule(r.status==='ready'||r.status==='between','FLOOR_ALREADY_ACTIVE');requireRule(!r.pendingBossReward,'CHOOSE_BOSS_REWARD');requireRule(r.contentVersion===1||s.debug||r.loadout.length===4,'FOUR_SKILLS_REQUIRED');const challenge=CHALLENGES.find(c=>c.id===r.challengeId);const enemy=generateFloor(r.seed,r.floor,challenge??'endless',r.contentVersion);const difficulty=r.difficulty==='easy'?.8:r.difficulty==='hard'?1.2:1;enemy.attack*=difficulty;const b:TowerBattle={id:uuid(),enemy,enemyHp:enemy.hp,playerHp:r.hp,maxHp:r.maxHp,phase:0,turn:'player',series:null,defending:false,fatigue:{leg:0,arm:0,back:0,core:0,cardio:0,mobility:0},rng:nextRandom(normalizeSeed(r.seed+r.floor*7919)),log:`Floor ${r.floor} · ${enemy.title}`,hitSerial:0,lastDamage:0,verified:0,manual:0};r.battle=b;r.status='battle';}break;
 case 'beginAttack':{const b=playerTurn(),r=run();requireRule(r.loadout.includes(command.skillId)&&s.skills[command.skillId]?.unlocked,'SKILL_NOT_EQUIPPED');const skill=SKILL_BY_ID[command.skillId];b.series=makeSeries(skill.id,skill.units);b.turn='exercise';b.log=skill.description;}break;
 case 'unit':accept(command.sessionId,command.unit);break;
 case 'manualUnit':{const series=activeSeries(s);requireRule(series&&series.id===command.sessionId,'STALE_EXERCISE_SESSION');const skill=SKILL_BY_ID[series.skillId];accept(series.id,{id:command.operationId?`manual:${command.operationId}`:uuid(),exerciseId:skill.exercise,quality:1,confidence:0,verified:false,timestamp:now,...(skill.alternating?{side:series.side==='left'?'right' as const:'left' as const}:{})});}break;
 case 'pause':{requireRule(typeof command.paused==='boolean','INVALID_PAUSE');const series=activeSeries(s);requireRule(series,'NO_ACTIVE_SERIES');series.paused=command.paused;if(series.telemetry)delete series.telemetry.lastTimestamp;}break;
 case 'cancelSeries':{const b=battle();requireRule(b.turn==='exercise','NO_ACTIVE_SERIES');closeFatigue(b);if(b.series)b.series.paused=false;b.turn='enemy';b.log='Series stopped. Credited progress is kept.';}break;
 case 'resolveEnemy':{const b=battle();requireRule(b.turn==='enemy'&&!b.series?.paused,'NOT_ENEMY_TURN');b.rng=nextRandom(b.rng);const type=run().contentVersion===1?b.enemy.phases[b.phase][b.phase%b.enemy.phases[b.phase].length]:b.enemy.phases[b.phase];const damage=b.enemy.attack*effectiveness(type,run().specialization?[run().specialization!]:[])*1.25*(b.defending?.5:1);b.playerHp=Math.max(0,b.playerHp-damage);b.defending=false;b.turn=b.playerHp===0?'lost':'player';b.log=`${b.enemy.name} responds · ${damage.toFixed(1)} damage`;run().hp=b.playerHp;}break;
 case 'continuePhase':{const b=battle();requireRule(b.turn==='transform'&&!b.series?.paused&&b.phase+1<b.enemy.phases.length,'NO_TRANSFORMATION');b.phase++;b.turn='enemy';b.log='A new form awakens. Take a breath.';}break;
 case 'defend':{const b=playerTurn();b.defending=true;b.turn='enemy';b.log='Brace · incoming damage reduced by half.';}break;
 case 'settleFloor':{
  const r=run();if(r.battle?.id!==command.battleId){requireRule(r.status==='between'||r.status==='lost'||r.status==='complete','STALE_BATTLE');break;}
  const b=r.battle;requireRule(b.turn==='won'||b.turn==='lost','BATTLE_NOT_FINISHED');
  if(r.lastSettledFloor>=r.floor)break;
  const key=r.mode==='endless'?'endless':`challenge:${r.challengeId}`;
  const record=s.records[key]??={bestFloor:0,bestVerifiedFloor:0,runs:0,wins:0};
  if(b.turn==='won'){
   r.lastSettledFloor=r.floor;r.cleared=r.floor;record.bestFloor=Math.max(record.bestFloor,r.floor);if(r.manual===0)record.bestVerifiedFloor=Math.max(record.bestVerifiedFloor,r.floor);
   r.hp=b.enemy.boss?r.maxHp:Math.min(r.maxHp,b.playerHp+20);
   if(r.contentVersion===2&&r.mode==='endless'){if(r.floor%3===0)s.progression!.trialTokens++;if(b.enemy.boss)r.pendingBossReward={floor:r.floor};}
   const challenge=CHALLENGES.find(c=>c.id===r.challengeId);
   if(r.floor===MAX_FLOOR||challenge&&r.floor>=challenge.floors){r.status='complete';record.runs++;record.wins++;if(challenge?.specialization&&!s.availableSpecializations.includes(challenge.specialization))s.availableSpecializations.push(challenge.specialization);history(s,{id:r.id,kind:'tower',name:challenge?.name??'Endless Tower',completed:r.cleared,skipped:0,verified:r.verified,manual:r.manual,result:'complete',at:now,seed:r.seed});}
   else{r.floor++;r.status='between';}
  }else{r.hp=0;r.status='lost';record.runs++;history(s,{id:r.id,kind:'tower',name:CHALLENGES.find(c=>c.id===r.challengeId)?.name??'Endless Tower',completed:r.cleared,skipped:0,verified:r.verified,manual:r.manual,result:'lost',at:now,seed:r.seed});}
  r.battle=null;break;
 }
 case 'abandon':{const a=s.activity;if(a.kind==='tower'&&!['lost','complete'].includes(a.status)){const key=a.mode==='endless'?'endless':`challenge:${a.challengeId}`;const record=s.records[key]??={bestFloor:0,bestVerifiedFloor:0,runs:0,wins:0};record.runs++;history(s,{id:a.id,kind:'tower',name:CHALLENGES.find(c=>c.id===a.challengeId)?.name??'Endless Tower',completed:a.cleared,skipped:0,verified:a.verified,manual:a.manual,result:'abandoned',at:now,seed:a.seed});}if(a.kind==='workout'&&a.status!=='complete'){if(a.status==='active')(a.results??=[]).push(workoutEntryResult(a.series,a.series.progress?'partial':'skipped'));history(s,workoutHistory(a,now,'abandoned'));}s.activity=a.kind==='trial'&&a.returnRun?a.returnRun:{kind:'idle'};break;}
 case 'closeActivity':requireRule(s.activity.kind==='idle'||s.activity.kind==='tower'&&['lost','complete'].includes(s.activity.status)||s.activity.kind==='workout'&&s.activity.status==='complete','ACTIVITY_NOT_FINISHED');s.activity={kind:'idle'};break;
 case 'saveRoutine':idle();{const r=command.routine;requireRule(r&&typeof r.id==='string'&&r.id.length>0&&r.id.length<=100&&typeof r.name==='string'&&r.name.trim().length>0&&r.name.length<=60&&Number.isSafeInteger(r.restSeconds)&&r.restSeconds>=0&&r.restSeconds<=600,'INVALID_ROUTINE');const entries=normalizeWorkoutEntries(s,r.entries);requireRule(s.routines.some(x=>x.id===r.id)||s.routines.length<30,'TOO_MANY_ROUTINES');const i=s.routines.findIndex(x=>x.id===r.id);if(i<0)s.routines.push({...structuredClone(r),entries});else s.routines[i]={...structuredClone(r),entries};}break;
 case 'deleteRoutine':idle();s.routines=s.routines.filter(r=>r.id!==command.id);break;
 case 'startWorkout':idle();{const routine=command.routineId?s.routines.find(r=>r.id===command.routineId):undefined;requireRule(!command.routineId||routine,'UNKNOWN_ROUTINE');const entries=normalizeWorkoutEntries(s,routine?.entries??command.entries??[]);const name=routine?.name??command.name??'Free Practice',rest=routine?.restSeconds??command.restSeconds??20;requireRule(typeof name==='string'&&name.trim().length>0&&name.length<=60&&Number.isSafeInteger(rest)&&rest>=0&&rest<=600,'INVALID_WORKOUT');s.activity={kind:'workout',id:uuid(),name,entries:structuredClone(entries),index:0,series:makeSeries(entries[0].skillId,entries[0].target),completed:0,skipped:0,verified:0,manual:0,status:'active',restSeconds:rest,startedAt:now,results:[],timing:{elapsedSeconds:0,restSeconds:0,pausedSeconds:0,activeSecondsEstimate:null,lastTick:now}};}break;
 case 'skipWorkoutEntry':requireRule(s.activity.kind==='workout'&&s.activity.status==='active','NO_ACTIVE_WORKOUT');finishWorkoutEntry(s.activity,true);break;
 case 'continueWorkout':requireRule(s.activity.kind==='workout'&&s.activity.status==='rest','NOT_RESTING');workoutNext(s,s.activity,makeSeries,now);break;
 default:throw Error('UNKNOWN_COMMAND');
 }
 if(command.operationId)s.lastOperationIds=[...s.lastOperationIds,command.operationId].slice(-256);
 return s;
}

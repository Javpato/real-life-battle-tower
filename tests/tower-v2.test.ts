import {describe,it,expect} from 'vitest';
import {initialSave,applyCommand,activeSeries,migrateSave,trialRequirement,effectiveness,stab} from '../src/tower/engine';
import {TYPES,TYPE_CHART} from '../src/tower/typeChart';
import {SKILLS} from '../src/tower/catalog';
import {generateFloor,generateLegacyFloor,MAX_FLOOR} from '../src/tower/generation';
import {validateTowerImport} from '../src/tower/importSave';
import type {PlayerSave,TowerRun,TowerCommand,ExerciseUnit} from '../src/tower/model';
let seq=0;
const send=(s:PlayerSave,c:TowerCommand)=>applyCommand(s,c,{uuid:()=>`v2-${++seq}`,now:()=>100000,seed:()=>42});
const run=(s:PlayerSave)=>s.activity as TowerRun;
function winAt(s:PlayerSave,floor:number){s=send(s,{kind:'startRun',mode:'endless'});run(s).floor=floor;s=send(s,{kind:'startFloor'});run(s).battle!.turn='won';return send(s,{kind:'settleFloor',battleId:run(s).battle!.id});}
function completeTrial(s:PlayerSave){while(s.activity.kind==='trial'&&!s.activity.completed)s=send(s,{kind:'manualUnit',sessionId:activeSeries(s)!.id});return send(s,{kind:'finishTrial'});}
function camera(s:PlayerSave,index:number,duration=2000,uninterrupted=true){const unit:ExerciseUnit={id:`camera-${++seq}`,exerciseId:'squat',quality:.9,confidence:.9,verified:true,timestamp:(index+1)*10000,cycle:{startedAt:(index+1)*10000-duration,endedAt:(index+1)*10000,uninterrupted}};return send(s,{kind:'unit',sessionId:activeSeries(s)!.id,unit});}

describe('six types and hybrids',()=>{
 it('retains the original triangle with six distinct profiles, two advantages and two resistances per row',()=>{
  expect(new Set(TYPES.map(type=>JSON.stringify(TYPES.map(target=>TYPE_CHART[type][target])))).size).toBe(6);
  for(const t of TYPES){expect(TYPE_CHART[t][t]).toBe(1);expect(Object.values(TYPE_CHART[t]).filter(n=>n===1.5)).toHaveLength(2);expect(Object.values(TYPE_CHART[t]).filter(n=>n===.75)).toHaveLength(2);}
  expect(effectiveness('leg',['arm'])).toBe(1.5);expect(effectiveness('arm',['back'])).toBe(1.5);expect(effectiveness('back',['leg'])).toBe(1.5);
 });
 it('averages offensive types, multiplies defense and applies STAB once',()=>{
  expect(effectiveness(['leg','arm'],['arm'])).toBe(1.25);
  expect(effectiveness(['leg','arm'],['arm','back'])).toBe((1.125+1.5)/2);
  expect(stab(['leg','arm'],'arm')).toBe(1.25);expect(stab(['leg','arm'],null)).toBe(1);
  for(const a of TYPES)for(const b of TYPES)for(const d of TYPES)for(const e of TYPES){const value=effectiveness([a,b],[d,e]);expect(value).toBeGreaterThanOrEqual(.5625);expect(value).toBeLessThanOrEqual(2.25);}
 });
});
describe('v2 progression and resumable trials',()=>{
 it('starts with exactly four free attacks and no fabricated evidence',()=>{
  const s=initialSave();expect(s.version).toBe(2);expect(s.loadout).toHaveLength(4);expect(Object.values(s.skills).filter(p=>p.unlocked)).toHaveLength(4);
  for(const id of s.loadout)expect(s.skills[id]).toMatchObject({verifiedUnits:0,totalUnits:0,trialVerification:null});
  expect(run(send(s,{kind:'startRun',mode:'endless'})).contentVersion).toBe(2);
  s.loadout.pop();expect(()=>send(s,{kind:'startRun',mode:'endless'})).toThrow('SKILL_LOCKED');
 });
 it('requires all four equipped slots when leaving a v2 camp, not only at expedition start',()=>{
  let s=send(initialSave(),{kind:'startRun',mode:'endless'});s=send(s,{kind:'equip',skillIds:['mini-squat']});expect(()=>send(s,{kind:'startFloor'})).toThrow('FOUR_SKILLS_REQUIRED');
  s=send(s,{kind:'equip',skillIds:['mini-squat','knee-pushup','birddog','short-superman']});expect(run(send(s,{kind:'startFloor'})).status).toBe('battle');
 });
 it('challenge loadouts do not silently inherit personal Flash variants',()=>{
  let s=initialSave('Challenge','male',true);s.progression!.flashSkills=['squat'];s.flashEquipped=['squat'];s=send(s,{kind:'startRun',mode:'challenge',challengeId:'leg'});expect(run(s).flashEquipped).toEqual([]);expect(s.flashEquipped).toEqual(['squat']);
 });
 it('earns an opportunity every third floor in every expedition without duplicate settlement',()=>{
  let s=winAt(initialSave(),3);expect(s.progression!.trialTokens).toBe(1);const before=structuredClone(s);
  s=send(s,{kind:'settleFloor',battleId:'old-receipt'});expect(s).toEqual(before);
  s=send(s,{kind:'abandon'});s=winAt(s,3);expect(s.progression!.trialTokens).toBe(2);
 });
 it('suspends a run, preserves tokens on cancellation and resumes after successful unlock',()=>{
  let s=winAt(initialSave(),3);const before=structuredClone(run(s));s=send(s,{kind:'startTrial',skillId:'squat'});s=send(s,{kind:'manualUnit',sessionId:activeSeries(s)!.id});s=send(s,{kind:'abandon'});
  expect(run(s)).toEqual(before);expect(s.progression!.trialTokens).toBe(1);
  s=send(s,{kind:'startTrial',skillId:'squat'});expect(activeSeries(s)!.target).toBe(6);s=completeTrial(s);
  expect(run(s)).toEqual(before);expect(s.skills.squat.unlocked).toBe(true);expect(s.progression!.trialTokens).toBe(0);
 });
 it('progresses trial targets by prerequisite depth without oversized series',()=>{
  expect(trialRequirement('mini-squat')).toBe(4);expect(trialRequirement('squat')).toBe(6);expect(trialRequirement('pause-squat')).toBe(8);expect(trialRequirement('short-superman')).toBe(6);expect(trialRequirement('superman')).toBe(10);
  for(const skill of SKILLS)expect(trialRequirement(skill.id)).toBeLessThanOrEqual(skill.unit==='seconds'?15:8);
 });
 it('offers all exercises in training without granting battle unlocks',()=>{
  for(const skill of SKILLS){let s=initialSave();s=send(s,{kind:'startWorkout',entries:[{skillId:skill.id,target:skill.alternating?2:1}]});while(s.activity.kind==='workout'&&s.activity.status==='active')s=send(s,{kind:'manualUnit',sessionId:activeSeries(s)!.id});expect(s.records).toEqual({});expect(s.progression!.trialTokens).toBe(0);expect(Object.values(s.skills).filter(p=>p.unlocked)).toHaveLength(4);}
 });
 it('grants both milestones at floor15 and requires one boss reward selection',()=>{
  let s=winAt(initialSave(),15);expect(s.progression!.trialTokens).toBe(1);expect(run(s).pendingBossReward?.floor).toBe(15);
  expect(()=>send(s,{kind:'startFloor'})).toThrow('CHOOSE_BOSS_REWARD');
  s=send(s,{kind:'chooseBossReward',choice:'power',skillId:'mini-squat'});expect(run(s).powerUps?.['mini-squat']).toBe(1);expect(s.progression!.flashTokens).toBe(0);
  expect(()=>send(s,{kind:'chooseBossReward',choice:'flash'})).toThrow('NO_BOSS_REWARD');
  s=send(s,{kind:'abandon'});s=send(s,{kind:'startRun',mode:'endless'});expect(run(s).powerUps).toEqual({});
 });
 it('caps power upgrades and offers healing only after all equipped skills are capped',()=>{
  let s=winAt(initialSave(),5);run(s).powerUps=Object.fromEntries(run(s).loadout.map(id=>[id,5]));run(s).hp=10;
  expect(()=>send(s,{kind:'chooseBossReward',choice:'power',skillId:'mini-squat'})).toThrow('POWER_UP_UNAVAILABLE');
  s=send(s,{kind:'chooseBossReward',choice:'heal'});expect(run(s).hp).toBe(100);
 });
});
describe('Flash evidence',()=>{
 it('rejects replayed and overlapping cycles even with new event IDs, while allowing a fresh detector clock',()=>{
  let s=initialSave();s.progression!.flashTokens=1;s=send(s,{kind:'startFlashTrial',skillId:'mini-squat'});
  const unit:ExerciseUnit={id:'first',exerciseId:'squat',quality:.95,confidence:.95,verified:true,timestamp:3000,cycle:{clockId:'detector-A',startedAt:1000,endedAt:3000,uninterrupted:true}};
  const accept=(u:ExerciseUnit)=>{s=send(s,{kind:'unit',sessionId:activeSeries(s)!.id,unit:u});};
  accept(unit);accept({...unit,id:'replayed'});accept({...unit,id:'overlapping',timestamp:4000,cycle:{...unit.cycle!,startedAt:2000,endedAt:4000}});expect(activeSeries(s)!.progress).toBe(1);
  s=JSON.parse(JSON.stringify(s));accept({...unit,id:'after-reload',cycle:{...unit.cycle!,clockId:'detector-B'}});expect(activeSeries(s)!.progress).toBe(2);
  accept({...unit,id:'old-detector-replay'});expect(activeSeries(s)!.progress).toBe(2);
 });
 it('manual intents ignore caller-supplied verification and cadence fields',()=>{
  let s=initialSave();s.progression!.flashTokens=1;s=send(s,{kind:'startFlashTrial',skillId:'mini-squat'});
  s=send(s,{kind:'manualUnit',sessionId:activeSeries(s)!.id,verified:true,cycle:{startedAt:1,endedAt:2001,uninterrupted:true}} as TowerCommand);
  expect(activeSeries(s)).toMatchObject({verified:0,manual:1});expect(s.activity.kind==='trial'&&s.activity.referenceCycles).toEqual([]);
 });
 it('requires a boss opportunity and known compatible skill',()=>{
  expect(()=>send(initialSave(),{kind:'startFlashTrial',skillId:'mini-squat'})).toThrow('TRIAL_LOCKED');
  let s=winAt(initialSave(),5);s=send(s,{kind:'chooseBossReward',choice:'flash'});s=send(s,{kind:'startFlashTrial',skillId:'mini-squat'});expect(activeSeries(s)!.target).toBe(9);
  s=completeTrial(s);expect(s.progression!.flashSkills).toEqual(['mini-squat']);expect(s.progression!.flashTokens).toBe(0);expect(s.progression!.flashCadence).toEqual({});expect(s.progression!.flashVerification?.['mini-squat']).toBe('manual');
 });
 it('uses three actual cycles then six flexible paced cycles and rejects broken/extreme timing',()=>{
  let s=initialSave();s.progression!.flashTokens=1;s=send(s,{kind:'startFlashTrial',skillId:'mini-squat'});
  s=camera(s,0,2000,false);s=camera(s,1,500);expect(activeSeries(s)!.progress).toBe(0);
  for(let i=2;i<5;i++)s=camera(s,i);expect(s.activity.kind==='trial'&&s.activity.cadenceMs).toBe(2000);
  s=camera(s,5,1300);expect(activeSeries(s)!.progress).toBe(4);
  for(let i=6;i<11;i++)s=camera(s,i,1800);s=send(s,{kind:'finishTrial'});expect(s.progression!.flashCadence['mini-squat']).toBe(2000);expect(s.progression!.flashVerification?.['mini-squat']).toBe('verified');
 });
 it('does not give manual damage a cadence bonus and cannot change Flash during an attack',()=>{
  let s=initialSave();s.progression!.flashSkills=['mini-squat'];s.progression!.flashCadence['mini-squat']=2000;s=send(s,{kind:'equipFlash',skillId:'mini-squat',enabled:true});s=send(s,{kind:'startRun',mode:'endless',seed:2});s=send(s,{kind:'startFloor'});s=send(s,{kind:'beginAttack',skillId:'mini-squat'});
  expect(()=>send(s,{kind:'equipFlash',skillId:'mini-squat',enabled:false})).toThrow('CHANGE_LOADOUT_AT_SAFE_POINT');
  const manual=send(s,{kind:'manualUnit',sessionId:activeSeries(s)!.id});const timed=camera(s,1);expect(run(timed).battle!.lastDamage).toBeCloseTo(run(manual).battle!.lastDamage*.9*1.25);
 });
});
describe('determinism and migration',()=>{
 it('rejects inherited catalog property names without changing the save',()=>{
  for(const id of ['__proto__','constructor','toString']){
   const s=initialSave(),before=structuredClone(s);expect(()=>send(s,{kind:'startWorkout',entries:[{skillId:id,target:1}]})).toThrow('UNKNOWN_SKILL');expect(s).toEqual(before);
   expect(()=>trialRequirement(id)).toThrow('UNKNOWN_SKILL');
  }
 });
 it('preserves independent old slot data and migration is idempotent',()=>{
  const old=Array.from({length:3},(_,i)=>{const s=initialSave(`Player ${i}`);s.version=1;delete s.progression;delete s.flashEquipped;s.loadout=[s.loadout[i]];s.records.endless={bestFloor:i+1,bestVerifiedFloor:0,runs:i+2,wins:0};return s;});
  const before=structuredClone(old),migrated=old.map(migrateSave);expect(old).toEqual(before);
  for(let i=0;i<3;i++){expect(migrated[i].name).toBe(before[i].name);expect(migrated[i].records).toEqual(before[i].records);expect(migrated[i].loadout[0]).toBe(before[i].loadout[0]);expect(migrated[i].loadout).toHaveLength(4);expect(migrateSave(migrated[i])).toEqual(migrated[i]);}
 });
 it('caps fully boosted Flash damage at each boss phase and never skips a phase',()=>{
  let s=initialSave('Boosted','male',true);s.progression!.flashSkills=['squat'];s.progression!.flashCadence.squat=2000;s.flashEquipped=['squat'];s.loadout=['squat','pushup','birddog','superman'];s.specialization='leg';s=send(s,{kind:'startRun',mode:'endless',floor:100});run(s).powerUps={squat:5};s=send(s,{kind:'startFloor'});
  for(let phase=0;phase<3;phase++){
   s=send(s,{kind:'beginAttack',skillId:'squat'});run(s).battle!.enemyHp=run(s).battle!.enemy.thresholds[phase]+.01;
   s=camera(s,phase);expect(run(s).battle!.phase).toBe(phase);expect(run(s).battle!.lastDamage).toBeCloseTo(.01);expect(run(s).battle!.enemyHp).toBe(run(s).battle!.enemy.thresholds[phase]);
   if(phase<2){expect(run(s).battle!.turn).toBe('transform');s=send(s,{kind:'continuePhase'});s=send(s,{kind:'resolveEnemy'});}else expect(run(s).battle!.turn).toBe('won');
  }
 });
 it('generates 20 boss identities in a repeatable centennial cycle and bounded high floors',()=>{
  expect(new Set(Array.from({length:20},(_,i)=>generateFloor(7,(i+1)*5).artId)).size).toBe(20);
  expect(generateFloor(7,95).artId).toBe('boss-19');expect(generateFloor(7,100).artId).toBe('boss-20');expect(generateFloor(7,105).artId).toBe('boss-01');expect(generateFloor(7,200).artId).toBe('boss-20');
  for(const n of [1,10,100,1000,10000,MAX_FLOOR]){const e=generateFloor(7,n);expect(e).toEqual(generateFloor(7,n));expect(Number.isFinite(e.hp)).toBe(true);expect(e.hp).toBeLessThanOrEqual(432);}
  for(let i=2;i<200;i++)expect(generateFloor(7,i).artId).not.toBe(generateFloor(7,i-1).artId);
 });
 it('preserves an old run and its old generated encounters, without retroactive rewards',()=>{
  let s=send(initialSave(),{kind:'startRun',mode:'endless'});s.version=1;run(s).contentVersion=1;run(s).floor=5;const oldRun=structuredClone(run(s));const migrated=migrateSave(s);expect(run(migrated)).toEqual(oldRun);expect(migrated.version).toBe(2);
  s=send(s,{kind:'startFloor'});expect(run(s).battle!.enemy).toEqual(generateLegacyFloor(run(s).seed,5));run(s).battle!.turn='won';s=send(s,{kind:'settleFloor',battleId:run(s).battle!.id});expect(run(s).pendingBossReward).toBeUndefined();expect(s.progression!.trialTokens).toBe(0);
 });
 it('does not introduce new skills or specializations into a legacy expedition',()=>{
  let s=send(initialSave('Legacy','male',true),{kind:'startRun',mode:'endless'});run(s).contentVersion=1;
  expect(()=>send(s,{kind:'equip',skillIds:['cat-cow','mini-squat','knee-pushup','birddog']})).toThrow('LEGACY_RUN_SKILL_UNAVAILABLE');
  expect(()=>send(s,{kind:'specialize',type:'core'})).toThrow('LEGACY_RUN_TYPE_UNAVAILABLE');
  s=send(s,{kind:'equip',skillIds:['squat','pushup','birddog','superman']});expect(run(s).loadout).toEqual(['squat','pushup','birddog','superman']);
 });
 it('preserves local unlocks but strips imported timing evidence',()=>{
  const s=initialSave();s.progression!.flashSkills=['mini-squat'];s.progression!.flashCadence['mini-squat']=2000;s.progression!.flashVerification={'mini-squat':'verified'};s.flashEquipped=['mini-squat'];const imported=validateTowerImport(s);
  expect(imported.progression!.flashSkills).toEqual(['mini-squat']);expect(imported.progression!.flashCadence).toEqual({});expect(imported.progression!.flashVerification?.['mini-squat']).toBe('manual');expect(imported.loadout).toEqual(s.loadout);
 });
});

import {describe,it,expect} from 'vitest';
import {initialSave,applyCommand,activeSeries,availableSlots,effectiveness,stab} from '../src/tower/engine';
import {SKILLS,SKILL_BY_ID,INITIAL_SKILLS,CHALLENGES,canAttemptTrial} from '../src/tower/catalog';
import {generateFloor,MAX_FLOOR} from '../src/tower/generation';
import type {PlayerSave,TowerCommand,TowerRun,WorkoutActivity} from '../src/tower/model';
let id=0;
const context={uuid:()=>`event-${++id}`,now:()=>1000,seed:()=>42};
const send=(s:PlayerSave,c:TowerCommand)=>applyCommand(s,c,context);
const manual=(s:PlayerSave)=>send(s,{kind:'manualUnit',sessionId:activeSeries(s)!.id});
function trial(s:PlayerSave,skillId:string){s=send(s,{kind:'startTrial',skillId});while(!('completed'in s.activity&&s.activity.completed))s=manual(s);return send(s,{kind:'finishTrial'});}
const run=(s:PlayerSave)=>s.activity as TowerRun;
function start(skill='squat',floor=1){let s=initialSave('QA','male',true);s=send(s,{kind:'equip',skillIds:[skill]});s=send(s,{kind:'startRun',mode:'endless',seed:42,floor});return send(s,{kind:'startFloor'});}
function winFloor(s:PlayerSave){for(let guard=0;guard<2000;guard++){const b=run(s).battle!;if(b.turn==='won')return send(s,{kind:'settleFloor',battleId:b.id});if(b.turn==='lost')throw Error('fixture lost');if(b.turn==='player')s=send(s,{kind:'beginAttack',skillId:run(s).loadout[0]});else if(b.turn==='exercise')s=manual(s);else if(b.turn==='enemy')s=send(s,{kind:'resolveEnemy'});else if(b.turn==='transform')s=send(s,{kind:'continuePhase'});}throw Error('fixture infinite loop');}

describe('fresh tower saves and earned skills',()=>{
 it('has thirty unique skills and four initial trials, no XP or levels',()=>{
  const s=initialSave();expect(SKILLS).toHaveLength(30);expect(new Set(SKILLS.map(s=>s.id)).size).toBe(30);
  expect(SKILLS.filter(k=>canAttemptTrial(s,k.id)).map(k=>k.id).sort()).toEqual([...INITIAL_SKILLS].sort());
  expect(Object.values(s.skills).filter(k=>k.unlocked)).toHaveLength(0);expect(s).not.toHaveProperty('xp');expect(s).not.toHaveProperty('level');expect(s).not.toHaveProperty('journey');
 });
 it('unlocks each skill only after a completed trial, grows loadout and marks manual proof',()=>{
  let s=initialSave();expect(()=>send(s,{kind:'startRun',mode:'endless'})).toThrow('SKILL_LOCKED');
  expect(()=>send(s,{kind:'startTrial',skillId:'diamond'})).toThrow('TRIAL_LOCKED');
  s=send(s,{kind:'startTrial',skillId:'mini-squat'});expect(()=>send(s,{kind:'finishTrial'})).toThrow('TRIAL_NOT_FINISHED');
  s=manual(manual(manual(s)));s=send(s,{kind:'finishTrial'});expect(s.skills['mini-squat'].trialVerification).toBe('manual');expect(s.loadout).toEqual(['mini-squat']);expect(availableSlots(s)).toBe(1);
  for(const skill of INITIAL_SKILLS.slice(1))s=trial(s,skill);expect(availableSlots(s)).toBe(4);expect(s.completedTrials).toBe(4);
  const before=s.completedTrials;s=trial(s,'mini-squat');expect(s.completedTrials).toBe(before);
 });
 it('refuses camera credit for a movement variant without its own recognizer',()=>{
  let s=send(initialSave('QA','male',true),{kind:'startTrial',skillId:'pause-squat'});const sessionId=activeSeries(s)!.id;
  expect(()=>send(s,{kind:'unit',sessionId,unit:{id:'a',exerciseId:'squat',quality:1,confidence:1,verified:true,timestamp:1}})).toThrow('VARIANT_REQUIRES_MANUAL');
  expect(canAttemptTrial(s,'__proto__')).toBe(false);
 });
 it('allows later camera accreditation without repeated unlock or extra slots',()=>{
  let s=trial(initialSave(),'birddog');s=send(s,{kind:'startTrial',skillId:'birddog'});
  for(let i=0;i<4;i++)s=send(s,{kind:'unit',sessionId:activeSeries(s)!.id,unit:{id:`camera-${i}`,exerciseId:'birddog',quality:1,confidence:1,verified:true,timestamp:i,side:i%2?'right':'left'}});
  s=send(s,{kind:'finishTrial'});expect(s.skills.birddog.trialVerification).toBe('verified');expect(s.completedTrials).toBe(1);expect(s.loadout).toEqual(['birddog']);
 });
 it('requires debug state for floor jumping, never a player name',()=>{
  let s=trial(initialSave('admin'),'mini-squat');expect(()=>send(s,{kind:'startRun',mode:'endless',floor:100})).toThrow('DEBUG_FLOOR_ONLY');
  expect(run(start('squat',100)).floor).toBe(100);
 });
});

describe('seeded floors and battle mechanics',()=>{
 it('generates identical encounters with bounded stats through floor one billion',()=>{
  for(const floor of [1,5,10,1000,MAX_FLOOR]){const e=generateFloor(42,floor);expect(e).toEqual(generateFloor(42,floor));expect(e.hp).toBeLessThanOrEqual(432);expect(e.attack).toBeGreaterThanOrEqual(6);expect(e.attack).toBeLessThanOrEqual(12);expect(e.thresholds.at(-1)).toBe(0);}
  expect(generateFloor(42,5).phases).toHaveLength(2);expect(generateFloor(42,10).phases).toHaveLength(3);expect(()=>generateFloor(42,MAX_FLOOR+1)).toThrow();
 });
 it('retains type chart and STAB',()=>{expect(effectiveness('leg',['arm'])).toBe(1.5);expect(effectiveness('leg',['back'])).toBe(.75);expect(effectiveness('arm',['leg','back'])).toBe(1.125);expect(stab('leg','leg')).toBe(1.25);});
 it('credits each unit once and rejects stale sessions without changing the original state',()=>{
  let s=start();s=send(s,{kind:'beginAttack',skillId:'squat'});const before=structuredClone(s),sessionId=activeSeries(s)!.id;
  const c:TowerCommand={kind:'unit',sessionId,unit:{id:'one',exerciseId:'squat',quality:1,confidence:1,verified:true,timestamp:1}};
  const next=send(s,c);expect(s).toEqual(before);expect(activeSeries(next)!.progress).toBe(1);expect(send(next,c)).toEqual(next);
  expect(()=>send(next,{...c,sessionId:'stale'})).toThrow('STALE_EXERCISE_SESSION');
 });
 it('preserves alternation, pause and progress on reload',()=>{
  let s=start('birddog');s=send(s,{kind:'beginAttack',skillId:'birddog'});const sessionId=activeSeries(s)!.id;
  const u={id:'left',exerciseId:'birddog' as const,quality:1,confidence:1,verified:true,timestamp:1,side:'left' as const};
  s=send(s,{kind:'unit',sessionId,unit:u});s=send(s,{kind:'unit',sessionId,unit:{...u,id:'repeat-left'}});expect(activeSeries(s)!.progress).toBe(1);
  s=send(s,{kind:'pause',paused:true});s=manual(s);expect(activeSeries(s)!.progress).toBe(1);s=JSON.parse(JSON.stringify(s));s=send(s,{kind:'pause',paused:false});s=manual(s);expect(activeSeries(s)!.progress).toBe(2);
 });
 it('caps a powerful hit at the phase threshold and never skips a phase',()=>{
  let s=start('squat',10);s=send(s,{kind:'beginAttack',skillId:'squat'});run(s).battle!.enemyHp=run(s).battle!.enemy.thresholds[0]+.5;s=manual(s);
  expect(run(s).battle!.enemyHp).toBe(run(s).battle!.enemy.thresholds[0]);expect(run(s).battle!.turn).toBe('transform');expect(run(s).battle!.phase).toBe(0);
  s=send(s,{kind:'continuePhase'});expect(run(s).battle!.phase).toBe(1);expect(run(s).battle!.turn).toBe('enemy');
 });
 it('defense halves the next hit and does not permanently suppress damage',()=>{
  let defended=start(),normal=structuredClone(defended);defended=send(defended,{kind:'defend'});run(normal).battle!.turn='enemy';
  defended=send(defended,{kind:'resolveEnemy'});normal=send(normal,{kind:'resolveEnemy'});
  expect(100-run(defended).battle!.playerHp).toBeCloseTo((100-run(normal).battle!.playerHp)/2);expect(run(defended).battle!.defending).toBe(false);
 });
 it('manual fatigue applies after a manual series without altering verified damage',()=>{
  let s=start('squat',100);s=send(s,{kind:'beginAttack',skillId:'squat'});for(let i=0;i<8;i++)s=manual(s);
  expect(run(s).battle!.fatigue.leg).toBe(1);s=send(s,{kind:'resolveEnemy'});s=send(s,{kind:'beginAttack',skillId:'squat'});s=manual(s);
  expect(activeSeries(s)!.manualFactor).toBe(.85);
 });
 it('settles only completed floors, heals, and prevents duplicate reward/record settlement',()=>{
  let s=start();const battleId=run(s).battle!.id;expect(()=>send(s,{kind:'settleFloor',battleId})).toThrow('BATTLE_NOT_FINISHED');
  s=winFloor(s);expect(s.records.endless.bestFloor).toBe(1);expect(s.records.endless.bestVerifiedFloor).toBe(0);expect(run(s).floor).toBe(2);expect(run(s).hp).toBeLessThanOrEqual(100);
  expect(send(s,{kind:'settleFloor',battleId})).toEqual(s);const next=send(s,{kind:'startFloor'});expect(()=>send(next,{kind:'settleFloor',battleId})).toThrow('STALE_BATTLE');
 });
 it('loss ends an attempt without erasing skills or fabricating completed floors',()=>{
  let s=start();s.skills.squat.mastery=42;run(s).battle!.turn='lost';run(s).battle!.playerHp=0;
  s=send(s,{kind:'settleFloor',battleId:run(s).battle!.id});expect(run(s).status).toBe('lost');expect(s.records.endless.bestFloor).toBe(0);expect(s.skills.squat.mastery).toBe(42);expect(s.history[0].result).toBe('lost');
  s=send(s,{kind:'closeActivity'});expect(s.activity.kind).toBe('idle');
 });
 it('challenge loadouts cannot change and completing a type challenge grants its specialization once',()=>{
  let s=initialSave('QA','female',true);s.availableSpecializations=[];s=send(s,{kind:'startRun',mode:'challenge',challengeId:'leg'});
  expect(run(s).loadout).toEqual(CHALLENGES[0].skillIds);expect(()=>send(s,{kind:'equip',skillIds:['squat']})).toThrow();
  // Terminal fixture focuses on canonical completion rather than exercising all five fights.
  run(s).floor=5;s=send(s,{kind:'startFloor'});const b=run(s).battle!;b.turn='won';b.enemyHp=0;
  s=send(s,{kind:'settleFloor',battleId:b.id});expect(run(s).status).toBe('complete');expect(s.availableSpecializations).toEqual(['leg']);expect(s.records['challenge:leg'].wins).toBe(1);expect(send(s,{kind:'settleFloor',battleId:b.id})).toEqual(s);
 });
});

describe('custom workouts are not combat',()=>{
 it('executes exact targets, rest and skip without mastery, damage or tower records',()=>{
  let s=initialSave('QA','male',true);s=send(s,{kind:'startWorkout',name:'Exact sequence',entries:[{skillId:'mini-squat',target:2},{skillId:'knee-pushup',target:3},{skillId:'birddog',target:4}],restSeconds:10});
  s=manual(manual(s));expect((s.activity as WorkoutActivity).status).toBe('rest');expect(s.skills['mini-squat'].mastery).toBe(0);expect(s.records).toEqual({});
  s=send(s,{kind:'continueWorkout'});s=send(s,{kind:'skipWorkoutEntry'});s=send(s,{kind:'continueWorkout'});for(let i=0;i<4;i++)s=manual(s);
  expect((s.activity as WorkoutActivity).status).toBe('complete');expect(s.history[0]).toMatchObject({completed:2,skipped:1,manual:6,result:'incomplete'});expect(s.activity).not.toHaveProperty('battle');expect(s.activity).not.toHaveProperty('hp');
 });
 it('validates unlocked exercises, exact alternating targets and immutable routine snapshots',()=>{
  expect(()=>send(initialSave(),{kind:'startWorkout',entries:[{skillId:'squat',target:3}]})).toThrow('SKILL_LOCKED');
  let s=initialSave('QA','male',true);expect(()=>send(s,{kind:'startWorkout',entries:[{skillId:'birddog',target:3}]})).toThrow('INVALID_WORKOUT_TARGET');
  const routine={id:'daily',name:'Daily',entries:[{skillId:'squat',target:3}],restSeconds:20};s=send(s,{kind:'saveRoutine',routine});s=send(s,{kind:'startWorkout',routineId:'daily'});routine.entries[0].target=99;expect((s.activity as WorkoutActivity).entries[0].target).toBe(3);
 });
 it('replayed semantic operations cannot duplicate manual actions or skips',()=>{
  let s=initialSave('QA','male',true);s=send(s,{kind:'startWorkout',entries:[{skillId:'squat',target:3}]});
  const c:TowerCommand={kind:'manualUnit',sessionId:activeSeries(s)!.id,operationId:'receipt-1'};s=send(s,c);expect(send(s,c)).toEqual(s);expect(activeSeries(s)!.progress).toBe(1);
 });
});

it('retains manual deduplication within long series even after operation receipt eviction',()=>{
 let s=initialSave('QA','male',true);s=send(s,{kind:'startWorkout',entries:[{skillId:'short-superman',target:400}]});
 const sessionId=activeSeries(s)!.id;
 for(let i=0;i<300;i++)s=send(s,{kind:'manualUnit',sessionId,operationId:`long-${i}`});
 expect(activeSeries(s)!.progress).toBe(300);expect(s.lastOperationIds).not.toContain('long-0');
 s=send(s,{kind:'manualUnit',sessionId,operationId:'long-0'});expect(activeSeries(s)!.progress).toBe(300);
});
it('marks mixed trials honestly and does not turn a mixed run into a camera record',()=>{
 let s=send(initialSave(),{kind:'startTrial',skillId:'short-superman'});const sessionId=activeSeries(s)!.id;
 s=send(s,{kind:'unit',sessionId,unit:{id:'verified',exerciseId:'superman',quality:1,confidence:1,verified:true,timestamp:1}});
 for(let i=0;i<4;i++)s=manual(s);s=send(s,{kind:'finishTrial'});expect(s.skills['short-superman'].trialVerification).toBe('mixed');
 s=send(s,{kind:'startRun',mode:'endless'});s=send(s,{kind:'startFloor'});s=winFloor(s);expect(s.records.endless.bestVerifiedFloor).toBe(0);
});
it('new experimental patterns and pending variants expose their capability honestly',()=>{
 expect(SKILL_BY_ID['mini-squat'].detectorStatus).toBe('experimental');expect(SKILL_BY_ID['knee-pushup'].detectorStatus).toBe('experimental');
 expect(SKILL_BY_ID.diamond.detector).toBe('manual');expect(SKILL_BY_ID.diamond.detectorStatus).toBe('pending');expect(SKILL_BY_ID.squat.detectorStatus).toBe('configured');
});

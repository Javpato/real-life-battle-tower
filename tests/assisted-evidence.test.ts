import {describe,expect,it} from 'vitest';
import {activeSeries,applyCommand,initialSave} from '../src/tower/engine';
import {SKILL_BY_ID} from '../src/tower/catalog';
import {EXERCISE_PROFILES} from '../src/tower/exerciseProfiles';
import {acceptedExerciseUnit} from '../src/tower/unitReceipt';
import type {ExerciseUnit,PlayerSave,TowerCommand,TowerRun,WorkoutActivity} from '../src/tower/model';

let sequence=0;
const send=(save:PlayerSave,command:TowerCommand)=>applyCommand(save,command,{uuid:()=>`evidence-${++sequence}`,now:()=>1000});
function workout(skillId='pause-squat',target=4){return send(initialSave('QA','male',true),{kind:'startWorkout',entries:[{skillId,target}]});}
function evidence(save:PlayerSave,overrides:Partial<ExerciseUnit>={}):Extract<TowerCommand,{kind:'unit'}>{
 const series=activeSeries(save)!,skill=SKILL_BY_ID[series.skillId];
 return {kind:'unit',sessionId:series.id,unit:{id:`unit-${++sequence}`,exerciseId:skill.exercise,skillId:skill.id,profileId:`assisted-v1:${skill.id}`,evidence:'assisted',verified:false,quality:1,confidence:.55,timestamp:1000+sequence,...(skill.alternating?{side:series.side==='left'?'right':'left'}:{}),...overrides}};
}
function battle(skillId='pause-squat',floor=100){
 let save=initialSave('QA','male',true);save=send(save,{kind:'equip',skillIds:[skillId]});
 save=send(save,{kind:'startRun',mode:'endless',seed:42,floor});save=send(save,{kind:'startFloor'});
 return send(save,{kind:'beginAttack',skillId});
}
const run=(save:PlayerSave)=>save.activity as TowerRun;

describe('exact assisted exercise provenance',()=>{
 it('accepts every opted-in profile as unverified assistance, not a family alias',()=>{
  for(const profile of Object.values(EXERCISE_PROFILES).filter(p=>p.method==='assisted')){
   const before=workout(profile.id),command=evidence(before),after=send(before,command);
   expect(activeSeries(after),profile.id).toMatchObject({progress:1,manual:1,verified:0});
   expect(acceptedExerciseUnit(before,after,command),profile.id).toBe(true);
   expect(after.skills[profile.id].mastery,profile.id).toBe(0);
  }
 });
 it('binds the exact skill even when the transport family is shared',()=>{
  const before=workout(),command=evidence(before,{skillId:'sumo-squat',profileId:'assisted-v1:sumo-squat'});
  expect(()=>send(before,command)).toThrow('WRONG_SKILL');
  expect(()=>send(before,evidence(before,{exerciseId:'pushup'}))).toThrow('WRONG_EXERCISE');
  expect(()=>send(before,evidence(before,{skillId:undefined}))).toThrow('SKILL_EVIDENCE_REQUIRED');
  expect(()=>send(before,evidence(before,{profileId:undefined}))).toThrow('WRONG_EVIDENCE_PROFILE');
  expect(()=>send(before,evidence(before,{profileId:'assisted-v1:sumo-squat'}))).toThrow('WRONG_EVIDENCE_PROFILE');
  expect(()=>send(before,evidence(before,{profileId:'assisted-v2:pause-squat'}))).toThrow('WRONG_EVIDENCE_PROFILE');
  expect(activeSeries(before)!.progress).toBe(0);
 });
 it('rejects false verification, fabricated technique scores and cadence on assisted events',()=>{
  const save=workout();
  for(const patch of [{verified:true},{quality:.8},{cycle:{startedAt:1,endedAt:1000,uninterrupted:true}}]){
   expect(()=>send(save,evidence(save,patch))).toThrow('INVALID_UNVERIFIED_EVIDENCE');
  }
  expect(()=>send(save,evidence(save,{evidence:'camera',verified:true,profileId:undefined}))).toThrow('INVALID_CAMERA_EVIDENCE');
  // Dropping the label never converts a pending variation into a supported detector.
  expect(()=>send(save,evidence(save,{evidence:undefined,profileId:undefined,verified:true}))).toThrow('VARIANT_REQUIRES_MANUAL');
 });
 it('does not let confirmation-only movements masquerade as automatic detections',()=>{
  const save=workout('cat-cow');
  expect(()=>send(save,evidence(save))).toThrow('WRONG_EVIDENCE_PROFILE');
  const next=send(save,evidence(save,{evidence:'confirmation',profileId:'confirmation-v1:cat-cow'}));
  expect(activeSeries(next)).toMatchObject({progress:1,verified:0,manual:1});
  expect(()=>send(save,evidence(save,{evidence:'confirmation',profileId:'confirmation-v1:cat-cow',verified:true}))).toThrow('INVALID_UNVERIFIED_EVIDENCE');
 });
 it('validates new metadata without breaking older configured camera or manual clients',()=>{
  let save=workout('squat');
  save=send(save,evidence(save,{evidence:undefined,profileId:undefined,skillId:undefined,verified:true}));
  save=send(save,evidence(save,{evidence:'camera',profileId:'camera-v1:squat',verified:true}));
  save=send(save,{kind:'manualUnit',sessionId:activeSeries(save)!.id});
  expect(activeSeries(save)).toMatchObject({progress:3,verified:2,manual:1});
  expect(()=>send(save,evidence(save,{evidence:undefined}))).toThrow('EVIDENCE_KIND_REQUIRED');
  expect(()=>send(save,evidence(save,{evidence:'invalid' as ExerciseUnit['evidence']}))).toThrow('INVALID_UNIT');
  expect(()=>send(save,evidence(save,{skillId:42 as unknown as string}))).toThrow('INVALID_UNIT');
  expect(()=>send(save,evidence(save,{profileId:'x'.repeat(121)}))).toThrow('INVALID_UNIT');
  expect(()=>send(save,evidence(save,{evidence:'manual',profileId:undefined,verified:true}))).toThrow('INVALID_UNVERIFIED_EVIDENCE');
 });
});

describe('assistance preserves canonical progression boundaries',()=>{
 it('deduplicates events, rejects a previous series and gives no credit while paused',()=>{
  const start=workout(),command=evidence(start);let save=send(start,command);
  expect(activeSeries(start)!.progress).toBe(0);
  expect(send(save,command)).toEqual(save);
  expect(()=>send(save,{...command,sessionId:'previous-series'})).toThrow('STALE_EXERCISE_SESSION');
  save=send(save,{kind:'pause',paused:true});const paused=evidence(save),after=send(save,paused);
  expect(activeSeries(after)!.progress).toBe(1);expect(acceptedExerciseUnit(save,after,paused)).toBe(false);
  save=send(after,{kind:'pause',paused:false});save=send(save,evidence(save));
  expect(activeSeries(save)!.progress).toBe(2);
 });
 it('enforces alternation and stops at the prescribed target',()=>{
  let save=workout('assisted-lunge',2);save=send(save,evidence(save,{side:'left'}));
  save=send(save,evidence(save,{side:'left'}));expect(activeSeries(save)!.progress).toBe(1);
  save=send(save,evidence(save,{side:'right'}));save=send(save,evidence(save,{side:'left'}));
  expect(activeSeries(save)).toMatchObject({progress:2,verified:0,manual:2});
  expect((save.activity as WorkoutActivity).status).toBe('complete');
 });
 it('never invents quality, technical stars, held time or camera records for assistance',()=>{
  for(const skillId of ['pause-squat','high-plank']){
   let save=workout(skillId,3);for(let n=0;n<3;n++)save=send(save,evidence(save));
   expect(save.history[0].workoutResults![0]).toMatchObject({units:3,manual:3,verified:0,stars:1,technicalStars:null,quality:null,activeSecondsEstimate:null});
   expect(save.history[0].timing!.activeSecondsEstimate).toBeNull();
   expect(save.records).toEqual({});
  }
 });
 it('unlocks trials permanently with manual provenance and no fabricated Flash cadence',()=>{
  let save=send(initialSave('QA','male',true),{kind:'startTrial',skillId:'pause-squat'});
  save.skills['pause-squat'].unlocked=false;
  const target=activeSeries(save)!.target;for(let n=0;n<target;n++)save=send(save,evidence(save));
  save=send(save,{kind:'finishTrial'});
  expect(save.skills['pause-squat']).toMatchObject({unlocked:true,totalUnits:target,verifiedUnits:0,manualUnits:target,trialVerification:'manual'});
  expect(save.progression!.flashCadence).toEqual({});
  const flash=send(save,{kind:'startFlashTrial',skillId:'squat'});
  expect(()=>send(flash,evidence(flash))).toThrow('WRONG_EVIDENCE_PROFILE');
 });
 it('applies immediate damage, labels assistance and preserves it when cancelling',()=>{
  const before=battle();let save=send(before,evidence(before));
  expect(run(save).battle!.enemyHp).toBeLessThan(run(before).battle!.enemyHp);
  expect(run(save).battle!.log).toMatch(/^Assisted repetition/);
  expect(run(save).battle!.turn).toBe('exercise');
  expect(run(save)).toMatchObject({manual:1,verified:0});
  const hp=run(save).battle!.enemyHp;save=send(save,{kind:'cancelSeries'});
  expect(run(save).battle!.enemyHp).toBe(hp);expect(run(save).battle!.turn).toBe('enemy');
 });
 it('cannot spill assistance across boss phase thresholds or act during an enemy turn',()=>{
  let save=battle('pause-squat',10);const firstThreshold=run(save).battle!.enemy.thresholds[0];
  run(save).battle!.enemyHp=firstThreshold+.1;save=send(save,evidence(save));
  expect(run(save).battle!).toMatchObject({enemyHp:firstThreshold,phase:0,turn:'transform'});
  const progress=activeSeries(save)!.progress;save=send(save,evidence(save));
  expect(activeSeries(save)!.progress).toBe(progress);
  save=send(save,{kind:'continuePhase'});expect(run(save).battle!.turn).toBe('enemy');
 });
});

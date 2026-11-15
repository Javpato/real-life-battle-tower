import {describe,it,expect} from 'vitest';
import {assessFlashCycle,flashCadenceWindow,FLASH_TIMING,flashSetBudget,createFlashSet,assessFlashSet} from '../src/tower/flash';
import {activeSeries,applyCommand,initialSave} from '../src/tower/engine';
import type {ExerciseUnit,PlayerSave,TowerCommand,TowerRun} from '../src/tower/model';

let sequence=0,clock=0;
const send=(save:PlayerSave,command:TowerCommand)=>applyCommand(save,command,{uuid:()=>`flash-${++sequence}`,now:()=>100000});
function unit(durationMs=2000,overrides:Partial<ExerciseUnit>={}):ExerciseUnit {
 const timestamp=(clock+=durationMs);++sequence;
 return {id:`cycle-${sequence}`,exerciseId:'squat',quality:.5,confidence:.5,verified:true,timestamp,cycle:{clockId:'camera',startedAt:timestamp-durationMs,endedAt:timestamp,uninterrupted:true},...overrides};
}
function trial(){const save=initialSave();save.progression!.flashTokens=1;return send(save,{kind:'startFlashTrial',skillId:'mini-squat'});}
const camera=(save:PlayerSave,observed=unit())=>send(save,{kind:'unit',sessionId:activeSeries(save)!.id,unit:observed});
function battle(){
 let save=initialSave();save.progression!.flashSkills=['mini-squat'];save.progression!.flashCadence['mini-squat']=2000;
 save=send(save,{kind:'equipFlash',skillId:'mini-squat',enabled:true});save=send(save,{kind:'startRun',mode:'endless',seed:2});save=send(save,{kind:'startFloor'});
 return send(save,{kind:'beginAttack',skillId:'mini-squat'});
}

describe('shared Flash pace and evidence policy',()=>{
 it('retains bounded legacy windows while set budgets require a speedup',()=>{
  expect(flashCadenceWindow(2000)).toEqual({minMs:1000,maxMs:3500,referenceMs:2000});
  expect(flashCadenceWindow(700)).toEqual({minMs:350,maxMs:1225,referenceMs:700});
  expect(flashCadenceWindow(12000)).toEqual({minMs:6000,maxMs:12000,referenceMs:12000});
  for(const invalid of [undefined,0,Infinity,NaN,349,12001])expect(flashCadenceWindow(invalid)).toEqual({minMs:350,maxMs:12000,referenceMs:null});
  expect(flashSetBudget(6,2000)).toBe(9600);expect(flashSetBudget(6,2000,15)).toBe(15000);
  for(const duration of [1000,1300,2000,3200,3500])expect(assessFlashCycle(unit(duration),2000).accepted).toBe(true);
  expect(assessFlashCycle(unit(999),2000)).toMatchObject({accepted:false,reason:'too-fast'});
  expect(assessFlashCycle(unit(3501),2000)).toMatchObject({accepted:false,reason:'too-slow'});
 });
 it('accepts configured minimum motion quality without allowing poor visibility or fabricated cycles',()=>{
  expect(assessFlashCycle(unit()).accepted).toBe(true);
  expect(assessFlashCycle(unit(2000,{quality:.49}))).toMatchObject({accepted:false,reason:'low-quality'});
  expect(assessFlashCycle(unit(2000,{confidence:.49}))).toMatchObject({accepted:false,reason:'low-confidence'});
  expect(assessFlashCycle(unit(2000,{confidence:NaN}))).toMatchObject({accepted:false,reason:'low-confidence'});
  expect(assessFlashCycle(unit(2000,{quality:Infinity}))).toMatchObject({accepted:false,reason:'low-quality'});
  expect(assessFlashCycle(unit(2000,{verified:false}))).toMatchObject({accepted:false,reason:'manual'});
  expect(assessFlashCycle(unit(2000,{cycle:undefined}))).toMatchObject({accepted:false,reason:'missing-cycle'});
 });
 it('rejects interruption, invalid clocks and overlapping evidence with explanatory reasons',()=>{
  const observed=unit();
  expect(assessFlashCycle({...observed,cycle:{...observed.cycle!,uninterrupted:false}})).toMatchObject({accepted:false,reason:'interrupted'});
  for(const cycle of [{...observed.cycle!,startedAt:NaN},{...observed.cycle!,startedAt:-1},{...observed.cycle!,endedAt:observed.timestamp-1},{...observed.cycle!,clockId:''},{...observed.cycle!,clockId:'x'.repeat(201)}])expect(assessFlashCycle({...observed,cycle})).toMatchObject({accepted:false,reason:'invalid-clock'});
  expect(assessFlashCycle(observed,undefined,observed.cycle!.startedAt+1)).toMatchObject({accepted:false,reason:'overlap'});
  expect(assessFlashCycle(observed,undefined,observed.cycle!.startedAt).accepted).toBe(true);
 });
});

describe('Flash trial and battle use actual completed motion',()=>{
 it('finishes six complete camera repetitions inside one faster set budget',()=>{
  let save=trial();
  for(let i=0;i<3;i++)save=camera(save);
  expect(save.activity).toMatchObject({flashStage:'test',cadenceMs:2000});
  expect(activeSeries(save)!.flash?.budgetMs).toBe(9600);
  for(const duration of [1000,1300,1500,1600,1800,2000])save=camera(save,unit(duration));
  expect(save.activity).toMatchObject({completed:true,series:{progress:9,verified:9,manual:0}});
  save=send(save,{kind:'finishTrial'});
  expect(save.progression).toMatchObject({flashTokens:0,flashSkills:['mini-squat'],flashCadence:{'mini-squat':2000},flashVerification:{'mini-squat':'verified'}});
 });
 it('requires a faster complete set even for a slow baseline, and retries free',()=>{
  let save=trial();for(let i=0;i<3;i++)save=camera(save,unit(9000));
  expect(save.activity).toMatchObject({cadenceMs:9000});
  for(let i=0;i<6;i++)save=camera(save,unit(11000));
  expect(save.activity).toMatchObject({completed:false,series:{progress:9,flash:{status:'expired'}}});
  expect(()=>send(save,{kind:'finishTrial'})).toThrow('TRIAL_NOT_FINISHED');
  save=send(save,{kind:'retryFlashTrial'});expect(activeSeries(save)).toMatchObject({target:6,progress:0,flash:{budgetMs:43200}});
  expect(save.progression!.flashTokens).toBe(1);for(let i=0;i<6;i++)save=camera(save,unit(6500));
  save=send(save,{kind:'finishTrial'});expect(save.progression!.flashCadence['mini-squat']).toBe(9000);
 });
 it('ignores paused and duplicate evidence and permits a later fresh cycle without penalizing the rest',()=>{
  let save=trial();const observed=unit();save=camera(save,observed);
  save=camera(save,observed);save=camera(save,{...observed,id:'renamed-replay'});expect(activeSeries(save)!.progress).toBe(1);
  save=send(save,{kind:'pause',paused:true});save=camera(save);expect(activeSeries(save)!.progress).toBe(1);
  save=send(save,{kind:'pause',paused:false});save=camera(save);expect(activeSeries(save)!.progress).toBe(2);
  expect(save.progression!.flashTokens).toBe(1);
 });
 it('collects a baseline after manual reference reps without pretending a mixed trial was verified',()=>{
  let save=trial();for(let i=0;i<3;i++)save=send(save,{kind:'manualUnit',sessionId:activeSeries(save)!.id});
  expect(save.activity).toMatchObject({flashStage:'test',referenceCycles:[]});
  for(let i=0;i<6;i++)save=camera(save);
  expect(save.activity).toMatchObject({completed:true,cadenceMs:2000,referenceCycles:[2000,2000,2000]});
  save=send(save,{kind:'finishTrial'});expect(save.progression!.flashVerification?.['mini-squat']).toBe('mixed');expect(save.progression!.flashCadence).toEqual({});
 });
 it('awards a visible bonus only for eligible camera cycles, retaining ordinary damage outside the window',()=>{
  const save=battle(),matched=camera(save,unit(3200)),outside=camera(save,unit(10000));
  const matchBattle=(matched.activity as TowerRun).battle!,outsideBattle=(outside.activity as TowerRun).battle!;
  expect(matchBattle.lastDamage).toBeCloseTo(outsideBattle.lastDamage*1.25);expect(matchBattle.log).toContain('FLASH ×1.25');expect(outsideBattle.log).not.toContain('FLASH');
  expect(activeSeries(outside)!.progress).toBe(1);
  const manual=send(save,{kind:'manualUnit',sessionId:activeSeries(save)!.id});expect((manual.activity as TowerRun).battle!.log).not.toContain('FLASH');
  const noBaseline=structuredClone(save);delete noBaseline.progression!.flashCadence['mini-squat'];expect((camera(noBaseline).activity as TowerRun).battle!.log).not.toContain('FLASH');
 });
 it('keeps the trial small regardless of the timing window',()=>{
  expect(activeSeries(trial())!.target).toBe(FLASH_TIMING.referenceReps+FLASH_TIMING.testReps);
 });
});

describe('whole-set clocks and settings',()=>{
 it('includes gaps between repetitions and never restarts an expired budget',()=>{
  const state=createFlashSet(6,2000),a=unit(1000);expect(assessFlashSet(state,a)).toBe(true);
  clock+=10000;expect(assessFlashSet(state,unit(1000))).toBe(false);expect(state.status).toBe('expired');
  expect(assessFlashSet(state,unit(1000))).toBe(false);
 });
 it('invalidates timing after rest, interruption or a changed camera clock',()=>{
  let save=camera(battle(),unit(1000));save=send(save,{kind:'pause',paused:true});save=send(save,{kind:'pause',paused:false});
  save=camera(save,unit(1000));expect((save.activity as TowerRun).battle!.log).not.toContain('FLASH');
  for(const changed of ['clock','interrupted'] as const){
   const state=createFlashSet(6,2000);expect(assessFlashSet(state,unit(1000))).toBe(true);
   const u=unit(1000);if(changed==='clock')u.cycle!.clockId='new-camera';else u.cycle!.uninterrupted=false;
   expect(assessFlashSet(state,u)).toBe(false);expect(state.status).toBe('interrupted');
  }
 });
 it('accepts custom duration before a set, validates bounds, and locks it once started',()=>{
  let save=battle();const sessionId=activeSeries(save)!.id;
  for(const seconds of [0,-1,601,NaN,Infinity])expect(()=>send(save,{kind:'configureFlash',sessionId,seconds})).toThrow('INVALID_FLASH_TIME');
  save=send(save,{kind:'configureFlash',sessionId,seconds:20});expect(activeSeries(save)!.flash).toMatchObject({budgetMs:20000,source:'custom'});
  save=camera(save,unit(1000));expect(()=>send(save,{kind:'configureFlash',sessionId,seconds:30})).toThrow('FLASH_ALREADY_STARTED');
 });
 it('preserves legacy active battles and trials without adding a new timing policy',()=>{
  let save=battle();delete activeSeries(save)!.flash;
  save=camera(save,unit(4000));expect((save.activity as TowerRun).battle!.log).not.toContain('FLASH');expect(activeSeries(save)!.flash).toBeUndefined();
  save=trial();if(save.activity.kind==='trial')delete save.activity.flashPolicyVersion;
  for(let i=0;i<3;i++)save=camera(save,unit(2000));for(let i=0;i<6;i++)save=camera(save,unit(3000));
  expect(save.activity).toMatchObject({completed:true});expect(activeSeries(save)!.flash).toBeUndefined();
 });
});

import {describe,it,expect} from 'vitest';
import {initialSave,applyCommand,activeSeries,trialRequirement} from '../src/tower/engine';
import {validateTowerImport} from '../src/tower/importSave';
import {challengeAvailable} from '../src/tower/catalog';
import type {PlayerSave,TowerCommand,TowerRun} from '../src/tower/model';
let sequence=0;const send=(s:PlayerSave,c:TowerCommand)=>applyCommand(s,c,{uuid:()=>`import-${++sequence}`,now:()=>1000});
function earned(){let s=initialSave('Traveller','female');s.progression!.trialTokens=1;for(const skill of ['mini-squat','squat']){s=send(s,{kind:'startTrial',skillId:skill});for(let i=0;i<trialRequirement(skill);i++)s=send(s,{kind:'unit',sessionId:activeSeries(s)!.id,unit:{id:`unit-${++sequence}`,exerciseId:'squat',quality:.9,confidence:.9,verified:true,timestamp:1000+i*1000}});s=send(s,{kind:'finishTrial'});}return s;}
function historySave(){let s=earned();s=send(s,{kind:'saveRoutine',routine:{id:'morning',name:'Morning',entries:[{skillId:'squat',target:3}],restSeconds:20}});s=send(s,{kind:'startWorkout',routineId:'morning'});for(let i=0;i<3;i++)s=send(s,{kind:'unit',sessionId:activeSeries(s)!.id,unit:{id:`work-${++sequence}`,exerciseId:'squat',quality:.9,confidence:.9,verified:true,timestamp:1000+i*1000}});return send(s,{kind:'closeActivity'});}
describe('explicit fresh-schema tower import',()=>{
 it('accepts a fresh idle save and adds explicit local provenance without mutating input',()=>{
  const s=initialSave(),before=structuredClone(s),next=validateTowerImport(s);expect(s).toEqual(before);expect(next.importProvenance).toBe('local-unverified');expect(next.activity).toEqual({kind:'idle'});expect(validateTowerImport(next)).toEqual(next);
 });
 it('preserves earned skills, profile, loadout, routine targets and preferences',()=>{
  const s=historySave();s.settings={muted:true,reducedMotion:true,difficulty:'hard'};s.lastOperationIds=['local-receipt'];const next=validateTowerImport(s);
  expect(next.name).toBe('Traveller');expect(next.avatar).toBe('female');expect(next.loadout).toEqual(s.loadout);expect(next.routines).toEqual(s.routines);expect(next.settings).toEqual(s.settings);expect(next.completedTrials).toBe(1);expect(next.skills.squat).toMatchObject({unlocked:true,totalUnits:6,mastery:6,verifiedUnits:0,manualUnits:6,trialVerification:'manual'});expect(next.lastOperationIds).toEqual([]);
 });
 it('demotes imported camera records and technical stars without erasing completed achievements',()=>{
  const s=historySave();s.records.endless={bestFloor:12,bestVerifiedFloor:12,runs:2,wins:0};s.records['challenge:leg']={bestFloor:5,bestVerifiedFloor:5,runs:1,wins:1};s.availableSpecializations=['leg'];s.specialization='leg';
  const next=validateTowerImport(s);expect(next.records.endless).toEqual({bestFloor:12,bestVerifiedFloor:0,runs:2,wins:0});expect(next.specialization).toBe('leg');expect(next.history[0].verified).toBe(0);expect(next.history[0].manual).toBe(3);expect(next.history[0].workoutResults![0]).toMatchObject({units:3,verified:0,manual:3,completion:'complete',quality:null,stars:1,technicalStars:null,activeSecondsEstimate:null});expect(validateTowerImport(next)).toEqual(next);
 });
 it('imports an easy challenge victory, specialization and borrowed attack statistics without unlocking the attack',()=>{
  let s=initialSave();s=send(s,{kind:'startRun',mode:'challenge',challengeId:'arm-easy'});
  for(let floor=1;floor<=5;floor++){
   s=send(s,{kind:'startFloor'});s=send(s,{kind:'beginAttack',skillId:'wall-pushup'});
   s=send(s,{kind:'manualUnit',sessionId:activeSeries(s)!.id});
   const b=(s.activity as TowerRun).battle!;b.turn='won';b.enemyHp=0;s=send(s,{kind:'settleFloor',battleId:b.id});
  }
  s=send(s,{kind:'closeActivity'});s=send(s,{kind:'specialize',type:'arm'});
  const next=validateTowerImport(s);expect(next.availableSpecializations).toContain('arm');expect(next.specialization).toBe('arm');
  expect(next.skills['wall-pushup']).toMatchObject({unlocked:false,totalUnits:5,manualUnits:5,trialVerification:null});
  expect(challengeAvailable(next,'arm')).toBe(true);expect(next.records['challenge:arm-easy']).toMatchObject({bestFloor:5,wins:1});
  expect(validateTowerImport(next)).toEqual(next);
 });
 it.each(['mixed','endurance'])('preserves old eight-floor %s records and mixed old/new completion peaks',id=>{
  for(const bestFloor of [5,6,7,8]){
   const s=initialSave();s.records[`challenge:${id}`]={bestFloor,bestVerifiedFloor:bestFloor,runs:2,wins:1};
   const next=validateTowerImport(s);expect(next.records[`challenge:${id}`]).toEqual({bestFloor,bestVerifiedFloor:0,runs:2,wins:1});
   expect(challengeAvailable(next,id)).toBe(true);expect(validateTowerImport(next)).toEqual(next);
  }
 });
 it('preserves the old six-floor control record and rejects impossible easy or legacy peaks',()=>{
  const s=initialSave();s.records['challenge:control']={bestFloor:6,bestVerifiedFloor:6,runs:1,wins:1};
  expect(validateTowerImport(s).records['challenge:control'].bestFloor).toBe(6);
  for(const [id,bestFloor,wins] of [['arm-easy',4,1],['arm-easy',6,0],['mixed',9,0],['control',7,0]] as const){
   const malformed=initialSave();malformed.records[`challenge:${id}`]={bestFloor,bestVerifiedFloor:0,runs:1,wins};expect(()=>validateTowerImport(malformed)).toThrow();
  }
  const wrongType=initialSave();wrongType.records['challenge:arm-easy']={bestFloor:5,bestVerifiedFloor:0,runs:1,wins:1};wrongType.availableSpecializations=['leg'];
  expect(()=>validateTowerImport(wrongType)).toThrow('IMPORT_SPECIALIZATION_UNEARNED');
 });
 it.each(['tower','workout','trial'])('rejects an active %s without silently clearing it',kind=>{const s=initialSave();(s as any).activity={kind};expect(()=>validateTowerImport(s)).toThrow('FINISH_CURRENT_ACTIVITY');});
 it('rejects test saves and all removed RPG schema shapes',()=>{
  expect(()=>validateTowerImport(initialSave('QA','male',true))).toThrow('TEST_SAVE_LOCAL_ONLY');
  for(const field of ['xp','level','player','journey'])expect(()=>validateTowerImport({...initialSave(),[field]:0})).toThrow('LEGACY_SAVE_UNSUPPORTED');
  expect(()=>validateTowerImport({...initialSave(),version:3})).toThrow('UNSUPPORTED_TOWER_VERSION');
 });
 it.each([
  (s:any)=>s.skills.squat.totalUnits=NaN,
  (s:any)=>s.skills.squat.mastery=Infinity,
  (s:any)=>s.skills.squat.manualUnits=-1,
  (s:any)=>s.skills.fake=s.skills.squat,
  (s:any)=>s.records.endless={bestFloor:1e9+1,bestVerifiedFloor:0,runs:0,wins:0},
  (s:any)=>s.records.endless={bestFloor:3,bestVerifiedFloor:4,runs:0,wins:0},
  (s:any)=>s.records.endless={bestFloor:3,bestVerifiedFloor:0,runs:1,wins:2},
  (s:any)=>s.records['challenge:fake']={bestFloor:0,bestVerifiedFloor:0,runs:0,wins:0},
  (s:any)=>s.completedTrials=99,
  (s:any)=>s.loadout=['squat','squat'],
  (s:any)=>s.loadout=['diamond'],
  (s:any)=>s.availableSpecializations=['leg'],
  (s:any)=>s.settings.muted='yes',
  (s:any)=>s.routines[0].entries[0].target=NaN,
  (s:any)=>s.routines[0].entries[0].target=1001,
  (s:any)=>s.routines[0].entries[0].extra=NaN,
  (s:any)=>s.history[0].workoutResults[0].quality.mean=NaN,
  (s:any)=>s.history[0].workoutResults[0].quality.standardDeviation=Infinity,
  (s:any)=>s.history[0].timing.restSeconds=99,
  (s:any)=>s.history[0].at=Infinity,
  (s:any)=>s.history[0].manual=-1,
  (s:any)=>s.history[0].workoutResults[0].units=4,
  (s:any)=>s.history[0].workoutResults[0].technicalStars.control='yes',
  (s:any)=>s.routines.push(s.routines[0]),
  (s:any)=>s.history.push(s.history[0]),
  (s:any)=>s.lastOperationIds=Array.from({length:257},(_,i)=>String(i)),
 ])('rejects malformed, unbounded or inconsistent nested data',change=>{const s=historySave();change(s);expect(()=>validateTowerImport(s)).toThrow();});
 it('rejects prototype-derived and foreign-object inputs',()=>{expect(()=>validateTowerImport(null)).toThrow();expect(()=>validateTowerImport(new Date())).toThrow();expect(()=>validateTowerImport(Object.create(initialSave()))).toThrow();const s=initialSave();(s.skills as any).__proto__={evil:true};expect(()=>validateTowerImport(s)).toThrow();});
});

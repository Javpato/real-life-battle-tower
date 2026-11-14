import {describe,it,expect} from 'vitest';
import {initialSave,applyCommand,activeSeries} from '../src/tower/engine';
import type {PlayerSave,TowerCommand,WorkoutActivity} from '../src/tower/model';
import {SKILL_BY_ID} from '../src/tower/catalog';
let sequence=0,clock=1000;
const send=(s:PlayerSave,c:TowerCommand)=>applyCommand(s,c,{uuid:()=>`stats-${++sequence}`,now:()=>clock});
const manual=(s:PlayerSave)=>send(s,{kind:'manualUnit',sessionId:activeSeries(s)!.id});
function start(skillId='squat',target=3){clock=1000;return send(initialSave('QA','male',true),{kind:'startWorkout',entries:[{skillId,target}]});}
function camera(s:PlayerSave,quality:number,timestamp:number){const series=activeSeries(s)!;return send(s,{kind:'unit',sessionId:series.id,unit:{id:`camera-${++sequence}`,exerciseId:SKILL_BY_ID[series.skillId].exercise,verified:true,quality,confidence:.9,timestamp}});}
const result=(s:PlayerSave)=>s.history[0].workoutResults![0];

describe('honest workout scores',()=>{
 it('gives manual completion one completion star and no invented technical metrics',()=>{
  let s=start();s=manual(manual(manual(s)));expect(result(s)).toMatchObject({target:3,units:3,verified:0,manual:3,completion:'complete',stars:1,technicalStars:null,quality:null,activeSecondsEstimate:null});
 });
 it('uses bounded quality statistics for camera control and consistency stars',()=>{
  let s=start();s=camera(s,.82,1000);s=camera(s,.85,2000);s=camera(s,.88,3000);
  const r=result(s);expect(r.stars).toBe(3);expect(r.quality!.mean).toBeCloseTo(.85);expect(r.quality!.minimum).toBe(.82);expect(r.quality!.samples).toBe(3);expect(r.quality!.standardDeviation).toBeCloseTo(Math.sqrt(.0006));expect(r.activeSecondsEstimate).toBe(2);
  expect((s.activity as WorkoutActivity).series.telemetry).not.toHaveProperty('samples');
 });
 it('requires three real samples and cannot award technical stars from manual or mixed events',()=>{
  let short=start('squat',2);short=camera(short,.95,1000);short=camera(short,.95,2000);expect(result(short).stars).toBe(1);expect(result(short).technicalStars).toBeNull();
  let mixed=start('squat',4);mixed=camera(mixed,.95,1000);mixed=camera(mixed,.95,2000);mixed=camera(mixed,.95,3000);mixed=manual(mixed);expect(result(mixed).quality!.samples).toBe(3);expect(result(mixed).stars).toBe(1);expect(result(mixed).technicalStars).toBeNull();
 });
 it('does not mislabel hold amplitude as movement control',()=>{
  let s=start('short-superman',3);s=camera(s,.9,1000);s=camera(s,.9,2000);s=camera(s,.9,3000);
  expect(result(s).quality!.metric).toBe('observed-amplitude');expect(result(s).technicalStars).toEqual({control:null,consistency:true});expect(result(s).stars).toBe(2);
 });
 it('retains partial results when skipped or abandoned, without completion stars',()=>{
  let s=start();s=camera(s,.9,1000);s=send(s,{kind:'skipWorkoutEntry'});expect(s.history[0].result).toBe('incomplete');expect(result(s)).toMatchObject({units:1,target:3,completion:'partial',stars:0,technicalStars:null});
  s=start();s=manual(s);s=send(s,{kind:'abandon'});expect(s.history[0].result).toBe('abandoned');expect(result(s).completion).toBe('partial');
 });
 it('cannot inflate statistics with duplicated events or after reaching the exact target',()=>{
  let s=start();const c:TowerCommand={kind:'unit',sessionId:activeSeries(s)!.id,unit:{id:'dedupe',exerciseId:'squat',quality:.9,confidence:.9,verified:true,timestamp:1000}};
  s=send(s,c);s=send(s,c);s=camera(s,.9,2000);s=camera(s,.9,3000);s=send(s,{...c,unit:{...c.unit,id:'late'}});
  expect(result(s).units).toBe(3);expect(result(s).quality!.samples).toBe(3);expect(s.history).toHaveLength(1);
 });
});

describe('elapsed and observed activity are distinct',()=>{
 it('accounts explicit rests and pauses without crediting units from clock time',()=>{
  clock=1000;let s=send(initialSave('QA','male',true),{kind:'startWorkout',entries:[{skillId:'short-superman',target:2},{skillId:'squat',target:3}],restSeconds:20});
  clock=2000;s=camera(s,.9,1000);clock=3000;s=send(s,{kind:'pause',paused:true});clock=33000;s=send(s,{kind:'pause',paused:false});expect(activeSeries(s)!.progress).toBe(1);
  clock=34000;s=camera(s,.9,32000);expect((s.activity as WorkoutActivity).status).toBe('rest');
  clock=54000;s=send(s,{kind:'continueWorkout'});clock=55000;s=camera(s,.9,54000);clock=56000;s=camera(s,.9,55000);clock=57000;s=camera(s,.9,56000);
  expect(s.history[0].timing).toEqual({elapsedSeconds:56,restSeconds:20,pausedSeconds:30,activeSecondsEstimate:4});expect(result(s).units).toBe(2);
 });
 it('excludes long tracking gaps from estimated activity time and ignores clock reversal',()=>{
  let s=start();clock=2000;s=camera(s,.9,1000);clock=1000;s=camera(s,.9,100000);clock=3000;s=camera(s,.9,101000);
  expect(result(s).activeSecondsEstimate).toBe(1);expect(s.history[0].timing!.elapsedSeconds).toBe(2);
 });
 it('does not include time spent reading a finished summary in the workout duration',()=>{
  let s=start();clock=2000;s=manual(manual(manual(s)));const metrics=structuredClone(s.history[0].timing);clock=999000;s=send(s,{kind:'closeActivity'});expect(s.history[0].timing).toEqual(metrics);
 });
});

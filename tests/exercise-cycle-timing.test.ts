import {describe,it,expect} from 'vitest';
import {ExerciseDetector,type Observation} from '../src/exercises/detectors';
import type {ExerciseId,ExerciseUnit} from '../src/core/contracts';
const ready:Observation={visible:true,ready:true,extended:false,amplitude:0,confidence:.99,motion:0,fresh:true};
const moving:Observation={...ready,ready:false,motion:.15,amplitude:.6};
const bottom:Observation={...ready,ready:false,extended:true,motion:.3,amplitude:1};
function cycle(d:ExerciseDetector,base=0,interrupt?:'hidden'|'stale'|'pause'|'calibration'|'estimated'|'gap'){
 const units:ExerciseUnit[]=[];
 function observe(o:Observation,t:number){const u=d.updateObservation(o,base+t).unit;if(u)units.push(u);}
 observe(ready,0);observe(ready,200);observe(moving,300);observe(moving,500);observe(bottom,700);observe(bottom,900);
 if(interrupt==='hidden')observe({...bottom,visible:false},1000);
 if(interrupt==='stale')observe({...bottom,fresh:false},1000);
 if(interrupt==='pause')d.pause();
 if(interrupt==='calibration')d.beginCalibration();
 if(interrupt==='estimated')observe({...bottom,estimated:true},1000);
 if(interrupt==='gap')observe(bottom,1500);
 observe(bottom,1100);observe(moving,1300);observe(ready,1500);observe(ready,1700);
 return units;
}
describe('observed full-cycle timing for Flash',()=>{
 for(const id of ['squat','pushup'] as ExerciseId[])it(`${id} reports movement onset through stable return, not the previous repetition gap`,()=>{
  const d=new ExerciseDetector(id,'cycle');const first=cycle(d)[0];expect(first).toBeDefined();expect(first.cycle).toEqual({startedAt:300,endedAt:1700,uninterrupted:true});
  d.pause();const second=cycle(d,120000)[0];expect(second.cycle).toEqual({startedAt:120300,endedAt:121700,uninterrupted:true});
 });
 for(const condition of ['hidden','stale'] as const)it(`retained repetition after ${condition} tracking cannot earn speed evidence`,()=>{
  const u=cycle(new ExerciseDetector('squat','cycle'),0,condition)[0];expect(u).toBeDefined();expect(u.cycle?.uninterrupted).toBe(false);
 });
 for(const condition of ['pause','calibration','gap'] as const)it(`${condition} invalidates the unfinished cycle`,()=>{
  const d=new ExerciseDetector('pushup','cycle');expect(cycle(d,0,condition)).toHaveLength(0);d.pause();expect(cycle(d,5000)[0].cycle?.uninterrupted).toBe(true);
 });
 it('estimated observations do not produce verified cadence metadata',()=>{
  const u=cycle(new ExerciseDetector('squat','cycle'),0,'estimated')[0];expect(u.verified).toBe(false);expect(u.cycle).toBeUndefined();
 });
 it('a rejected incomplete movement produces neither a rep nor cadence metadata',()=>{
  const d=new ExerciseDetector('squat','cycle');d.updateObservation(ready,0);d.updateObservation(ready,200);d.updateObservation(moving,300);expect(d.updateObservation(ready,500).unit).toBeUndefined();
 });
 it('non-Flash families do not manufacture full-cycle metadata',()=>{
  const u=cycle(new ExerciseDetector('wallpushup','cycle'))[0];expect(u).toBeDefined();expect(u.cycle).toBeUndefined();
 });
});

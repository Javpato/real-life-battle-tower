import {describe,it,expect} from 'vitest';
import {OneEuro,PoseFilter} from '../src/exercises/poseFilter';
import {FeedbackDwell} from '../src/exercises/feedbackDwell';
import {ExerciseDetector,observePose,type PoseFrame} from '../src/exercises/detectors';
const frame=(timestamp:number,x=.5):PoseFrame=>({timestamp,width:480,height:480,landmarks:Array.from({length:33},()=>({x,y:.5,visibility:.95,presence:.95}))});
describe('adaptive filtering preserves current evidence',()=>{
 it('reduces small stationary jitter and resets across a gap',()=>{const f=new OneEuro();const values=Array.from({length:30},(_,i)=>f.update(.5+(i%2?.01:-.01),i*70));expect(Math.max(...values.slice(10))-Math.min(...values.slice(10))).toBeLessThan(.02);expect(f.update(.8,3000)).toBe(.8);});
 it('rejects a one-frame jump without drawing or crediting an invented joint',()=>{const f=new PoseFilter();f.process(frame(0));const spike=f.process(frame(70,.95));expect(spike.spikeJoints).toHaveLength(33);expect(spike.landmarks[23].visibility).toBe(0);const recovered=f.process(frame(140));expect(recovered.landmarks[23].x).toBe(.5);expect(recovered.landmarks[23].visibility).toBe(.95);});
 it('never smooths old visibility into a missing frame and rejects stale timestamps',()=>{const f=new PoseFilter();f.process(frame(0));const missing=frame(70);missing.landmarks[23].visibility=0;expect(f.process(missing).landmarks[23].visibility).toBe(0);expect(f.process(frame(60)).landmarks.every(p=>p.visibility===0)).toBe(true);});
});
describe('message dwell',()=>{it('holds changing correction text for 800ms but immediately reports loss/pause',()=>{const d=new FeedbackDwell();expect(d.update('Lower','incomplete',0)).toBe('Lower');expect(d.update('Rise','incomplete',100)).toBe('Lower');expect(d.update('Rise','incomplete',899)).toBe('Lower');expect(d.update('Rise','incomplete',900)).toBe('Rise');expect(d.update('Lost view','no-body',901)).toBe('Lost view');expect(d.update('Paused','paused',902)).toBe('Paused');});});
describe('cropped squat consent and baseline',()=>{
 const cropped=(t:number)=>{const f=frame(t);f.landmarks.forEach(p=>p.visibility=0);for(const [i,x,y] of [[11,.4,.2],[23,.4,.45],[25,.4,.7]])f.landmarks[i]={x,y,visibility:.95,presence:.95};return f;};
 it('requires explicit opt in and fresh calibration, with no credit for static standing',()=>{expect(observePose('squat',cropped(0)).visible).toBe(false);expect(observePose('squat',cropped(0),undefined,{allowPartialSquat:true})).toMatchObject({visible:true,estimated:true,ready:true,extended:false});const d=new ExerciseDetector('squat','crop',undefined,{allowPartialSquat:true});expect(d.recalibrate(cropped(0))).toBe(true);for(let t=70;t<3000;t+=70)expect(d.update(cropped(t)).unit).toBeUndefined();});
});

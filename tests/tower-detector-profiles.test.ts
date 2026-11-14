import {expect,it} from 'vitest';
import {observePose,type PoseFrame} from '../src/exercises/detectors';
const frame=():PoseFrame=>({timestamp:100,width:480,height:480,landmarks:Array.from({length:33},()=>({x:.5,y:.5,visibility:0}))});
function put(f:PoseFrame,id:number,x:number,y:number){f.landmarks[id]={x,y,visibility:.99};}
it('mini squat observes a shallower bend without crediting it as a full squat',()=>{const f=frame();put(f,23,.25,.48);put(f,25,.4,.65);put(f,27,.4,.85);expect(observePose('squat',f,undefined,{profile:'mini-squat'}).extended).toBe(true);expect(observePose('squat',f).extended).toBe(false);});
it('knee profile requires visible knee even with a visible ankle',()=>{const f=frame();put(f,11,.22,.48);put(f,13,.22,.64);put(f,15,.22,.8);put(f,23,.5,.63);put(f,27,.8,.8);expect(observePose('pushup',f).visible).toBe(true);expect(observePose('pushup',f,undefined,{profile:'knee-pushup'}).visible).toBe(false);});

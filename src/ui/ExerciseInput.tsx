import {useSyncExternalStore, type ComponentProps, lazy} from 'react';
import type {PoseFrame} from '../exercises/detectors';
const Camera=lazy(()=>import('../exercises/ExerciseCamera'));
/** Pose updates redraw only the camera, never the world, journal or adventure state. */
export function createPoseInput(){let frame:PoseFrame|null=null;const listeners=new Set<()=>void>();return {
 update(next:PoseFrame|null){frame=next;listeners.forEach(notify=>notify());},
 read:()=>frame,
 subscribe(notify:()=>void){listeners.add(notify);return()=>{listeners.delete(notify);};}
};}
export default function ExerciseInput({input,...props}:ComponentProps<typeof Camera>&{input:ReturnType<typeof createPoseInput>}){
 const frame=useSyncExternalStore(input.subscribe,input.read,input.read);
 return <Camera {...props} externalPoseFrame={frame}/>;
}

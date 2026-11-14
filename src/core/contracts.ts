export type Element = 'leg' | 'arm' | 'back';
export type ExerciseId = 'squat' | 'lunge' | 'pushup' | 'diamond' | 'superman' | 'birddog' | 'sitstand' | 'wallpushup' | 'bridge';
export type ExerciseUnit = { id:string; exerciseId:ExerciseId; quality:number; confidence:number; side?:'left'|'right'; verified:boolean; timestamp:number };
export type WorldProps = { onInteract:(id:string)=>void; paused:boolean; badges:Element[]; avatar?:'male'|'female';mapId?:string;facing?:'up'|'down'|'left'|'right';position?:{x:number;y:number}; onTransition?:(portalId:string)=>void;onPosition?:(position:{x:number;y:number;mapId?:string;facing?:'up'|'down'|'left'|'right'})=>void;onMove?:(position:{x:number;y:number;mapId?:string;facing?:'up'|'down'|'left'|'right'})=>void };
export type ExerciseCameraProps = {exerciseId:ExerciseId; target:number; progress:number; active:boolean; onUnit:(unit:ExerciseUnit)=>void; onError?:(message:string)=>void};

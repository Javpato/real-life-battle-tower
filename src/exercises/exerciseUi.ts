import type {ExerciseId} from '../core/contracts';
export type ExerciseVisualState='no-body'|'partial'|'insufficient'|'ready'|'moving'|'return'|'valid'|'incomplete'|'hold'|'paused'|'off'|'loading'|'error'|'countdown';
export type ExerciseHudProps={exerciseId:ExerciseId;progress:number;target:number;status:ExerciseVisualState;message:string;nextSide?:'left'|'right';quality:number|null;countdown?:number;paused:boolean;muted?:boolean;active:boolean};

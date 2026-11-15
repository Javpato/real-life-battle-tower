import type {PlayerSave, TowerCommand} from './model';
import {activeSeries} from './engine';

/** A successful command response is not proof that its exercise event was credited. */
export function acceptedExerciseUnit(before:PlayerSave,after:PlayerSave,command:Extract<TowerCommand,{kind:'unit'}>):boolean{
 const previous=activeSeries(before),next=activeSeries(after);
 return !!previous && !!next && previous.id===command.sessionId && next.id===command.sessionId &&
  !previous.seen.includes(command.unit.id) && next.seen.includes(command.unit.id) && next.progress>previous.progress;
}

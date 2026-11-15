import {describe,it,expect} from 'vitest';
import {initialSave,applyCommand,activeSeries} from '../src/tower/engine';
import {acceptedExerciseUnit} from '../src/tower/unitReceipt';
import type {TowerCommand} from '../src/tower/model';

describe('canonical exercise receipts',()=>{
 const start=()=>applyCommand(initialSave(),{kind:'startTrial',skillId:'mini-squat'});
 const command=(s:ReturnType<typeof start>):Extract<TowerCommand,{kind:'unit'}>=>({kind:'unit',sessionId:activeSeries(s)!.id,unit:{id:'observed-1',exerciseId:'squat',quality:1,confidence:.9,verified:true,timestamp:3000}});
 it('acknowledges a newly credited repetition',()=>{const before=start(),c=command(before);expect(acceptedExerciseUnit(before,applyCommand(before,c),c)).toBe(true);});
 it('does not acknowledge duplicate, paused or unchanged snapshots',()=>{
  const before=start(),c=command(before),after=applyCommand(before,c);
  expect(acceptedExerciseUnit(after,applyCommand(after,c),c)).toBe(false);
  const paused=applyCommand(before,{kind:'pause',paused:true});
  expect(acceptedExerciseUnit(paused,applyCommand(paused,c),c)).toBe(false);
  expect(acceptedExerciseUnit(before,before,c)).toBe(false);
 });
 it('does not acknowledge progress from a different session',()=>{const before=start(),c=command(before),other=start();expect(acceptedExerciseUnit(before,applyCommand(other,command(other)),c)).toBe(false);});
});

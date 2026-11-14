import {it,expect} from 'vitest';
import {initialSave,applyCommand,normalizeWorkoutEntries} from '../src/tower/engine';
import {validateTowerImport} from '../src/tower/importSave';
import type {WorkoutActivity} from '../src/tower/model';
const s=initialSave('QA','male',true);
it('splits exact repetition totals into reasonable series with rest boundaries',()=>{
 const entries=normalizeWorkoutEntries(s,[{skillId:'squat',target:26}]);expect(entries.map(e=>e.target)).toEqual([12,12,2]);
 const next=applyCommand(s,{kind:'startWorkout',entries:[{skillId:'squat',target:26}]});expect((next.activity as WorkoutActivity).entries).toEqual(entries);expect((next.activity as WorkoutActivity).series.target).toBe(12);
});
it('splits held-second totals without adding seconds or converting clock time into credit',()=>{
 const entries=normalizeWorkoutEntries(s,[{skillId:'short-superman',target:65}]);expect(entries.map(e=>e.target)).toEqual([30,30,5]);expect(entries.reduce((n,e)=>n+e.target,0)).toBe(65);
});
it('keeps alternating series even and rejects odd totals',()=>{
 expect(normalizeWorkoutEntries(s,[{skillId:'birddog',target:26}]).map(e=>e.target)).toEqual([12,12,2]);expect(()=>normalizeWorkoutEntries(s,[{skillId:'birddog',target:25}])).toThrow('INVALID_WORKOUT_TARGET');
});
it('saves the expanded routine and limits expanded size without truncating requested totals',()=>{
 const next=applyCommand(s,{kind:'saveRoutine',routine:{id:'long',name:'Long practice',entries:[{skillId:'squat',target:26},{skillId:'superman',target:65}],restSeconds:30}});expect(next.routines[0].entries.map(e=>e.target)).toEqual([12,12,2,30,30,5]);
 expect(()=>normalizeWorkoutEntries(s,[{skillId:'squat',target:1000},{skillId:'squat',target:1000}])).toThrow('WORKOUT_TOO_MANY_SERIES');
});
it('normalizes an idle schema1 imported routine with the same exact-total caps',()=>{
 const save=initialSave();save.skills['mini-squat']={unlocked:true,mastery:3,totalUnits:3,verifiedUnits:0,manualUnits:3,trialVerification:'manual'};save.completedTrials=1;save.loadout=['mini-squat'];save.routines=[{id:'old',name:'Old local routine',entries:[{skillId:'mini-squat',target:26}],restSeconds:20}];
 expect(validateTowerImport(save).routines[0].entries.map(e=>e.target)).toEqual([12,12,2]);expect(save.routines[0].entries).toHaveLength(1);
});

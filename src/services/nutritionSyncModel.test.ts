import {describe,it,expect} from 'vitest';
import {defaultNutrition,type Entry} from '../nutrition/engine';
import {appendNutritionChanges,emptyCache,nutritionRecords,reconcileNutrition,resolveNutritionConflict,visibleNutrition} from './nutritionSyncModel';
const entry:Entry={id:'food-1',amount:40,date:'2026-11-14',meal:'Breakfast',planned:false,createdAt:'2026-11-14T08:00:00Z',food:{id:'oats',name:'Oats',source:'Product label',per100:{kcal:370,protein:12,carbs:60,fat:7}}};
const remote=(id:string,version:number,content:unknown,deleted=false)=>({id,save_id:'save-a',version,content:content as Record<string,unknown>,deleted,updated_at:'2026-11-14T09:00:00Z'});
describe('cloud nutrition outbox and explicit conflicts',()=>{
 it('starts empty and gives different saves isolated deterministic record IDs',async()=>{const a=await nutritionRecords('save-a',defaultNutrition()),b=await nutritionRecords('save-a',defaultNutrition()),c=await nutritionRecords('save-b',defaultNutrition());expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());expect(Object.keys(a).some(id=>id in c)).toBe(false);expect(emptyCache('user').pending).toEqual([]);});
 it('queues a food entry without uploading unrelated default profile metadata',async()=>{const cache=emptyCache('user'),before=defaultNutrition(),next={...before,entries:[entry]};await appendNutritionChanges(cache,'save-a',before,next);expect(cache.pending).toHaveLength(1);expect(cache.pending[0].content.kind).toBe('entry');expect(visibleNutrition(cache).entries[0].food.source).toBe('Product label');});
 it('keeps both versions of a concurrent food edit and explicitly rebases the local choice',async()=>{const cache=emptyCache('user'),base=defaultNutrition(),first={...base,entries:[entry]};await appendNutritionChanges(cache,'save-a',base,first);const op=cache.pending[0];reconcileNutrition(cache,[remote(op.recordId,1,{...op.content,value:{...entry,amount:80}})],1);expect(cache.conflicts).toHaveLength(1);expect(visibleNutrition(cache).entries[0].amount).toBe(40);resolveNutritionConflict(cache,op.recordId,'local');expect(cache.pending[0].expectedVersion).toBe(1);expect(cache.pending[0].operationId).not.toBe(op.operationId);expect(cache.conflicts).toHaveLength(0);});
 it('recognizes a committed write whose acknowledgement was lost',async()=>{const cache=emptyCache('user');await appendNutritionChanges(cache,'save-a',defaultNutrition(),{...defaultNutrition(),entries:[entry]});const op=cache.pending[0];(op.content.value as Entry).food.image=undefined;reconcileNutrition(cache,[remote(op.recordId,1,JSON.parse(JSON.stringify(op.content)))],1);expect(cache.pending).toHaveLength(0);expect(cache.conflicts).toHaveLength(0);expect(visibleNutrition(cache).entries).toHaveLength(1);});
 it('does not resurrect edits silently after owner erasure',async()=>{const cache=emptyCache('user');await appendNutritionChanges(cache,'save-a',defaultNutrition(),{...defaultNutrition(),entries:[entry]});const id=cache.pending[0].recordId;reconcileNutrition(cache,[],2);expect(cache.conflicts[0].reason).toBe('NUTRITION_RESET');resolveNutritionConflict(cache,id,'remote');expect(cache.pending).toHaveLength(0);expect(visibleNutrition(cache).entries).toHaveLength(0);});
 it('stores a deletion as an explicit versioned operation',async()=>{const cache=emptyCache('user');await appendNutritionChanges(cache,'save-a',defaultNutrition(),{...defaultNutrition(),entries:[entry]});const first=cache.pending[0];reconcileNutrition(cache,[remote(first.recordId,1,first.content)],1);await appendNutritionChanges(cache,'save-a',visibleNutrition(cache),defaultNutrition());expect(cache.pending[0].deleted).toBe(true);expect(cache.pending[0].expectedVersion).toBe(1);expect(visibleNutrition(cache).entries).toHaveLength(0);});
});

describe('shared journal settings metadata',()=>{
 it('roundtrips weekly plans, overrides, reminders and units as object metadata',async()=>{
  const cache=emptyCache('user'),base=defaultNutrition();
  const journalSettings={units:'imperial' as const,weekly:{'1':{kind:'training' as const,kcal:2200}},overrides:{'2026-11-15':{kind:'rest' as const,kcal:1900}},reminders:[{id:'water',label:'A quiet break',time:'14:30',enabled:true}]};
  await appendNutritionChanges(cache,'save-a',base,{...base,journalSettings});
  expect(cache.pending).toHaveLength(1);const op=cache.pending[0];expect(op.content.kind).toBe('journalSettings');
  reconcileNutrition(cache,[remote(op.recordId,1,JSON.parse(JSON.stringify(op.content)))],1);
  expect(cache.pending).toHaveLength(0);expect(visibleNutrition(cache).journalSettings).toEqual(journalSettings);
 });
 it('preserves both versions when two devices change settings and resolves explicitly',async()=>{
  const cache=emptyCache('user'),base=defaultNutrition();
  const localSettings={units:'metric' as const,weekly:{},overrides:{},reminders:[{id:'local',label:'Local reminder',time:'09:00',enabled:true}]};
  await appendNutritionChanges(cache,'save-a',base,{...base,journalSettings:localSettings});
  const op=cache.pending[0],remoteSettings={...localSettings,units:'imperial' as const,reminders:[{id:'remote',label:'Cloud reminder',time:'10:00',enabled:true}]};
  reconcileNutrition(cache,[remote(op.recordId,1,{schema:1,kind:'journalSettings',value:remoteSettings})],1);
  expect(cache.conflicts).toHaveLength(1);expect(visibleNutrition(cache).journalSettings).toEqual(localSettings);
  resolveNutritionConflict(cache,op.recordId,'remote');expect(visibleNutrition(cache).journalSettings).toEqual(remoteSettings);
 });
});

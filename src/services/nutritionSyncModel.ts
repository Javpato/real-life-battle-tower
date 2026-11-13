import {defaultNutrition,type NutritionState} from '../nutrition/engine';
import type {RemoteNutritionEntry} from './sync';
export type NutritionRecordContent={schema:1;kind:'entry'|Exclude<keyof NutritionState,'entries'>;value:unknown};
export type NutritionPending={operationId:string;recordId:string;expectedVersion:number;content:NutritionRecordContent;deleted:boolean;generation:number};
export type NutritionConflict={id:string;kind:string;local:NutritionPending;remote:RemoteNutritionEntry|null;reason:'VERSION_CONFLICT'|'NUTRITION_RESET'};
export type NutritionCloudCache={userId:string;generation:number;confirmed:Record<string,RemoteNutritionEntry>;pending:NutritionPending[];conflicts:NutritionConflict[];draft?:NutritionState};
export const emptyCache=(userId:string,generation=1):NutritionCloudCache=>({userId,generation,confirmed:{},pending:[],conflicts:[]});
const metadata:Array<Exclude<keyof NutritionState,'entries'>>=['profile','activities','weights','favorites','recipes','completeDays','goalHistory','healthImports'];
export function canonical(value:unknown):string {if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';return JSON.stringify(value)??'null';}
async function recordId(saveId:string,key:string){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(saveId+':nutrition-v1:'+key));const bytes=new Uint8Array(digest).slice(0,16);bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;}
export async function nutritionRecords(saveId:string,state:NutritionState):Promise<Record<string,NutritionRecordContent>>{
 const records:Record<string,NutritionRecordContent>={};
 await Promise.all(state.entries.map(async entry=>{records[await recordId(saveId,'entry:'+entry.id)]={schema:1,kind:'entry',value:entry};}));
 await Promise.all(metadata.map(async kind=>{records[await recordId(saveId,'meta:'+kind)]={schema:1,kind,value:state[kind]??[]};}));
 return records;
}
export function visibleNutrition(cache:NutritionCloudCache):NutritionState {
 const current=new Map<string,{content:Record<string,unknown>|NutritionRecordContent;deleted:boolean}>();
 for(const row of Object.values(cache.confirmed))current.set(row.id,row);
 for(const op of cache.pending)current.set(op.recordId,op);
 const state=defaultNutrition();
 for(const row of current.values()){
  if(row.deleted)continue;const content=row.content as unknown as NutritionRecordContent;
  if(content.schema!==1)continue;
  if(content.kind==='entry'){
   const entry=content.value as NutritionState['entries'][number];
   if(entry&&typeof entry.id==='string'&&entry.food&&typeof entry.food.name==='string'&&entry.food.per100&&typeof entry.date==='string'&&typeof entry.createdAt==='string'&&Number.isFinite(entry.amount))state.entries.push(entry);
  }else if(content.kind==='profile'){
   if(content.value&&typeof content.value==='object'&&!Array.isArray(content.value))state.profile={...state.profile,...content.value};
  }else if(metadata.includes(content.kind)&&Array.isArray(content.value)) (state as unknown as Record<string,unknown>)[content.kind]=content.value;
 }
 state.entries.sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
 return state;
}
export async function appendNutritionChanges(cache:NutritionCloudCache,saveId:string,before:NutritionState,after:NutritionState){
 const [old,next]=await Promise.all([nutritionRecords(saveId,before),nutritionRecords(saveId,after)]);
 for(const id of new Set([...Object.keys(old),...Object.keys(next)])){
  if(canonical(old[id])===canonical(next[id]))continue;
  const prior=cache.pending.filter(p=>p.recordId===id);
  const op:NutritionPending={recordId:id,operationId:crypto.randomUUID(),expectedVersion:(cache.confirmed[id]?.version??0)+prior.length,content:next[id]??old[id],deleted:!next[id],generation:cache.generation};
  cache.pending.push(op);const conflict=cache.conflicts.find(c=>c.id===id);if(conflict)conflict.local=op;
 }
}
export function reconcileNutrition(cache:NutritionCloudCache,rows:RemoteNutritionEntry[],generation:number){
 cache.confirmed=Object.fromEntries(rows.map(row=>[row.id,row]));
 const changedGeneration=generation!==cache.generation;cache.generation=generation;
 // A response may have been lost after the server committed. Exact same version/content is already saved.
 if(!changedGeneration){for(const id of new Set(cache.pending.map(p=>p.recordId))){
  const remote=cache.confirmed[id];if(!remote)continue;
  const ops=cache.pending.filter(p=>p.recordId===id);
  const acknowledged=ops.findIndex(op=>op.generation===generation&&op.expectedVersion+1===remote.version&&op.deleted===remote.deleted&&(op.deleted||canonical(op.content)===canonical(remote.content)));
  if(acknowledged>=0){const ids=new Set(ops.slice(0,acknowledged+1).map(p=>p.operationId));cache.pending=cache.pending.filter(p=>!ids.has(p.operationId));}
 }}
 const previous=new Map(cache.conflicts.map(c=>[c.id,c]));cache.conflicts=[];
 for(const id of new Set(cache.pending.map(p=>p.recordId))){
  const ops=cache.pending.filter(p=>p.recordId===id),first=ops[0],remote=cache.confirmed[id]??null;
  if(changedGeneration||first.generation!==generation||previous.get(id)?.reason==='NUTRITION_RESET'||first.expectedVersion!==(remote?.version??0))cache.conflicts.push({id,kind:first.content.kind,local:ops.at(-1)!,remote,reason:changedGeneration||first.generation!==generation||previous.get(id)?.reason==='NUTRITION_RESET'?'NUTRITION_RESET':'VERSION_CONFLICT'});
 }
}
export function resolveNutritionConflict(cache:NutritionCloudCache,id:string,choice:'local'|'remote'){
 const conflict=cache.conflicts.find(c=>c.id===id);if(!conflict)return;
 const latest=cache.pending.filter(p=>p.recordId===id).at(-1)??conflict.local;
 cache.pending=cache.pending.filter(p=>p.recordId!==id);cache.conflicts=cache.conflicts.filter(c=>c.id!==id);
 if(choice==='local')cache.pending.push({...latest,operationId:crypto.randomUUID(),expectedVersion:cache.confirmed[id]?.version??0,generation:cache.generation});
}

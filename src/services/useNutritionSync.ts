import {useCallback,useEffect,useRef,useState} from 'react';
import {defaultNutrition,type NutritionState} from '../nutrition/engine';
import {gameSync} from './sync';
import {appendNutritionChanges,emptyCache,reconcileNutrition,resolveNutritionConflict,visibleNutrition,type NutritionCloudCache,type NutritionConflict} from './nutritionSyncModel';

type Active={saveId:string;cache:NutritionCloudCache;ready:boolean;working:boolean;refreshing:boolean;stopped:boolean;revoked:boolean;editCount:number;edits:Promise<void>;state:NutritionState};
export type NutritionSyncController={state:NutritionState;ready:boolean;status:string;storageError:string;pending:number;conflicts:NutritionConflict[];update:(next:NutritionState)=>void;retry:()=>Promise<void>;resolveConflict:(id:string,choice:'local'|'remote')=>Promise<void>;deleteAll:()=>Promise<void>};
/** A separate cloud diary. This hook NEVER receives or uploads the existing local diary. */
export function useNutritionSync(saveId:string|null):NutritionSyncController {
 const [state,setState]=useState<NutritionState>(defaultNutrition),[ready,setReady]=useState(false),[status,setStatus]=useState('Local journal'),[storageError,setStorageError]=useState(''),[pending,setPending]=useState(0),[conflicts,setConflicts]=useState<NutritionConflict[]>([]);
 const active=useRef<Active|null>(null);
 const key=(a:Active)=>`everstride.nutrition.cloud.v1.${a.saveId}.${a.cache.userId}`;
 const publish=useCallback((a:Active,message?:string)=>{
  if(a.revoked)return;
  if(a.editCount===0)a.state=a.cache.draft??visibleNutrition(a.cache);
  let cacheError='';try{localStorage.setItem(key(a),JSON.stringify(a.cache));}catch{cacheError='This browser could not persist pending diary edits. Keep this screen open and export the journal before leaving.';}
  if(active.current!==a||a.stopped)return;
  setState(a.state);setReady(a.ready);setPending(a.cache.pending.length+(a.cache.draft?1:0));setConflicts([...a.cache.conflicts]);setStorageError(cacheError);if(message)setStatus(message);
 },[]);
 const refresh=useCallback(async(a:Active)=>{
  if(a.refreshing||a.stopped)return;a.refreshing=true;try{
  const saves=await gameSync.listSaves();if(!saves.ok)throw new Error(saves.error);
  const selected=saves.data.find(s=>s.id===a.saveId);
  if(!selected){a.ready=false;a.stopped=true;a.revoked=true;localStorage.removeItem(key(a));if(active.current===a){setState(defaultNutrition());setReady(false);setStatus('Diary access was revoked or the cloud record no longer exists. The device cache was removed.');}throw new Error('DIARY_ACCESS_REVOKED');}
  const rows=await gameSync.readNutrition(a.saveId);if(!rows.ok)throw new Error(rows.error);
  if(a.stopped)return;
  reconcileNutrition(a.cache,rows.data,selected.nutrition_generation);a.ready=true;publish(a,a.cache.conflicts.length?'Conflicting diary edits need your choice.':a.cache.pending.length?'Diary edits waiting to sync.':'Cloud diary is up to date.');
  }finally{a.refreshing=false;}
 },[publish]);
 const pump=useCallback(async(a:Active)=>{
  if(a.working||a.refreshing||a.stopped||!a.ready)return;a.working=true;
  try{
   await a.edits;
   while(!a.stopped){
    const op=a.cache.pending.find(p=>!a.cache.conflicts.some(c=>c.id===p.recordId));if(!op)break;
    const result=await gameSync.writeNutrition(a.saveId,op.recordId,op.expectedVersion,op.content as unknown as Record<string,unknown>,op.deleted,op.operationId,op.generation);
    if(a.stopped)return;
    if(!result.ok){
     if(result.error==='VERSION_CONFLICT'||result.error==='NUTRITION_RESET'){await refresh(a);continue;}
     throw new Error(result.error);
    }
    a.cache.confirmed[op.recordId]={id:op.recordId,save_id:a.saveId,version:result.data.version,content:op.content as unknown as Record<string,unknown>,deleted:op.deleted,updated_at:new Date().toISOString()};
    a.cache.pending=a.cache.pending.filter(p=>p.operationId!==op.operationId);
    a.cache.conflicts=a.cache.conflicts.filter(c=>c.id!==op.recordId);
    publish(a,a.cache.pending.length?'Saving diary edits…':'Cloud diary saved.');
   }
   if(a.cache.conflicts.length)publish(a,'Conflicting diary edits need your choice. Other entries can still sync.');
  }catch(error){if(active.current===a&&!a.stopped)setStatus(`Pending edits are kept on this device. ${error instanceof Error?error.message:String(error)}`);}
  finally{a.working=false;}
 },[publish,refresh]);
 useEffect(()=>{
  if(active.current)active.current.stopped=true;
  const a:Active={saveId:saveId??'',cache:emptyCache(''),ready:false,working:false,refreshing:false,stopped:false,revoked:false,editCount:0,edits:Promise.resolve(),state:defaultNutrition()};active.current=a;
  setState(defaultNutrition());setReady(false);setPending(0);setConflicts([]);setStorageError('');
  if(!saveId){setStatus('Local journal');return()=>{a.stopped=true;};}
  setStatus('Loading the cloud diary. Your local diary stays separate.');
  void(async()=>{
   try{
    const auth=await gameSync.authenticate();if(!auth.ok)throw new Error(auth.error);if(a.stopped)return;
    a.cache=emptyCache(auth.data.userId);
    try{const saved=JSON.parse(localStorage.getItem(key(a))??'null');if(saved?.userId===auth.data.userId&&saved.confirmed&&Array.isArray(saved.pending)&&Array.isArray(saved.conflicts)){a.cache=saved;a.ready=true;publish(a,'Showing this device’s cached cloud diary while reconnecting.');}}catch{/* An unreadable cache never replaces remote records. */}
    await refresh(a);if(a.cache.draft){await appendNutritionChanges(a.cache,a.saveId,visibleNutrition(a.cache),a.cache.draft);delete a.cache.draft;publish(a,'Recovered pending diary edits from this device.');}await pump(a);
   }catch(error){if(active.current===a&&!a.stopped)setStatus(`${a.ready?'Cached diary is available; pending edits are kept.':'Cloud diary is not ready; your local diary was not uploaded.'} ${error instanceof Error?error.message:String(error)}`);}
  })();
  const timer=setInterval(()=>{if(a.ready&&!a.working&&!a.refreshing&&!a.stopped)void refresh(a).then(()=>pump(a)).catch(error=>{if(active.current===a&&!a.stopped)setStatus(`Waiting to reconnect. ${error instanceof Error?error.message:String(error)}`);});},8000);
  return()=>{a.stopped=true;clearInterval(timer);};
 },[saveId,publish,refresh,pump]);
 const update=useCallback((next:NutritionState)=>{
  const a=active.current;if(!a||!a.ready||a.stopped){setStatus('Wait for the cloud diary to load before editing.');return;}
  const before=a.state;a.state=next;a.editCount++;a.cache.draft=next;publish(a,'Diary edits queued on this device.');
  a.edits=a.edits.then(async()=>{try{await appendNutritionChanges(a.cache,a.saveId,before,next);}finally{a.editCount--;}if(a.editCount===0)delete a.cache.draft;publish(a,'Diary edits queued on this device.');}).catch(error=>{if(active.current===a)setStatus(`Could not queue edits: ${String(error)}`);});
  void a.edits.then(()=>pump(a));
 },[publish,pump]);
 const retry=useCallback(async()=>{const a=active.current;if(!a||a.stopped||a.working||a.refreshing)return;try{await a.edits;await refresh(a);if(a.cache.draft){await appendNutritionChanges(a.cache,a.saveId,visibleNutrition(a.cache),a.cache.draft);delete a.cache.draft;publish(a);}await pump(a);}catch(error){if(active.current===a)setStatus(String(error));}},[refresh,pump,publish]);
 const resolveConflict=useCallback(async(id:string,choice:'local'|'remote')=>{const a=active.current;if(!a||a.stopped)return;await a.edits;resolveNutritionConflict(a.cache,id,choice);publish(a,'Conflict resolved explicitly.');await pump(a);},[publish,pump]);
 const deleteAll=useCallback(async()=>{
  const a=active.current;if(!a||a.stopped)throw new Error('The cloud diary is not available.');await a.edits;
  if(a.working||a.refreshing)throw new Error('Wait for synchronization to finish before deleting the cloud diary.');
  a.working=true;a.ready=false;publish(a,'Deleting cloud nutrition data…');
  try{const result=await gameSync.deleteNutrition(a.saveId);if(!result.ok)throw new Error(result.error);a.cache=emptyCache(a.cache.userId,result.data.generation);a.ready=true;publish(a,'Cloud nutrition data deleted. The adventure is unchanged.');}
  finally{a.working=false;a.ready=true;publish(a);}
 },[publish]);
 return {state,ready,status,storageError,pending,conflicts,update,retry,resolveConflict,deleteAll};
}

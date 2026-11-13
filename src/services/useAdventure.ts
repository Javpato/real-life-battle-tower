import {useEffect,useRef,useState} from 'react';
import {applyAdventureCommand,initialAdventure,type AdventureCommand,type AdventureSnapshot} from '../core/commands';
import {gameSync,type Lease,type SyncResult} from './sync';

type Remote={snapshot:AdventureSnapshot;revision:number};
type Pending={id:string;command:AdventureCommand;expectedRevision?:number};
export type AdventureApi={authenticate:()=>Promise<SyncResult<{userId:string}>>;control:typeof gameSync.control;readAdventure:typeof gameSync.readAdventure;executeAdventure:typeof gameSync.executeAdventure;requestControl?:(saveId:string)=>Promise<SyncResult<unknown>>};
export type AdventureView={snapshot:AdventureSnapshot;ready:boolean;fresh:boolean;mode:'local'|'cloud';saveId?:string;revision:number;lease?:Lease;userId?:string;busy:boolean;readOnly:boolean;error:string;pending:number;requesting:boolean};
type Store={read:<T>(key:string)=>Promise<T|undefined>;write:(key:string,value:unknown)=>Promise<void>};
const storage:Store={read:async<T>(key:string)=>(await import('./storage')).readSave<T>(key),write:async(key,value)=>{await (await import('./storage')).writeSave(key,value);}};
const pendingKey=(id:string,userId?:string)=>`adventure-cloud-pending:${id}:${userId??"anonymous"}`;
/** One command queue; canonical acknowledgments are the only cloud state writes. */
export class AdventureController {
 state:AdventureView={snapshot:initialAdventure(),ready:false,fresh:false,mode:'local',revision:0,busy:false,readOnly:false,error:'',pending:0,requesting:false};
 private queue:Pending[]=[];private running=false;private waiters=new Map<string,(ok:boolean)=>void>();private listeners=new Set<()=>void>();private local=initialAdventure();
 constructor(private api:AdventureApi=gameSync,private store:Store=storage){}
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 private update(patch:Partial<AdventureView>){this.state={...this.state,...patch};this.listeners.forEach(fn=>fn());}
 async load(){try{const saved=await this.store.read<AdventureSnapshot>('adventure');this.local=saved?{...saved,quest:saved.quest??null,battle:saved.battle?{...saved.battle,paused:true}:null}:initialAdventure();this.update({snapshot:this.local,ready:true,fresh:!saved});}catch(e){this.update({ready:true,error:`Local storage unavailable: ${String(e)}`});}}
 async send(command:AdventureCommand):Promise<boolean>{
  if(!this.state.ready||this.state.readOnly||this.state.error)return false;
  const id=crypto.randomUUID();const completion=new Promise<boolean>(resolve=>this.waiters.set(id,resolve));this.queue.push({id,command});this.update({pending:this.queue.length,busy:true});void this.drain();return completion;
 }
 private async drain(){
  if(this.running)return;this.running=true;
  try{while(this.queue.length&&!this.state.readOnly&&!this.state.error){
   const pending=this.queue[0];
   if(this.state.mode==='local'){
    const next=applyAdventureCommand(this.state.snapshot,pending.command);await this.store.write('adventure',next);this.local=next;this.update({snapshot:next,fresh:false});
   }else{
    const {saveId,lease}=this.state;if(!saveId||!lease)throw Error('NO_CLOUD_CONTROL');
    pending.expectedRevision??=this.state.revision;await this.store.write(pendingKey(saveId,this.state.userId),this.queue);
    if(pending.command.kind==='beginAttack'||pending.command.kind==='startQuest'){
     const marked=await this.api.control(saveId,'busy',lease.epoch);if(!marked.ok)throw Error(marked.error);this.update({lease:marked.data});
    }
    const response=await this.api.executeAdventure(saveId,lease.epoch,pending.command,pending.id,pending.expectedRevision);
    if(!response.ok)throw Error(response.error);
    this.update({snapshot:response.data.snapshot,revision:response.data.revision});
    if(response.data.snapshot.battle?.turn!=='exercise'&&!response.data.snapshot.quest){
     const safe=await this.api.control(saveId,'safe',lease.epoch);if(safe.ok)this.update({lease:safe.data});
    }
   }
   this.queue.shift();this.waiters.get(pending.id)?.(true);this.waiters.delete(pending.id);if(this.state.saveId)await this.store.write(pendingKey(this.state.saveId,this.state.userId),this.queue);
   this.update({pending:this.queue.length});
  }}catch(e){if(this.state.saveId)try{await this.store.write(pendingKey(this.state.saveId,this.state.userId),this.queue);}catch{}for(const resolve of this.waiters.values())resolve(false);this.waiters.clear();this.update({error:`Action stopped: ${e instanceof Error?e.message:String(e)}. Pending actions are retained; retry or review them before continuing.`});}
  finally{this.running=false;this.update({busy:false});}
 }
 async openCloud(saveId:string){
  if(this.running)throw Error('Wait for the current action to finish.');
  if(this.state.mode==='local'&&(this.state.snapshot.battle?.turn==='exercise'||this.state.snapshot.quest))throw Error('End the current exercise or quest before opening a cloud adventure.');
  if(this.state.mode==='cloud'&&this.queue.length&&this.state.saveId!==saveId)throw Error('Resolve pending cloud actions before switching records.');
  this.update({busy:true,error:''});
  try{
   const auth=await this.api.authenticate();if(!auth.ok)throw Error(auth.error);
   const read=await this.api.readAdventure(saveId);if(!read.ok)throw Error(read.error);
   const acquired=await this.api.control(saveId,'acquire');
   const snapshot=read.data.snapshot??initialAdventure();snapshot.player={...snapshot.player,coins:read.data.coins,items:{...snapshot.player.items,...read.data.items},upgrades:read.data.upgrades};
   this.queue=await this.store.read<Pending[]>(pendingKey(saveId,auth.data.userId))??[];
   this.update({mode:'cloud',saveId,userId:auth.data.userId,snapshot,revision:read.data.revision,lease:acquired.ok?acquired.data:undefined,readOnly:!acquired.ok,fresh:false,pending:this.queue.length,requesting:false});
   if(acquired.ok){
    if(!this.queue.length)this.queue.push({id:crypto.randomUUID(),command:{kind:'initialize'},expectedRevision:read.data.revision});
    await this.drain();
   }else if(acquired.error!=='CONTROL_BUSY')this.update({error:acquired.error});
  }catch(e){this.update({error:e instanceof Error?e.message:String(e),readOnly:this.state.mode==='cloud'});throw e;}
  finally{this.update({busy:false});}
 }
 async refresh(){if(this.running||this.state.mode!=='cloud'||!this.state.saveId)return;const r=await this.api.readAdventure(this.state.saveId);if(!r.ok){this.update({error:r.error,readOnly:true});return;}if(r.data.snapshot){const snapshot=structuredClone(r.data.snapshot);snapshot.player.coins=r.data.coins;snapshot.player.items={...snapshot.player.items,...r.data.items};snapshot.player.upgrades=r.data.upgrades;this.update({snapshot,revision:r.data.revision});}}
 async heartbeat(){
  const {mode,saveId,lease,userId}=this.state;if(mode!=='cloud'||!saveId)return;
  if(this.state.readOnly){if(this.state.requesting){const acquired=await this.api.control(saveId,'acquire');if(acquired.ok&&acquired.data.holderId===userId){this.update({lease:acquired.data,readOnly:false,requesting:false,error:''});await this.refresh();}}else await this.refresh();return;}
  if(!lease)return;const result=await this.api.control(saveId,'renew',lease.epoch);
  if(!result.ok||result.data.holderId!==userId){this.update({readOnly:true,lease:result.ok?result.data:undefined,error:result.ok?'Control moved to another device.':`Control paused: ${result.error}`});return;}
  this.update({lease:result.data});
 }
 async requestControl(){if(!this.state.saveId)return;const api=this.api;if(!api.requestControl)throw Error('Control requests are unavailable in this server version. Release control on the active device first.');const r=await api.requestControl(this.state.saveId);if(!r.ok)throw Error(r.error);this.update({requesting:true,error:''});await this.heartbeat();}
 async release(){const {saveId,lease,snapshot}=this.state;if(this.running||snapshot.battle?.turn==='exercise'||snapshot.quest)throw Error('Finish or end the exercise first. Control changes only at a safe point.');if(saveId&&lease&&!this.state.readOnly){const safe=await this.api.control(saveId,'safe',lease.epoch);if(!safe.ok)throw Error(safe.error);const r=await this.api.control(saveId,'release',lease.epoch);if(!r.ok)throw Error(r.error);this.update({lease:r.data,readOnly:true,error:''});}}
 async returnLocal(){if(this.queue.length)throw Error('Pending cloud actions are retained. Retry or explicitly discard them before returning locally.');await this.release();this.update({mode:'local',snapshot:this.local,saveId:undefined,lease:undefined,readOnly:false,error:'',revision:0,requesting:false});}
 async retry(){if(this.state.readOnly)throw Error('Acquire control before retrying.');if(this.state.mode==='cloud'&&this.state.error.includes('VERSION_CONFLICT')){await this.refresh();if(this.state.readOnly)return;if(this.queue[0])this.queue[0].expectedRevision=this.state.revision;}this.update({error:''});await this.drain();}
 async discardPending(){if(this.running)throw Error('An action is still running.');if(this.state.saveId){await this.store.write(`${pendingKey(this.state.saveId,this.state.userId)}:discarded:${Date.now()}`,this.queue);await this.store.write(pendingKey(this.state.saveId,this.state.userId),[]);}this.queue=[];this.update({pending:0,error:''});await this.refresh();}
}
export function useAdventure(){
 const ref=useRef<AdventureController|null>(null);if(!ref.current)ref.current=new AdventureController();const controller=ref.current;
 const [view,setView]=useState(controller.state);
 useEffect(()=>{const unsubscribe=controller.subscribe(()=>setView(controller.state));void controller.load();const timer=setInterval(()=>void controller.heartbeat(),20000);return()=>{unsubscribe();clearInterval(timer);};},[controller]);
 return {...view,controller,send:(command:AdventureCommand)=>controller.send(command),locked:(view.mode==='cloud'&&view.busy)||view.readOnly||Boolean(view.error)};
}

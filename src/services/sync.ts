import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {AdventureCommand,AdventureSnapshot} from '../core/commands';

export type SyncResult<T> = { ok: true; data: T } | { ok: false; error: string; unavailable?: boolean };
export type Lease = { holderId: string | null; epoch: number; expiresAt: string; safePoint: boolean; requestedBy?:string|null;requestExpiresAt?:string|null };
export type StepEpoch = { epochId: string; startedAt: string; source: 'health-connect' | 'step-counter'; difficulty: 'easy' | 'medium' | 'hard' };
export type RemoteNutritionEntry = {id:string;save_id:string;version:number;content:Record<string,unknown>;deleted:boolean;updated_at:string};
const env = (import.meta as ImportMeta & {env?:Record<string,string>}).env ?? {};
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
/** Shared browser client. Only publishable/public credentials belong here. */
export const supabaseClient: SupabaseClient | null = url && key ? createClient(url,key) : null;

/** This adapter never loads remote data over the local adventure automatically. */
export class GameSync {
  readonly configured = Boolean(url && key);
  private client: SupabaseClient | null = supabaseClient;
  get availability() { return this.configured ? 'configured' as const : 'unavailable' as const; }
  async authenticate(): Promise<SyncResult<{userId:string}>> {
    if (!this.client) return this.missing();
    try {
      const existing = await this.client.auth.getSession();
      if (existing.error) throw existing.error;
      if (existing.data.session) return {ok:true,data:{userId:existing.data.session.user.id}};
      const result = await this.client.auth.signInAnonymously();
      if (result.error || !result.data.user) throw result.error ?? new Error('No session returned');
      return {ok:true,data:{userId:result.data.user.id}};
    } catch(error) { return this.failure(error); }
  }
  private missing<T>():SyncResult<T> {return {ok:false,error:'Cloud sync is unavailable: Supabase has not been configured. Your local save is unchanged.',unavailable:true};}
  private failure<T>(error:unknown):SyncResult<T> {return {ok:false,error:error instanceof Error ? error.message : String(error)};}
  private async rpc<T>(name:string,args:Record<string,unknown>):Promise<SyncResult<T>> {
    if (!this.client) return this.missing();
    try {
      const {data,error}=await this.client.rpc(name,args);
      if(error) return {ok:false,error:error.message};
      if(data && typeof data==='object' && 'error' in data) return {ok:false,error:String(data.error)};
      return {ok:true,data:data as T};
    } catch(error){return this.failure(error);}
  }
  createSave(deviceName='Device',creationId?:string) {return creationId?this.rpc<{saveId:string}>('create_game_save_slot',{device_name:deviceName,creation_id:creationId}):this.rpc<{saveId:string}>('create_game_save',{device_name:deviceName});}
  createPairCode(deviceName='Device') {return this.rpc<{code:string;expiresAt:string;sharesNutrition:true}>('create_pair_code',{device_name:deviceName});}
  /** Calling this explicitly authorizes adventure AND nutrition access. Show that fact before calling. */
  approvePairCode(saveId:string,code:string) {return this.rpc<{linked:true;deviceName:string;sharesNutrition:true}>('approve_pair_code',{save_id:saveId,code});}
  control(saveId:string,action:'acquire'|'renew'|'safe'|'busy'|'release'|'transfer',epoch?:number,target?:string) {return this.rpc<Lease>('adventure_control_command',{save_id:saveId,action,epoch:epoch??null,target:target??null});}
  requestControl(saveId:string) {return this.rpc<Lease>('request_adventure_control',{save_id:saveId});}
  readControl(saveId:string) {return this.rpc<Lease>('read_adventure_control',{save_id:saveId});}
  purchase(saveId:string,epoch:number,item:string,operationId:string=crypto.randomUUID()) {return this.rpc<{coins:number;item:string}>('economy_command',{save_id:saveId,operation_id:operationId,epoch,kind:'purchaseItem',item});}
  upgrade(saveId:string,epoch:number,attack:string,operationId:string=crypto.randomUUID()) {return this.rpc<{coins:number;level:number}>('economy_command',{save_id:saveId,operation_id:operationId,epoch,kind:'upgradeAttack',item:attack});}
  startStepEpoch(saveId:string,source:StepEpoch['source'],difficulty:StepEpoch['difficulty']) {return this.rpc<StepEpoch>('start_step_epoch',{save_id:saveId,source,difficulty});}
  creditSteps(saveId:string,epochId:string,totalSteps:number,operationId:string=crypto.randomUUID()) {return this.rpc<{creditedCoins:number;coins:number;creditedSteps:number;remainingSteps:number}>('credit_steps',{save_id:saveId,operation_id:operationId,epoch_id:epochId,total_steps:totalSteps});}
  writeNutrition(saveId:string,entryId:string,expectedVersion:number,content:Record<string,unknown>,deleted=false,operationId:string=crypto.randomUUID(),generation=1) {
    return this.rpc<{id:string;version:number;deleted:boolean}>('write_nutrition_entry',{save_id:saveId,operation_id:operationId,entry_id:entryId,expected_version:expectedVersion,content,deleted,generation});
  }
  revokeDevice(saveId:string,userId:string) {return this.rpc<{revoked:true}>('revoke_linked_device',{save_id:saveId,target_user_id:userId});}
  exportNutrition(saveId:string) {return this.rpc<Record<string,unknown>>('export_nutrition_data',{save_id:saveId});}
  deleteNutrition(saveId:string) {return this.rpc<{deleted:true;generation:number}>('delete_all_nutrition_data',{save_id:saveId});}
  readAdventure(saveId:string) {return this.rpc<{revision:number;coins:number;snapshot:AdventureSnapshot|null;items:Record<string,number>;upgrades:Record<string,number>}>('read_adventure_context',{save_id:saveId});}
  executeAdventure(saveId:string,leaseEpoch:number,command:AdventureCommand,operationId:string=crypto.randomUUID(),expectedRevision?:number){return this.executeRequest(saveId,leaseEpoch,command,operationId,expectedRevision);}
  importLocalAdventure(saveId:string,leaseEpoch:number,snapshot:AdventureSnapshot,operationId:string){return this.executeRequest(saveId,leaseEpoch,{kind:'importLocal',snapshot},operationId,0);}
  private async executeRequest(saveId:string,leaseEpoch:number,command:AdventureCommand|{kind:'importLocal';snapshot:AdventureSnapshot},operationId:string=crypto.randomUUID(),expectedRevision?:number):Promise<SyncResult<{snapshot:AdventureSnapshot;revision:number}>> {
    if(!this.client)return this.missing();
    try {
      const {data,error}=await this.client.functions.invoke('adventure-command',{body:{saveId,leaseEpoch,command,operationId,expectedRevision}});
      if(error){let detail=error.message;try{const body=await error.context?.json();if(body?.error)detail=body.error;}catch{/* Keep transport error. */}return {ok:false,error:detail};}
      if(data?.error)return {ok:false,error:String(data.error)};
      if(!data?.snapshot||!Number.isSafeInteger(data.revision))return {ok:false,error:'INVALID_SERVER_RESPONSE'};
      return {ok:true,data};
    }catch(error){return this.failure(error);}
  }
  async listSaves():Promise<SyncResult<Array<{id:string;coins:number;revision:number;nutrition_generation:number}>>> {
    if(!this.client)return this.missing();
    try {const {data,error}=await this.client.from('game_saves').select('id,coins,revision,nutrition_generation');return error?{ok:false,error:error.message}:{ok:true,data:data??[]};} catch(error){return this.failure(error);}
  }
  async readNutrition(saveId:string):Promise<SyncResult<RemoteNutritionEntry[]>> {
    if(!this.client)return this.missing();
    try {const {data,error}=await this.client.from('nutrition_entries').select('*').eq('save_id',saveId);return error?{ok:false,error:error.message}:{ok:true,data:data??[]};} catch(error){return this.failure(error);}
  }
}
export const gameSync = new GameSync();

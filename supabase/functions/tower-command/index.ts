import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import {applyCommand,initialSave} from '../_shared/tower/engine.ts';
import {validateTowerImport} from '../_shared/tower/importSave.ts';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
const respond=(data:unknown,status=200)=>new Response(status===204?null:JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
function named(variable:string){try{return JSON.parse(Deno.env.get(variable)??'{}').default;}catch{return undefined;}}
Deno.serve(async request=>{
 if(request.method==='OPTIONS')return respond(null,204);
 if(request.method!=='POST')return respond({error:'METHOD_NOT_ALLOWED'},405);
 try{
 const url=Deno.env.get('SUPABASE_URL')!,publicKey=Deno.env.get('EVERSTRIDE_PUBLISHABLE_KEY')??named('SUPABASE_PUBLISHABLE_KEYS')??Deno.env.get('SUPABASE_ANON_KEY')!,secret=named('SUPABASE_SECRET_KEYS')??Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const authorization=request.headers.get('authorization')??'';
 const caller=createClient(url,publicKey,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
 const auth=await caller.auth.getUser(authorization.replace(/^Bearer /,''));if(auth.error||!auth.data.user)return respond({error:'AUTH_REQUIRED'},401);
 const raw=await request.text();if(raw.length>65536)return respond({error:'REQUEST_TOO_LARGE'},413);const body=JSON.parse(raw);
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 if(!uuid.test(body.saveId)||!uuid.test(body.operationId)||!Number.isSafeInteger(body.leaseEpoch)||!Number.isSafeInteger(body.expectedRevision)||!body.command)return respond({error:'INVALID_REQUEST'},400);
 const command={kind:'tower',command:body.command};
 const receipt=await caller.rpc('get_adventure_receipt',{save_id:body.saveId,operation_id:body.operationId,command});if(receipt.error)throw receipt.error;if(receipt.data)return respond(receipt.data);
 const current=await caller.rpc('read_tower_context',{save_id:body.saveId});if(current.error)throw current.error;
 if(current.data.revision!==body.expectedRevision)return respond({error:'VERSION_CONFLICT'},409);
 let next;
 if(body.command.kind==='importLocal'){
 if(current.data.snapshot)throw Error('CLOUD_SAVE_NOT_EMPTY');const owner=await caller.from('game_saves').select('owner_id').eq('id',body.saveId).single();if(owner.error||owner.data?.owner_id!==auth.data.user.id)throw Error('OWNER_REQUIRED');next=validateTowerImport(body.command.snapshot);
 }else if(body.command.kind==='initialize'){
 if(current.data.snapshot)throw Error('ALREADY_INITIALIZED');
 if(typeof body.command.name!=='string'||!body.command.name.trim()||body.command.name.length>20||!['male','female'].includes(body.command.avatar))throw Error('INVALID_PROFILE');
 next=initialSave(body.command.name,body.command.avatar,false);
 }else{
 if(!current.data.snapshot||current.data.snapshot.debug)throw Error('INVALID_SAVE');
 if(String(body.command.kind).toLowerCase().includes('debug'))throw Error('DEBUG_LOCAL_ONLY');
 next=applyCommand(current.data.snapshot,body.command);
 }
 const admin=createClient(url,secret,{auth:{persistSession:false}});
 const result=await admin.rpc('commit_tower_command',{save_id:body.saveId,operation_id:body.operationId,actor_id:auth.data.user.id,epoch:body.leaseEpoch,expected_revision:body.expectedRevision,command,next_state:next});if(result.error)throw result.error;
 return respond(result.data,result.data?.error?409:200);
 }catch(e){return respond({error:e instanceof Error?e.message:String((e as {message?:string})?.message??e)},400);}
});

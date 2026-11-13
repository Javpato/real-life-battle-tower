import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import {applyAdventureCommand,initialAdventure,type AdventureCommand,type AdventureSnapshot} from '../_shared/commands.ts';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
function response(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});}
function namedDefaultKey(variable:string){try{const value=JSON.parse(Deno.env.get(variable)??'{}').default;return typeof value==='string'&&value?value:undefined;}catch{return undefined;}}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(request.method!=='POST')return response({error:'METHOD_NOT_ALLOWED'},405);
 try{
  const url=Deno.env.get('SUPABASE_URL');
  const publicKey=Deno.env.get('EVERSTRIDE_PUBLISHABLE_KEY')??namedDefaultKey('SUPABASE_PUBLISHABLE_KEYS')??Deno.env.get('SUPABASE_PUBLISHABLE_KEY')??Deno.env.get('SUPABASE_ANON_KEY');
  const secret=namedDefaultKey('SUPABASE_SECRET_KEYS')??Deno.env.get('SUPABASE_SECRET_KEY')??Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!publicKey||!secret)return response({error:'SERVER_NOT_CONFIGURED'},503);
  const authorization=request.headers.get('authorization');
  if(!authorization?.startsWith('Bearer '))return response({error:'AUTH_REQUIRED'},401);
  const caller=createClient(url,publicKey,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
  // Verify the token with Auth; do not trust a decoded client-supplied user id.
  const {data:auth,error:authError}=await caller.auth.getUser(authorization.slice(7));
  if(authError||!auth.user)return response({error:'INVALID_SESSION'},401);
  const text=await request.text();if(text.length>32768)return response({error:'REQUEST_TOO_LARGE'},413);
  const body=JSON.parse(text) as {saveId:string;operationId:string;leaseEpoch:number;expectedRevision?:number;command:AdventureCommand};
  if(!uuid.test(body.saveId)||!uuid.test(body.operationId)||!Number.isSafeInteger(body.leaseEpoch)||body.leaseEpoch<1||!body.command||typeof body.command.kind!=='string')return response({error:'INVALID_REQUEST'},400);
  const requestData={kind:'adventure',command:body.command};
  const receipt=await caller.rpc('get_adventure_receipt',{save_id:body.saveId,operation_id:body.operationId,command:requestData});
  if(receipt.error)return response({error:receipt.error.message},403);
  if(receipt.data)return response(receipt.data);
  if(body.command.kind==='discoverFood'){
   if(!/^\d{8,14}$/.test(body.command.barcode))return response({error:'INVALID_BARCODE'},400);
   const product=await fetch(`https://world.openfoodfacts.org/api/v2/product/${body.command.barcode}.json?fields=code,product_name`,{headers:{'User-Agent':'Everstride/0.1 (hackathon food discovery)'},signal:AbortSignal.timeout(8000)});
   if(!product.ok)return response({error:'FOOD_DATABASE_UNAVAILABLE'},503);
   if((await product.json()).status!==1)return response({error:'PRODUCT_NOT_FOUND'},404);
  }
  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  // Re-read after a wallet-only change (for example a concurrent step credit). No client state is accepted.
  for(let attempt=0;attempt<3;attempt++){
   const current=await caller.rpc('read_adventure_context',{save_id:body.saveId});
   if(current.error||!current.data)return response({error:current.error?.message??'SAVE_NOT_FOUND'},403);
   if(body.expectedRevision!==undefined&&attempt===0&&body.expectedRevision!==current.data.revision)return response({error:'VERSION_CONFLICT',revision:current.data.revision},409);
   const state:AdventureSnapshot=current.data.snapshot??initialAdventure();
   state.player.coins=current.data.coins;
   // No persisted inventory means an uninitialized adventure; preserve initial starter items once.
   if(current.data.snapshot||Object.keys(current.data.items).length)state.player.items={...state.player.items,...current.data.items};
   state.player.upgrades=current.data.upgrades;
   let next:AdventureSnapshot;
   try { next=applyAdventureCommand(state,body.command); }
   catch(error){
    // Another identical request may have committed between our receipt check and state read.
    const raced=await caller.rpc('get_adventure_receipt',{save_id:body.saveId,operation_id:body.operationId,command:requestData});
    if(!raced.error&&raced.data)return response(raced.data);
    throw error;
   }
   const committed=await admin.rpc('commit_adventure_command',{save_id:body.saveId,operation_id:body.operationId,actor_id:auth.user.id,epoch:body.leaseEpoch,expected_revision:current.data.revision,command:requestData,next_state:next,coin_delta:next.player.coins-state.player.coins});
   if(committed.error)return response({error:committed.error.message},409);
   if(committed.data?.error==='VERSION_CONFLICT')continue;
   return response(committed.data);
  }
  return response({error:'VERSION_CONFLICT'},409);
 }catch(error){return response({error:error instanceof Error?error.message:'INVALID_COMMAND'},400);}
});

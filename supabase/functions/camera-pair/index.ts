import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import {applySignal,createPairState,pairView,roleForToken,type SignalAction} from './protocol.ts';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,apikey','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
const answer=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
const hash=async(text:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});if(req.method!=='POST')return answer({error:'METHOD_NOT_ALLOWED'},405);
 try{
  const text=await req.text();if(text.length>20000)return answer({error:'SIGNAL_TOO_LARGE'},413);
  const body=JSON.parse(text),url=Deno.env.get('SUPABASE_URL');let secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??Deno.env.get('SUPABASE_SECRET_KEY');
  if(!secret){try{secret=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')??'{}').default;}catch{}}
  if(!url||!secret)return answer({error:'SIGNALING_NOT_DEPLOYED'},503);
  const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()??'unknown';const rate=await hash(`camera-pair:${ip}`);
  if(body.action==='create'){
   const roomId=crypto.randomUUID(),desktopToken=token(),inviteToken=token();const state=createPairState(roomId,await hash(desktopToken),await hash(inviteToken),Date.now());
   const r=await db.rpc('camera_pair_access',{p_room_id:roomId,p_rate_hash:rate,p_create:state});if(r.error)throw Error(r.error.message);
   return answer({roomId,desktopToken,inviteToken,expiresAt:state.expiresAt});
  }
  if(typeof body.roomId!=='string'||!/^[0-9a-f-]{36}$/i.test(body.roomId)||typeof body.token!=='string'||!/^[a-f0-9]{64}$/.test(body.token))return answer({error:'INVALID_CAPABILITY'},403);
  const tokenHash=await hash(body.token);const phoneToken=body.action==='claim'?token():undefined;
  for(let attempt=0;attempt<3;attempt++){
   const read=await db.rpc('camera_pair_access',{p_room_id:body.roomId,p_rate_hash:rate});if(read.error)throw Error(read.error.message);
   const state=read.data.state,role=roleForToken(state,tokenHash);if(!role)return answer({error:'INVALID_CAPABILITY'},403);
   const payload=body.action==='claim'?{phoneName:String(body.payload?.phoneName??'Phone').slice(0,40),phoneHash:await hash(phoneToken!),challenge:String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0')}:body.payload;
   const next=applySignal(state,role,body.action as SignalAction,payload,Date.now());
   if(body.action!=='poll'){
    const commit=await db.rpc('camera_pair_commit',{p_room_id:body.roomId,p_revision:read.data.revision,p_state:next});if(commit.error)throw Error(commit.error.message);if(!commit.data)continue;
   }
   return answer({...pairView(next,body.action==='claim'?'phone':role),...(phoneToken?{phoneToken}:{})});
  }
  return answer({error:'SIGNAL_BUSY_RETRY'},409);
 }catch(error){return answer({error:error instanceof Error?error.message:'INVALID_SIGNAL'},400);}
});

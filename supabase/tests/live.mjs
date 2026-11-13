/** Real hosted verification, isolated QA records, no privileged keys. Run with:
 * node --env-file=.env.local supabase/tests/live.mjs
 * Requires anonymous auth, all migrations and adventure-command deployed.
 * Creates clearly named QA anonymous records, never reads another player's records.
 */
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
const url=process.env.VITE_SUPABASE_URL,key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if(!url||!key)throw Error('Configure public URL and publishable key in .env.local first.');
const make=()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const owner=make(),second=make(),outsider=make();
async function login(client){const r=await client.auth.signInAnonymously();if(r.error)throw Error(`Anonymous auth blocked: ${r.error.message}`);return r.data.user.id;}
async function rpc(client,name,args){const r=await client.rpc(name,args);if(r.error)throw Error(`${name}: ${r.error.message}`);if(r.data?.error)throw Error(`${name}: ${r.data.error}`);return r.data;}
try{
 await login(owner);await login(second);await login(outsider);
 const record=await rpc(owner,'create_game_save',{device_name:'QA disposable owner'}),saveId=record.saveId;
 const pair=await rpc(second,'create_pair_code',{device_name:'QA disposable second device'});
 await rpc(owner,'approve_pair_code',{save_id:saveId,code:pair.code});
 const reused=await owner.rpc('approve_pair_code',{save_id:saveId,code:pair.code});assert(reused.error||reused.data?.error,'Pair code reusable');
 const forbidden=await outsider.from('game_saves').select('id').eq('id',saveId);assert(!forbidden.error&&forbidden.data.length===0,'RLS exposed save');
 const blocked=await outsider.rpc('read_adventure_context',{save_id:saveId});assert(blocked.error||blocked.data?.error,'Foreign context exposed');
 const lease=await rpc(owner,'adventure_control_command',{save_id:saveId,action:'acquire',epoch:null,target:null});
 const operationId=crypto.randomUUID();const invoke=async(command,operation=crypto.randomUUID())=>{const r=await owner.functions.invoke('adventure-command',{body:{saveId,leaseEpoch:lease.epoch,operationId:operation,command}});if(r.error)throw Error('Edge command: '+r.error.message);if(r.data?.error)throw Error('Edge command: '+r.data.error);return r.data;};
 await invoke({kind:'initialize'});
 await invoke({kind:'rename',name:'QA test adventurer'});
 const before=await rpc(owner,'read_adventure_context',{save_id:saveId});
 const bought=await invoke({kind:'purchaseItem',item:'potion'},operationId);
 const replay=await invoke({kind:'purchaseItem',item:'potion'},operationId);assert.deepEqual(replay,bought,'Idempotent command result differs');
 const loaded=await rpc(second,'read_adventure_context',{save_id:saveId});assert.equal(loaded.snapshot.player.name,'QA test adventurer');assert.equal(loaded.coins,before.coins-15);assert.equal(loaded.items.potion,before.items.potion+1);
 const direct=await second.from('adventure_states').update({snapshot:{player:{coins:99999}}}).eq('save_id',saveId);assert(direct.error,'Direct write unexpectedly allowed');
 const privileged=await second.rpc('commit_adventure_command',{save_id:saveId,operation_id:crypto.randomUUID(),actor_id:(await second.auth.getUser()).data.user.id,epoch:lease.epoch,expected_revision:loaded.revision,command:{},next_state:{player:{coins:99999}},coin_delta:99999});assert(privileged.error,'Privileged commit accessible');
 const journalId=crypto.randomUUID();await rpc(owner,'write_nutrition_entry',{save_id:saveId,operation_id:crypto.randomUUID(),entry_id:journalId,expected_version:0,content:{kind:'qa-test',note:'Disposable test, not a real meal'},deleted:false,generation:1});
 const diary=await second.from('nutrition_entries').select('id').eq('id',journalId);assert(!diary.error&&diary.data.length===1,'Linked diary inaccessible');
 await rpc(owner,'adventure_control_command',{save_id:saveId,action:'release',epoch:lease.epoch,target:null});
 console.log(JSON.stringify({passed:true,checks:['anonymous auth','create save','pair once','owner/second save recovery','RLS isolation','no direct state write','no privileged client commit','idempotent purchase','shared journal'],qaRecord:saveId,note:'Clearly named QA record retained; not used in demo.'}));
}finally{await Promise.allSettled([owner.auth.signOut(),second.auth.signOut(),outsider.auth.signOut()]);}

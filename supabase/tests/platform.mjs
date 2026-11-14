/** Run with: PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node supabase/tests/platform.mjs
 * Uses embedded PostgreSQL. The crypto-only stand-ins below are TEST FIXTURES, never deployed.
 */
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create schema extensions;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated;
create function extensions.digest(text,text) returns bytea language sql as $$select decode(md5($1),'hex')$$;
create function extensions.gen_random_bytes(integer) returns bytea language sql as $$select decode(replace(gen_random_uuid()::text,'-',''),'hex')$$;`);
for(const file of ['202611140001_platform.sql','202611140002_privacy.sql','202611140003_adventure.sql','202611140004_control_requests.sql','202611140005_save_slots.sql']){
 const sql=(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8')).replace('create extension if not exists pgcrypto with schema extensions;','');
 await db.exec(sql);
}
const alice='00000000-0000-0000-0000-000000000001',bob='00000000-0000-0000-0000-000000000002',eve='00000000-0000-0000-0000-000000000003';
await db.query('insert into auth.users values ($1),($2),($3)',[alice,bob,eve]);
async function actor(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');}
async function rpc(sql,args=[]){return (await db.query(sql,args)).rows[0].result;}
async function rejects(sql,args,match){await assert.rejects(()=>db.query(sql,args),match);}
await actor(alice);
const s=(await rpc('select public.create_game_save($1) result',['Alice'])).saveId;
assert.equal((await rpc('select public.create_game_save($1) result',['Alice'])).saveId,s);
await rejects('update public.game_saves set coins=9999 where id=$1',[s],/permission denied/);
await actor(eve);assert.equal((await db.query('select * from public.game_saves')).rows.length,0);
await rejects('select public.economy_command($1,$2,1,$3,$4)',[s,crypto.randomUUID(),'purchaseItem','potion'],/NOT_AUTHORIZED/);
await actor(bob);const pair=await rpc('select public.create_pair_code($1) result',['Bob']);
await actor(alice);assert.equal((await rpc('select public.approve_pair_code($1,$2) result',[s,pair.code])).linked,true);
assert.equal((await rpc('select public.approve_pair_code($1,$2) result',[s,pair.code])).error,'INVALID_CODE');
await actor(bob);assert.equal((await db.query('select * from public.game_saves')).rows.length,1);
assert.equal((await rpc("select public.adventure_control_command($1,'acquire') result",[s])).error,'CONTROL_BUSY');
await actor(alice);const op=crypto.randomUUID();
assert.equal((await rpc("select public.economy_command($1,$2,1,'purchaseItem','potion') result",[s,op])).coins,35);
assert.equal((await rpc("select public.economy_command($1,$2,1,'purchaseItem','potion') result",[s,op])).coins,35);
await rejects("select public.economy_command($1,$2,1,'purchaseItem','boost')",[s,op],/IDEMPOTENCY_CONFLICT/);
const entry=crypto.randomUUID();await actor(bob);
assert.equal((await rpc('select public.write_nutrition_entry($1,$2,$3,0,$4,false,1) result',[s,crypto.randomUUID(),entry,{food:'Oats',grams:40}])).version,1);
assert.equal((await rpc('select public.write_nutrition_entry($1,$2,$3,0,$4,false,1) result',[s,crypto.randomUUID(),entry,{food:'Oats',grams:60}])).error,'VERSION_CONFLICT');
await rejects('select public.write_nutrition_entry($1,$2,$3,null,$4,false,1)',[s,crypto.randomUUID(),entry,{}],/INVALID_ENTRY/);
await rejects('select public.export_nutrition_data($1)',[s],/OWNER_REQUIRED/);
await actor(alice);assert.equal((await rpc('select public.export_nutrition_data($1) result',[s])).entries.length,1);
assert.equal((await rpc('select public.delete_all_nutrition_data($1) result',[s])).generation,2);
await actor(bob);assert.equal((await rpc('select public.write_nutrition_entry($1,$2,$3,0,$4,false,1) result',[s,crypto.randomUUID(),crypto.randomUUID(),{food:'Stale'}])).error,'NUTRITION_RESET');
await actor(alice);await rpc("select public.adventure_control_command($1,'busy',1) result",[s]);
await rejects("select public.adventure_control_command($1,'transfer',1,$2)",[s,bob],/WAIT_FOR_SAFE_POINT/);
await rpc("select public.adventure_control_command($1,'safe',1) result",[s]);
const lease=await rpc("select public.adventure_control_command($1,'transfer',1,$2) result",[s,bob]);assert.equal(lease.epoch,2);
await rejects("select public.economy_command($1,$2,1,'purchaseItem','potion')",[s,crypto.randomUUID()],/CONTROL_LOST/);
await actor(bob);const ep=await rpc("select public.start_step_epoch($1,'health-connect','hard') result",[s]);
await db.exec('reset role');await db.query("update public.step_epochs set started_at=now()-interval '10 minutes' where id=$1",[ep.epochId]);await actor(bob);
const credit=await rpc('select public.credit_steps($1,$2,$3,500) result',[s,crypto.randomUUID(),ep.epochId]);assert.equal(credit.creditedCoins,10);
assert.equal((await rpc('select public.credit_steps($1,$2,$3,500) result',[s,crypto.randomUUID(),ep.epochId])).creditedCoins,0);
assert.equal((await rpc('select public.credit_steps($1,$2,$3,450) result',[s,crypto.randomUUID(),ep.epochId])).creditedCoins,0);
// Partial blocks survive source changes without being repriced.
const ep2=await rpc("select public.start_step_epoch($1,'step-counter','hard') result",[s]);
await db.exec('reset role');await db.query("update public.step_epochs set started_at=now()-interval '1 minute' where id=$1",[ep2.epochId]);await actor(bob);
assert.equal((await rpc('select public.credit_steps($1,$2,$3,60) result',[s,crypto.randomUUID(),ep2.epochId])).creditedCoins,0);
const ep3=await rpc("select public.start_step_epoch($1,'health-connect','hard') result",[s]);
await db.exec('reset role');await db.query("update public.step_epochs set started_at=now()-interval '1 minute' where id=$1",[ep3.epochId]);await actor(bob);
assert.equal((await rpc('select public.credit_steps($1,$2,$3,40) result',[s,crypto.randomUUID(),ep3.epochId])).creditedCoins,2);
await rejects('select public.credit_steps($1,$2,$3,100)',[s,crypto.randomUUID(),ep2.epochId],/STEP_EPOCH_NOT_ACTIVE/);
await actor(alice);await rpc('select public.revoke_linked_device($1,$2) result',[s,bob]);
await actor(bob);assert.equal((await db.query('select * from public.nutrition_entries')).rows.length,0);
await rejects('select public.credit_steps($1,$2,$3,600)',[s,crypto.randomUUID(),ep.epochId],/NOT_AUTHORIZED/);
await actor(alice);
const lease2=await rpc("select public.adventure_control_command($1,'acquire') result",[s]);
const context=await rpc('select public.read_adventure_context($1) result',[s]);
const commandBody={kind:'adventure',command:{kind:'initialize'}};
const snapshot={player:{coins:context.coins,items:context.items,upgrades:context.upgrades},battle:null,quest:null};
const commitId=crypto.randomUUID();
await rejects('select public.commit_adventure_command($1,$2,$3,$4,$5,$6,$7,7)',[s,commitId,alice,lease2.epoch,context.revision,commandBody,snapshot],/permission denied/);
await db.exec('reset role; set role service_role');
const committed=await rpc('select public.commit_adventure_command($1,$2,$3,$4,$5,$6,$7,7) result',[s,commitId,alice,lease2.epoch,context.revision,commandBody,snapshot]);
assert.equal(committed.snapshot.player.coins,context.coins+7);
const repeated=await rpc('select public.commit_adventure_command($1,$2,$3,$4,$5,$6,$7,7) result',[s,commitId,alice,lease2.epoch,context.revision,commandBody,snapshot]);
assert.equal(repeated.revision,committed.revision);
const stale=await rpc('select public.commit_adventure_command($1,$2,$3,$4,$5,$6,$7,7) result',[s,crypto.randomUUID(),alice,lease2.epoch,context.revision,commandBody,snapshot]);
assert.equal(stale.error,'VERSION_CONFLICT');
await rejects('select public.commit_adventure_command($1,$2,$3,$4,$5,$6,$7,7)',[s,crypto.randomUUID(),alice,lease2.epoch-1,committed.revision,commandBody,snapshot],/CONTROL_LOST/);
await actor(alice);assert.equal((await rpc('select public.get_adventure_receipt($1,$2,$3) result',[s,commitId,commandBody])).revision,committed.revision);
// A linked recipient requests control; renewal cannot hand it over during an active series.
await db.exec('reset role');await db.query('insert into public.save_members values($1,$2,$3)',[s,bob,'Bob relinked']);await actor(alice);
await rpc("select public.adventure_control_command($1,'busy',$2) result",[s,lease2.epoch]);
await actor(bob);const pending=await rpc('select public.request_adventure_control($1) result',[s]);assert.equal(pending.requestedBy,bob);
await actor(alice);const still=await rpc("select public.adventure_control_command($1,'renew',$2) result",[s,lease2.epoch]);assert.equal(still.holderId,alice);
await rpc("select public.adventure_control_command($1,'safe',$2) result",[s,lease2.epoch]);
const handed=await rpc("select public.adventure_control_command($1,'renew',$2) result",[s,lease2.epoch]);assert.equal(handed.holderId,bob);assert.equal(handed.epoch,lease2.epoch+1);
await actor(bob);assert.equal((await rpc('select public.read_adventure_control($1) result',[s])).holderId,bob);
// Execute the same shared reducer and fenced SQL transaction through the complete adventure.
// Manual units are deliberately marked unverified; this is not a physical-camera test.
const {initialAdventure,applyAdventureCommand}=await import('../functions/_shared/commands.ts');
const {attackFor,effectiveness,available}=await import('../functions/_shared/game.ts');
await actor(eve);const journeySave=(await rpc('select public.create_game_save($1) result',['Journey test'])).saveId;
let journey;
async function dispatchJourney(command){
 await actor(eve);
 const ctx=await rpc('select public.read_adventure_context($1) result',[journeySave]);
 const current=ctx.snapshot??initialAdventure();current.player.coins=ctx.coins;current.player.items={...current.player.items,...ctx.items};current.player.upgrades=ctx.upgrades;
 const next=applyAdventureCommand(current,command);
 await db.exec('reset role;set role service_role');
 const result=await rpc('select public.commit_adventure_command($1,$2,$3,1,$4,$5,$6,$7) result',[journeySave,crypto.randomUUID(),eve,ctx.revision,{kind:'adventure',command},next,next.player.coins-current.player.coins]);
 assert.equal(result.error,undefined);journey=result.snapshot;return journey;
}
await dispatchJourney({kind:'initialize'});
for(const enemyId of ['trainer-1','leader-leg','leader-arm','leader-back','rival']){
 // Equip skills earned from earlier encounters; no unlocked fields are injected.
 const earned=available(journey.player),loadout=['leg','arm','back'].map(type=>earned.filter(a=>a.type===type).sort((a,b)=>b.damage-a.damage)[0]?.id).filter(Boolean);
 await dispatchJourney({kind:'equip',attackIds:loadout});
 await dispatchJourney({kind:'heal'});
 while(journey.player.items.potion<6&&journey.player.coins>=15)await dispatchJourney({kind:'purchaseItem',item:'potion'});
 await dispatchJourney({kind:'startBattle',enemyId,specialization:null});
 let loops=0;
 while(journey.battle&&journey.battle.turn!=='won'&&loops++<200){
  const b=journey.battle;
  assert.notEqual(b.turn,'lost',`Complete adventure fixture lost against ${enemyId}`);
  if(b.turn==='enemy')await dispatchJourney({kind:'resolveEnemy'});
  else if(b.turn==='transform')await dispatchJourney({kind:'continuePhase'});
  else if(b.turn==='exercise')await dispatchJourney({kind:'manualRemaining',sessionId:b.sessionId});
  else if(b.turn==='player'){
   if(b.playerHp<55&&journey.player.items.potion>0)await dispatchJourney({kind:'useItem',item:'potion'});
   else {
    const attacks=journey.player.equipped.map(id=>attackFor(id,journey.player));
    attacks.sort((a,z)=>z.damage*effectiveness(z.type,b.enemy.phases[b.phase])-a.damage*effectiveness(a.type,b.enemy.phases[b.phase]));
    await dispatchJourney({kind:'beginAttack',attackId:attacks[0].id});
   }
  }
 }
 assert.equal(journey.battle.turn,'won');await dispatchJourney({kind:'finishBattle'});
}
assert.equal(journey.player.badges.length,3);assert.equal(journey.player.ending,true);
console.log('PASS: full database-backed manual adventure from initial save through all three leaders and three-phase rival, using the shared core and server-only commit.');
console.log('PASS: RLS, pairing, idempotency, wallet, fencing, safe transfer, shared diary, conflicts, null version, export owner, erase generation, steps deduplication revocation, service-only adventure commits, CAS, receipts and fenced wallet deltas.');
const slotOwner=crypto.randomUUID();await db.exec('reset role');await db.query('insert into auth.users values ($1)',[slotOwner]);await actor(slotOwner);
const slotTokens=[crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID()];
const slotIds=[];
for(const token of slotTokens){const created=await rpc('select public.create_game_save_slot($1,$2) result',['Eve',token]);slotIds.push(created.saveId);assert.equal((await rpc('select public.create_game_save_slot($1,$2) result',['Eve',token])).saveId,created.saveId);}
assert.equal(new Set(slotIds).size,3);
await rejects('select public.create_game_save_slot($1,$2)',['Eve',crypto.randomUUID()],/SAVE_LIMIT_REACHED/);
await actor(alice);for(const id of slotIds)await rejects('select public.read_adventure_context($1)',[id],/NOT_AUTHORIZED/);
console.log('PASS: three independent cloud saves, idempotent creation, fourth-save rejection and cross-owner isolation.');
await db.close();

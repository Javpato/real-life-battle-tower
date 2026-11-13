/** Run with: PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node supabase/tests/platform.mjs
 * Uses embedded PostgreSQL. The crypto-only stand-ins below are TEST FIXTURES, never deployed.
 */
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth; create schema extensions;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated;
create function extensions.digest(text,text) returns bytea language sql as $$select decode(md5($1),'hex')$$;
create function extensions.gen_random_bytes(integer) returns bytea language sql as $$select decode(replace(gen_random_uuid()::text,'-',''),'hex')$$;`);
for(const file of ['202611140001_platform.sql','202611140002_privacy.sql']){
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
assert.equal((await rpc("select public.economy_command($1,$2,1,'purchaseItem','potion') result",[s,op])).coins,45);
assert.equal((await rpc("select public.economy_command($1,$2,1,'purchaseItem','potion') result",[s,op])).coins,45);
await rejects("select public.economy_command($1,$2,1,'purchaseItem','power-tonic')",[s,op],/IDEMPOTENCY_CONFLICT/);
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
await actor(alice);await rpc('select public.revoke_linked_device($1,$2) result',[s,bob]);
await actor(bob);assert.equal((await db.query('select * from public.nutrition_entries')).rows.length,0);
await rejects('select public.credit_steps($1,$2,$3,600)',[s,crypto.randomUUID(),ep.epochId],/NOT_AUTHORIZED/);
console.log('PASS: RLS, pairing, idempotency, wallet, fencing, safe transfer, shared diary, conflicts, null version, export owner, erase generation, steps deduplication and revocation.');
await db.close();

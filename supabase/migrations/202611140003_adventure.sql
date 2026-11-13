create table public.adventure_states (
 save_id uuid primary key references public.game_saves on delete cascade,
 snapshot jsonb not null, updated_at timestamptz not null default now()
);
alter table public.adventure_states enable row level security;
revoke all on public.adventure_states from anon,authenticated;
grant select on public.adventure_states to authenticated;
create policy member_read on public.adventure_states for select to authenticated using(everstride_private.is_member(save_id));

create function everstride_private.adventure_context(s uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; begin
 perform everstride_private.require_member(s);
 select jsonb_build_object('revision',g.revision,'coins',g.coins,'snapshot',a.snapshot,
 'items',coalesce((select jsonb_object_agg(item_id,quantity) from public.game_inventory where save_id=s),'{}'::jsonb),
 'upgrades',coalesce((select jsonb_object_agg(attack_id,level-1) from public.attack_upgrades where save_id=s),'{}'::jsonb))
 into result from public.game_saves g left join public.adventure_states a on a.save_id=g.id where g.id=s;
 return result;
end; $$;
create function public.read_adventure_context(save_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select everstride_private.adventure_context(save_id); $$;

-- Service-only: the Edge Function validates JWT and runs the shared reducer before this atomic commit.
-- A browser cannot call this function, even if it guesses a save or actor UUID.
create function everstride_private.commit_adventure(s uuid,op uuid,actor uuid,e bigint,expected bigint,command jsonb,next_state jsonb,coin_delta integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.game_saves; previous everstride_private.operations; result jsonb; item record; new_revision bigint; begin
 if actor is null or not exists(select 1 from public.save_members where save_id=s and user_id=actor) then raise exception 'NOT_AUTHORIZED'; end if;
 select * into g from public.game_saves where id=s for update;
 select * into previous from everstride_private.operations where save_id=s and operation_id=op;
 if found then if previous.actor_id<>actor or previous.request<>command then raise exception 'IDEMPOTENCY_CONFLICT'; end if; return previous.result; end if;
 if expected is null or expected<>g.revision then return jsonb_build_object('error','VERSION_CONFLICT','revision',g.revision); end if;
 if not exists(select 1 from public.adventure_control where save_id=s and holder_id=actor and epoch=e and expires_at>now()) then raise exception 'CONTROL_LOST'; end if;
 if jsonb_typeof(next_state)<>'object' or jsonb_typeof(next_state->'player')<>'object' or coin_delta is null or g.coins+coin_delta<0 then raise exception 'INVALID_SERVER_RESULT'; end if;
 -- Coins cannot be restored from an old snapshot. Apply only the server-computed change to the locked wallet.
 update public.game_saves set coins=coins+coin_delta,revision=revision+1 where id=s returning revision into new_revision;
 next_state:=jsonb_set(next_state,'{player,coins}',to_jsonb(g.coins+coin_delta));
 insert into public.adventure_states values(s,next_state,now()) on conflict(save_id) do update set snapshot=excluded.snapshot,updated_at=excluded.updated_at;
 -- The same transaction persists inventory. Existing standalone purchases remain visible to the reducer.
 delete from public.game_inventory where save_id=s;
 for item in select key,value from jsonb_each_text(next_state#>'{player,items}') loop
 insert into public.game_inventory values(s,item.key,item.value::integer); end loop;
 delete from public.attack_upgrades where save_id=s;
 for item in select key,value from jsonb_each_text(next_state#>'{player,upgrades}') loop
 insert into public.attack_upgrades values(s,item.key,item.value::integer+1); end loop;
 update public.adventure_control set safe_point=(next_state->'battle'='null'::jsonb or next_state#>>'{battle,turn}'<>'exercise'),expires_at=now()+interval '90 seconds' where save_id=s;
 result:=jsonb_build_object('snapshot',next_state,'revision',new_revision);
 insert into everstride_private.operations values(s,op,actor,command,result,now());
 return result;
end; $$;
create function public.commit_adventure_command(save_id uuid,operation_id uuid,actor_id uuid,epoch bigint,expected_revision bigint,command jsonb,next_state jsonb,coin_delta integer) returns jsonb language sql security invoker set search_path='' as $$ select everstride_private.commit_adventure(save_id,operation_id,actor_id,epoch,expected_revision,command,next_state,coin_delta); $$;

-- Read a receipt before replaying a command: a lost HTTP response must not repeat rewards.
create function everstride_private.adventure_receipt(s uuid,op uuid,command jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r everstride_private.operations; begin
 perform everstride_private.require_member(s);
 select * into r from everstride_private.operations where save_id=s and operation_id=op;
 if not found then return null; end if;
 if r.actor_id<>auth.uid() or r.request<>command then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
 return r.result;
end; $$;
create function public.get_adventure_receipt(save_id uuid,operation_id uuid,command jsonb) returns jsonb language sql security invoker set search_path='' as $$ select everstride_private.adventure_receipt(save_id,operation_id,command); $$;

revoke all on function everstride_private.adventure_context(uuid),everstride_private.adventure_receipt(uuid,uuid,jsonb),public.read_adventure_context(uuid),public.get_adventure_receipt(uuid,uuid,jsonb) from public,anon;
grant execute on function everstride_private.adventure_context(uuid),everstride_private.adventure_receipt(uuid,uuid,jsonb),public.read_adventure_context(uuid),public.get_adventure_receipt(uuid,uuid,jsonb) to authenticated;
revoke all on function everstride_private.commit_adventure(uuid,uuid,uuid,bigint,bigint,jsonb,jsonb,integer),public.commit_adventure_command(uuid,uuid,uuid,bigint,bigint,jsonb,jsonb,integer) from public,anon,authenticated;
grant usage on schema everstride_private, public to service_role;
grant execute on function everstride_private.commit_adventure(uuid,uuid,uuid,bigint,bigint,jsonb,jsonb,integer),public.commit_adventure_command(uuid,uuid,uuid,bigint,bigint,jsonb,jsonb,integer) to service_role;

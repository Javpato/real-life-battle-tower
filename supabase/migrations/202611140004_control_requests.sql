-- Requesting control never interrupts an exercise. The active holder acknowledges via renewal at a canonical safe point.
alter table public.adventure_control add column requested_by uuid references auth.users on delete set null;
alter table public.adventure_control add column request_expires_at timestamptz;
create or replace function everstride_private.control(s uuid,action text,e bigint default null,target uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.adventure_control; begin
 perform everstride_private.require_member(s);
 select * into c from public.adventure_control where save_id=s for update;
 if action='acquire' then
 if c.holder_id is distinct from auth.uid() and c.expires_at>now() then return jsonb_build_object('error','CONTROL_BUSY','expiresAt',c.expires_at); end if;
 if c.holder_id is distinct from auth.uid() or c.expires_at<=now() then c.epoch:=c.epoch+1; c.requested_by:=null; c.request_expires_at:=null; end if;
 c.holder_id:=auth.uid(); c.expires_at:=now()+interval '90 seconds'; c.safe_point:=true;
 elsif action in ('renew','safe','busy','release','transfer') then
 perform everstride_private.require_control(s,e);
 if action='renew' then
 c.expires_at:=now()+interval '90 seconds';
 if c.requested_by is not null and (c.request_expires_at<=now() or not exists(select 1 from public.save_members where save_id=s and user_id=c.requested_by)) then c.requested_by:=null;c.request_expires_at:=null; end if;
 if c.requested_by is not null and c.safe_point then
 c.holder_id:=c.requested_by;c.epoch:=c.epoch+1;c.requested_by:=null;c.request_expires_at:=null;
 end if;
 elsif action='safe' then
 -- A client cannot mark an in-flight physical activity safe merely by claiming it is.
 c.safe_point:=not exists(select 1 from public.adventure_states where save_id=s and
 (snapshot#>>'{battle,turn}'='exercise' or (snapshot->'quest'<>'null'::jsonb and (snapshot#>>'{quest,progress}')::integer<(snapshot#>>'{quest,target}')::integer)));
 elsif action='busy' then c.safe_point:=false;
 elsif action in ('release','transfer') then
 if not c.safe_point then raise exception 'WAIT_FOR_SAFE_POINT'; end if;
 if action='transfer' and not exists(select 1 from public.save_members where save_id=s and user_id=target) then raise exception 'TARGET_NOT_LINKED'; end if;
 c.requested_by:=null;c.request_expires_at:=null;
 c.epoch:=c.epoch+1; c.holder_id:=case when action='transfer' then target else null end;
 c.expires_at:=case when action='transfer' then now()+interval '90 seconds' else now() end;
 end if;
 else raise exception 'INVALID_ACTION'; end if;
 update public.adventure_control set holder_id=c.holder_id,epoch=c.epoch,expires_at=c.expires_at,safe_point=c.safe_point,requested_by=c.requested_by,request_expires_at=c.request_expires_at where save_id=s;
 return jsonb_build_object('holderId',c.holder_id,'epoch',c.epoch,'expiresAt',c.expires_at,'safePoint',c.safe_point,'requestedBy',c.requested_by,'requestExpiresAt',c.request_expires_at);
end; $$;

create function everstride_private.read_control(s uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.adventure_control; begin
 perform everstride_private.require_member(s);
 select * into c from public.adventure_control where save_id=s;
 return jsonb_build_object('holderId',c.holder_id,'epoch',c.epoch,'expiresAt',c.expires_at,'safePoint',c.safe_point,'requestedBy',c.requested_by,'requestExpiresAt',c.request_expires_at);
end; $$;
create function public.read_adventure_control(save_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select everstride_private.read_control(save_id); $$;
create function everstride_private.request_control(s uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.adventure_control; begin
 perform everstride_private.require_member(s);
 select * into c from public.adventure_control where save_id=s for update;
 if c.holder_id=auth.uid() or c.expires_at<=now() then return everstride_private.control(s,'acquire'); end if;
 if c.requested_by is not null and c.requested_by<>auth.uid() and c.request_expires_at>now() then return jsonb_build_object('error','TRANSFER_ALREADY_REQUESTED'); end if;
 update public.adventure_control set requested_by=auth.uid(),request_expires_at=now()+interval '5 minutes' where save_id=s;
 return everstride_private.read_control(s);
end; $$;
create function public.request_adventure_control(save_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select everstride_private.request_control(save_id); $$;
revoke all on function everstride_private.read_control(uuid),everstride_private.request_control(uuid),public.read_adventure_control(uuid),public.request_adventure_control(uuid) from public,anon;
grant execute on function everstride_private.read_control(uuid),everstride_private.request_control(uuid),public.read_adventure_control(uuid),public.request_adventure_control(uuid) to authenticated;
create or replace function everstride_private.commit_adventure(s uuid,op uuid,actor uuid,e bigint,expected bigint,command jsonb,next_state jsonb,coin_delta integer) returns jsonb language plpgsql security definer set search_path='' as $$
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
 update public.adventure_control set safe_point=((next_state->'battle'='null'::jsonb or next_state#>>'{battle,turn}'<>'exercise') and (next_state->'quest'='null'::jsonb or (next_state#>>'{quest,progress}')::integer >= (next_state#>>'{quest,target}')::integer)),expires_at=now()+interval '90 seconds' where save_id=s;
 result:=jsonb_build_object('snapshot',next_state,'revision',new_revision);
 insert into everstride_private.operations values(s,op,actor,command,result,now());
 return result;
end; $$;

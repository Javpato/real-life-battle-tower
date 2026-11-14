-- Battle Tower uses fresh saves; adventure snapshots are never imported.
create table public.tower_states (
 save_id uuid primary key references public.game_saves on delete cascade,
 snapshot jsonb not null check (snapshot->>'version'='1'), updated_at timestamptz not null default now()
);
alter table public.tower_states enable row level security;
revoke all on public.tower_states from anon,authenticated;
grant select on public.tower_states to authenticated;
create policy member_read on public.tower_states for select to authenticated using(everstride_private.is_member(save_id));
create function public.read_tower_context(save_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; begin
 perform everstride_private.require_member(save_id);
 select jsonb_build_object('revision',g.revision,'snapshot',t.snapshot,'coins',g.coins) into result
 from public.game_saves g left join public.tower_states t on t.save_id=g.id where g.id=read_tower_context.save_id;
 return result;
end; $$;
revoke all on function public.read_tower_context(uuid) from public,anon;
grant execute on function public.read_tower_context(uuid) to authenticated;
create function public.commit_tower_command(save_id uuid,operation_id uuid,actor_id uuid,epoch bigint,expected_revision bigint,command jsonb,next_state jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.game_saves; previous everstride_private.operations; result jsonb; new_revision bigint; begin
 if actor_id is null or not exists(select 1 from public.save_members m where m.save_id=commit_tower_command.save_id and m.user_id=actor_id) then raise exception 'NOT_AUTHORIZED'; end if;
 select * into g from public.game_saves where id=save_id for update;
 select * into previous from everstride_private.operations o where o.save_id=commit_tower_command.save_id and o.operation_id=commit_tower_command.operation_id;
 if found then if previous.actor_id<>commit_tower_command.actor_id or previous.request<>command then raise exception 'IDEMPOTENCY_CONFLICT'; end if; return previous.result; end if;
 if expected_revision<>g.revision then return jsonb_build_object('error','VERSION_CONFLICT','revision',g.revision); end if;
 if not exists(select 1 from public.adventure_control c where c.save_id=commit_tower_command.save_id and c.holder_id=actor_id and c.epoch=commit_tower_command.epoch and c.expires_at>now()) then raise exception 'CONTROL_LOST'; end if;
 if next_state->>'version'<>'1' or next_state->>'debug'='true' or next_state ? 'player' then raise exception 'INVALID_TOWER_STATE'; end if;
 update public.game_saves set revision=revision+1 where id=save_id returning revision into new_revision;
 insert into public.tower_states values(save_id,next_state,now()) on conflict on constraint tower_states_pkey do update set snapshot=excluded.snapshot,updated_at=excluded.updated_at;
 update public.adventure_control c set safe_point=(next_state#>>'{activity,kind}'='idle' or next_state#>>'{activity,paused}'='true'),expires_at=now()+interval '90 seconds' where c.save_id=commit_tower_command.save_id;
 result:=jsonb_build_object('snapshot',next_state,'revision',new_revision);
 insert into everstride_private.operations values(save_id,operation_id,actor_id,command,result,now());
 return result;
end; $$;
revoke all on function public.commit_tower_command(uuid,uuid,uuid,bigint,bigint,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.commit_tower_command(uuid,uuid,uuid,bigint,bigint,jsonb,jsonb) to service_role;

create or replace function everstride_private.control(s uuid,action text,e bigint default null,target uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.adventure_control; begin
 perform everstride_private.require_member(s);
 if action='safe' and exists(select 1 from public.tower_states where save_id=s and snapshot#>>'{activity,kind}'<>'idle' and coalesce(snapshot#>>'{activity,series,paused}','false')<>'true') then raise exception 'WAIT_FOR_SAFE_POINT'; end if;
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


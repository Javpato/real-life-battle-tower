-- Preserve v1 snapshots; migrate under the authoritative reducer on the next command.
alter table public.tower_states drop constraint tower_states_snapshot_check;
alter table public.tower_states add constraint tower_states_snapshot_check check (snapshot->>'version' in ('1','2'));
create or replace function public.commit_tower_command(save_id uuid,operation_id uuid,actor_id uuid,epoch bigint,expected_revision bigint,command jsonb,next_state jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.game_saves; previous everstride_private.operations; result jsonb; new_revision bigint; begin
 if actor_id is null or not exists(select 1 from public.save_members m where m.save_id=commit_tower_command.save_id and m.user_id=actor_id) then raise exception 'NOT_AUTHORIZED'; end if;
 select * into g from public.game_saves where id=save_id for update;
 select * into previous from everstride_private.operations o where o.save_id=commit_tower_command.save_id and o.operation_id=commit_tower_command.operation_id;
 if found then if previous.actor_id<>commit_tower_command.actor_id or previous.request<>command then raise exception 'IDEMPOTENCY_CONFLICT'; end if; return previous.result; end if;
 if expected_revision<>g.revision then return jsonb_build_object('error','VERSION_CONFLICT','revision',g.revision); end if;
 if not exists(select 1 from public.adventure_control c where c.save_id=commit_tower_command.save_id and c.holder_id=actor_id and c.epoch=commit_tower_command.epoch and c.expires_at>now()) then raise exception 'CONTROL_LOST'; end if;
 if coalesce(next_state->>'version','') not in ('1','2') or next_state->>'debug'='true' or next_state ? 'player' then raise exception 'INVALID_TOWER_STATE'; end if;
 update public.game_saves set revision=revision+1 where id=save_id returning revision into new_revision;
 insert into public.tower_states values(save_id,next_state,now()) on conflict on constraint tower_states_pkey do update set snapshot=excluded.snapshot,updated_at=excluded.updated_at;
 update public.adventure_control c set safe_point=coalesce((next_state#>>'{activity,kind}'='idle' or next_state#>>'{activity,series,paused}'='true' or next_state#>>'{activity,status}' in ('between','ready','complete','lost')),false),expires_at=now()+interval '90 seconds' where c.save_id=commit_tower_command.save_id;
 result:=jsonb_build_object('snapshot',next_state,'revision',new_revision);
 insert into everstride_private.operations values(save_id,operation_id,actor_id,command,result,now());
 return result;
end; $$;

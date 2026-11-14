-- Ephemeral capability signaling, isolated from all adventure/journal identities.
create table everstride_private.camera_pairs (
 id uuid primary key, state jsonb not null, revision integer not null default 0,
 expires_at timestamptz not null, requests integer not null default 0
);
create table everstride_private.camera_pair_limits (
 rate_hash text primary key, expires_at timestamptz not null, creates integer not null default 0, requests integer not null default 0
);
revoke all on everstride_private.camera_pairs,everstride_private.camera_pair_limits from public,anon,authenticated;
create function public.camera_pair_access(p_room_id uuid,p_rate_hash text,p_create jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare pair everstride_private.camera_pairs; bucket everstride_private.camera_pair_limits; begin
 delete from everstride_private.camera_pairs where expires_at<=now();
 delete from everstride_private.camera_pair_limits where expires_at<=now();
 if length(p_rate_hash)<>64 then raise exception 'INVALID_RATE_KEY';end if;
 insert into everstride_private.camera_pair_limits values(p_rate_hash,now()+interval '5 minutes',0,0) on conflict do nothing;
 select * into bucket from everstride_private.camera_pair_limits where rate_hash=p_rate_hash for update;
 if bucket.requests>=1600 or (p_create is not null and bucket.creates>=12) then raise exception 'RATE_LIMIT';end if;
 update everstride_private.camera_pair_limits set requests=requests+1,creates=creates+case when p_create is null then 0 else 1 end where rate_hash=p_rate_hash;
 if p_create is not null then
  if jsonb_typeof(p_create)<>'object' or length(p_create::text)>4096 then raise exception 'INVALID_PAIR';end if;
  insert into everstride_private.camera_pairs(id,state,expires_at) values(p_room_id,p_create,now()+interval '5 minutes');
 end if;
 update everstride_private.camera_pairs set requests=requests+1 where id=p_room_id and requests<1000 returning * into pair;
 if pair.id is null then raise exception 'PAIR_EXPIRED_OR_LIMITED';end if;
 return jsonb_build_object('state',pair.state,'revision',pair.revision);
end; $$;
create function public.camera_pair_commit(p_room_id uuid,p_revision integer,p_state jsonb) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if length(p_state::text)>262144 then raise exception 'SIGNAL_LIMIT';end if;
 update everstride_private.camera_pairs set state=p_state,revision=revision+1 where id=p_room_id and revision=p_revision and expires_at>now();
 return found;
end; $$;
revoke all on function public.camera_pair_access(uuid,text,jsonb),public.camera_pair_commit(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.camera_pair_access(uuid,text,jsonb),public.camera_pair_commit(uuid,integer,jsonb) to service_role;
-- Active requests purge expired rows. Also schedule this DELETE every minute
-- with the deployment scheduler for physical cleanup when no requests arrive.

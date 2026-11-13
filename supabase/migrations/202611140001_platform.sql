-- Everstride: one adventure, multiple individually authenticated installations.
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.game_saves (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 coins integer not null default 60 check(coins >= 0), revision bigint not null default 0,
 created_at timestamptz not null default now()
);
create table public.save_members (
 save_id uuid references public.game_saves on delete cascade, user_id uuid references auth.users on delete cascade,
 display_name text not null default 'Device', primary key(save_id,user_id)
);
create table public.adventure_control (
 save_id uuid primary key references public.game_saves on delete cascade,
 holder_id uuid references auth.users, epoch bigint not null default 0,
 expires_at timestamptz not null default now(), safe_point boolean not null default true
);
create table public.game_inventory (
 save_id uuid references public.game_saves on delete cascade, item_id text not null,
 quantity integer not null default 0 check(quantity >= 0), primary key(save_id,item_id)
);
create table public.attack_upgrades (
 save_id uuid references public.game_saves on delete cascade, attack_id text not null,
 level integer not null default 1 check(level between 1 and 5), primary key(save_id,attack_id)
);
create table private.operations (
 save_id uuid references public.game_saves on delete cascade, operation_id uuid not null,
 actor_id uuid not null, request jsonb not null, result jsonb not null,
 created_at timestamptz not null default now(), primary key(save_id,operation_id)
);
create table private.pair_requests (
 code_hash text primary key, user_id uuid not null references auth.users on delete cascade,
 display_name text not null, expires_at timestamptz not null, consumed_at timestamptz
);
create table private.pair_attempts (user_id uuid primary key references auth.users on delete cascade, attempts integer not null default 0, window_start timestamptz not null default now());
create table public.step_epochs (
 id uuid primary key default gen_random_uuid(), save_id uuid not null references public.game_saves on delete cascade,
 user_id uuid not null references auth.users, source text not null check(source in ('health-connect','step-counter')),
 difficulty text not null check(difficulty in ('easy','medium','hard')),
 started_at timestamptz not null default now(), ended_at timestamptz,
 reported_steps bigint not null default 0 check(reported_steps >= 0), rewarded_blocks bigint not null default 0
);
create unique index one_open_step_epoch on public.step_epochs(save_id) where ended_at is null;
-- Food data is deliberately separate from adventure state, but all linked members have access by user choice.
create table public.nutrition_entries (
 id uuid primary key, save_id uuid not null references public.game_saves on delete cascade,
 version bigint not null default 1, content jsonb not null, deleted boolean not null default false,
 updated_by uuid not null references auth.users, updated_at timestamptz not null default now()
);
create table private.nutrition_revisions (
 entry_id uuid references public.nutrition_entries on delete cascade, version bigint not null,
 content jsonb not null, deleted boolean not null, actor_id uuid not null, created_at timestamptz not null default now(),
 primary key(entry_id,version)
);

create function private.is_member(s uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.save_members where save_id=s and user_id=auth.uid());
$$;
create function private.require_member(s uuid) returns void language plpgsql security definer set search_path='' as $$
begin if auth.uid() is null or not private.is_member(s) then raise exception 'NOT_AUTHORIZED' using errcode='42501'; end if; end;
$$;
create function private.require_control(s uuid,e bigint) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_member(s);
 if not exists(select 1 from public.adventure_control where save_id=s and holder_id=auth.uid() and epoch=e and expires_at>now()) then raise exception 'CONTROL_LOST'; end if;
end; $$;

do $$ declare t text; begin
 foreach t in array array['game_saves','save_members','adventure_control','game_inventory','attack_upgrades','step_epochs','nutrition_entries'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 if t='game_saves' then execute format('create policy member_read on public.%I for select to authenticated using (private.is_member(id))',t);
 else execute format('create policy member_read on public.%I for select to authenticated using (private.is_member(save_id))',t); end if;
 end loop;
end $$;

create function private.create_save(device_name text) returns jsonb language plpgsql security definer set search_path='' as $$
declare s uuid; begin
 if auth.uid() is null then raise exception 'NOT_AUTHORIZED'; end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 if length(device_name)>60 then raise exception 'INVALID_DEVICE_NAME'; end if;
 -- Idempotent creation for this installation; linking does not merge pre-existing saves.
 select save_id into s from public.save_members where user_id=auth.uid() order by save_id limit 1;
 if s is null then
 insert into public.game_saves(owner_id) values(auth.uid()) returning id into s;
 insert into public.save_members values(s,auth.uid(),device_name);
 insert into public.adventure_control(save_id,holder_id,epoch,expires_at) values(s,auth.uid(),1,now()+interval '90 seconds');
 end if;
 return jsonb_build_object('saveId',s);
end; $$;
create function public.create_game_save(device_name text default 'Device') returns jsonb language sql security invoker set search_path='' as $$ select private.create_save(device_name); $$;

create function private.create_pair(device_name text) returns jsonb language plpgsql security definer set search_path='' as $$
declare code text; begin
 if auth.uid() is null or length(device_name)>60 then raise exception 'INVALID_REQUEST'; end if;
 if exists(select 1 from private.pair_requests where user_id=auth.uid() and expires_at>now() and consumed_at is null) then raise exception 'PAIR_REQUEST_ALREADY_ACTIVE'; end if;
 code:=upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,8));
 insert into private.pair_requests values(encode(extensions.digest(code,'sha256'),'hex'),auth.uid(),device_name,now()+interval '5 minutes',null);
 return jsonb_build_object('code',code,'expiresAt',now()+interval '5 minutes','sharesNutrition',true);
end; $$;
create function public.create_pair_code(device_name text default 'Device') returns jsonb language sql security invoker set search_path='' as $$ select private.create_pair(device_name); $$;
create function private.approve_pair(s uuid,code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.pair_requests; n integer; begin
 perform private.require_member(s);
 if not exists(select 1 from public.game_saves where id=s and owner_id=auth.uid()) then raise exception 'OWNER_REQUIRED'; end if;
 insert into private.pair_attempts(user_id,attempts) values(auth.uid(),1)
 on conflict(user_id) do update set attempts=case when private.pair_attempts.window_start<now()-interval '5 minutes' then 1 else private.pair_attempts.attempts+1 end,
 window_start=case when private.pair_attempts.window_start<now()-interval '5 minutes' then now() else private.pair_attempts.window_start end returning attempts into n;
 -- Return errors instead of raising: failed attempts must commit.
 if n>5 then return jsonb_build_object('error','RATE_LIMITED'); end if;
 select * into r from private.pair_requests where code_hash=encode(extensions.digest(upper(trim(code)),'sha256'),'hex') for update;
 if r.user_id is null or r.expires_at<=now() or r.consumed_at is not null or r.user_id=auth.uid() then return jsonb_build_object('error','INVALID_CODE'); end if;
 insert into public.save_members values(s,r.user_id,r.display_name) on conflict do nothing;
 update private.pair_requests set consumed_at=now() where code_hash=r.code_hash;
 return jsonb_build_object('linked',true,'deviceName',r.display_name,'sharesNutrition',true);
end; $$;
create function public.approve_pair_code(save_id uuid,code text) returns jsonb language sql security invoker set search_path='' as $$ select private.approve_pair(save_id,code); $$;

create function private.control(s uuid,action text,e bigint default null,target uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.adventure_control; begin
 perform private.require_member(s);
 select * into c from public.adventure_control where save_id=s for update;
 if action='acquire' then
 if c.holder_id is distinct from auth.uid() and c.expires_at>now() then return jsonb_build_object('error','CONTROL_BUSY','expiresAt',c.expires_at); end if;
 if c.holder_id is distinct from auth.uid() or c.expires_at<=now() then c.epoch:=c.epoch+1; end if;
 c.holder_id:=auth.uid(); c.expires_at:=now()+interval '90 seconds'; c.safe_point:=true;
 elsif action in ('renew','safe','busy','release','transfer') then
 perform private.require_control(s,e);
 if action='renew' then c.expires_at:=now()+interval '90 seconds';
 elsif action='safe' then c.safe_point:=true;
 elsif action='busy' then c.safe_point:=false;
 elsif action in ('release','transfer') then
 if not c.safe_point then raise exception 'WAIT_FOR_SAFE_POINT'; end if;
 if action='transfer' and not exists(select 1 from public.save_members where save_id=s and user_id=target) then raise exception 'TARGET_NOT_LINKED'; end if;
 c.epoch:=c.epoch+1; c.holder_id:=case when action='transfer' then target else null end;
 c.expires_at:=case when action='transfer' then now()+interval '90 seconds' else now() end;
 end if;
 else raise exception 'INVALID_ACTION'; end if;
 update public.adventure_control set holder_id=c.holder_id,epoch=c.epoch,expires_at=c.expires_at,safe_point=c.safe_point where save_id=s;
 return jsonb_build_object('holderId',c.holder_id,'epoch',c.epoch,'expiresAt',c.expires_at,'safePoint',c.safe_point);
end; $$;
create function public.adventure_control_command(save_id uuid,action text,epoch bigint default null,target uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select private.control(save_id,action,epoch,target); $$;

create function private.economy(s uuid,op uuid,e bigint,kind text,item text) returns jsonb language plpgsql security definer set search_path='' as $$
declare request jsonb:=jsonb_build_object('kind',kind,'item',item); previous private.operations; price integer; balance integer; lvl integer; result jsonb; begin
 perform private.require_member(s);
 perform 1 from public.game_saves where id=s for update;
 select * into previous from private.operations where save_id=s and operation_id=op;
 if found then if previous.request<>request or previous.actor_id<>auth.uid() then raise exception 'IDEMPOTENCY_CONFLICT'; end if; return previous.result; end if;
 perform private.require_control(s,e);
 if kind='purchaseItem' then
 price:=case item when 'potion' then 15 when 'guard-tonic' then 25 when 'power-tonic' then 30 else null end;
 elsif kind='upgradeAttack' then
 if item not in ('squat','lunge','pushup','diamond','superman','birddog') then raise exception 'INVALID_ATTACK'; end if;
 select level into lvl from public.attack_upgrades where save_id=s and attack_id=item;
 lvl:=coalesce(lvl,1); if lvl>=5 then raise exception 'MAX_LEVEL'; end if;
 price:=25*lvl;
 else raise exception 'UNSUPPORTED_OPERATION'; end if;
 if price is null then raise exception 'UNKNOWN_ITEM'; end if;
 update public.game_saves set coins=coins-price,revision=revision+1 where id=s and coins>=price returning coins into balance;
 if not found then raise exception 'INSUFFICIENT_COINS'; end if;
 if kind='purchaseItem' then insert into public.game_inventory values(s,item,1) on conflict(save_id,item_id) do update set quantity=public.game_inventory.quantity+1;
 else insert into public.attack_upgrades values(s,item,lvl+1) on conflict(save_id,attack_id) do update set level=excluded.level; end if;
 result:=jsonb_build_object('coins',balance,'item',item,'level',case when kind='upgradeAttack' then lvl+1 else null end);
 insert into private.operations values(s,op,auth.uid(),request,result,now()); return result;
end; $$;
create function public.economy_command(save_id uuid,operation_id uuid,epoch bigint,kind text,item text) returns jsonb language sql security invoker set search_path='' as $$ select private.economy(save_id,operation_id,epoch,kind,item); $$;

create function private.start_steps(s uuid,source_name text,difficulty_name text) returns jsonb language plpgsql security definer set search_path='' as $$
declare ep public.step_epochs; begin
 perform private.require_member(s);
 perform 1 from public.game_saves where id=s for update;
 if source_name not in ('health-connect','step-counter') or difficulty_name not in ('easy','medium','hard') then raise exception 'INVALID_SOURCE'; end if;
 -- Only the existing source owner can close an open epoch; explicitly sync before changing sources.
 if exists(select 1 from public.step_epochs where save_id=s and ended_at is null and user_id<>auth.uid()) then raise exception 'STEP_SOURCE_OTHER_DEVICE'; end if;
 update public.step_epochs set ended_at=now() where save_id=s and ended_at is null;
 insert into public.step_epochs(save_id,user_id,source,difficulty) values(s,auth.uid(),source_name,difficulty_name) returning * into ep;
 return jsonb_build_object('epochId',ep.id,'startedAt',ep.started_at,'source',ep.source,'difficulty',ep.difficulty);
end; $$;
create function public.start_step_epoch(save_id uuid,source text,difficulty text) returns jsonb language sql security invoker set search_path='' as $$ select private.start_steps(save_id,source,difficulty); $$;
create function private.credit_steps(s uuid,op uuid,epid uuid,total bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare ep public.step_epochs; previous private.operations; request jsonb:=jsonb_build_object('kind','steps','epochId',epid,'total',total); block_size integer; rate integer; blocks bigint; reward integer; result jsonb; balance integer; begin
 perform private.require_member(s); perform 1 from public.game_saves where id=s for update;
 select * into previous from private.operations where save_id=s and operation_id=op;
 if found then if previous.request<>request or previous.actor_id<>auth.uid() then raise exception 'IDEMPOTENCY_CONFLICT'; end if; return previous.result; end if;
 select * into ep from public.step_epochs where id=epid and save_id=s for update;
 if ep.id is null or ep.user_id<>auth.uid() or ep.ended_at is not null then raise exception 'STEP_EPOCH_NOT_ACTIVE'; end if;
 if total<0 or total>floor(extract(epoch from now()-ep.started_at)*5)+20 then raise exception 'INVALID_STEP_TOTAL'; end if;
 total:=greatest(total,ep.reported_steps);
 block_size:=case ep.difficulty when 'easy' then 1000 when 'medium' then 500 else 100 end;
 rate:=case ep.difficulty when 'easy' then 30 when 'medium' then 12 else 2 end;
 blocks:=total/block_size; reward:=((blocks-ep.rewarded_blocks)*rate)::integer;
 update public.step_epochs set reported_steps=total,rewarded_blocks=blocks where id=epid;
 update public.game_saves set coins=coins+reward,revision=revision+1 where id=s returning coins into balance;
 result:=jsonb_build_object('creditedCoins',reward,'coins',balance,'creditedSteps',total,'remainingSteps',total%block_size);
 insert into private.operations values(s,op,auth.uid(),request,result,now()); return result;
end; $$;
create function public.credit_steps(save_id uuid,operation_id uuid,epoch_id uuid,total_steps bigint) returns jsonb language sql security invoker set search_path='' as $$ select private.credit_steps(save_id,operation_id,epoch_id,total_steps); $$;

create function private.nutrition_write(s uuid,op uuid,entry uuid,expected bigint,data jsonb,remove boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare existing public.nutrition_entries; previous private.operations; request jsonb:=jsonb_build_object('kind','nutrition','entry',entry,'expected',expected,'data',data,'remove',remove); result jsonb; v bigint; begin
 perform private.require_member(s); perform 1 from public.game_saves where id=s for update;
 select * into previous from private.operations where save_id=s and operation_id=op;
 if found then if previous.request<>request or previous.actor_id<>auth.uid() then raise exception 'IDEMPOTENCY_CONFLICT'; end if; return previous.result; end if;
 if expected is null or expected<0 or data is null or octet_length(data::text)>65536 or jsonb_typeof(data)<>'object' then raise exception 'INVALID_ENTRY'; end if;
 select * into existing from public.nutrition_entries where id=entry for update;
 if found then
 if existing.save_id<>s then raise exception 'NOT_AUTHORIZED'; end if;
 if existing.version<>expected then return jsonb_build_object('error','VERSION_CONFLICT','current',to_jsonb(existing)); end if;
 v:=existing.version+1;
 else if expected<>0 then return jsonb_build_object('error','VERSION_CONFLICT'); end if; v:=1; end if;
 insert into public.nutrition_entries values(entry,s,v,case when remove then '{}'::jsonb else data end,remove,auth.uid(),now())
 on conflict(id) do update set version=excluded.version,content=excluded.content,deleted=excluded.deleted,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
 insert into private.nutrition_revisions values(entry,v,case when remove then '{}'::jsonb else data end,remove,auth.uid(),now());
 result:=jsonb_build_object('id',entry,'version',v,'deleted',remove);
 insert into private.operations values(s,op,auth.uid(),request,result,now()); return result;
end; $$;
create function public.write_nutrition_entry(save_id uuid,operation_id uuid,entry_id uuid,expected_version bigint,content jsonb,deleted boolean default false) returns jsonb language sql security invoker set search_path='' as $$ select private.nutrition_write(save_id,operation_id,entry_id,expected_version,content,deleted); $$;

-- Every public RPC is a non-privileged wrapper. Private implementations authenticate explicitly.
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to authenticated;
revoke all on function public.create_game_save(text),public.create_pair_code(text),public.approve_pair_code(uuid,text),public.adventure_control_command(uuid,text,bigint,uuid),public.economy_command(uuid,uuid,bigint,text,text),public.start_step_epoch(uuid,text,text),public.credit_steps(uuid,uuid,uuid,bigint),public.write_nutrition_entry(uuid,uuid,uuid,bigint,jsonb,boolean) from public,anon;
grant execute on function public.create_game_save(text),public.create_pair_code(text),public.approve_pair_code(uuid,text),public.adventure_control_command(uuid,text,bigint,uuid),public.economy_command(uuid,uuid,bigint,text,text),public.start_step_epoch(uuid,text,text),public.credit_steps(uuid,uuid,uuid,bigint),public.write_nutrition_entry(uuid,uuid,uuid,bigint,jsonb,boolean) to authenticated;

-- Stable creation tokens make separate adventures independent and retries safe.
create table everstride_private.save_creation_tokens (
 user_id uuid not null references auth.users on delete cascade,
 creation_id uuid not null,
 save_id uuid not null references public.game_saves on delete cascade,
 primary key(user_id,creation_id)
);
revoke all on everstride_private.save_creation_tokens from public,anon,authenticated;
create function everstride_private.create_save_slot(device_name text,creation_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s uuid; begin
 if auth.uid() is null then raise exception 'NOT_AUTHORIZED'; end if;
 if creation_id is null or length(device_name)>60 then raise exception 'INVALID_SAVE_REQUEST'; end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 select t.save_id into s from everstride_private.save_creation_tokens t where t.user_id=auth.uid() and t.creation_id=create_save_slot.creation_id;
 if s is not null then return jsonb_build_object('saveId',s);end if;
 if (select count(*) from public.game_saves where owner_id=auth.uid())>=3 then raise exception 'SAVE_LIMIT_REACHED';end if;
 insert into public.game_saves(owner_id) values(auth.uid()) returning id into s;
 insert into public.save_members values(s,auth.uid(),device_name);
 insert into public.adventure_control(save_id,holder_id,epoch,expires_at) values(s,auth.uid(),1,now()+interval '90 seconds');
 insert into public.game_inventory values(s,'potion',2),(s,'shield',1),(s,'boost',0),(s,'ingredient',0);
 insert into everstride_private.save_creation_tokens values(auth.uid(),creation_id,s);
 return jsonb_build_object('saveId',s);
end; $$;
create function public.create_game_save_slot(device_name text,creation_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select everstride_private.create_save_slot(device_name,creation_id); $$;
revoke all on function everstride_private.create_save_slot(text,uuid),public.create_game_save_slot(text,uuid) from public,anon;
grant execute on function everstride_private.create_save_slot(text,uuid),public.create_game_save_slot(text,uuid) to authenticated;

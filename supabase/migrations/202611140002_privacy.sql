-- Linked installations share the diary by explicit product decision.
-- A generation fences queued diary writes after the owner clears all nutrition data.
alter table public.game_saves add column nutrition_generation bigint not null default 1;

create function private.revoke_device(s uuid,target uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.require_member(s);
 perform 1 from public.game_saves where id=s and owner_id=auth.uid() for update;
 if not found then raise exception 'OWNER_REQUIRED'; end if;
 if target=auth.uid() then raise exception 'CANNOT_REVOKE_OWNER'; end if;
 delete from public.save_members where save_id=s and user_id=target;
 update public.adventure_control set holder_id=null,epoch=epoch+1,expires_at=now(),safe_point=true where save_id=s and holder_id=target;
 update public.step_epochs set ended_at=now() where save_id=s and user_id=target and ended_at is null;
 return jsonb_build_object('revoked',true);
end; $$;
create function public.revoke_linked_device(save_id uuid,target_user_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.revoke_device(save_id,target_user_id); $$;

create function private.export_nutrition(s uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; begin
 if not exists(select 1 from public.game_saves where id=s and owner_id=auth.uid()) then raise exception 'OWNER_REQUIRED'; end if;
 select jsonb_build_object('exportedAt',now(),'schemaVersion',1,'generation',nutrition_generation,
 'entries',coalesce((select jsonb_agg(to_jsonb(n)) from public.nutrition_entries n where n.save_id=s),'[]'::jsonb),
 'revisions',coalesce((select jsonb_agg(to_jsonb(r)) from private.nutrition_revisions r join public.nutrition_entries n on n.id=r.entry_id where n.save_id=s),'[]'::jsonb))
 into result from public.game_saves where id=s;
 return result;
end; $$;
create function public.export_nutrition_data(save_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.export_nutrition(save_id); $$;

create function private.clear_nutrition(s uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare gen bigint; begin
 perform 1 from public.game_saves where id=s and owner_id=auth.uid() for update;
 if not found then raise exception 'OWNER_REQUIRED'; end if;
 delete from private.nutrition_revisions where entry_id in(select id from public.nutrition_entries where save_id=s);
 delete from private.operations where save_id=s and request->>'kind'='nutrition';
 delete from public.nutrition_entries where save_id=s;
 update public.game_saves set nutrition_generation=nutrition_generation+1 where id=s returning nutrition_generation into gen;
 return jsonb_build_object('deleted',true,'generation',gen);
end; $$;
create function public.delete_all_nutrition_data(save_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.clear_nutrition(save_id); $$;

-- Replace the exposed write wrapper: every caller must supply the current generation.
drop function public.write_nutrition_entry(uuid,uuid,uuid,bigint,jsonb,boolean);
create function private.nutrition_write_checked(s uuid,op uuid,entry uuid,expected bigint,data jsonb,remove boolean,generation bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare current_generation bigint; begin
 perform private.require_member(s);
 select nutrition_generation into current_generation from public.game_saves where id=s for update;
 if generation is null or generation<>current_generation then return jsonb_build_object('error','NUTRITION_RESET','generation',current_generation); end if;
 return private.nutrition_write(s,op,entry,expected,data,remove);
end; $$;
create function public.write_nutrition_entry(save_id uuid,operation_id uuid,entry_id uuid,expected_version bigint,content jsonb,deleted boolean default false,generation bigint default 1) returns jsonb language sql security invoker set search_path='' as $$ select private.nutrition_write_checked(save_id,operation_id,entry_id,expected_version,content,deleted,generation); $$;
-- The unchecked helper may only be reached by its privileged checked caller.
revoke execute on function private.nutrition_write(uuid,uuid,uuid,bigint,jsonb,boolean) from authenticated;
revoke all on function private.revoke_device(uuid,uuid),private.export_nutrition(uuid),private.clear_nutrition(uuid),private.nutrition_write_checked(uuid,uuid,uuid,bigint,jsonb,boolean,bigint) from public,anon;
grant execute on function private.revoke_device(uuid,uuid),private.export_nutrition(uuid),private.clear_nutrition(uuid),private.nutrition_write_checked(uuid,uuid,uuid,bigint,jsonb,boolean,bigint) to authenticated;
revoke all on function public.revoke_linked_device(uuid,uuid),public.export_nutrition_data(uuid),public.delete_all_nutrition_data(uuid),public.write_nutrition_entry(uuid,uuid,uuid,bigint,jsonb,boolean,bigint) from public,anon;
grant execute on function public.revoke_linked_device(uuid,uuid),public.export_nutrition_data(uuid),public.delete_all_nutrition_data(uuid),public.write_nutrition_entry(uuid,uuid,uuid,bigint,jsonb,boolean,bigint) to authenticated;

-- Isolated fixtures: every test write is rolled back.
begin;
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  source uuid; copied uuid; item uuid; share uuid; lease uuid := gen_random_uuid();
  token text := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
  snap jsonb := '{"name":"Shared groceries","items":[{"query":"Oats","quantity":2,"unit":"package","selectedProduct":{"provider":"qa","providerProductId":"012345678905","title":"Chosen oats","upc":"012345678905"}}]}'::jsonb;
  rejected boolean := false;
begin
  insert into auth.users(id,email) values(a,'qa-'||a||'@example.invalid'),(b,'qa-'||b||'@example.invalid');
  source := public.save_grocery_list(a,null,'Original',jsonb_build_array((snap->'items'->0)||'{"sort_order":0}'::jsonb));
  select id into item from public.grocery_list_items where list_id=source;
  perform public.save_grocery_list(a,source,null,jsonb_build_array(jsonb_build_object('id',item,'query','Oats','sort_order',0)));
  if (select quantity from public.grocery_list_items where id=item) <> 2 or
    (select selected_product->>'title' from public.grocery_list_items where id=item) <> 'Chosen oats' then raise exception 'Legacy update lost fields'; end if;
  insert into public.grocery_list_shares(list_id,user_id,token,snapshot) values(source,a,token,snap) returning id into share;
  copied := public.copy_shared_grocery_list(b,token);
  if public.copy_shared_grocery_list(b,token) <> copied then raise exception 'Copy retry duplicated list'; end if;
  if (select user_id from public.grocery_lists where id=copied) <> b then raise exception 'Wrong copy owner'; end if;
  if not exists(select 1 from public.grocery_list_items where list_id=copied and id<>item and quantity=2 and selected_product->>'title'='Chosen oats') then raise exception 'Copy lost choice'; end if;
  perform public.save_grocery_list(a,source,'Changed original',jsonb_build_array(jsonb_build_object('id',item,'query','Rice','sort_order',0)));
  if (select selected_product from public.grocery_list_items where id=item) is not null then raise exception 'Rename retained selection'; end if;
  if (select snapshot from public.grocery_list_shares where id=share) <> snap then raise exception 'Snapshot mutated'; end if;
  update public.grocery_list_shares set revoked_at=now() where id=share;
  begin perform public.copy_shared_grocery_list(a,token); exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'Revoked share copied'; end if;
  update public.grocery_list_shares set revoked_at=null where id=share;
  update public.grocery_lists set is_deleted=true where id=source;
  rejected:=false;
  begin perform public.copy_shared_grocery_list(a,token); exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'Deleted source copied'; end if;
  if not exists(select 1 from public.grocery_lists where id=copied and not is_deleted) then raise exception 'Recipient copy disappeared'; end if;
  if not public.claim_instacart_export(token,lease) then raise exception 'First lease rejected'; end if;
  if public.claim_instacart_export(token,gen_random_uuid()) then raise exception 'Concurrent lease granted'; end if;
  update public.instacart_exports set lease_until=now()-interval '1 second' where cache_key=token;
  if not public.claim_instacart_export(token,lease) then raise exception 'Expired lease not reclaimed'; end if;
  update public.instacart_exports set lease_until=null,url='https://www.instacart.com/test',expires_at=now()+interval '1 day' where cache_key=token;
  if public.claim_instacart_export(token,lease) then raise exception 'Unexpired link regenerated'; end if;
  if has_table_privilege('anon','public.grocery_list_shares','select') or has_table_privilege('authenticated','public.grocery_list_shares','select') or
    has_table_privilege('authenticated','public.instacart_exports','select') or has_function_privilege('authenticated','public.copy_shared_grocery_list(uuid,text)','execute') or
    has_function_privilege('anon','public.claim_instacart_export(text,uuid)','execute') then raise exception 'Public access to server data/functions'; end if;
end $$;
select 'PASS: legacy saves, independent copies, idempotency, immutable snapshots, revocation, deleted sources, export leases, private grants' as result;
rollback;

-- Run against a disposable or connected development database. All fixtures roll back.
begin;
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  la uuid; lb uuid; ia uuid; ib uuid; purchase uuid; rejected boolean;
begin
  insert into auth.users(id,email) values(a,'qa-'||a||'@example.invalid'),(b,'qa-'||b||'@example.invalid');
  la := public.save_grocery_list(a,null,'QA A','[{"query":"Oats","sort_order":0}]');
  lb := public.save_grocery_list(b,null,'QA B','[{"query":"Milk","sort_order":0}]');
  select id into ia from public.grocery_list_items where list_id=la;
  select id into ib from public.grocery_list_items where list_id=lb;
  rejected := false;
  begin
    perform public.save_grocery_list(a,la,'SHOULD ROLL BACK',jsonb_build_array(jsonb_build_object('id',ib,'query','stolen','sort_order',0)));
  exception when insufficient_privilege then rejected := true;
  end;
  if not rejected then raise exception 'Cross-account item accepted'; end if;
  if (select name from public.grocery_lists where id=la) <> 'QA A' then raise exception 'List name partially changed'; end if;
  if (select list_id from public.grocery_list_items where id=ib) <> lb then raise exception 'Item parent changed'; end if;
  rejected := false;
  begin
    perform public.record_grocery_purchase(a,lb,ib,'Milk','{"provider":"qa","providerProductId":"qa","title":"Milk","estimatedPrice":2}');
  exception when insufficient_privilege then rejected := true;
  end;
  if not rejected then raise exception 'Cross-account purchase accepted'; end if;
  rejected := false;
  begin
    perform public.record_grocery_purchase(a,la,ib,'Milk','{"provider":"qa","providerProductId":"qa","title":"Milk","estimatedPrice":2}');
  exception when insufficient_privilege then rejected := true;
  end;
  if not rejected then raise exception 'Mismatched item/list accepted'; end if;
  purchase := public.record_grocery_purchase(a,la,ia,'Oats','{"provider":"qa","providerProductId":"qa","title":"Oats","estimatedPrice":2}');
  if purchase is null then raise exception 'Valid purchase failed'; end if;
  perform public.save_grocery_list(a,la,'Empty','[]');
  if (select is_active from public.grocery_list_items where id=ia) then raise exception 'Removed item stayed active'; end if;
  if not exists(select 1 from public.bought_products where id=purchase and item_id=ia) then raise exception 'History lost'; end if;
  if has_function_privilege('authenticated','public.save_grocery_list(uuid,uuid,text,jsonb)','execute') then raise exception 'Public RPC access'; end if;
  if has_column_privilege('authenticated','public.profiles','subscription_status','update') then raise exception 'User can change billing status'; end if;
  -- Direct database API insert policies must enforce the same relationship ownership.
  perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  rejected := false;
  begin
    insert into public.bought_products(user_id,list_id,item_id,query,provider,provider_product_id,title)
    values(a,lb,ib,'Milk','qa','qa','Milk');
  exception when insufficient_privilege then rejected := true;
  end;
  execute 'reset role';
  if not rejected then raise exception 'Direct API accepted foreign references'; end if;
end $$;
select 'PASS: atomic list ownership, purchase relationships, snapshot removal, history retention, RPC grants, billing-column grants, direct RLS' as result;
rollback;

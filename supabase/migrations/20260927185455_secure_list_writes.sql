-- Service-only, invoker-rights RPCs. Caller identity is supplied only by authenticated server routes.
-- Snapshot updates are atomic; purchases retain references to deactivated historical items.
create or replace function public.save_grocery_list(
  p_user_id uuid, p_list_id uuid, p_name text, p_items jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_list_id uuid := p_list_id;
  v_item jsonb;
  v_id uuid;
  v_ids uuid[] := '{}';
begin
  if p_user_id is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if p_name is not null and (length(trim(p_name)) < 1 or length(p_name) > 120) then
    raise exception 'Invalid list name' using errcode = '22023';
  end if;
  if p_items is not null and (jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 100) then
    raise exception 'Invalid list items' using errcode = '22023';
  end if;
  if v_list_id is null then
    if p_name is null or p_items is null or jsonb_array_length(p_items) = 0 then
      raise exception 'A new list requires a name and items' using errcode = '22023';
    end if;
    insert into public.grocery_lists(user_id,name) values(p_user_id,trim(p_name)) returning id into v_list_id;
  else
    perform 1 from public.grocery_lists where id=v_list_id and user_id=p_user_id and not is_deleted for update;
    if not found then raise exception 'List not found' using errcode = '42501'; end if;
    update public.grocery_lists set name=coalesce(trim(p_name),name),updated_at=now() where id=v_list_id;
  end if;
  if p_items is not null then
    for v_item in select value from jsonb_array_elements(p_items) loop
      if coalesce(length(trim(v_item->>'query')),0) < 1 or length(v_item->>'query') > 160 or
        coalesce((v_item->>'sort_order')::integer,-1) < 0 then
        raise exception 'Invalid list item' using errcode = '22023';
      end if;
      v_id := (v_item->>'id')::uuid;
      if v_id is not null then
        if v_id = any(v_ids) then raise exception 'Duplicate item ID' using errcode = '22023'; end if;
        -- Lock and scope the existing row. Never upsert a client-supplied ID into a different parent.
        perform 1 from public.grocery_list_items where id=v_id and list_id=v_list_id for update;
        if not found then raise exception 'Item not found in this list' using errcode = '42501'; end if;
        update public.grocery_list_items set query=trim(v_item->>'query'),sort_order=(v_item->>'sort_order')::integer,
          is_active=coalesce((v_item->>'is_active')::boolean,true),updated_at=now() where id=v_id and list_id=v_list_id;
      else
        insert into public.grocery_list_items(list_id,query,sort_order,is_active)
        values(v_list_id,trim(v_item->>'query'),(v_item->>'sort_order')::integer,coalesce((v_item->>'is_active')::boolean,true)) returning id into v_id;
      end if;
      v_ids := array_append(v_ids,v_id);
    end loop;
    update public.grocery_list_items set is_active=false,updated_at=now() where list_id=v_list_id and not (id=any(v_ids));
  end if;
  return v_list_id;
end;
$$;
revoke all on function public.save_grocery_list(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.save_grocery_list(uuid,uuid,text,jsonb) to service_role;

create or replace function public.record_grocery_purchase(
  p_user_id uuid, p_list_id uuid, p_item_id uuid, p_query text, p_product jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_list_id uuid := p_list_id; v_item_list uuid; v_id uuid;
begin
  if p_user_id is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if p_item_id is not null then
    select list_id into v_item_list from public.grocery_list_items where id=p_item_id;
    if not found or (v_list_id is not null and v_item_list <> v_list_id) then
      raise exception 'Item not found in this list' using errcode = '42501';
    end if;
    v_list_id := v_item_list;
  end if;
  if v_list_id is not null then
    perform 1 from public.grocery_lists where id=v_list_id and user_id=p_user_id and not is_deleted for share;
    if not found then raise exception 'List not found' using errcode = '42501'; end if;
  end if;
  if p_item_id is not null then
    perform 1 from public.grocery_list_items where id=p_item_id and list_id=v_list_id for share;
    if not found then raise exception 'Item not found in this list' using errcode = '42501'; end if;
  end if;
  insert into public.bought_products(user_id,list_id,item_id,query,provider,provider_product_id,upc,title,brand,estimated_price,image_url,product_url)
  values(p_user_id,v_list_id,p_item_id,p_query,p_product->>'provider',p_product->>'providerProductId',p_product->>'upc',p_product->>'title',
    p_product->>'brand',(p_product->>'estimatedPrice')::numeric,p_product->>'imageUrl',p_product->>'productUrl') returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.record_grocery_purchase(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.record_grocery_purchase(uuid,uuid,uuid,text,jsonb) to service_role;

-- Prevent direct API users from changing billing authority through their own profile.
revoke update on public.profiles from anon,authenticated;
grant update(email) on public.profiles to authenticated;

-- The same parent ownership checks apply to direct authenticated inserts.
drop policy if exists "Users can insert own bought products" on public.bought_products;
create policy "Users can insert own bought products" on public.bought_products for insert to authenticated
with check (
  (select auth.uid())=user_id
  and (list_id is null or exists(select 1 from public.grocery_lists l where l.id=list_id and l.user_id=(select auth.uid()) and not l.is_deleted))
  and (item_id is null or exists(select 1 from public.grocery_list_items i join public.grocery_lists l on l.id=i.list_id
    where i.id=item_id and l.user_id=(select auth.uid()) and not l.is_deleted and (bought_products.list_id is null or i.list_id=bought_products.list_id)))
);

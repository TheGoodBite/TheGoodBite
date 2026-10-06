-- Additive migration: legacy list clients remain supported.
alter table public.grocery_list_items
  add column quantity numeric not null default 1,
  add column unit text not null default 'each',
  add column selected_product jsonb;
alter table public.grocery_list_items
  add constraint list_item_quantity check (quantity > 0 and quantity <= 10000),
  add constraint list_item_unit check (unit in ('each','package','g','kg','oz','lb','ml','l')),
  add constraint list_item_selection check (selected_product is null or
    (jsonb_typeof(selected_product)='object' and unit='package' and quantity=trunc(quantity)));

create table public.grocery_list_shares (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.grocery_lists(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text unique not null check (token ~ '^[a-f0-9]{64}$'),
  snapshot jsonb not null check (jsonb_typeof(snapshot)='object'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index grocery_list_shares_list_idx on public.grocery_list_shares(list_id);
create index grocery_list_shares_user_idx on public.grocery_list_shares(user_id);
create table public.grocery_list_copies (
  share_id uuid not null references public.grocery_list_shares(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  list_id uuid not null references public.grocery_lists(id) on delete cascade,
  primary key(share_id,user_id)
);
create index grocery_list_copies_list_idx on public.grocery_list_copies(list_id);
create index grocery_list_copies_user_idx on public.grocery_list_copies(user_id);
create table public.instacart_exports (
  cache_key text primary key,
  url text,
  expires_at timestamptz,
  lease_id uuid,
  lease_until timestamptz
);
-- Capability links are resolved only by server routes. No public Data API access.
alter table public.grocery_list_shares enable row level security;
alter table public.grocery_list_copies enable row level security;
alter table public.instacart_exports enable row level security;
revoke all on public.grocery_list_shares,public.grocery_list_copies,public.instacart_exports from public,anon,authenticated;
grant all on public.grocery_list_shares,public.grocery_list_copies,public.instacart_exports to service_role;

-- Service-only, invoker-rights RPCs. Caller identity is supplied only by authenticated server routes.
-- Snapshot updates are atomic; purchases retain references to deactivated historical items.
create or replace function public.save_grocery_list(
  p_user_id uuid, p_list_id uuid, p_name text, p_items jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_list_id uuid := p_list_id;
  v_item jsonb;
  v_id uuid;
  v_quantity numeric;
  v_unit text;
  v_product jsonb;
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
      -- Missing fields from older clients preserve existing values on updates.
      v_quantity := coalesce((v_item->>'quantity')::numeric, 1);
      v_unit := coalesce(v_item->>'unit', 'each');
      v_product := nullif(v_item->'selectedProduct', 'null'::jsonb);
      if v_id is not null then
        if v_id = any(v_ids) then raise exception 'Duplicate item ID' using errcode = '22023'; end if;
        -- Lock and scope the existing row. Never upsert a client-supplied ID into a different parent.
        perform 1 from public.grocery_list_items where id=v_id and list_id=v_list_id for update;
        if not found then raise exception 'Item not found in this list' using errcode = '42501'; end if;
        select case when v_item ? 'quantity' then v_quantity else i.quantity end,
          case when v_item ? 'unit' then v_unit else i.unit end,
          case when v_item ? 'selectedProduct' then v_product
            when i.query <> trim(v_item->>'query') then null else i.selected_product end
          into v_quantity,v_unit,v_product from public.grocery_list_items i where i.id=v_id;
        update public.grocery_list_items set quantity=v_quantity,unit=v_unit,selected_product=v_product,query=trim(v_item->>'query'),sort_order=(v_item->>'sort_order')::integer,
          is_active=coalesce((v_item->>'is_active')::boolean,true),updated_at=now() where id=v_id and list_id=v_list_id;
      else
        insert into public.grocery_list_items(list_id,query,sort_order,is_active,quantity,unit,selected_product)
        values(v_list_id,trim(v_item->>'query'),(v_item->>'sort_order')::integer,coalesce((v_item->>'is_active')::boolean,true),v_quantity,v_unit,v_product) returning id into v_id;
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


-- Serialize copies of a snapshot; retries return the same private list.
create function public.copy_shared_grocery_list(p_user_id uuid,p_token text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_share public.grocery_list_shares%rowtype; v_list uuid; v_items jsonb;
begin
  if p_user_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
  select s.* into v_share from public.grocery_list_shares s
    join public.grocery_lists l on l.id=s.list_id
    where s.token=p_token and s.revoked_at is null and not l.is_deleted for update of s;
  if not found then raise exception 'Shared list unavailable' using errcode='42501'; end if;
  select c.list_id into v_list from public.grocery_list_copies c
    join public.grocery_lists l on l.id=c.list_id
    where c.share_id=v_share.id and c.user_id=p_user_id and not l.is_deleted;
  if v_list is not null then return v_list; end if;
  select jsonb_agg(value || jsonb_build_object('sort_order',ordinality-1)) into v_items
    from jsonb_array_elements(v_share.snapshot->'items') with ordinality;
  v_list := public.save_grocery_list(p_user_id,null,v_share.snapshot->>'name',v_items);
  insert into public.grocery_list_copies(share_id,user_id,list_id) values(v_share.id,p_user_id,v_list)
    on conflict(share_id,user_id) do update set list_id=excluded.list_id;
  return v_list;
end; $$;
revoke all on function public.copy_shared_grocery_list(uuid,text) from public,anon,authenticated;
grant execute on function public.copy_shared_grocery_list(uuid,text) to service_role;

-- A bounded database lease prevents duplicate provider requests across workers.
create function public.claim_instacart_export(p_key text,p_lease uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
declare v_claimed text;
begin
  insert into public.instacart_exports(cache_key,lease_id,lease_until)
    values(p_key,p_lease,now()+interval '30 seconds')
    on conflict(cache_key) do update set lease_id=excluded.lease_id,lease_until=excluded.lease_until
    where (instacart_exports.lease_until is null or instacart_exports.lease_until < now())
      and (instacart_exports.url is null or instacart_exports.expires_at <= now()+interval '1 minute')
    returning cache_key into v_claimed;
  return v_claimed is not null;
end; $$;
revoke all on function public.claim_instacart_export(text,uuid) from public,anon,authenticated;
grant execute on function public.claim_instacart_export(text,uuid) to service_role;

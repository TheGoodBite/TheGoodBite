create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  stripe_customer_id text unique,
  subscription_status text not null default 'free',
  subscription_price_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.grocery_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.grocery_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.grocery_lists(id) on delete cascade,
  query text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bought_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  list_id uuid references public.grocery_lists(id) on delete set null,
  item_id uuid references public.grocery_list_items(id) on delete set null,
  query text not null,
  provider text not null,
  provider_product_id text not null,
  upc text,
  title text not null,
  brand text,
  estimated_price numeric,
  image_url text,
  product_url text,
  bought_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  diet_modes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists grocery_lists_user_id_idx on public.grocery_lists(user_id);
create index if not exists grocery_list_items_list_id_idx on public.grocery_list_items(list_id);
create index if not exists bought_products_user_id_idx on public.bought_products(user_id);
create index if not exists bought_products_item_id_idx on public.bought_products(item_id);

alter table public.profiles enable row level security;
alter table public.grocery_lists enable row level security;
alter table public.grocery_list_items enable row level security;
alter table public.bought_products enable row level security;
alter table public.user_preferences enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can read own lists"
  on public.grocery_lists for select
  using (auth.uid() = user_id);

create policy "Users can insert own lists"
  on public.grocery_lists for insert
  with check (auth.uid() = user_id);

create policy "Users can update own lists"
  on public.grocery_lists for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can read own list items"
  on public.grocery_list_items for select
  using (
    exists (
      select 1 from public.grocery_lists
      where grocery_lists.id = grocery_list_items.list_id
      and grocery_lists.user_id = auth.uid()
    )
  );

create policy "Users can insert own list items"
  on public.grocery_list_items for insert
  with check (
    exists (
      select 1 from public.grocery_lists
      where grocery_lists.id = grocery_list_items.list_id
      and grocery_lists.user_id = auth.uid()
    )
  );

create policy "Users can update own list items"
  on public.grocery_list_items for update
  using (
    exists (
      select 1 from public.grocery_lists
      where grocery_lists.id = grocery_list_items.list_id
      and grocery_lists.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.grocery_lists
      where grocery_lists.id = grocery_list_items.list_id
      and grocery_lists.user_id = auth.uid()
    )
  );

create policy "Users can read own bought products"
  on public.bought_products for select
  using (auth.uid() = user_id);

create policy "Users can insert own bought products"
  on public.bought_products for insert
  with check (auth.uid() = user_id);

create policy "Users can read own preferences"
  on public.user_preferences for select
  using (auth.uid() = user_id);

create policy "Users can upsert own preferences"
  on public.user_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

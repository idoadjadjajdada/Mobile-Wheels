-- CRAVE initial schema
-- Catalog tables are world-readable and admin-writable. User tables are owner-only.
-- Every sourced fact carries source attribution, verification and refresh metadata.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type source_kind as enum ('osm', 'google_places', 'foursquare', 'catalog', 'spoonacular', 'manual', 'user_report', 'demo');
create type verification_status as enum ('verified', 'reported', 'estimate', 'unknown');
create type refresh_status as enum ('fresh', 'stale', 'pending', 'failed', 'manual_only');
create type restaurant_kind as enum ('standard', 'ghost_kitchen', 'virtual_brand', 'delivery_only');
create type chain_tier as enum ('national', 'regional', 'local');
create type delivery_platform as enum ('doordash', 'ubereats', 'grubhub', 'direct', 'other');
create type listing_status as enum ('verified_listed', 'reported_listed', 'not_listed', 'unknown');
create type tri_state as enum ('yes', 'no', 'unknown');
create type swipe_action as enum ('like', 'pass', 'save');

-- ---------------------------------------------------------------------------
-- Roles / profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'admin')),
  display_name text,
  -- UserProfile + Filters JSON (see src/lib/types.ts). Precise location lives in user_addresses.
  settings jsonb not null default '{}'::jsonb,
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
create table public.markets (
  id text primary key,
  name text not null,
  timezone text not null,
  bbox_south double precision not null,
  bbox_west double precision not null,
  bbox_north double precision not null,
  bbox_east double precision not null,
  center_lat double precision not null,
  center_lng double precision not null,
  tax_rate numeric(6, 4) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.chains (
  id text primary key,
  slug text not null unique,
  name text not null,
  tier chain_tier not null,
  priority int not null default 100,
  wikidata text unique,
  aliases text[] not null default '{}',
  website text,
  direct_order_url text,
  categories text[] not null default '{}',
  price_level smallint check (price_level between 1 and 4),
  source source_kind not null default 'catalog',
  verified_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  market_id text not null references public.markets (id),
  chain_id text references public.chains (id) on delete set null,
  name text not null,
  kind restaurant_kind not null default 'standard',
  host_restaurant_id uuid references public.restaurants (id) on delete set null,
  address_line1 text,
  city text,
  state text,
  postal_code text,
  lat double precision not null,
  lng double precision not null,
  phone text,
  website text,
  cuisine text[] not null default '{}',
  price_level smallint check (price_level between 1 and 4),
  -- RestaurantHours JSON: { general, delivery, pickup, kitchenCutoffMinutes }, each HoursSet carries provenance.
  hours jsonb not null default '{}'::jsonb,
  pickup tri_state not null default 'unknown',
  rating_value numeric(3, 2),
  rating_count int,
  rating_source source_kind,
  rating_fetched_at timestamptz,
  osm_id text unique,
  google_place_id text unique,
  foursquare_id text unique,
  -- Provenance of the record as a whole; per-field overrides in field_provenance.
  source source_kind not null,
  source_ref text,
  verification verification_status not null default 'reported',
  verified_at timestamptz,
  verified_by uuid references auth.users (id) on delete set null,
  fetched_at timestamptz,
  field_provenance jsonb not null default '{}'::jsonb,
  -- Fields an admin has locked; automated refresh must not overwrite them.
  locked_fields text[] not null default '{}',
  refresh_status refresh_status not null default 'pending',
  last_refreshed_at timestamptz,
  content_hash text,
  status text not null default 'active' check (status in ('active', 'closed_permanently', 'hidden')),
  -- Set when dedupe decides this row duplicates another.
  duplicate_of uuid references public.restaurants (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index restaurants_geo_idx on public.restaurants (market_id, lat, lng);
create index restaurants_chain_idx on public.restaurants (chain_id);
create index restaurants_status_idx on public.restaurants (status) where duplicate_of is null;

create table public.restaurant_sources (
  id bigint generated always as identity primary key,
  restaurant_id uuid references public.restaurants (id) on delete cascade,
  source source_kind not null,
  source_ref text not null,
  payload_hash text not null,
  -- Only sources whose terms allow storage keep a payload (e.g. OSM). Google content is never stored.
  payload jsonb,
  fetched_at timestamptz not null default now(),
  unique (source, source_ref)
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  chain_id text references public.chains (id) on delete cascade,
  restaurant_id uuid references public.restaurants (id) on delete cascade,
  catalog_key text unique,
  name text not null,
  description text,
  category text not null,
  ingredients text[] not null default '{}',
  is_combo boolean not null default false,
  price_amount numeric(8, 2),
  price_low numeric(8, 2),
  price_high numeric(8, 2),
  price_status verification_status not null default 'unknown',
  price_channel text,
  price_verified_at timestamptz,
  combo_price_amount numeric(8, 2),
  combo_price_low numeric(8, 2),
  combo_price_high numeric(8, 2),
  combo_price_status verification_status not null default 'unknown',
  portion_size text not null default 'regular' check (portion_size in ('snack', 'regular', 'large', 'shareable')),
  portion_note text,
  nutrition jsonb,
  allergens jsonb,
  dietary text[] not null default '{}',
  image_url text,
  image_kind text check (image_kind in ('official', 'licensed', 'representative')),
  image_attribution text,
  order_path text,
  available boolean not null default true,
  source source_kind not null,
  source_ref text,
  verification verification_status not null default 'reported',
  verified_at timestamptz,
  verified_by uuid references auth.users (id) on delete set null,
  refresh_status refresh_status not null default 'manual_only',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (chain_id is not null or restaurant_id is not null)
);

create index menu_items_chain_idx on public.menu_items (chain_id);
create index menu_items_restaurant_idx on public.menu_items (restaurant_id);

create table public.delivery_listings (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  platform delivery_platform not null,
  platform_label text,
  store_url text check (store_url is null or store_url ~* '^https://'),
  -- Presence on the platform. NOT address coverage, NOT live order acceptance.
  listing_status listing_status not null default 'unknown',
  offers_delivery tri_state not null default 'unknown',
  offers_pickup tri_state not null default 'unknown',
  source source_kind not null default 'manual',
  verification verification_status not null default 'unknown',
  verified_at timestamptz,
  verified_by uuid references auth.users (id) on delete set null,
  refresh_status refresh_status not null default 'manual_only',
  updated_at timestamptz not null default now(),
  unique (restaurant_id, platform)
);

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  chain_id text references public.chains (id) on delete cascade,
  restaurant_id uuid references public.restaurants (id) on delete cascade,
  title text not null,
  detail text,
  valid_until date,
  source source_kind not null default 'manual',
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Refresh pipeline
-- ---------------------------------------------------------------------------
create table public.refresh_runs (
  id uuid primary key default gen_random_uuid(),
  market_id text references public.markets (id),
  source source_kind not null,
  trigger text not null default 'schedule' check (trigger in ('schedule', 'manual', 'cli')),
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed', 'partial')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  stats jsonb not null default '{}'::jsonb,
  error text
);

create table public.data_changes (
  id bigint generated always as identity primary key,
  run_id uuid references public.refresh_runs (id) on delete set null,
  entity_type text not null,
  entity_id text not null,
  change_type text not null check (change_type in ('created', 'updated', 'removed', 'skipped_locked')),
  field text,
  old_value jsonb,
  new_value jsonb,
  source source_kind not null,
  detected_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null
);

create index data_changes_entity_idx on public.data_changes (entity_type, entity_id);
create index data_changes_unreviewed_idx on public.data_changes (detected_at desc) where reviewed_at is null;

create table public.user_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  restaurant_id uuid references public.restaurants (id) on delete cascade,
  menu_item_id uuid references public.menu_items (id) on delete cascade,
  kind text not null check (kind in ('hours', 'price', 'closed', 'delivery', 'menu', 'other')),
  message text check (char_length(message) <= 1000),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- User data (owner-only)
-- ---------------------------------------------------------------------------
create table public.user_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  lat double precision not null,
  lng double precision not null,
  precision text not null default 'exact' check (precision in ('exact', 'approximate')),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.user_swipes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  offering_key text not null,
  menu_item_id text not null,
  restaurant_id text not null,
  chain_id text,
  category text not null,
  ingredients text[] not null default '{}',
  price numeric(8, 2),
  portion_size text,
  action swipe_action not null,
  created_at timestamptz not null default now()
);
create index user_swipes_user_idx on public.user_swipes (user_id, created_at desc);

-- Three deliberately separate preference types:
create table public.user_blocks (
  user_id uuid not null references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('restaurant', 'chain')),
  target_id text not null,
  target_name text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);

create table public.user_dislikes (
  user_id uuid not null references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('restaurant', 'chain', 'category')),
  target_id text not null,
  target_name text not null,
  reason text not null check (reason in ('not_tonight', 'tired_of')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);

create table public.user_meal_rejections (
  user_id uuid not null references auth.users (id) on delete cascade,
  menu_item_id text not null,
  item_name text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, menu_item_id)
);

create table public.user_recent_meals (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  restaurant_id text not null,
  chain_id text,
  name text not null,
  eaten_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Group mode
-- ---------------------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  name text not null default 'Group',
  created_by uuid references auth.users (id) on delete set null,
  center_lat double precision,
  center_lng double precision,
  expires_at timestamptz not null default now() + interval '2 days',
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  member_id text not null,
  user_id uuid references auth.users (id) on delete cascade,
  display_name text not null,
  joined_at timestamptz not null default now(),
  primary key (group_id, member_id)
);

create table public.group_swipes (
  group_id uuid not null references public.groups (id) on delete cascade,
  member_id text not null,
  offering_key text not null,
  restaurant_id text not null,
  action swipe_action not null,
  created_at timestamptz not null default now(),
  primary key (group_id, member_id, offering_key),
  foreign key (group_id, member_id) references public.group_members (group_id, member_id) on delete cascade
);

create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.group_members where group_id = gid and user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Geo query
-- ---------------------------------------------------------------------------
create or replace function public.restaurants_near(p_lat double precision, p_lng double precision, p_radius_km double precision default 10)
returns table (restaurant_id uuid, distance_km double precision)
language sql
stable
as $$
  with box as (
    select p_radius_km / 111.045 as dlat,
           p_radius_km / (111.045 * greatest(cos(radians(p_lat)), 0.01)) as dlng
  )
  select r.id,
         2 * 6371 * asin(sqrt(
           power(sin(radians(r.lat - p_lat) / 2), 2) +
           cos(radians(p_lat)) * cos(radians(r.lat)) * power(sin(radians(r.lng - p_lng) / 2), 2)
         )) as distance_km
  from public.restaurants r, box
  where r.status = 'active'
    and r.duplicate_of is null
    and r.lat between p_lat - box.dlat and p_lat + box.dlat
    and r.lng between p_lng - box.dlng and p_lng + box.dlng
  order by distance_km
$$;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger chains_touch before update on public.chains for each row execute function public.touch_updated_at();
create trigger restaurants_touch before update on public.restaurants for each row execute function public.touch_updated_at();
create trigger menu_items_touch before update on public.menu_items for each row execute function public.touch_updated_at();
create trigger delivery_listings_touch before update on public.delivery_listings for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.markets enable row level security;
alter table public.chains enable row level security;
alter table public.restaurants enable row level security;
alter table public.restaurant_sources enable row level security;
alter table public.menu_items enable row level security;
alter table public.delivery_listings enable row level security;
alter table public.promotions enable row level security;
alter table public.refresh_runs enable row level security;
alter table public.data_changes enable row level security;
alter table public.user_reports enable row level security;
alter table public.user_addresses enable row level security;
alter table public.user_swipes enable row level security;
alter table public.user_blocks enable row level security;
alter table public.user_dislikes enable row level security;
alter table public.user_meal_rejections enable row level security;
alter table public.user_recent_meals enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_swipes enable row level security;

-- Profiles: users read/update their own row but can never change their role.
create policy profiles_select_own on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Role changes are admin-only. Done in a trigger because a policy that reads
-- profiles from inside a profiles policy recurses.
-- SECURITY INVOKER on purpose: current_user must be the caller's role, not the owner.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Only API callers are gated; the SQL console / migrations (postgres) and the
  -- service role can promote the first admin.
  if new.role is distinct from old.role
     and current_user in ('anon', 'authenticated')
     and not public.is_admin() then
    raise exception 'only admins can change roles';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role before update on public.profiles
  for each row execute function public.guard_profile_role();
create policy profiles_admin_all on public.profiles for all using (public.is_admin()) with check (public.is_admin());

-- Catalog: public read, admin write.
create policy markets_read on public.markets for select using (true);
create policy markets_admin on public.markets for all using (public.is_admin()) with check (public.is_admin());
create policy chains_read on public.chains for select using (true);
create policy chains_admin on public.chains for all using (public.is_admin()) with check (public.is_admin());
create policy restaurants_read on public.restaurants for select using (status = 'active' or public.is_admin());
create policy restaurants_admin on public.restaurants for all using (public.is_admin()) with check (public.is_admin());
create policy menu_items_read on public.menu_items for select using (true);
create policy menu_items_admin on public.menu_items for all using (public.is_admin()) with check (public.is_admin());
create policy delivery_listings_read on public.delivery_listings for select using (true);
create policy delivery_listings_admin on public.delivery_listings for all using (public.is_admin()) with check (public.is_admin());
create policy promotions_read on public.promotions for select using (true);
create policy promotions_admin on public.promotions for all using (public.is_admin()) with check (public.is_admin());

-- Pipeline internals: admins only (the refresh job uses the service role, which bypasses RLS).
create policy restaurant_sources_admin on public.restaurant_sources for all using (public.is_admin()) with check (public.is_admin());
create policy refresh_runs_admin on public.refresh_runs for all using (public.is_admin()) with check (public.is_admin());
create policy data_changes_admin on public.data_changes for all using (public.is_admin()) with check (public.is_admin());

-- Reports: anyone signed in can file; only admins read.
create policy user_reports_insert on public.user_reports for insert with check (auth.uid() is not null and user_id = auth.uid());
create policy user_reports_admin on public.user_reports for all using (public.is_admin()) with check (public.is_admin());

-- Owner-only user data.
create policy user_addresses_own on public.user_addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy user_swipes_own on public.user_swipes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy user_blocks_own on public.user_blocks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy user_dislikes_own on public.user_dislikes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy user_meal_rejections_own on public.user_meal_rejections for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy user_recent_meals_own on public.user_recent_meals for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Groups: members see their group; joining happens via the server (service role) after a code check.
create policy groups_member_read on public.groups for select using (public.is_group_member(id) or created_by = auth.uid());
create policy group_members_read on public.group_members for select using (public.is_group_member(group_id));
create policy group_swipes_read on public.group_swipes for select using (public.is_group_member(group_id));
create policy group_swipes_insert_own on public.group_swipes for insert with check (
  exists (select 1 from public.group_members m where m.group_id = group_swipes.group_id and m.member_id = group_swipes.member_id and m.user_id = auth.uid())
);

-- ---------------------------------------------------------------------------
-- Grants (Supabase defaults grant to anon/authenticated; RLS above does the gating)
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on public.markets, public.chains, public.restaurants, public.menu_items, public.delivery_listings, public.promotions to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.restaurants_near(double precision, double precision, double precision) to anon, authenticated;

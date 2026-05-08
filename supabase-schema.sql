-- HikingLog — Supabase Schema v2
-- Run this in: Supabase Dashboard → SQL Editor → New Query

-- ── Trail reports ─────────────────────────────────────────────────────────────
create table if not exists trail_reports (
  id               uuid primary key default gen_random_uuid(),
  trail_id         text not null,
  user_id          uuid references auth.users(id) on delete cascade,
  username         text,
  visited_on       date not null,
  distance_mi      numeric,
  duration_min     integer,
  elevation_gain_ft integer,
  what_happened    text,
  rating           smallint check (rating between 1 and 5),
  trail_type       text,
  hike_type        text,
  difficulty       text,
  grade            text,
  liked            smallint check (liked between 1 and 5),
  public_transport boolean,
  parking          text[],
  weather          text,
  temperature      text,
  wind             text,
  path             text[],
  fauna            text[],
  landscape        text[],
  facilities       text[],
  crowdedness      text,
  alltrails_link   text,
  garmin_link      text,
  avenza_link      text,
  created_at       timestamptz default now()
);
alter table trail_reports enable row level security;
create policy "Trail reports readable by all" on trail_reports for select using (true);
create policy "Users insert own reports" on trail_reports for insert with check (auth.uid() = user_id);
create policy "Users update own reports" on trail_reports for update using (auth.uid() = user_id);
create index if not exists trail_reports_trail_id_idx on trail_reports(trail_id);

-- ── Favorites ─────────────────────────────────────────────────────────────────
create table if not exists favorites (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  trail_id   text not null,
  created_at timestamptz default now(),
  unique(user_id, trail_id)
);
alter table favorites enable row level security;
create policy "Users manage own favorites" on favorites for all using (auth.uid() = user_id);
create index if not exists favorites_user_id_idx on favorites(user_id);

-- ── Checklist trips ───────────────────────────────────────────────────────────
create table if not exists checklist_trips (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid references auth.users(id) on delete cascade not null,
  trail_id  text not null,
  trip_date date not null,
  created_at timestamptz default now(),
  unique(user_id, trail_id, trip_date)
);
alter table checklist_trips enable row level security;
create policy "Users manage own checklist trips" on checklist_trips for all using (auth.uid() = user_id);

-- ── Checklist items ───────────────────────────────────────────────────────────
create table if not exists checklist_items (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid references checklist_trips(id) on delete cascade not null,
  user_id     uuid references auth.users(id) on delete cascade not null,
  category    text not null,
  description text not null,
  planned     boolean default false,
  packed      boolean default false,
  review      text,
  updated_at  timestamptz default now()
);
alter table checklist_items enable row level security;
create policy "Users manage own checklist items" on checklist_items for all using (auth.uid() = user_id);
create index if not exists checklist_items_trip_id_idx on checklist_items(trip_id);

-- ── Profiles (user preferences & privacy settings) ────────────────────────────
-- Run this in Supabase SQL Editor if not already present
create table if not exists profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  share_favorites  boolean default true,
  share_planned    boolean default false,
  share_reviews    boolean default true,
  share_completed  boolean default true,
  updated_at       timestamptz default now()
);
alter table profiles enable row level security;
create policy "Users manage own profile"
  on profiles for all using (auth.uid() = id);

-- ── Planned trips ──────────────────────────────────────────────────────────────
create table if not exists planned_trips (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  trail_id   text not null,
  trip_date  date,
  status     text default 'planned',
  created_at timestamptz default now(),
  unique(user_id, trail_id, trip_date)
);
alter table planned_trips enable row level security;
create policy "Users manage own planned trips"
  on planned_trips for all using (auth.uid() = user_id);

-- ── Trail links ───────────────────────────────────────────────────────────────
create table if not exists trail_links (
  id          uuid primary key default gen_random_uuid(),
  trail_id    text not null,
  type        text not null default 'user',  -- 'suggested' | 'user'
  user_id     uuid references auth.users(id) on delete cascade,
  url         text not null,
  title       text,
  source      text,  -- 'alltrails' | 'garmin' | 'avenza' | 'other'
  created_at  timestamptz default now()
);
alter table trail_links enable row level security;
-- Suggested links readable by everyone
create policy "Suggested links readable by all"
  on trail_links for select using (type = 'suggested' or auth.uid() = user_id);
-- Users insert their own links
create policy "Users insert own links"
  on trail_links for insert with check (auth.uid() = user_id);
-- Users delete their own links
create policy "Users delete own links"
  on trail_links for delete using (auth.uid() = user_id);

create index if not exists trail_links_trail_id_idx on trail_links(trail_id);
create index if not exists trail_links_type_idx on trail_links(type);

-- ── Trail links ───────────────────────────────────────────────────────────────
-- type = 'suggested' → added by admin, visible to all
-- type = 'user'      → added by a logged-in user, visible only to them
create table if not exists trail_links (
  id         uuid primary key default gen_random_uuid(),
  trail_id   text not null,
  type       text not null default 'user',   -- 'suggested' | 'user'
  user_id    uuid references auth.users(id) on delete cascade,
  url        text not null,
  title      text,
  source     text,                            -- 'alltrails' | 'garmin' | 'avenza' | 'other'
  created_at timestamptz default now()
);
alter table trail_links enable row level security;

-- Suggested links readable by everyone
create policy "Suggested links are public"
  on trail_links for select
  using (type = 'suggested');

-- User links readable only by owner
create policy "Users read own links"
  on trail_links for select
  using (type = 'user' and auth.uid() = user_id);

-- Logged-in users can insert their own links
create policy "Users insert own links"
  on trail_links for insert
  with check (auth.uid() = user_id);

-- Users can delete their own links
create policy "Users delete own links"
  on trail_links for delete
  using (auth.uid() = user_id);

-- Admin can insert suggested links (via service role — no RLS policy needed)
-- Run inserts from admin panel using anon key with your own user_id = null

create index if not exists trail_links_trail_id_idx on trail_links(trail_id);
create index if not exists trail_links_type_idx on trail_links(type);

-- ── Trail link suggestions (user-submitted, pending admin review) ─────────────
create table if not exists trail_link_suggestions (
  id         uuid primary key default gen_random_uuid(),
  trail_id   text not null,
  user_id    uuid references auth.users(id) on delete cascade,
  url        text not null,
  notes      text,
  status     text default 'pending',          -- 'pending' | 'approved' | 'rejected'
  created_at timestamptz default now()
);
alter table trail_link_suggestions enable row level security;

create policy "Users submit suggestions"
  on trail_link_suggestions for insert
  with check (auth.uid() = user_id);

create policy "Users see own suggestions"
  on trail_link_suggestions for select
  using (auth.uid() = user_id);

-- ── Trail links ────────────────────────────────────────────────────────────────
-- Stores both admin-curated suggested links and user-saved personal links
create table if not exists trail_links (
  id         uuid primary key default gen_random_uuid(),
  trail_id   text not null,
  type       text not null,           -- 'suggested' (admin) | 'user' (personal)
  user_id    uuid references auth.users(id) on delete cascade,
  url        text not null,
  title      text not null,
  source     text default 'other',   -- 'alltrails' | 'garmin' | 'avenza' | 'other'
  approved   boolean default true,
  created_at timestamptz default now()
);
alter table trail_links enable row level security;

-- Anyone can read suggested links
create policy "Anyone reads suggested trail links"
  on trail_links for select using (type = 'suggested' and approved = true);

-- Logged-in users can read their own links
create policy "Users read own trail links"
  on trail_links for select using (auth.uid() = user_id);

-- Logged-in users can insert their own links
create policy "Users insert own trail links"
  on trail_links for insert with check (auth.uid() = user_id and type = 'user');

-- Users can delete their own links
create policy "Users delete own trail links"
  on trail_links for delete using (auth.uid() = user_id and type = 'user');

create index if not exists trail_links_trail_id_idx on trail_links(trail_id);
create index if not exists trail_links_type_idx on trail_links(type);

-- ── suspect_match column for trailheads ───────────────────────────────────────
-- Add if not already present (safe to run multiple times)
alter table trailheads add column if not exists suspect_match boolean default false;
alter table trailheads add column if not exists suspect_note  text;
alter table trailheads add column if not exists updated_at    timestamptz default now();

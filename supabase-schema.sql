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

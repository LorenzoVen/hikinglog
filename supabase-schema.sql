-- HikingLog — Supabase Schema
-- Run this in your Supabase project: Dashboard → SQL Editor → New Query

-- Trail reports (visible to all users, submitted by logged-in users)
create table if not exists trail_reports (
  id          uuid primary key default gen_random_uuid(),
  trail_id    text not null,
  user_id     uuid references auth.users(id) on delete cascade,
  username    text,
  visited_on  date not null,
  crowdedness text,
  parking     text,
  water_available text,
  trail_condition text,
  notes       text,
  created_at  timestamptz default now()
);

-- Anyone can read trail reports
alter table trail_reports enable row level security;

create policy "Trail reports are public"
  on trail_reports for select
  using (true);

create policy "Users can insert their own reports"
  on trail_reports for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own reports"
  on trail_reports for update
  using (auth.uid() = user_id);

-- Index for fast lookups by trail
create index if not exists trail_reports_trail_id_idx on trail_reports(trail_id);
create index if not exists trail_reports_visited_on_idx on trail_reports(visited_on desc);

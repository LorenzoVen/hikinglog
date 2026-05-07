-- ══════════════════════════════════════════════════════════════════
-- HikingLog — Trailheads & Transit Stops in Supabase
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ══════════════════════════════════════════════════════════════════
--
-- OVERVIEW
-- ─────────
-- This moves trailhead and transit stop data out of trails.json
-- and into Supabase. Benefits:
--   • You can edit/add trailheads directly in the Supabase Table Editor
--   • Users can submit suggestions (you approve them)
--   • No code deploy needed to add a new trailhead
--   • The website queries Supabase at runtime instead of reading a file
--
-- TABLES
-- ───────
--   trailheads          — the main table (replaces trails.json)
--   trailhead_suggestions — user-submitted trailheads, pending your approval
--
-- ACCESS
-- ───────
--   Anyone can READ approved trailheads (approved = true)
--   Anyone can INSERT a suggestion
--   Only you (service role / admin) can approve, edit, or delete
-- ══════════════════════════════════════════════════════════════════

-- ── Trailheads table ──────────────────────────────────────────────
create table if not exists trailheads (
  id              bigserial primary key,

  -- Identity
  osm_id          text unique,              -- OpenStreetMap node/relation ID
  name            text not null,
  source          text,                     -- 'trailhead-tag' | 'hiking-relation' | 'manual'

  -- Trailhead location
  lat             double precision not null,
  lng             double precision not null,

  -- Nearest transit stop
  station         text,
  line            text,                     -- e.g. 'Hudson Line', 'Babylon Branch'
  operator        text,                     -- e.g. 'Metro-North', 'NJ Transit Bus'
  route_type      text,                     -- 'Rail' | 'Bus' | 'Transit'
  station_lat     double precision,
  station_lng     double precision,

  -- Times
  walk_mi         numeric,
  walk_min        integer,
  transit_min     integer,
  total_min       integer,

  -- Trail metadata (filled in manually or by users)
  difficulty      text,                     -- 'Easy' | 'Moderate' | 'Hard'
  length_mi       numeric,
  elev_ft         integer,
  description     text,
  tips            text,
  alltrails_url   text,
  seasonal        boolean default false,
  season_note     text,

  -- Admin
  approved        boolean default false,    -- only approved=true shows on the website
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Only approved trailheads are visible to website users
alter table trailheads enable row level security;

create policy "Public can read approved trailheads"
  on trailheads for select
  using (approved = true);

-- No insert/update from the browser — only via Supabase dashboard or service role
-- (this means regular users cannot modify trailheads)

-- Indexes for fast querying
create index if not exists trailheads_approved_idx on trailheads(approved);
create index if not exists trailheads_operator_idx on trailheads(operator);
create index if not exists trailheads_total_min_idx on trailheads(total_min);
create index if not exists trailheads_lat_lng_idx on trailheads(lat, lng);

-- ── Trailhead suggestions (user-submitted) ────────────────────────
create table if not exists trailhead_suggestions (
  id              uuid primary key default gen_random_uuid(),
  submitted_by    uuid references auth.users(id) on delete set null,
  username        text,

  -- What they're suggesting
  name            text not null,
  lat             double precision,
  lng             double precision,
  station         text,
  operator        text,
  notes           text,                     -- anything else they want to say
  alltrails_url   text,

  -- Admin workflow
  status          text default 'pending',  -- 'pending' | 'approved' | 'rejected'
  admin_notes     text,
  reviewed_at     timestamptz,
  created_at      timestamptz default now()
);

alter table trailhead_suggestions enable row level security;

-- Anyone can submit a suggestion
create policy "Logged-in users can submit suggestions"
  on trailhead_suggestions for insert
  with check (auth.uid() = submitted_by);

-- Users can see their own suggestions
create policy "Users see their own suggestions"
  on trailhead_suggestions for select
  using (auth.uid() = submitted_by);

-- ══════════════════════════════════════════════════════════════════
-- HOW TO IMPORT YOUR DISCOVERED TRAILHEADS
-- ══════════════════════════════════════════════════════════════════
--
-- After running: node build-trailheads.mjs
-- A file is created at: data/supabase-import.json
--
-- OPTION A — Supabase Table Editor (easiest, no SQL):
--   1. Go to Supabase Dashboard → Table Editor → trailheads
--   2. Click the arrow next to "Insert" → "Import data from CSV/JSON"
--   3. Select data/supabase-import.json
--   4. Map columns (they match exactly)
--   5. Click Import
--   6. Trailheads are imported with approved=false
--   7. In the Table Editor, filter by approved=false
--   8. Select the ones you want live, click Edit → set approved=true
--
-- OPTION B — SQL import:
--   The supabase-import.json can also be loaded via:
--   Dashboard → SQL Editor → paste the INSERT statements
--   (use a JSON→SQL converter if needed)
--
-- ══════════════════════════════════════════════════════════════════
-- HOW TO EDIT TRAILHEADS AFTER IMPORT
-- ══════════════════════════════════════════════════════════════════
--
-- Go to Supabase Dashboard → Table Editor → trailheads
-- You'll see a spreadsheet-like view of all trailheads.
-- You can:
--   • Fix coordinates: click the lat/lng cell, type new value, press Enter
--   • Add description/tips: click the cell, type, Enter
--   • Approve/unapprove: click the approved cell, toggle
--   • Add a new trailhead manually: click "+ Insert row"
--   • Delete a trailhead: select the row, click Delete
--
-- Changes take effect on the website within seconds (no redeploy needed).
--
-- ══════════════════════════════════════════════════════════════════
-- HOW TO REVIEW USER SUGGESTIONS
-- ══════════════════════════════════════════════════════════════════
--
-- Go to Table Editor → trailhead_suggestions
-- Filter by status = 'pending'
-- For each suggestion:
--   1. Check the name, coordinates, and notes
--   2. If valid: copy the details, create a new row in trailheads
--      with approved=true
--   3. Update the suggestion: set status='approved' or 'rejected'
--      and add admin_notes if useful
-- ══════════════════════════════════════════════════════════════════

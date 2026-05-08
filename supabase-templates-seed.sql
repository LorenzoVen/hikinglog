-- ══════════════════════════════════════════════════════════════════
-- HikingLog — Default Checklist Templates
-- Run ONCE in Supabase SQL Editor after supabase-schema.sql
-- ══════════════════════════════════════════════════════════════════

-- Insert default templates (is_default = true, no created_by)
insert into checklist_templates (name, description, is_default) values
  ('Summer Day Hike',  'Warm weather, full day, moderate terrain',  true),
  ('Winter Hike',      'Cold weather, snow/ice conditions expected', true),
  ('Rock Scramble',    'Technical terrain, hands-on climbing',       true),
  ('Easy Trail Walk',  'Short, flat, beginner-friendly',             true)
on conflict do nothing;

-- Helper to get template id by name
-- Summer Day Hike items
with t as (select id from checklist_templates where name = 'Summer Day Hike' and is_default = true limit 1)
insert into checklist_template_items (template_id, category, description) select t.id, v.cat, v.desc from t,
(values
  ('Clothing',       'Extra Socks'),
  ('Clothing',       'T-shirt'),
  ('Clothing',       'Hat'),
  ('Clothing',       'Sunglasses'),
  ('Clothing',       'Hiking pants/shorts'),
  ('Food&Water',     'Water'),
  ('Food&Water',     'Snacks'),
  ('Food&Water',     'Lunch'),
  ('Food&Water',     'Protein Bar'),
  ('Food&Water',     'Electrolytes'),
  ('Gear',           'Backpack'),
  ('Gear',           'Trekking Poles'),
  ('Navigation',     'Map'),
  ('Safety',         'Sunscreen'),
  ('Safety',         'Bug Spray'),
  ('Safety',         'First-Aid Kit'),
  ('Safety',         'Power Bank'),
  ('Personal Items', 'ID'),
  ('Personal Items', 'Cash')
) as v(cat, desc) on conflict do nothing;

-- Winter Hike items
with t as (select id from checklist_templates where name = 'Winter Hike' and is_default = true limit 1)
insert into checklist_template_items (template_id, category, description) select t.id, v.cat, v.desc from t,
(values
  ('Clothing',       'Extra Socks'),
  ('Clothing',       'Gloves'),
  ('Clothing',       'Hat'),
  ('Clothing',       'Neck gaiter'),
  ('Clothing',       'Quick-dry layer'),
  ('Clothing',       'Rain cover'),
  ('Food&Water',     'Water'),
  ('Food&Water',     'Hot Drink'),
  ('Food&Water',     'Snacks'),
  ('Food&Water',     'Lunch'),
  ('Gear',           'Backpack'),
  ('Gear',           'Crampons'),
  ('Gear',           'Trekking Poles'),
  ('Gear',           'Headlamp'),
  ('Navigation',     'Map'),
  ('Safety',         'First-Aid Kit'),
  ('Safety',         'Power Bank'),
  ('Safety',         'Emergency blanket'),
  ('Safety',         'Lighter/Matches'),
  ('Safety',         'Whistle')
) as v(cat, desc) on conflict do nothing;

-- Rock Scramble items
with t as (select id from checklist_templates where name = 'Rock Scramble' and is_default = true limit 1)
insert into checklist_template_items (template_id, category, description) select t.id, v.cat, v.desc from t,
(values
  ('Clothing',       'Extra Socks'),
  ('Clothing',       'T-shirt'),
  ('Clothing',       'Gloves'),
  ('Clothing',       'Hat'),
  ('Clothing',       'Quick-dry layer'),
  ('Food&Water',     'Water'),
  ('Food&Water',     'Snacks'),
  ('Food&Water',     'Lunch'),
  ('Gear',           'Backpack'),
  ('Gear',           'Trekking Poles'),
  ('Gear',           'Headlamp'),
  ('Navigation',     'Map'),
  ('Navigation',     'Compass'),
  ('Safety',         'Sunscreen'),
  ('Safety',         'First-Aid Kit'),
  ('Safety',         'Whistle'),
  ('Safety',         'Power Bank'),
  ('Personal Items', 'ID')
) as v(cat, desc) on conflict do nothing;

-- Easy Trail Walk items
with t as (select id from checklist_templates where name = 'Easy Trail Walk' and is_default = true limit 1)
insert into checklist_template_items (template_id, category, description) select t.id, v.cat, v.desc from t,
(values
  ('Clothing',       'Extra Socks'),
  ('Clothing',       'T-shirt'),
  ('Clothing',       'Hat'),
  ('Clothing',       'Sunglasses'),
  ('Food&Water',     'Water'),
  ('Food&Water',     'Snacks'),
  ('Gear',           'Backpack'),
  ('Navigation',     'Map'),
  ('Safety',         'Sunscreen'),
  ('Safety',         'First-Aid Kit'),
  ('Personal Items', 'ID'),
  ('Personal Items', 'Cash')
) as v(cat, desc) on conflict do nothing;

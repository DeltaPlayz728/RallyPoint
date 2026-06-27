-- ============================================================
-- One-off: seed a bot-hosted event in Cypress, TX and Nashville, TN
-- so playtesters there don't open the app to an empty map.
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor).
-- Safe to run once — re-running will create duplicate events.
-- ============================================================

-- Cypress, TX — ZunZun Coffee Roaster, 12716 Telge Rd, Cypress, TX 77429
with ins as (
  insert into events (
    created_by, title, description, type, location, city,
    starts_at, max_attendees, price, lat, lng,
    venue_name, venue_address, status, is_suggested, suggested_by
  )
  select
    p.id,
    'Casual coffee meetup at ZunZun Coffee Roaster',
    'A low-key coffee hangout — come meet a few people and see who else is around.',
    'casual',
    'Cypress',
    'Cypress',
    (date_trunc('week', now()) + interval '5 days' + interval '19 hours'), -- next Saturday 7pm
    8,
    0,
    29.9614,
    -95.6918,
    'ZunZun Coffee Roaster',
    '12716 Telge Rd, Cypress, TX 77429',
    'active',
    true,
    p.id
  from profiles p where p.is_bot = true
  returning id
)
insert into event_chats (event_id)
select id from ins;

-- Nashville, TN — Crema Coffee Roasters, 15 Hermitage Ave, Nashville, TN 37210
with ins as (
  insert into events (
    created_by, title, description, type, location, city,
    starts_at, max_attendees, price, lat, lng,
    venue_name, venue_address, status, is_suggested, suggested_by
  )
  select
    p.id,
    'Casual coffee meetup at Crema Coffee Roasters',
    'A low-key coffee hangout — come meet a few people and see who else is around.',
    'casual',
    'Nashville',
    'Nashville',
    (date_trunc('week', now()) + interval '5 days' + interval '19 hours'), -- next Saturday 7pm
    8,
    0,
    36.1581,
    -86.7714,
    'Crema Coffee Roasters',
    '15 Hermitage Ave, Nashville, TN 37210',
    'active',
    true,
    p.id
  from profiles p where p.is_bot = true
  returning id
)
insert into event_chats (event_id)
select id from ins;

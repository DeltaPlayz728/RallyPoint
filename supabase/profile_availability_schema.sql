-- Profile Availability Layer (Phase 6)
-- Adds social battery, weekly availability, and preferred time to profiles

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS social_battery   text    DEFAULT 'full'
    CHECK (social_battery IN ('full', 'medium', 'low')),
  ADD COLUMN IF NOT EXISTS available_this_week boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS preferred_time   text    DEFAULT 'any'
    CHECK (preferred_time IN ('morning', 'afternoon', 'evening', 'any'));

-- Expose these fields through existing RLS — no new policies needed
-- (profiles table already has SELECT/UPDATE policies for authenticated users)

-- Age Gating Schema
-- Adds date_of_birth and is_minor to profiles
-- Run in Supabase SQL Editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS is_minor boolean DEFAULT false NOT NULL;

-- Index for fast minor queries
CREATE INDEX IF NOT EXISTS profiles_is_minor_idx ON profiles(is_minor);

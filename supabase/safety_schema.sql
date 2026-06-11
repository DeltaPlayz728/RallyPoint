-- ============================================================
-- RallyPoint — Safety Schema
-- Run in Supabase SQL Editor
-- ============================================================

-- ── reports ──────────────────────────────────────────────────
create table if not exists reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('user', 'event', 'message')),
  target_id   uuid not null,
  reason      text not null,
  details     text,
  status      text not null default 'pending' check (status in ('pending', 'reviewed', 'actioned', 'dismissed')),
  created_at  timestamptz default now()
);

alter table reports enable row level security;

create policy "reports_insert" on reports
  for insert with check (auth.uid() = reporter_id);

-- Only admins/service role can read reports (no user-facing policy)


-- ── blocks ───────────────────────────────────────────────────
create table if not exists blocks (
  id         uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (blocker_id, blocked_id)
);

alter table blocks enable row level security;

create policy "blocks_select" on blocks
  for select using (auth.uid() = blocker_id);

create policy "blocks_insert" on blocks
  for insert with check (auth.uid() = blocker_id);

create policy "blocks_delete" on blocks
  for delete using (auth.uid() = blocker_id);


-- ── user_suspensions ─────────────────────────────────────────
create table if not exists user_suspensions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  reason      text,
  suspended_at timestamptz default now(),
  lifted_at   timestamptz,
  unique (user_id)
);

alter table user_suspensions enable row level security;
-- Only service role manages suspensions — no user-facing policies


-- ── Auto-suspend trigger: 3 reports = suspended ──────────────
create or replace function auto_suspend_on_reports()
returns trigger as $$
declare
  report_count int;
begin
  -- Only count reports against users, not events/messages
  if NEW.target_type != 'user' then
    return NEW;
  end if;

  select count(*) into report_count
  from reports
  where target_type = 'user'
    and target_id = NEW.target_id
    and status = 'pending';

  if report_count >= 3 then
    insert into user_suspensions (user_id, reason)
    values (NEW.target_id, 'Auto-suspended: 3 or more user reports')
    on conflict (user_id) do nothing;
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_auto_suspend on reports;
create trigger trg_auto_suspend
  after insert on reports
  for each row execute function auto_suspend_on_reports();

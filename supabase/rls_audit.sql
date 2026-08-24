-- ============================================================
-- RLS AUDIT & REMEDIATION SCRIPT
-- Prompt Manager — run in Supabase Dashboard → SQL Editor
--
-- PART 1: DIAGNOSTIC — run these SELECT queries first to see
--         what policies are currently active on each table.
-- PART 2: REMEDIATION — idempotent fixes for every gap found
--         during the security audit. Safe to run on a live DB
--         (uses DROP IF EXISTS + CREATE, no data loss).
-- ============================================================


-- ============================================================
-- PART 1 — DIAGNOSTIC QUERIES
-- ============================================================

-- 1A. Which tables have RLS enabled?
select
  schemaname,
  tablename,
  rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public'
order by tablename;

-- 1B. All active RLS policies (name, table, command, roles)
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd        as command,
  qual       as using_expr,
  with_check as check_expr
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;

-- 1C. Are all 6 core tables RLS-enabled?
--     Expected: all rows show rls_enabled = true
select tablename, rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles','catalog','prompts','favorites','usage_events','publish_requests')
order by tablename;

-- 1D. Does publish_requests table exist?
select exists (
  select 1 from information_schema.tables
  where table_schema = 'public'
    and table_name = 'publish_requests'
) as publish_requests_exists;

-- 1E. Does is_private column exist on prompts?
select exists (
  select 1 from information_schema.columns
  where table_schema = 'public'
    and table_name   = 'prompts'
    and column_name  = 'is_private'
) as is_private_column_exists;

-- 1F. Does sessions table exist?
select exists (
  select 1 from information_schema.tables
  where table_schema = 'public'
    and table_name = 'sessions'
) as sessions_table_exists;

-- 1G. Quick policy count per table (0 = unprotected)
select tablename, count(*) as policy_count
from pg_policies
where schemaname = 'public'
group by tablename
order by tablename;


-- ============================================================
-- PART 2 — REMEDIATION
-- Run section-by-section after reviewing Part 1 results.
-- Each block is idempotent (safe to re-run).
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 2A. prompts: add is_private column (if migration not run yet)
-- ────────────────────────────────────────────────────────────
alter table public.prompts
  add column if not exists is_private boolean not null default true;


-- ────────────────────────────────────────────────────────────
-- 2B. prompts: replace all policies with complete, correct set
--
-- Audit findings addressed:
--   CRITICAL-B  getAllPrompts returns others' private drafts
--   CRITICAL-A  any user can DELETE any prompt
--   HIGH        viewer can self-promote status to 'published'
-- ────────────────────────────────────────────────────────────

-- Drop outdated policies
drop policy if exists "prompts: read"   on public.prompts;
drop policy if exists "prompts: insert" on public.prompts;
drop policy if exists "prompts: update" on public.prompts;
drop policy if exists "prompts: delete" on public.prompts;

-- SELECT: own drafts always visible; public prompts visible to all;
--         admins/editors see everything (including private drafts)
create policy "prompts: select"
  on public.prompts for select
  using (
    owner_id = auth.uid()                                          -- always see own
    or is_private = false                                          -- public prompts visible to all
    or exists (                                                    -- admins/editors see all
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'editor')
    )
  );

-- INSERT: authenticated users only; owner_id must match caller;
--         viewers restricted to draft + is_private=true
create policy "prompts: insert"
  on public.prompts for insert
  with check (
    auth.uid() = owner_id
    and (
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role in ('admin', 'editor')
      )
      -- viewers may only insert private drafts
      or (status = 'draft' and is_private = true)
    )
  );

-- UPDATE: owner or admin can update; viewers cannot set status='published'
--         or flip is_private=false (must go through publish request workflow)
create policy "prompts: update"
  on public.prompts for update
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    -- admins: unrestricted
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
    -- editors: can publish and set public
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'editor'
    )
    -- viewers/owners: can save own drafts (any is_private value) but cannot publish
    or (status = 'draft' and owner_id = auth.uid())
  );

-- DELETE: owner deletes their own; admin deletes any
create policy "prompts: delete"
  on public.prompts for delete
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );


-- ────────────────────────────────────────────────────────────
-- 2C. catalog: tighten to admin-only write
--
-- Audit finding CRITICAL-D: any editor could overwrite
-- visibility/kpi rules. Lock catalog writes to admin only.
-- ────────────────────────────────────────────────────────────

drop policy if exists "catalog: editor write" on public.catalog;

create policy "catalog: admin write"
  on public.catalog for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );


-- ────────────────────────────────────────────────────────────
-- 2D. favorites: already correct — verify and leave
-- ────────────────────────────────────────────────────────────
-- Existing policy "favorites: own only" covers SELECT/INSERT/DELETE
-- for own rows. Nothing to change. Included here for completeness.
-- The diagnostic query in 1B will confirm it.


-- ────────────────────────────────────────────────────────────
-- 2E. publish_requests: create table + RLS (if not done yet)
--
-- Audit finding CRITICAL-C: reviewPublishRequest() had no
-- backend permission check.
-- ────────────────────────────────────────────────────────────

create table if not exists public.publish_requests (
  id           uuid primary key default uuid_generate_v4(),
  prompt_id    uuid not null references public.prompts(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'pending'
                 check (status in ('pending', 'approved', 'rejected')),
  reviewed_by  uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (prompt_id, requester_id)
);
alter table public.publish_requests enable row level security;

drop policy if exists "publish_requests: read"          on public.publish_requests;
drop policy if exists "publish_requests: viewer insert"  on public.publish_requests;
drop policy if exists "publish_requests: owner delete"   on public.publish_requests;
drop policy if exists "publish_requests: editor update"  on public.publish_requests;

-- SELECT: requester sees own; admins/editors see all
create policy "publish_requests: read"
  on public.publish_requests for select
  using (
    auth.uid() = requester_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'editor')
    )
  );

-- INSERT: any authenticated user can submit a request for their own prompt
create policy "publish_requests: insert"
  on public.publish_requests for insert
  with check (
    auth.uid() = requester_id
    and exists (
      select 1 from public.prompts pr
      where pr.id = prompt_id and pr.owner_id = auth.uid()
    )
  );

-- DELETE: requester can cancel own pending request; admins can delete any
create policy "publish_requests: delete"
  on public.publish_requests for delete
  using (
    (auth.uid() = requester_id and status = 'pending')
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- UPDATE: only admins/editors can approve or reject
create policy "publish_requests: review"
  on public.publish_requests for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'editor')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'editor')
    )
    -- must be transitioning from pending only
    and (select status from public.publish_requests where id = publish_requests.id) = 'pending'
  );

-- Updated_at trigger for publish_requests
drop trigger if exists set_publish_requests_updated_at on public.publish_requests;
create trigger set_publish_requests_updated_at
  before update on public.publish_requests
  for each row execute function public.set_updated_at();

-- Add to realtime
alter publication supabase_realtime add table public.publish_requests;


-- ────────────────────────────────────────────────────────────
-- 2F. sessions: create table + RLS (if not done yet)
--     Used by AuthContext for session duration tracking.
-- ────────────────────────────────────────────────────────────

create table if not exists public.sessions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  duration_s  integer
);
alter table public.sessions enable row level security;

drop policy if exists "sessions: own"       on public.sessions;
drop policy if exists "sessions: admin read" on public.sessions;

-- Users can insert/update/select their own rows only
create policy "sessions: own"
  on public.sessions for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Admins can read all (for usage analytics)
create policy "sessions: admin read"
  on public.sessions for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );


-- ────────────────────────────────────────────────────────────
-- 2G. profiles: tighten — block self-role escalation
--
-- The existing "profiles: self update" policy allows users to
-- update their own row, including the `role` column.
-- A user could promote themselves from viewer → admin.
-- ────────────────────────────────────────────────────────────

drop policy if exists "profiles: self update" on public.profiles;

-- Users can update only display_name on their own row (not role/pin_hash)
create policy "profiles: self update display_name"
  on public.profiles for update
  using  (auth.uid() = id)
  with check (
    auth.uid() = id
    -- role and pin_hash must remain unchanged
    and role = (select role from public.profiles where id = auth.uid())
    and (pin_hash is not distinct from (select pin_hash from public.profiles where id = auth.uid()))
  );


-- ────────────────────────────────────────────────────────────
-- 2H. Final verification — re-run after applying all blocks
-- ────────────────────────────────────────────────────────────

-- All tables should show rls_enabled = true
select tablename, rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public'
  and tablename in (
    'profiles', 'catalog', 'prompts',
    'favorites', 'usage_events',
    'publish_requests', 'sessions'
  )
order by tablename;

-- All policies should be listed
select tablename, policyname, cmd as command, permissive
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;

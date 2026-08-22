-- ============================================================
-- Prompt Manager — Supabase Schema + RLS
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Roles enum ───────────────────────────────────────────────
create type user_role as enum ('admin', 'editor', 'viewer');

-- ── Profiles ─────────────────────────────────────────────────
-- One row per auth.users entry, created automatically on signup.
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  display_name text,
  role        user_role not null default 'viewer',
  pin_hash    text,                        -- SHA-256 hex of admin PIN (admin only)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Anyone can read all profiles (needed to show owner names on prompts)
create policy "profiles: read all"
  on public.profiles for select using (true);

-- User can update their own display_name; admin can update anything
create policy "profiles: self update"
  on public.profiles for update
  using (auth.uid() = id or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

-- Only admins can change roles
create policy "profiles: admin full"
  on public.profiles for all
  using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    -- First user ever becomes admin automatically
    case when (select count(*) from public.profiles) = 0 then 'admin'::user_role else 'viewer'::user_role end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Catalog ───────────────────────────────────────────────────
-- Single shared row for the whole team.
create table public.catalog (
  id           uuid primary key default uuid_generate_v4(),
  solutions    text[] not null default '{}',
  story_flows  text[] not null default '{}',
  categories   text[] not null default '{}',
  personas     text[] not null default '{}',
  tags         text[] not null default '{}',
  systems      jsonb  not null default '[]',
  updated_at   timestamptz not null default now(),
  updated_by   uuid references public.profiles(id)
);
alter table public.catalog enable row level security;

-- Everyone can read
create policy "catalog: read all" on public.catalog for select using (true);
-- Only admins and editors can write
create policy "catalog: editor write"
  on public.catalog for all
  using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','editor')
  ))
  with check (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','editor')
  ));

-- Seed one catalog row
insert into public.catalog (id) values ('00000000-0000-0000-0000-000000000001')
  on conflict do nothing;

-- ── Prompts ───────────────────────────────────────────────────
create table public.prompts (
  id            uuid primary key default uuid_generate_v4(),
  owner_id      uuid not null references public.profiles(id),
  title         text not null,
  body          text not null default '',
  body_fr       text,
  prompt_items  jsonb not null default '[]',
  category      text,
  story_flow    text,
  solutions     text[] not null default '{}',
  personas      text[] not null default '{}',
  tags          text[] not null default '{}',
  notes         text,
  status        text check (status in ('draft','published')),
  is_favorite   boolean not null default false,
  usage_count   integer not null default 0,
  last_used_at  timestamptz,
  demo_links    jsonb not null default '[]',
  systems       jsonb not null default '[]',
  attachments   jsonb not null default '[]',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.prompts enable row level security;

-- Read: published prompts visible to all; drafts only to owner or admin
create policy "prompts: read"
  on public.prompts for select
  using (
    status = 'published'
    or owner_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Any authenticated user can insert their own prompt; viewers restricted to draft status
create policy "prompts: insert"
  on public.prompts for insert
  with check (
    auth.uid() = owner_id and
    (
      -- editors/admins can set any status
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','editor'))
      -- viewers can only insert drafts
      or (status = 'draft' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'viewer'))
    )
  );

-- Owner can update their own; admin can update any; viewers can only update drafts they own (cannot publish)
create policy "prompts: update"
  on public.prompts for update
  using (
    owner_id = auth.uid() or
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    -- editors/admins: unrestricted
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','editor'))
    -- viewers: can only save as draft
    or (status = 'draft' and owner_id = auth.uid())
  );

-- Owner can delete their own drafts; admin can delete any
create policy "prompts: delete"
  on public.prompts for delete
  using (
    owner_id = auth.uid() or
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ── Favorites ─────────────────────────────────────────────────
-- Per-user favorites (don't pollute the shared prompt row)
create table public.favorites (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  prompt_id  uuid not null references public.prompts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, prompt_id)
);
alter table public.favorites enable row level security;

create policy "favorites: own only"
  on public.favorites for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Usage events ──────────────────────────────────────────────
create table public.usage_events (
  id         uuid primary key default uuid_generate_v4(),
  prompt_id  uuid not null references public.prompts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  copied_at  timestamptz not null default now()
);
alter table public.usage_events enable row level security;

-- Anyone can insert their own usage
create policy "usage: insert own"
  on public.usage_events for insert
  with check (auth.uid() = user_id);

-- Users see own; admins see all
create policy "usage: read"
  on public.usage_events for select
  using (
    auth.uid() = user_id or
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Increment usage_count on prompts when usage event inserted
create or replace function public.handle_usage_event()
returns trigger language plpgsql security definer as $$
begin
  update public.prompts
  set usage_count = usage_count + 1,
      last_used_at = new.copied_at
  where id = new.prompt_id;
  return new;
end;
$$;

create trigger on_usage_event
  after insert on public.usage_events
  for each row execute procedure public.handle_usage_event();

-- ── Attachments storage bucket ────────────────────────────────
-- Run separately in Storage → Buckets
-- insert into storage.buckets (id, name, public) values ('attachments', 'attachments', false);

-- ── Helper: get my role ───────────────────────────────────────
create or replace function public.my_role()
returns user_role language sql security definer stable as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ── Updated_at triggers ───────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger set_prompts_updated_at
  before update on public.prompts
  for each row execute procedure public.set_updated_at();

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

create trigger set_catalog_updated_at
  before update on public.catalog
  for each row execute procedure public.set_updated_at();

-- ── Realtime ─────────────────────────────────────────────────
-- Enable realtime for prompts and catalog
alter publication supabase_realtime add table public.prompts;
alter publication supabase_realtime add table public.catalog;

-- ── Privacy flag migration (run in Supabase SQL Editor) ───────
-- Step A: add is_private column + update policies
/*
alter table public.prompts add column if not exists is_private boolean not null default true;

drop policy if exists "prompts: read" on public.prompts;
create policy "prompts: read"
  on public.prompts for select
  using (
    status = 'published'
    or owner_id = auth.uid()
    or (status = 'draft' and is_private = false
        and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','editor')))
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "prompts: update" on public.prompts;
create policy "prompts: update"
  on public.prompts for update
  using (owner_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','editor'))
    or (status = 'draft' and is_private = true and owner_id = auth.uid())
  );
*/

-- ── Publish requests (run in Supabase SQL Editor) ─────────────
-- Step B: create publish_requests table + RLS
/*
create table if not exists public.publish_requests (
  id           uuid primary key default uuid_generate_v4(),
  prompt_id    uuid not null references public.prompts(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by  uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (prompt_id, requester_id)
);
alter table public.publish_requests enable row level security;

create policy "publish_requests: read"
  on public.publish_requests for select
  using (auth.uid() = requester_id or
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','editor')));

create policy "publish_requests: viewer insert"
  on public.publish_requests for insert
  with check (auth.uid() = requester_id);

create policy "publish_requests: editor update"
  on public.publish_requests for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','editor')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','editor')));

create trigger set_publish_requests_updated_at
  before update on public.publish_requests
  for each row execute function public.set_updated_at();
*/

-- ============================================================
-- Prompt Manager — Supabase Schema + RLS
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- Last updated: 2026-08-22 (post security audit)
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Roles enum ───────────────────────────────────────────────
create type user_role as enum ('admin', 'editor', 'viewer', 'blocked');

-- ── Profiles ─────────────────────────────────────────────────
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  email          text not null,
  display_name   text,
  role           user_role not null default 'viewer',
  pin_hash       text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Anyone can read profiles (needed to show owner names)
create policy "profiles: read all"
  on public.profiles for select using (true);

-- Users can update only their own display_name — role/pin_hash locked
create policy "profiles: self update display_name"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role     = (select role     from public.profiles where id = auth.uid())
    and (pin_hash is not distinct from (select pin_hash from public.profiles where id = auth.uid()))
  );

-- Admins can do anything on profiles
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
    case when (select count(*) from public.profiles) = 0
         then 'admin'::user_role
         else 'viewer'::user_role end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Catalog ───────────────────────────────────────────────────
create table public.catalog (
  id               uuid primary key default uuid_generate_v4(),
  solutions        text[] not null default '{}',
  story_flows      text[] not null default '{}',
  categories       text[] not null default '{}',
  personas         text[] not null default '{}',
  tags             text[] not null default '{}',
  systems          jsonb  not null default '[]',
  visibility_rules jsonb  default null,
  kpi_rules        jsonb  default null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references public.profiles(id)
);
alter table public.catalog enable row level security;

-- Everyone can read
create policy "catalog: read all"
  on public.catalog for select using (true);

-- Only admins can write (visibility/kpi rules are sensitive config)
create policy "catalog: admin write"
  on public.catalog for all
  using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

-- Seed one catalog row
insert into public.catalog (id) values ('00000000-0000-0000-0000-000000000001')
  on conflict do nothing;

-- ── Prompts ───────────────────────────────────────────────────
create table public.prompts (
  id           uuid primary key default uuid_generate_v4(),
  owner_id     uuid not null references public.profiles(id),
  title        text not null,
  body         text not null default '',
  body_fr      text,
  prompt_items jsonb not null default '[]',
  category     text,
  story_flow   text,
  solutions    text[] not null default '{}',
  personas     text[] not null default '{}',
  tags         text[] not null default '{}',
  notes        text,
  status       text check (status in ('draft', 'published')),
  is_private   boolean not null default true,
  is_favorite  boolean not null default false,
  usage_count  integer not null default 0,
  last_used_at timestamptz,
  demo_links   jsonb not null default '[]',
  systems      jsonb not null default '[]',
  attachments  jsonb not null default '[]',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.prompts enable row level security;

-- SELECT: own prompts always visible; public (is_private=false) visible to all;
--         admins/editors see everything
create policy "prompts: select"
  on public.prompts for select
  using (
    owner_id = auth.uid()
    or is_private = false
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'editor')
    )
  );

-- INSERT: owner_id must match caller; viewers may only insert private drafts
create policy "prompts: insert"
  on public.prompts for insert
  with check (
    auth.uid() = owner_id
    and (
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role in ('admin', 'editor')
      )
      or (status = 'draft' and is_private = true)
    )
  );

-- UPDATE: owner or admin can update; viewers cannot publish or make public
create policy "prompts: update"
  on public.prompts for update
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
    )
    or exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.role = 'editor'
    )
    or (status = 'draft' and is_private = true and owner_id = auth.uid())
  );

-- DELETE: owner deletes own; admin deletes any
create policy "prompts: delete"
  on public.prompts for delete
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ── Favorites ─────────────────────────────────────────────────
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
  id        uuid primary key default uuid_generate_v4(),
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  copied_at timestamptz not null default now()
);
alter table public.usage_events enable row level security;

create policy "usage: insert own"
  on public.usage_events for insert
  with check (auth.uid() = user_id);

create policy "usage: read"
  on public.usage_events for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Increment usage_count on prompts when usage event inserted
create or replace function public.handle_usage_event()
returns trigger language plpgsql security definer as $$
begin
  update public.prompts
  set usage_count  = usage_count + 1,
      last_used_at = new.copied_at
  where id = new.prompt_id;
  return new;
end;
$$;

create trigger on_usage_event
  after insert on public.usage_events
  for each row execute procedure public.handle_usage_event();

-- ── Publish requests ──────────────────────────────────────────
create table public.publish_requests (
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

-- Requester sees own; admins/editors see all
create policy "publish_requests: read"
  on public.publish_requests for select
  using (
    auth.uid() = requester_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'editor')
    )
  );

-- Any user can submit a request only for a prompt they own
create policy "publish_requests: insert"
  on public.publish_requests for insert
  with check (
    auth.uid() = requester_id
    and exists (
      select 1 from public.prompts pr
      where pr.id = prompt_id and pr.owner_id = auth.uid()
    )
  );

-- Requester can cancel own pending request; admin can delete any
create policy "publish_requests: delete"
  on public.publish_requests for delete
  using (
    (auth.uid() = requester_id and status = 'pending')
    or exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Only admins/editors can approve or reject; only from pending state
create policy "publish_requests: review"
  on public.publish_requests for update
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'editor')
  ))
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'editor')
    )
    and (select status from public.publish_requests where id = publish_requests.id) = 'pending'
  );

create trigger set_publish_requests_updated_at
  before update on public.publish_requests
  for each row execute function public.set_updated_at();

-- ── Sessions ──────────────────────────────────────────────────
create table public.sessions (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at   timestamptz,
  duration_s integer
);
alter table public.sessions enable row level security;

-- Users access only their own rows
create policy "sessions: own"
  on public.sessions for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Admins can read all (usage analytics)
create policy "sessions: admin read"
  on public.sessions for select
  using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

-- ── Helper functions ──────────────────────────────────────────
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
alter publication supabase_realtime add table public.prompts;
alter publication supabase_realtime add table public.catalog;
alter publication supabase_realtime add table public.publish_requests;

-- ── Attachments storage bucket ────────────────────────────────
-- Run separately in Storage → Buckets:
-- insert into storage.buckets (id, name, public) values ('attachments', 'attachments', false);

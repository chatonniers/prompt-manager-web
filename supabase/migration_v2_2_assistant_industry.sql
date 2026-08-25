-- Migration v2.2: AI Assistant + Industry dimensions
-- Run this in Supabase SQL Editor

-- Add assistant and industry to prompts
alter table public.prompts
  add column if not exists assistant text default null,
  add column if not exists industry  text default null;

-- Add assistants and industries to catalog
alter table public.catalog
  add column if not exists assistants jsonb not null default '[]',
  add column if not exists industries text[] not null default '{}';

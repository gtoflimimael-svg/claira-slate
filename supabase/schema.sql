-- Claira Slate — Supabase schema
-- Run this once in the Supabase SQL editor (Project → SQL Editor → New query).

-- ============================================================
-- users (extends auth.users)
-- ============================================================
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "Users can view their own row"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update their own row"
  on public.users for update
  using (auth.uid() = id);

-- Auto-create a public.users row whenever someone signs up via Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- files
-- ============================================================
create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  filename text not null,
  size bigint not null,
  tool_used text not null,
  r2_key text not null,
  status text not null default 'processing'
    check (status in ('processing', 'ready', 'failed', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 hour')
);

create index if not exists files_user_id_idx on public.files (user_id);
create index if not exists files_expires_at_idx on public.files (expires_at);

alter table public.files enable row level security;

create policy "Users can view their own files"
  on public.files for select
  using (auth.uid() = user_id);

create policy "Users can insert their own files"
  on public.files for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own files"
  on public.files for update
  using (auth.uid() = user_id);

create policy "Users can delete their own files"
  on public.files for delete
  using (auth.uid() = user_id);

-- ============================================================
-- subscriptions
-- ============================================================
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  stripe_customer_id text,
  plan text not null default 'free'
    check (plan in ('free', 'pro', 'business')),
  status text not null default 'active'
    check (status in ('active', 'trialing', 'past_due', 'canceled', 'inactive', 'incomplete')),
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);
create index if not exists subscriptions_stripe_customer_id_idx on public.subscriptions (stripe_customer_id);

-- Re-running this file against a database where `subscriptions` was already
-- created (e.g. with the older 'team' plan value) widens the constraints
-- instead of erroring.
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check
  check (plan in ('free', 'pro', 'business'));

alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check
  check (status in ('active', 'trialing', 'past_due', 'canceled', 'inactive', 'incomplete'));

alter table public.subscriptions enable row level security;

create policy "Users can view their own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Inserts/updates to subscriptions happen from server-side Stripe webhook
-- handlers using the service role key, which bypasses RLS — no write
-- policy is defined for regular users here on purpose.

-- ============================================================
-- ai_usage
-- ============================================================
create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  action_type text not null,
  tokens_used integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_user_id_idx on public.ai_usage (user_id);
create index if not exists ai_usage_created_at_idx on public.ai_usage (created_at);

alter table public.ai_usage enable row level security;

create policy "Users can view their own AI usage"
  on public.ai_usage for select
  using (auth.uid() = user_id);

create policy "Users can insert their own AI usage"
  on public.ai_usage for insert
  with check (auth.uid() = user_id);

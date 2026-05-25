-- ============================================================
-- SmartBear Coach — Supabase Schema
-- Migration: 001_schema.sql
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── USERS PROFILE ────────────────────────────────────────────
-- Extends auth.users with display info & product preference
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  display_name  text,
  selected_product text default 'qmetry' check (selected_product in ('qmetry','reflect')),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── MODULE PROGRESS ──────────────────────────────────────────
-- Tracks each learner's completion state per module per product
create table if not exists public.module_progress (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  product       text not null check (product in ('qmetry','reflect')),
  module_id     text not null,
  completed     boolean default false,
  highest_tier  text default 'basics' check (highest_tier in ('basics','intermediate','advanced')),
  last_viewed   timestamptz default now(),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (user_id, product, module_id)
);

-- ── QUIZ ATTEMPTS ────────────────────────────────────────────
-- Stores every quiz attempt for adaptive logic & analytics
create table if not exists public.quiz_attempts (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  product       text not null check (product in ('qmetry','reflect')),
  module_id     text not null,
  score         int not null,           -- correct answers
  total         int not null,           -- total questions
  pct           int generated always as (case when total > 0 then round(score::numeric/total*100) else 0 end) stored,
  passed        boolean generated always as (case when total > 0 and round(score::numeric/total*100) >= 50 then true else false end) stored,
  attempted_at  timestamptz default now()
);

-- ── CHAT HISTORY ─────────────────────────────────────────────
-- Persists AI coach conversations per user/module
create table if not exists public.chat_history (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  product       text not null check (product in ('qmetry','reflect')),
  module_id     text not null,
  role          text not null check (role in ('user','coach')),
  content       text not null,
  created_at    timestamptz default now()
);

-- ── ADMIN EVENTS LOG ─────────────────────────────────────────
-- Lightweight audit log for admin dashboard
create table if not exists public.events (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references public.profiles(id) on delete set null,
  event_type    text not null,   -- login, module_view, quiz_pass, quiz_fail, chat_msg
  product       text,
  module_id     text,
  meta          jsonb,
  created_at    timestamptz default now()
);

-- ── UPDATED_AT TRIGGERS ──────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_module_progress_updated_at
  before update on public.module_progress
  for each row execute function public.set_updated_at();

-- ── AUTO-CREATE PROFILE ON SIGNUP ────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1))
  );
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── ROW LEVEL SECURITY ───────────────────────────────────────
alter table public.profiles        enable row level security;
alter table public.module_progress enable row level security;
alter table public.quiz_attempts   enable row level security;
alter table public.chat_history    enable row level security;
alter table public.events          enable row level security;

-- profiles: users read/write their own row; admins read all
create policy "profiles_self_rw" on public.profiles
  for all using (auth.uid() = id);

-- module_progress: own rows only
create policy "progress_self_rw" on public.module_progress
  for all using (auth.uid() = user_id);

-- quiz_attempts: own rows only
create policy "quiz_self_rw" on public.quiz_attempts
  for all using (auth.uid() = user_id);

-- chat_history: own rows only
create policy "chat_self_rw" on public.chat_history
  for all using (auth.uid() = user_id);

-- events: insert own; read own (admin reads handled via service role)
create policy "events_self_insert" on public.events
  for insert with check (auth.uid() = user_id);

create policy "events_self_select" on public.events
  for select using (auth.uid() = user_id);

-- ── INDEXES ──────────────────────────────────────────────────
create index if not exists idx_module_progress_user    on public.module_progress(user_id);
create index if not exists idx_quiz_attempts_user      on public.quiz_attempts(user_id);
create index if not exists idx_quiz_attempts_module    on public.quiz_attempts(user_id, product, module_id);
create index if not exists idx_chat_history_user       on public.chat_history(user_id, product, module_id);
create index if not exists idx_events_user             on public.events(user_id);
create index if not exists idx_events_type             on public.events(event_type);
create index if not exists idx_events_created          on public.events(created_at desc);

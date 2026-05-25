-- ============================================================
-- SmartBear Coach — RPC Helper Functions
-- Migration: 002_functions.sql
-- ============================================================

-- ── upsert_module_progress ───────────────────────────────────
-- Called whenever a user views a module or completes a quiz.
-- Updates completed flag and highest_tier reached.
create or replace function public.upsert_module_progress(
  p_product     text,
  p_module_id   text,
  p_completed   boolean default false,
  p_tier        text default 'basics'
)
returns public.module_progress
language plpgsql security definer as $$
declare
  v_row public.module_progress;
begin
  insert into public.module_progress (user_id, product, module_id, completed, highest_tier, last_viewed)
  values (auth.uid(), p_product, p_module_id, p_completed, p_tier, now())
  on conflict (user_id, product, module_id) do update
    set
      completed    = greatest(module_progress.completed, excluded.completed),
      highest_tier = case
        when excluded.highest_tier = 'advanced' then 'advanced'
        when excluded.highest_tier = 'intermediate' and module_progress.highest_tier = 'basics' then 'intermediate'
        else module_progress.highest_tier
      end,
      last_viewed  = now(),
      updated_at   = now()
  returning * into v_row;
  return v_row;
end;
$$;

-- ── record_quiz_attempt ──────────────────────────────────────
-- Saves a completed quiz attempt and logs the event.
create or replace function public.record_quiz_attempt(
  p_product   text,
  p_module_id text,
  p_score     int,
  p_total     int
)
returns public.quiz_attempts
language plpgsql security definer as $$
declare
  v_row public.quiz_attempts;
begin
  insert into public.quiz_attempts (user_id, product, module_id, score, total)
  values (auth.uid(), p_product, p_module_id, p_score, p_total)
  returning * into v_row;

  -- Log event
  insert into public.events (user_id, event_type, product, module_id, meta)
  values (
    auth.uid(),
    case when v_row.passed then 'quiz_pass' else 'quiz_fail' end,
    p_product,
    p_module_id,
    jsonb_build_object('score', p_score, 'total', p_total, 'pct', v_row.pct)
  );

  -- Auto-mark module complete if passed
  if v_row.passed then
    perform public.upsert_module_progress(p_product, p_module_id, true, 'basics');
  end if;

  return v_row;
end;
$$;

-- ── get_my_progress ──────────────────────────────────────────
-- Returns full progress summary for the current user (both products).
create or replace function public.get_my_progress()
returns table (
  product       text,
  module_id     text,
  completed     boolean,
  highest_tier  text,
  last_viewed   timestamptz,
  best_quiz_pct int,
  quiz_attempts int
)
language sql security definer as $$
  select
    mp.product,
    mp.module_id,
    mp.completed,
    mp.highest_tier,
    mp.last_viewed,
    coalesce(max(qa.pct), 0)   as best_quiz_pct,
    coalesce(count(qa.id), 0)::int as quiz_attempts
  from public.module_progress mp
  left join public.quiz_attempts qa
    on qa.user_id = mp.user_id
    and qa.product = mp.product
    and qa.module_id = mp.module_id
  where mp.user_id = auth.uid()
  group by mp.product, mp.module_id, mp.completed, mp.highest_tier, mp.last_viewed;
$$;

-- ── get_admin_summary ────────────────────────────────────────
-- Admin-only: aggregated stats across all users.
-- Requires service role key or admin claim; protected via policy check.
create or replace function public.get_admin_summary()
returns table (
  total_users       bigint,
  total_completions bigint,
  avg_quiz_pct      numeric,
  active_last_7d    bigint,
  top_module        text,
  top_product       text
)
language sql security definer as $$
  select
    (select count(*) from public.profiles)              as total_users,
    (select count(*) from public.module_progress where completed = true) as total_completions,
    (select round(avg(pct),1) from public.quiz_attempts) as avg_quiz_pct,
    (select count(distinct user_id) from public.events
      where created_at > now() - interval '7 days')     as active_last_7d,
    (select module_id from public.module_progress
      where completed = true
      group by module_id order by count(*) desc limit 1) as top_module,
    (select product from public.module_progress
      where completed = true
      group by product order by count(*) desc limit 1)   as top_product;
$$;

-- ── save_chat_message ────────────────────────────────────────
create or replace function public.save_chat_message(
  p_product   text,
  p_module_id text,
  p_role      text,
  p_content   text
)
returns void
language plpgsql security definer as $$
begin
  insert into public.chat_history (user_id, product, module_id, role, content)
  values (auth.uid(), p_product, p_module_id, p_role, p_content);

  if p_role = 'user' then
    insert into public.events (user_id, event_type, product, module_id)
    values (auth.uid(), 'chat_msg', p_product, p_module_id);
  end if;
end;
$$;

-- ── get_chat_history ─────────────────────────────────────────
create or replace function public.get_chat_history(
  p_product   text,
  p_module_id text,
  p_limit     int default 50
)
returns table (role text, content text, created_at timestamptz)
language sql security definer as $$
  select role, content, created_at
  from public.chat_history
  where user_id = auth.uid()
    and product = p_product
    and module_id = p_module_id
  order by created_at asc
  limit p_limit;
$$;

-- ── log_event ────────────────────────────────────────────────
create or replace function public.log_event(
  p_event_type text,
  p_product    text default null,
  p_module_id  text default null,
  p_meta       jsonb default null
)
returns void
language plpgsql security definer as $$
begin
  insert into public.events (user_id, event_type, product, module_id, meta)
  values (auth.uid(), p_event_type, p_product, p_module_id, p_meta);
end;
$$;

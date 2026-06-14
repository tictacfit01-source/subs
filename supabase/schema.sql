-- ============================================================
-- Subs · esquema de la base de datos (ejecutar en el SQL Editor
-- de tu proyecto Supabase nuevo)
-- ============================================================

create table if not exists public.subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  mono        text,
  brand       text default '#6f74f5',
  cat         text not null default 'other',
  amount      numeric(12,2) not null default 0,
  cur         text not null default 'EUR',
  cycle       text not null default 'monthly',
  next_charge date,
  method      text,
  status      text not null default 'active',
  trial_end   date,
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists subscriptions_user_idx on public.subscriptions (user_id);

-- ---- Row Level Security: cada usuario solo ve y edita lo suyo ----
alter table public.subscriptions enable row level security;

drop policy if exists "subs_select_own" on public.subscriptions;
create policy "subs_select_own" on public.subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "subs_insert_own" on public.subscriptions;
create policy "subs_insert_own" on public.subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "subs_update_own" on public.subscriptions;
create policy "subs_update_own" on public.subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "subs_delete_own" on public.subscriptions;
create policy "subs_delete_own" on public.subscriptions
  for delete using (auth.uid() = user_id);

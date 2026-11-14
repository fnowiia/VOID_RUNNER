-- ERROR 404: полная установка и обновление существующей версии.
-- Выполните весь файл в SQL Editor вашего Supabase-проекта.
begin;

-- ERROR 404: Escape the System — схема для нового проекта Supabase.
-- Выполните schema.sql, затем policies.sql; либо один setup.sql.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  created_at timestamptz not null default now(),
  constraint profiles_nickname_length check (char_length(btrim(nickname)) between 2 and 16),
  constraint profiles_nickname_no_controls check (nickname !~ '[[:cntrl:]]')
);

create table if not exists public.level_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  level_id smallint not null check (level_id between 1 and 5),
  best_time_ms integer not null check (best_time_ms >= 0),
  best_errors integer not null check (best_errors >= 0),
  best_stars smallint not null check (best_stars between 1 and 3),
  completed_at timestamptz not null default now(),
  primary key (user_id, level_id)
);

create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level_id smallint not null check (level_id between 1 and 5),
  duration_ms integer not null check (duration_ms >= 0),
  mistakes integer not null check (mistakes >= 0),
  hints_used integer not null constraint runs_hints_used_check check (hints_used between 0 and 6),
  completed_at timestamptz not null default now()
);

-- Обновление уже установленной версии игры: CREATE TABLE IF NOT EXISTS сам по
-- себе не меняет старое CHECK (0..2). Расширяем его до трёх терминалов × 2.
-- Повторное выполнение безопасно; существующие попытки и рекорды сохраняются.
alter table public.runs drop constraint if exists runs_hints_used_check;
alter table public.runs add constraint runs_hints_used_check
  check (hints_used between 0 and 6);

create index if not exists runs_user_completed_idx
  on public.runs(user_id, completed_at desc);

-- Независимые рекорды: лучшее время и ошибки минимальны, звёзды максимальны.
-- Защищает от ухудшения результата запоздавшим запросом другой вкладки.
-- Функция работает с правами вызывающего; обхода RLS здесь нет.
create or replace function public.keep_best_level_progress()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.best_time_ms := least(old.best_time_ms, new.best_time_ms);
  new.best_errors := least(old.best_errors, new.best_errors);
  new.best_stars := greatest(old.best_stars, new.best_stars);
  new.completed_at := least(old.completed_at, new.completed_at);
  return new;
end;
$$;

drop trigger if exists level_progress_keep_best on public.level_progress;
create trigger level_progress_keep_best
before update on public.level_progress
for each row execute function public.keep_best_level_progress();

comment on table public.runs is
  'История попыток. UUID генерируется клиентом один раз для идемпотентной синхронизации. Записи доступны владельцу и не редактируются клиентом.';
comment on table public.level_progress is
  'Рекорды по независимым метрикам; значения могут относиться к разным попыткам.';

comment on column public.runs.hints_used is
  'Общее число подсказок за уровень: 3 терминала × 2 подсказки, от 0 до 6.';

-- Выполняется после schema.sql. Anonymous Sign-Ins получают роль authenticated,
-- а не anon. Посетитель без сессии не получает доступ к таблицам.
alter table public.profiles enable row level security;
alter table public.level_progress enable row level security;
alter table public.runs enable row level security;

revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.level_progress from public, anon, authenticated;
revoke all on table public.runs from public, anon, authenticated;

grant usage on schema public to authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update on table public.level_progress to authenticated;
grant select, insert on table public.runs to authenticated;

revoke all on function public.keep_best_level_progress() from public;
grant execute on function public.keep_best_level_progress() to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists level_progress_select_own on public.level_progress;
create policy level_progress_select_own on public.level_progress
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists level_progress_insert_own on public.level_progress;
create policy level_progress_insert_own on public.level_progress
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists level_progress_update_own on public.level_progress;
create policy level_progress_update_own on public.level_progress
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists runs_select_own on public.runs;
create policy runs_select_own on public.runs
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists runs_insert_own on public.runs;
create policy runs_insert_own on public.runs
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- Нет ни UPDATE/DELETE grant, ни соответствующих политик для runs.
-- ON CONFLICT DO NOTHING позволяет безопасно повторить INSERT с тем же UUID.

commit;

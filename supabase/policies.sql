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

-- ERROR 404 — обновление v1 → три терминала на каждом из пяти уровней.
-- Выполните в Supabase SQL Editor один раз для существующей установки.
-- Можно выполнить повторно. Не удаляет попытки, пользователей или рекорды.
-- Для новой установки вместо этого выполните setup.sql целиком.
begin;

alter table public.runs drop constraint if exists runs_hints_used_check;
alter table public.runs add constraint runs_hints_used_check
  check (hints_used between 0 and 6);

comment on column public.runs.hints_used is
  'Общее число подсказок за уровень: 3 терминала × 2 подсказки, от 0 до 6.';

commit;

-- Проверка после COMMIT:
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.runs'::regclass
  and conname = 'runs_hints_used_check';

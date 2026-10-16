-- Practice types: give each practice a kind + config, and let a check-in carry
-- an optional detail value (minutes, checklist ticks, stretch level, ...).
--
-- Additive and backward compatible: every existing practice becomes kind='check'
-- with an empty config, and every existing check-in keeps detail = NULL, so
-- app builds that know nothing about types (e.g. TestFlight build 10) keep working.
-- No new tables, so purge_user_data (account deletion) needs no change.
-- Existing RLS policies (practices_own, checkins_own) cover the new columns.
-- Applied to production 2026-10-16 (version 20261016172826).

-- 1. practices.kind / practices.config
alter table public.practices
  add column if not exists kind text not null default 'check',
  add column if not exists config jsonb not null default '{}'::jsonb;

alter table public.practices
  add constraint practices_kind_check
    check (kind in ('check','timed','checklist','ritual','stretch','boundary')),
  add constraint practices_config_check
    check (jsonb_typeof(config) = 'object' and octet_length(config::text) <= 8000);

-- 2. checkins.detail (nullable; shape depends on the practice's kind)
alter table public.checkins
  add column if not exists detail jsonb;

alter table public.checkins
  add constraint checkins_detail_check
    check (detail is null or (jsonb_typeof(detail) = 'object' and octet_length(detail::text) <= 4000));

-- 3. checkins.count: was 1..2 (tap, tap again). Allow tallies such as "8 glasses of water".
alter table public.checkins drop constraint if exists checkins_count_check;
alter table public.checkins
  add constraint checkins_count_check check (count >= 1 and count <= 99);

comment on column public.practices.kind is 'check | timed | checklist | ritual | stretch | boundary';
comment on column public.practices.config is 'Per-kind settings (target, minutes/timer, items, steps/anchor/setting/closing, small/cadence, window). Object, <= 8000 bytes.';
comment on column public.checkins.detail is 'Optional per-day value for the practice kind: minutes, checklist ticks, stretch level 0-10, ... Object, <= 4000 bytes.';

-- ROLLBACK (only safe before any app build writes types/tallies > 2):
--   alter table public.checkins drop constraint checkins_detail_check;
--   alter table public.checkins drop column detail;
--   alter table public.practices drop constraint practices_config_check, drop constraint practices_kind_check;
--   alter table public.practices drop column config, drop column kind;
--   alter table public.checkins drop constraint checkins_count_check;
--   alter table public.checkins add constraint checkins_count_check check (count >= 1 and count <= 2);

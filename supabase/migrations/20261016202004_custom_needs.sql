-- Custom needs: the person's own needs, beyond the 13 built-ins.
-- Applied to production 2026-10-16 (version 20261016202004).
--
-- Rollback:
--   alter table public.users drop constraint users_custom_needs_check;
--   alter table public.users drop column custom_needs;

alter table public.users add column if not exists custom_needs jsonb not null default '[]'::jsonb;

alter table public.users add constraint users_custom_needs_check
  check (jsonb_typeof(custom_needs) = 'array' and octet_length(custom_needs::text) <= 2000);

comment on column public.users.custom_needs is 'The person''s own needs: [{id, name}]. id starts with c_. Array, <= 2000 bytes. Placement in a mode lives in users.canvas like any other need.';

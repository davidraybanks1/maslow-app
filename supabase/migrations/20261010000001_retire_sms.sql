-- ============================================================
-- RETIRE SMS INFRASTRUCTURE
-- DO NOT APPLY until the new build (9) is live on App Store /
-- TestFlight AND deployed to the web app. Older builds (8 and
-- web) still read/write users.phone; applying this early
-- breaks their profile-update calls.
--
-- Steps this migration performs:
--   1. Unschedule the three pg_cron jobs that call send-checkin-sms
--   2. Drop the users.phone column (no longer written by any client)
--
-- Run via: supabase db push  OR  paste in Supabase SQL editor
-- ============================================================

-- 1. Remove the scheduled SMS jobs (names set when the cron was created)
SELECT cron.unschedule('morning-checkin');
SELECT cron.unschedule('midday-checkin');
SELECT cron.unschedule('evening-checkin');

-- 2. Drop the phone column (the two Supabase edge functions that used it
--    are already deleted from the project; no app code writes this column
--    after build 9 is fully rolled out)
ALTER TABLE public.users DROP COLUMN IF EXISTS phone;

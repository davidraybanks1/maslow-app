-- ============================================================
-- DATABASE HARDENING (already applied to the live project 2026-10-17)
--   1. Texting is retired: the three pg_cron jobs are unscheduled and any
--      stored phone number is cleared. (The users.phone column itself can be
--      dropped later with 20261010000001_retire_sms.sql.)
--   2. The public roles keep only the table privileges the app needs
--      (select / insert / update / delete, still gated by row-level security).
--   3. Text columns get generous length limits, so a direct API call cannot
--      store megabytes in one row. NOT VALID = enforced for new writes.
-- Safe to run more than once.
-- ============================================================

DO $$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    PERFORM cron.unschedule(jobname) FROM cron.job
      WHERE jobname IN ('morning-checkin', 'midday-checkin', 'evening-checkin');
  END IF;
END $$;

UPDATE public.users SET phone = NULL WHERE phone IS NOT NULL;

REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

DO $$
DECLARE
  c record;
BEGIN
  FOR c IN SELECT * FROM (VALUES
    ('note_deck',   'note_deck_text_len',           'char_length(text) <= 1000'),
    ('practices',   'practices_label_len',          'char_length(label) <= 120'),
    ('journal',     'journal_entry_len',            'char_length(entry) <= 20000'),
    ('debriefs',    'debriefs_entry_len',           'char_length(entry) <= 20000'),
    ('users',       'users_name_len',               'char_length(name) <= 100'),
    ('users',       'users_note_to_self_len',       'char_length(note_to_self) <= 1000'),
    ('checkins',    'checkins_practice_text_len',   'char_length(practice_text) <= 120'),
    ('intentions',  'intentions_action_len',        'char_length(action) <= 500')
  ) AS t(tbl, name, expr)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = c.name) THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (%s) NOT VALID', c.tbl, c.name, c.expr);
    END IF;
  END LOOP;
END $$;

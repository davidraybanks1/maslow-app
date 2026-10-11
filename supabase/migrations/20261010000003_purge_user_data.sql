-- ============================================================
-- purge_user_data(p_user_id uuid)
-- DO NOT APPLY until reviewed. Apply BEFORE deploying the
-- updated delete-account edge function that calls it.
--
-- Creates a SECURITY DEFINER function callable only by
-- service_role that deletes all of a user's rows in a single
-- transaction, in FK-safe order, bypassing the
-- enforce_note_deck_min trigger.
--
-- FK constraints in this schema that constrain delete order:
--   checkins.user_id  → public.users(id) NO ACTION
--   moods.user_id     → public.users(id) NO ACTION
--   intentions.user_id → public.users(id) NO ACTION (if exists)
--   feelings.user_id  → public.users(id) NO ACTION (if exists)
-- All other user-data tables reference user_id informally
-- (no FK) or reference each other by their own ids only.
-- We must delete all child rows before the users row.
-- ============================================================

CREATE OR REPLACE FUNCTION public.purge_user_data(p_user_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  -- Allow the note_deck trigger to run without enforcing the minimum count.
  PERFORM set_config('app.bypass_deck_min', 'on', true);

  -- Delete in FK-safe order: children of users first, then users itself.
  -- Tables that may not exist in all environments are wrapped in IF EXISTS
  -- to keep the function idempotent across schema versions.
  DELETE FROM debriefs         WHERE user_id = p_user_id;
  DELETE FROM debrief_types    WHERE user_id = p_user_id;
  DELETE FROM custom_tags      WHERE user_id = p_user_id;
  DELETE FROM moods            WHERE user_id = p_user_id;
  DELETE FROM checkins         WHERE user_id = p_user_id;
  DELETE FROM journal          WHERE user_id = p_user_id;
  DELETE FROM journal_backup   WHERE user_id = p_user_id;
  DELETE FROM practice_merges  WHERE user_id = p_user_id;
  DELETE FROM practices        WHERE user_id = p_user_id;
  DELETE FROM weekly_reviews   WHERE user_id = p_user_id;
  DELETE FROM intentions       WHERE user_id = p_user_id;
  DELETE FROM feelings         WHERE user_id = p_user_id;
  DELETE FROM note_deck        WHERE user_id = p_user_id;
  -- users is keyed on id, not user_id
  DELETE FROM users            WHERE id      = p_user_id;
END;
$$;

-- Lock down execution: no public or auth-role access.
REVOKE EXECUTE ON FUNCTION public.purge_user_data(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purge_user_data(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.purge_user_data(uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.purge_user_data(uuid) TO service_role;

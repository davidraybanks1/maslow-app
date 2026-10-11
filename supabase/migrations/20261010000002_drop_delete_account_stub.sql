-- ============================================================
-- DROP THE OLD delete_account() SECURITY DEFINER STUB
-- DO NOT APPLY until the delete-account edge function is live
-- and confirmed working in production.
--
-- Background: public.delete_account(uuid) was a placeholder that
-- raises 'not implemented'. It is SECURITY DEFINER and executable
-- by anon with an arbitrary user id, which is a privilege-escalation
-- risk. The edge function replaces it; the stub must go.
-- ============================================================

DROP FUNCTION IF EXISTS public.delete_account(uuid);

-- ============================================================
-- JOURNAL SHAPES + REVISIT QUESTIONS
-- shape: which writing room a draft was written in (null = plain "just write").
-- revisit_question: the optional question you leave for future you when you
-- mark a draft "revisit". Both are written only by the owner (RLS policy
-- journal_own already covers every column); neither is ever sent to a model.
-- Constraints are NOT VALID so old rows are never rechecked.
-- ============================================================
SET lock_timeout = '5s';

ALTER TABLE public.journal
  ADD COLUMN IF NOT EXISTS shape text,
  ADD COLUMN IF NOT EXISTS revisit_question text;

ALTER TABLE public.journal DROP CONSTRAINT IF EXISTS journal_shape_valid;
ALTER TABLE public.journal ADD CONSTRAINT journal_shape_valid
  CHECK (shape IS NULL OR shape IN ('three_truths','tension','sort_first','continue','one_thing','timer')) NOT VALID;

ALTER TABLE public.journal DROP CONSTRAINT IF EXISTS journal_revisit_question_len;
ALTER TABLE public.journal ADD CONSTRAINT journal_revisit_question_len
  CHECK (revisit_question IS NULL OR char_length(revisit_question) <= 300) NOT VALID;

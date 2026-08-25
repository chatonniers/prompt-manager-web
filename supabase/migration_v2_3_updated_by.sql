-- Migration v2.3: Add updated_by to prompts table
-- Tracks which user last saved each prompt

ALTER TABLE public.prompts
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) DEFAULT NULL;

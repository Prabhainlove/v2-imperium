
-- 1. Extend profiles with V2 fields (all nullable / defaulted so existing rows are fine)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS target_role text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS seniority text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS work_mode text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS target_locations jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS salary_expectation jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS projects jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS languages jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS achievements jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS github_intel jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS linkedin_intel jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS profile_intel jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Brain memory table
CREATE TABLE IF NOT EXISTS public.brain_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  key_hash text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  model text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  UNIQUE (user_id, kind, key_hash)
);

CREATE INDEX IF NOT EXISTS brain_memory_user_kind_idx
  ON public.brain_memory (user_id, kind, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brain_memory TO authenticated;
GRANT ALL ON public.brain_memory TO service_role;

ALTER TABLE public.brain_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brain_memory_select_own"
  ON public.brain_memory FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "brain_memory_insert_own"
  ON public.brain_memory FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "brain_memory_update_own"
  ON public.brain_memory FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "brain_memory_delete_own"
  ON public.brain_memory FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER brain_memory_set_updated_at
  BEFORE UPDATE ON public.brain_memory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

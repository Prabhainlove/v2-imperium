
-- ============================================================
-- BATCH 1: Auth foundation + per-user data scoping
-- ============================================================

-- 1. PROFILES TABLE -----------------------------------------------------------
CREATE TABLE public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL DEFAULT '',
  email           TEXT NOT NULL DEFAULT '',
  phone           TEXT NOT NULL DEFAULT '',
  location        TEXT NOT NULL DEFAULT '',
  headline        TEXT NOT NULL DEFAULT '',
  summary         TEXT NOT NULL DEFAULT '',
  linkedin_url    TEXT NOT NULL DEFAULT '',
  github_url      TEXT NOT NULL DEFAULT '',
  portfolio_url   TEXT NOT NULL DEFAULT '',
  skills          JSONB NOT NULL DEFAULT '[]'::jsonb,
  experience      JSONB NOT NULL DEFAULT '[]'::jsonb,
  education       JSONB NOT NULL DEFAULT '[]'::jsonb,
  certifications  JSONB NOT NULL DEFAULT '[]'::jsonb,
  onboarded       BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_delete_own" ON public.profiles
  FOR DELETE TO authenticated USING (auth.uid() = id);

-- 2. updated_at trigger function (shared) -------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Auto-create profile on signup --------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. ADD user_id TO EXISTING TABLES -------------------------------------------
ALTER TABLE public.job_listings  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.applications  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.activity_log  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_job_listings_user_id ON public.job_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON public.applications(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON public.activity_log(user_id);

-- Clear existing demo data (no user_id, would be orphaned)
DELETE FROM public.applications WHERE user_id IS NULL;
DELETE FROM public.job_listings WHERE user_id IS NULL;
DELETE FROM public.activity_log WHERE user_id IS NULL;
DELETE FROM public.candidate_profiles WHERE id = 'default';

-- Now make user_id required for new rows
ALTER TABLE public.job_listings  ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.applications  ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.activity_log  ALTER COLUMN user_id SET NOT NULL;

-- 5. RE-GRANT + RLS on existing tables ----------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_listings TO authenticated;
GRANT ALL ON public.job_listings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;
GRANT SELECT, INSERT ON public.activity_log TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.activity_log_id_seq TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
GRANT ALL ON SEQUENCE public.activity_log_id_seq TO service_role;

-- job_listings policies
CREATE POLICY "jobs_select_own" ON public.job_listings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "jobs_insert_own" ON public.job_listings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "jobs_update_own" ON public.job_listings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "jobs_delete_own" ON public.job_listings
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- applications policies
CREATE POLICY "apps_select_own" ON public.applications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "apps_insert_own" ON public.applications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "apps_update_own" ON public.applications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "apps_delete_own" ON public.applications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- activity_log policies (append-only audit log; users can read their own)
CREATE POLICY "activity_select_own" ON public.activity_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "activity_insert_own" ON public.activity_log
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 6. DEPRECATE candidate_profiles --------------------------------------------
-- Replaced by `profiles` (linked to auth.users). Keep table but lock down.
ALTER TABLE public.candidate_profiles ENABLE ROW LEVEL SECURITY;
-- no policies = default deny; only service_role can touch it

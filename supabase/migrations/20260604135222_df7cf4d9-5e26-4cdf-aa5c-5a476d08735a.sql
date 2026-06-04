
-- Phase A: Make applications the source of truth; stop hoarding job listings.

-- 1) Expand applications with pipeline fields.
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS resume_version text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cover_letter_version text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS interview_notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS recruiter_notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS next_action text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS next_action_at timestamptz NULL;

-- 2) Normalize legacy statuses to the new canonical pipeline values.
UPDATE public.applications SET status = 'Preparing' WHERE status IN ('Pending Review','prepared','Manual Review','Under Review');
UPDATE public.applications SET status = 'Interview' WHERE status = 'Interview Scheduled';
UPDATE public.applications SET status = 'Offer' WHERE status = 'Offer Received';
UPDATE public.applications SET status = 'Withdrawn' WHERE status = 'Skipped';
ALTER TABLE public.applications ALTER COLUMN status SET DEFAULT 'Preparing';

-- 3) Job listings: distinguish ephemeral search results from user-curated jobs.
ALTER TABLE public.job_listings
  ADD COLUMN IF NOT EXISTS saved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bookmarked boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_job_listings_user_saved ON public.job_listings(user_id) WHERE saved = true OR bookmarked = true;

-- 4) Application timeline (status history, notes, events).
CREATE TABLE IF NOT EXISTS public.application_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  application_id uuid NOT NULL,
  event_type text NOT NULL,
  from_status text NOT NULL DEFAULT '',
  to_status text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_timeline TO authenticated;
GRANT ALL ON public.application_timeline TO service_role;

ALTER TABLE public.application_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timeline_select_own" ON public.application_timeline FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "timeline_insert_own" ON public.application_timeline FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "timeline_update_own" ON public.application_timeline FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "timeline_delete_own" ON public.application_timeline FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_application_timeline_app ON public.application_timeline(application_id, created_at DESC);

-- 5) Interviews tracker (separate from applications; multiple rounds per app).
CREATE TABLE IF NOT EXISTS public.interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  application_id uuid NULL,
  company text NOT NULL,
  position text NOT NULL DEFAULT '',
  stage text NOT NULL DEFAULT 'Screening',
  interview_at timestamptz NULL,
  location text NOT NULL DEFAULT '',
  recruiter text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  feedback text NOT NULL DEFAULT '',
  outcome text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.interviews TO authenticated;
GRANT ALL ON public.interviews TO service_role;

ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "interviews_select_own" ON public.interviews FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "interviews_insert_own" ON public.interviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "interviews_update_own" ON public.interviews FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "interviews_delete_own" ON public.interviews FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER set_interviews_updated_at BEFORE UPDATE ON public.interviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6) Purge ephemeral discovered listings that aren't linked to any application or saved/bookmarked.
DELETE FROM public.job_listings j
WHERE j.saved = false
  AND j.bookmarked = false
  AND NOT EXISTS (SELECT 1 FROM public.applications a WHERE a.listing_id = j.id);


CREATE TABLE public.candidate_profiles (
  id text PRIMARY KEY DEFAULT 'default',
  name text NOT NULL DEFAULT 'Candidate',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  headline text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  skills jsonb NOT NULL DEFAULT '[]'::jsonb,
  experience jsonb NOT NULL DEFAULT '[]'::jsonb,
  education jsonb NOT NULL DEFAULT '[]'::jsonb,
  links jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.job_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  external_id text NOT NULL,
  url text NOT NULL DEFAULT '',
  title text NOT NULL,
  company text NOT NULL,
  location text NOT NULL DEFAULT '',
  remote boolean NOT NULL DEFAULT false,
  salary_min numeric,
  salary_max numeric,
  salary_currency text NOT NULL DEFAULT 'USD',
  tech_stack jsonb NOT NULL DEFAULT '[]'::jsonb,
  description text NOT NULL DEFAULT '',
  posted_at timestamptz,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  match_score numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'discovered',
  task_id text NOT NULL DEFAULT '',
  UNIQUE(source, external_id)
);
CREATE INDEX idx_job_listings_task_id ON public.job_listings(task_id);
CREATE INDEX idx_job_listings_discovered_at ON public.job_listings(discovered_at DESC);
CREATE INDEX idx_job_listings_match_score ON public.job_listings(match_score DESC);

CREATE TABLE public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.job_listings(id) ON DELETE CASCADE,
  company text NOT NULL,
  job_title text NOT NULL,
  status text NOT NULL DEFAULT 'prepared',
  match_score numeric NOT NULL DEFAULT 0,
  resume_md text NOT NULL DEFAULT '',
  cover_letter_md text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  task_id text NOT NULL DEFAULT '',
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_applications_status ON public.applications(status);
CREATE INDEX idx_applications_created_at ON public.applications(created_at DESC);

CREATE TABLE public.activity_log (
  id bigserial PRIMARY KEY,
  task_id text NOT NULL DEFAULT '',
  agent text NOT NULL DEFAULT 'job_agent',
  action text NOT NULL,
  status text NOT NULL DEFAULT 'ok',
  detail text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_log_task_id ON public.activity_log(task_id);
CREATE INDEX idx_activity_log_created_at ON public.activity_log(created_at DESC);

-- Grants (single-user demo: open to anon + authenticated)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_profiles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_listings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_log TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.activity_log_id_seq TO anon, authenticated;
GRANT ALL ON public.candidate_profiles, public.job_listings, public.applications, public.activity_log TO service_role;
GRANT ALL ON SEQUENCE public.activity_log_id_seq TO service_role;

ALTER TABLE public.candidate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demo_all_profiles" ON public.candidate_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "demo_all_jobs" ON public.job_listings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "demo_all_apps" ON public.applications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "demo_all_activity" ON public.activity_log FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.candidate_profiles (id, name, email, location, headline, summary, skills)
VALUES (
  'default',
  'Candidate',
  'candidate@example.com',
  'Remote',
  'AI Engineer',
  'Experienced engineer building production AI systems.',
  '["Python","TypeScript","React","FastAPI","LLMs","RAG","PyTorch","SQL"]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

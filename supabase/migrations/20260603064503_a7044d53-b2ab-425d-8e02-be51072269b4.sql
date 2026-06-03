
DROP POLICY IF EXISTS "demo_all_activity" ON public.activity_log;
DROP POLICY IF EXISTS "demo_all_profiles" ON public.candidate_profiles;
DROP POLICY IF EXISTS "demo_all_jobs" ON public.job_listings;
DROP POLICY IF EXISTS "demo_all_apps" ON public.applications;

REVOKE ALL ON public.activity_log FROM anon, authenticated;
REVOKE ALL ON public.candidate_profiles FROM anon, authenticated;
REVOKE ALL ON public.job_listings FROM anon, authenticated;
REVOKE ALL ON public.applications FROM anon, authenticated;

GRANT ALL ON public.activity_log TO service_role;
GRANT ALL ON public.candidate_profiles TO service_role;
GRANT ALL ON public.job_listings TO service_role;
GRANT ALL ON public.applications TO service_role;


CREATE TABLE public.automation_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  application_id UUID,
  job_url TEXT NOT NULL DEFAULT '',
  job_title TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued', -- queued|running|awaiting_approval|approved|rejected|submitted|failed|cancelled
  current_step TEXT NOT NULL DEFAULT '',
  current_action TEXT NOT NULL DEFAULT '',
  current_url TEXT NOT NULL DEFAULT '',
  progress INT NOT NULL DEFAULT 0,
  screenshot_b64 TEXT,
  resume_text TEXT,
  cover_letter_text TEXT,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  approval_required BOOLEAN NOT NULL DEFAULT TRUE,
  approved BOOLEAN,
  error TEXT,
  agent_token TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_runs TO authenticated;
GRANT ALL ON public.automation_runs TO service_role;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own automation_runs" ON public.automation_runs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER set_automation_runs_updated BEFORE UPDATE ON public.automation_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX automation_runs_user_status ON public.automation_runs(user_id, status, created_at DESC);

CREATE TABLE public.automation_events (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.automation_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  step TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL DEFAULT 'info', -- info|warn|error|success
  detail TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_events TO authenticated;
GRANT ALL ON public.automation_events TO service_role;
ALTER TABLE public.automation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own automation_events" ON public.automation_events FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX automation_events_run ON public.automation_events(run_id, created_at);

ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_events;
ALTER TABLE public.automation_runs REPLICA IDENTITY FULL;
ALTER TABLE public.automation_events REPLICA IDENTITY FULL;

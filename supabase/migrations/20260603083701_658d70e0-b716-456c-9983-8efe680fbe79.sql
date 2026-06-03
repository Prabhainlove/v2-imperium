
CREATE TABLE public.resume_documents (
  user_id UUID PRIMARY KEY,
  content_md TEXT NOT NULL DEFAULT '',
  template TEXT NOT NULL DEFAULT 'classic',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.resume_documents TO authenticated;
GRANT ALL ON public.resume_documents TO service_role;

ALTER TABLE public.resume_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resume_doc_select_own" ON public.resume_documents
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "resume_doc_insert_own" ON public.resume_documents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "resume_doc_update_own" ON public.resume_documents
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "resume_doc_delete_own" ON public.resume_documents
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER set_resume_doc_updated_at
BEFORE UPDATE ON public.resume_documents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


CREATE TABLE public.resume_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  content_md TEXT NOT NULL DEFAULT '',
  template TEXT NOT NULL DEFAULT 'classic',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX resume_versions_user_idx ON public.resume_versions(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.resume_versions TO authenticated;
GRANT ALL ON public.resume_versions TO service_role;

ALTER TABLE public.resume_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resume_ver_select_own" ON public.resume_versions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "resume_ver_insert_own" ON public.resume_versions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "resume_ver_delete_own" ON public.resume_versions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

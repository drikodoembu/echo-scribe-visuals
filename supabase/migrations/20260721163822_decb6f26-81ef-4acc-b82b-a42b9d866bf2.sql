
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.scripts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  saint TEXT,
  format TEXT NOT NULL DEFAULT 'short',
  duration_seconds INTEGER NOT NULL DEFAULT 55,
  content TEXT NOT NULL DEFAULT '',
  model TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scripts TO authenticated;
GRANT ALL ON public.scripts TO service_role;

ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY scripts_select_own ON public.scripts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY scripts_insert_own ON public.scripts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY scripts_update_own ON public.scripts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY scripts_delete_own ON public.scripts FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX scripts_user_created_idx ON public.scripts (user_id, created_at DESC);

CREATE TRIGGER scripts_set_updated_at
  BEFORE UPDATE ON public.scripts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

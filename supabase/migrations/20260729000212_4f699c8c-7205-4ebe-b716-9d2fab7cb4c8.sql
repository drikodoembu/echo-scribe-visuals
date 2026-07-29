CREATE TABLE IF NOT EXISTS public.video_seo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  script_id uuid REFERENCES public.scripts(id) ON DELETE SET NULL,
  format text NOT NULL DEFAULT 'short',
  title text NOT NULL DEFAULT '',
  title_options jsonb NOT NULL DEFAULT '[]'::jsonb,
  description text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  hashtags text[] NOT NULL DEFAULT '{}',
  keywords text[] NOT NULL DEFAULT '{}',
  thumbnail_text text NOT NULL DEFAULT '',
  chapters jsonb NOT NULL DEFAULT '[]'::jsonb,
  pinned_comment text NOT NULL DEFAULT '',
  category text,
  language text NOT NULL DEFAULT 'pt-BR',
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_seo TO authenticated;
GRANT ALL ON public.video_seo TO service_role;

ALTER TABLE public.video_seo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "video_seo_own" ON public.video_seo
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS video_seo_user_created_idx ON public.video_seo (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS video_seo_script_idx ON public.video_seo (script_id);

CREATE TRIGGER video_seo_set_updated_at
  BEFORE UPDATE ON public.video_seo
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
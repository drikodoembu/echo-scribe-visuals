CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.image_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  script_id UUID REFERENCES public.scripts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  width INT,
  height INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.image_assets TO authenticated;
GRANT ALL ON public.image_assets TO service_role;

ALTER TABLE public.image_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own image_assets" ON public.image_assets
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_image_assets_user_created ON public.image_assets(user_id, created_at DESC);

CREATE TRIGGER trg_image_assets_updated BEFORE UPDATE ON public.image_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "images: users read own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "images: users insert own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "images: users update own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "images: users delete own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE TABLE public.audio_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  script_id uuid REFERENCES public.scripts(id) ON DELETE SET NULL,
  title text NOT NULL,
  voice text NOT NULL,
  model text,
  format text NOT NULL DEFAULT 'mp3',
  duration_seconds numeric,
  size_bytes bigint,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audio_assets_user_created_idx ON public.audio_assets(user_id, created_at DESC);
CREATE INDEX audio_assets_script_idx ON public.audio_assets(script_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.audio_assets TO authenticated;
GRANT ALL ON public.audio_assets TO service_role;

ALTER TABLE public.audio_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audio_assets_select_own" ON public.audio_assets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "audio_assets_insert_own" ON public.audio_assets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "audio_assets_update_own" ON public.audio_assets
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "audio_assets_delete_own" ON public.audio_assets
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER audio_assets_set_updated_at
  BEFORE UPDATE ON public.audio_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage RLS: each user only accesses their own folder inside `audio` bucket
CREATE POLICY "audio_storage_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "audio_storage_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "audio_storage_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "audio_storage_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]);

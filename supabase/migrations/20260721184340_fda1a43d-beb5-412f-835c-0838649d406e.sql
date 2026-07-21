
CREATE TABLE public.music_tracks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  format TEXT,
  size_bytes BIGINT,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.music_tracks TO authenticated;
GRANT ALL ON public.music_tracks TO service_role;
ALTER TABLE public.music_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own music" ON public.music_tracks FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX music_tracks_user_created_idx ON public.music_tracks(user_id, created_at DESC);

CREATE POLICY "Users read own music files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'music' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users upload own music files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'music' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own music files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'music' AND (storage.foldername(name))[1] = auth.uid()::text);

ALTER TABLE public.image_assets ADD COLUMN IF NOT EXISTS scene_order INTEGER;
CREATE INDEX IF NOT EXISTS image_assets_script_order_idx ON public.image_assets(script_id, scene_order);

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listMusicTracks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("music_tracks")
      .select("id, title, storage_path, format, size_bytes, duration_seconds, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const results = await Promise.all(
      (data ?? []).map(async (row) => {
        const { data: signed } = await supabaseAdmin.storage
          .from("music")
          .createSignedUrl(row.storage_path, 60 * 60 * 24);
        return { ...row, signed_url: signed?.signedUrl ?? null };
      }),
    );
    return results;
  });

export const saveMusicTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().min(1).max(200),
        storage_path: z.string().min(1),
        format: z.string().optional().nullable(),
        size_bytes: z.number().int().nonnegative().optional().nullable(),
        duration_seconds: z.number().int().nonnegative().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("music_tracks")
      .insert({
        user_id: context.userId,
        title: data.title,
        storage_path: data.storage_path,
        format: data.format ?? null,
        size_bytes: data.size_bytes ?? null,
        duration_seconds: data.duration_seconds ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteMusicTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error: fetchErr } = await context.supabase
      .from("music_tracks")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);

    if (row?.storage_path) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.storage
        .from("music")
        .remove([row.storage_path])
        .catch(() => {});
    }

    const { error } = await context.supabase.from("music_tracks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
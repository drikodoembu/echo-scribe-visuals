import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listAudioAssets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("audio_assets")
      .select("id, title, voice, model, format, duration_seconds, size_bytes, storage_path, script_id, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const results = await Promise.all(
      (data ?? []).map(async (row) => {
        const { data: signed } = await supabaseAdmin.storage
          .from("audio")
          .createSignedUrl(row.storage_path, 60 * 60 * 24);
        return { ...row, signed_url: signed?.signedUrl ?? null };
      }),
    );
    return results;
  });

export const deleteAudioAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error: fetchErr } = await context.supabase
      .from("audio_assets")
      .select("storage_path")
      .eq("id", data.id)
      .single();
    if (fetchErr) throw new Error(fetchErr.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.storage.from("audio").remove([row.storage_path]).catch(() => {});

    const { error } = await context.supabase.from("audio_assets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const signAudioAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("audio_assets")
      .select("storage_path")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("audio")
      .createSignedUrl(row.storage_path, 60 * 60 * 24);
    if (signErr) throw new Error(signErr.message);
    return { signed_url: signed.signedUrl };
  });
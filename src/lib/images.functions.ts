import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listImageAssets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    async function page(offset: number) {
      const { data, error } = await context.supabase
        .from("image_assets")
        .select("id, title, storage_path, mime_type, size_bytes, width, height, script_id, created_at")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + 199);
      if (error) throw new Error(error.message);
      return data ?? [];
    }
    const data = await page(0);
    let lastPageSize = data.length;
    while (lastPageSize === 200) {
      const next = await page(data.length);
      lastPageSize = next.length;
      data.push(...next);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const results = [];
    for (let offset = 0; offset < data.length; offset += 6) {
      const batch = await Promise.all(data.slice(offset, offset + 6).map(async (row) => {
        const { data: signed } = await supabaseAdmin.storage.from("images").createSignedUrl(row.storage_path, 60 * 60 * 24);
        return { ...row, signed_url: signed?.signedUrl ?? null };
      }));
      results.push(...batch);
    }
    return results;
  });

export const saveImageAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().min(1).max(200),
        storage_path: z.string().min(1),
        mime_type: z.string().optional().nullable(),
        size_bytes: z.number().int().nonnegative().optional().nullable(),
        width: z.number().int().positive().optional().nullable(),
        height: z.number().int().positive().optional().nullable(),
        script_id: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("image_assets")
      .insert({
        user_id: context.userId,
        title: data.title,
        storage_path: data.storage_path,
        mime_type: data.mime_type ?? null,
        size_bytes: data.size_bytes ?? null,
        width: data.width ?? null,
        height: data.height ?? null,
        script_id: data.script_id ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteImageAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error: fetchErr } = await context.supabase
      .from("image_assets")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);

    if (row?.storage_path) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.storage
        .from("images")
        .remove([row.storage_path])
        .catch(() => {});
    }

    const { error } = await context.supabase.from("image_assets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
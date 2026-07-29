import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ChapterSchema = z.object({ time: z.string().max(12), label: z.string().max(200) });

const SaveSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  script_id: z.string().uuid().nullable().optional(),
  format: z.enum(["short", "long"]).default("short"),
  title: z.string().max(200).default(""),
  title_options: z.array(z.string().max(200)).max(12).default([]),
  description: z.string().max(6000).default(""),
  tags: z.array(z.string().max(80)).max(60).default([]),
  hashtags: z.array(z.string().max(80)).max(20).default([]),
  keywords: z.array(z.string().max(80)).max(30).default([]),
  thumbnail_text: z.string().max(120).default(""),
  chapters: z.array(ChapterSchema).max(50).default([]),
  pinned_comment: z.string().max(2000).default(""),
  category: z.string().max(80).nullable().optional(),
  model: z.string().max(100).nullable().optional(),
});

export const listVideoSeo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("video_seo")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveVideoSeo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const row = {
      user_id: context.userId,
      script_id: data.script_id ?? null,
      format: data.format,
      title: data.title,
      title_options: data.title_options,
      description: data.description,
      tags: data.tags,
      hashtags: data.hashtags,
      keywords: data.keywords,
      thumbnail_text: data.thumbnail_text,
      chapters: data.chapters,
      pinned_comment: data.pinned_comment,
      category: data.category ?? null,
      model: data.model ?? null,
    };
    const query = data.id
      ? context.supabase.from("video_seo").update(row).eq("id", data.id).select().maybeSingle()
      : context.supabase.from("video_seo").insert(row).select().maybeSingle();
    const { data: saved, error } = await query;
    if (error) throw new Error(error.message);
    return saved;
  });

export const deleteVideoSeo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("video_seo").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SaveSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(200),
  topic: z.string().min(1).max(500),
  saint: z.string().max(200).nullable().optional(),
  format: z.enum(["short", "long"]),
  duration_seconds: z.number().int().min(20).max(600),
  content: z.string().min(1),
  model: z.string().max(100).nullable().optional(),
});

export const listScripts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("scripts")
      .select("id, title, topic, saint, format, duration_seconds, content, model, status, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const row = {
      user_id: context.userId,
      title: data.title,
      topic: data.topic,
      saint: data.saint ?? null,
      format: data.format,
      duration_seconds: data.duration_seconds,
      content: data.content,
      model: data.model ?? null,
      status: "draft",
    };
    const query = data.id
      ? context.supabase.from("scripts").update(row).eq("id", data.id).select().single()
      : context.supabase.from("scripts").insert(row).select().single();
    const { data: saved, error } = await query;
    if (error) throw new Error(error.message);
    return saved;
  });

export const deleteScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("scripts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
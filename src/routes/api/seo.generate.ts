import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { SEO_SYSTEM_PROMPT, buildSeoPrompt } from "@/lib/seo.prompt";

type Body = {
  title?: string;
  topic?: string;
  saint?: string | null;
  format?: "short" | "long";
  narration?: string;
};

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Resposta da IA sem JSON.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

export const Route = createFileRoute("/api/seo/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const supabaseUrl = process.env.SUPABASE_URL!;
        const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
          auth: { persistSession: false },
          global: {
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              if (supabaseKey.startsWith("sb_") && h.get("Authorization") === `Bearer ${supabaseKey}`) {
                h.delete("Authorization");
              }
              h.set("apikey", supabaseKey);
              h.set("Authorization", authHeader);
              return fetch(input, { ...init, headers: h });
            },
          },
        });
        const { data: userData, error: userErr } = await supabase.auth.getUser(authHeader.slice(7));
        if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json()) as Body;
        const narration = (body.narration ?? "").trim();
        const title = (body.title ?? "").trim();
        if (!narration && !title) return new Response("narration or title required", { status: 400 });

        const googleKey = process.env.GOOGLE_API_KEY;
        if (!googleKey) return new Response("Missing GOOGLE_API_KEY", { status: 500 });

        const model = "gemini-2.5-flash";
        const prompt = buildSeoPrompt({
          title,
          topic: (body.topic ?? "").trim(),
          saint: body.saint ?? null,
          format: body.format === "long" ? "long" : "short",
          narration,
        });

        const upstream = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(googleKey)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: SEO_SYSTEM_PROMPT }] },
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: "application/json", temperature: 0.8 },
            }),
          },
        );

        if (!upstream.ok) {
          const text = await upstream.text().catch(() => "");
          return new Response(text || "Gemini error", { status: upstream.status });
        }

        const json = (await upstream.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const raw = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
        let parsed: Record<string, unknown>;
        try {
          parsed = extractJson(raw) as Record<string, unknown>;
        } catch {
          return new Response("Não foi possível interpretar a resposta da IA.", { status: 502 });
        }

        const asStrings = (v: unknown): string[] =>
          Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];

        return Response.json({
          title: String(parsed.title ?? title ?? ""),
          title_options: asStrings(parsed.title_options),
          description: String(parsed.description ?? ""),
          tags: asStrings(parsed.tags).map((t) => t.replace(/^#/, "")),
          hashtags: asStrings(parsed.hashtags).map((t) => (t.startsWith("#") ? t : `#${t}`)),
          keywords: asStrings(parsed.keywords),
          thumbnail_text: String(parsed.thumbnail_text ?? ""),
          chapters: Array.isArray(parsed.chapters)
            ? (parsed.chapters as Array<Record<string, unknown>>)
                .map((c) => ({ time: String(c?.time ?? ""), label: String(c?.label ?? "") }))
                .filter((c) => c.time && c.label)
            : [],
          pinned_comment: String(parsed.pinned_comment ?? ""),
          category: parsed.category ? String(parsed.category) : null,
          model,
        });
      },
    },
  },
});
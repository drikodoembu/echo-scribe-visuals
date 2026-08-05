import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { SCRIPT_SYSTEM_PROMPT, buildScriptPrompt } from "@/lib/scripts.prompt";

type Body = {
  topic?: string;
  saint?: string;
  format?: "short" | "long";
  duration?: number;
  customPrompt?: string;
};

export const Route = createFileRoute("/api/scripts/stream")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Verify caller via publishable client + user's bearer token.
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
        const topic = body.topic?.trim();
        if (!topic) return new Response("topic required", { status: 400 });

        const format = body.format === "long" ? "long" : "short";
        const duration = Math.max(20, Math.min(600, Number(body.duration) || (format === "short" ? 55 : 180)));

        const googleKey = process.env.GOOGLE_API_KEY;
        if (!googleKey) return new Response("Missing GOOGLE_API_KEY", { status: 500 });

        const model = "gemini-2.5-flash";
        const userPrompt = buildScriptPrompt({ topic, saint: body.saint, format, duration });
        
        // Merge default system prompt with custom instructions if provided
        const finalSystemPrompt = body.customPrompt 
          ? `${SCRIPT_SYSTEM_PROMPT}\n\nINSTRUÇÕES ADICIONAIS DO USUÁRIO:\n${body.customPrompt}`
          : SCRIPT_SYSTEM_PROMPT;

        const upstream = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(googleKey)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: finalSystemPrompt }] },
              contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            }),
          },
        );

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "");
          return new Response(text || "Gemini error", { status: upstream.status });
        }

        // Convert SSE from Chat Completions into a plain text stream of tokens.
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        const reader = upstream.body.getReader();
        let buffer = "";

        const stream = new ReadableStream({
          async pull(controller) {
            const { value, done } = await reader.read();
            if (done) {
              controller.close();
              return;
            }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const raw of lines) {
              const line = raw.trim();
              if (!line.startsWith("data:")) continue;
              const data = line.slice(5).trim();
              if (!data || data === "[DONE]") continue;
              try {
                const json = JSON.parse(data) as {
                  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
                };
                const parts = json.candidates?.[0]?.content?.parts ?? [];
                for (const p of parts) {
                  if (p.text) controller.enqueue(encoder.encode(p.text));
                }
              } catch {
                // ignore parse errors on partial chunks
              }
            }
          },
          cancel(reason) {
            reader.cancel(reason).catch(() => {});
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
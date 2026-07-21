import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Body = {
  topic?: string;
  saint?: string;
  format?: "short" | "long";
  duration?: number;
};

function buildPrompt(b: Required<Pick<Body, "topic" | "format" | "duration">> & { saint?: string }) {
  const shape =
    b.format === "short"
      ? `Roteiro para YouTube Shorts (~${b.duration}s, ~150 palavras)`
      : `Roteiro para vídeo longo (~${b.duration}s)`;
  return `Você é um roteirista católico fiel ao Magistério da Igreja.
Escreva um ${shape} em português do Brasil sobre: "${b.topic}".
${b.saint ? `Inclua uma citação atribuída a ${b.saint}.` : "Inclua uma citação de um santo ou doutor da Igreja."}

Estrutura obrigatória (marque cada seção com título em MAIÚSCULAS seguido de dois-pontos):
GANCHO: 1-2 frases de impacto.
CITAÇÃO: frase do santo + nome.
APLICAÇÃO: aplicação prática à vida cristã hoje.
CHAMADA: convite para seguir o canal e viver o Evangelho.

Tom: reverente, direto, sem clichês. Sem emojis. Sem hashtags. Apenas o texto do roteiro.`;
}

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

        const lovableKey = process.env.LOVABLE_API_KEY;
        if (!lovableKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": lovableKey,
          },
          body: JSON.stringify({
            model: "google/gemini-3.5-flash",
            stream: true,
            messages: [
              { role: "system", content: "Você é um roteirista católico ortodoxo, claro e conciso." },
              { role: "user", content: buildPrompt({ topic, saint: body.saint, format, duration }) },
            ],
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "");
          return new Response(text || "Gateway error", { status: upstream.status });
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
                  choices?: Array<{ delta?: { content?: string } }>;
                };
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) controller.enqueue(encoder.encode(delta));
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
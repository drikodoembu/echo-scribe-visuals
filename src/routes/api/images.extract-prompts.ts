import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/images/extract-prompts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = authHeader.slice(7);

        const supabaseUrl = process.env.SUPABASE_URL!;
        const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
          auth: { persistSession: false },
        });
        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });

        const { scriptContent } = (await request.json()) as { scriptContent: string };
        if (!scriptContent) return new Response("scriptContent required", { status: 400 });

        const lovableKey = process.env.LOVABLE_API_KEY;
        if (!lovableKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const prompt = `Leia o roteiro abaixo com atenção e divida-o em 6 a 10 cenas, NA ORDEM em que acontecem na narração.
Para cada cena, escreva um prompt de imagem em INGLÊS que mostre EXATAMENTE o que está sendo narrado naquele trecho: os mesmos personagens (idade, aparência, roupas consistentes entre as cenas), o mesmo lugar, a ação e a emoção daquele momento.
Não invente elementos que não estão no roteiro. Estilo: fotografia cinematográfica realista, luz natural, alta qualidade, sem texto, sem marca d'água.
Responda em JSON no formato {"prompts": ["..."]}.

Roteiro:
${scriptContent.slice(0, 12000)}`;

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lovableKey}`,
            "Lovable-API-Key": lovableKey,
            "X-Lovable-AIG-SDK": "fetch",
          },
          body: JSON.stringify({
            model: "openai/gpt-6-astra",
            input: [{ role: "user", content: prompt }],
            stream: true,
            store: false,
            reasoning: { effort: "low" },
            text: {
              format: {
                type: "json_schema",
                name: "scene_prompts",
                strict: true,
                schema: {
                  type: "object",
                  properties: { prompts: { type: "array", items: { type: "string" } } },
                  required: ["prompts"],
                  additionalProperties: false,
                },
              },
            },
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const errTxt = await upstream.text().catch(() => "");
          if (upstream.status === 429)
            return new Response("Limite de requisições atingido. Aguarde um pouco e tente de novo.", { status: 429 });
          if (upstream.status === 402)
            return new Response("Créditos de IA esgotados no workspace.", { status: 402 });
          return new Response(errTxt || "Gateway error", { status: upstream.status });
        }

        // Read the SSE stream until it ends, collecting output text deltas
        let content = "";
        let streamError: string | null = null;
        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, idx).trim();
            buf = buf.slice(idx + 1);
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const evt = JSON.parse(payload);
              if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
                content += evt.delta;
              } else if (evt.type === "error" || evt.type === "response.failed") {
                streamError =
                  evt.error?.message || evt.response?.error?.message || "Falha na IA";
              }
            } catch {}
          }
        }
        content = content.trim();
        if (!content && streamError) return new Response(streamError, { status: 502 });
        
        try {
          // Clean possible markdown blocks
          const cleaned = content.replace(/^```json\s*|```$/g, "").trim();
          const parsed = JSON.parse(cleaned);
          let prompts: string[] = [];
          
          if (Array.isArray(parsed)) {
            prompts = parsed;
          } else if (typeof parsed === 'object' && parsed !== null) {
            const candidates = ['prompts', 'results', 'images', 'items', 'data'];
            for (const key of candidates) {
              if (Array.isArray(parsed[key])) {
                prompts = parsed[key];
                break;
              }
            }
            if (prompts.length === 0) {
              const firstArray = Object.values(parsed).find(v => Array.isArray(v));
              if (Array.isArray(firstArray)) prompts = firstArray as string[];
            }
          }

          prompts = prompts.filter(p => typeof p === 'string' && p.length > 5);

          if (prompts.length === 0) {
            throw new Error("No prompts found in JSON structure");
          }

          return Response.json({ prompts });
        } catch (e) {
          console.error("Parse error:", e, "Content:", content);
          // Fallback: regex for strings in quotes within brackets
          const arrayMatch = content.match(/\[\s*".*?"\s*(?:,\s*".*?"\s*)*\]/s);
          if (arrayMatch) {
            try {
              const prompts = JSON.parse(arrayMatch[0]);
              if (Array.isArray(prompts)) {
                return Response.json({ prompts: prompts.filter(p => typeof p === 'string' && p.length > 5) });
              }
            } catch (e2) {}
          }
          
          return new Response(`Falha ao processar resposta da IA: ${content}`, { status: 500 });
        }
      },
    },
  },
});

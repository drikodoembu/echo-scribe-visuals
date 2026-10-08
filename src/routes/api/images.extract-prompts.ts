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

        const googleKey = process.env.GOOGLE_API_KEY;
        if (!googleKey) return new Response("Missing GOOGLE_API_KEY", { status: 500 });

        const prompt = `Leia o roteiro abaixo com atenção e divida-o em 6 a 10 cenas, NA ORDEM em que acontecem na narração.
Para cada cena, escreva um prompt de imagem em INGLÊS que mostre EXATAMENTE o que está sendo narrado naquele trecho: os mesmos personagens (idade, aparência, roupas consistentes entre as cenas), o mesmo lugar, a ação e a emoção daquele momento.
Não invente elementos que não estão no roteiro. Estilo: fotografia cinematográfica realista, luz natural, alta qualidade, sem texto, sem marca d'água.

Roteiro:
${scriptContent.slice(0, 12000)}`;

        const upstream = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: "OBJECT",
                  properties: { prompts: { type: "ARRAY", items: { type: "STRING" } } },
                  required: ["prompts"],
                },
                thinkingConfig: { thinkingBudget: 0 },
              },
            }),
          },
        );

        if (!upstream.ok) {
          const errTxt = await upstream.text().catch(() => "");
          return new Response(errTxt || "Gateway error", { status: upstream.status });
        }

        const json = await upstream.json();
        const content = (
          json.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") || ""
        ).trim();
        
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

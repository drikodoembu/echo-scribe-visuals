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

        const prompt = `Analise o roteiro católico abaixo e sugira de 4 a 8 descrições de imagens cinematográficas (prompts) que ilustrem o conteúdo de forma profunda e reverente.
        As descrições devem ser em INGLÊS, focadas em iluminação dramática, estética sacra e alta qualidade, sem textos ou marcas d'água.
        
        IMPORTANTE: Responda APENAS um array JSON de strings no formato: ["prompt 1", "prompt 2", ...]
        Não inclua explicações, comentários ou outros campos.
        
        Roteiro:
        ${scriptContent}`;

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lovableKey}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.0-flash",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.1,
            max_tokens: 2000,
          }),
        });

        if (!upstream.ok) {
          const errTxt = await upstream.text().catch(() => "");
          return new Response(errTxt || "Gateway error", { status: upstream.status });
        }

        const json = await upstream.json();
        const content = (json.choices?.[0]?.message?.content || "").trim();
        
        try {
          // Attempt to find any array in the JSON response
          const parsed = JSON.parse(content);
          let prompts: string[] = [];
          
          if (Array.isArray(parsed)) {
            prompts = parsed;
          } else if (typeof parsed === 'object' && parsed !== null) {
            // Check common keys
            const candidates = ['prompts', 'results', 'images', 'items', 'data'];
            for (const key of candidates) {
              if (Array.isArray(parsed[key])) {
                prompts = parsed[key];
                break;
              }
            }
            
            // If still no array, take the first array found in values
            if (prompts.length === 0) {
              const firstArray = Object.values(parsed).find(v => Array.isArray(v));
              if (Array.isArray(firstArray)) prompts = firstArray as string[];
            }
          }

          // Filter out non-string elements just in case
          prompts = prompts.filter(p => typeof p === 'string');

          return Response.json({ prompts });
        } catch (e) {
          // Fallback: search for JSON array pattern in text
          const arrayMatch = content.match(/\[\s*".*?"\s*(?:,\s*".*?"\s*)*\]/s);
          if (arrayMatch) {
            try {
              const prompts = JSON.parse(arrayMatch[0]);
              if (Array.isArray(prompts)) {
                return Response.json({ prompts: prompts.filter(p => typeof p === 'string') });
              }
            } catch (e2) {}
          }
          
          return new Response(`Failed to parse AI response: ${content}`, { status: 500 });
        }
      },
    },
  },
});

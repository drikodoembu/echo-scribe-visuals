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

        const prompt = `Analise o roteiro católico abaixo e sugira 4 a 6 descrições de imagens cinematográficas (prompts) que ilustrem o conteúdo de forma profunda e reverente.
        As descrições devem ser em INGLÊS, focadas em iluminação dramática, estética sacra e alta qualidade, sem textos ou marcas d'água.
        Responda APENAS um array JSON de strings.
        
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
          }),
        });

        if (!upstream.ok) {
          const errTxt = await upstream.text().catch(() => "");
          return new Response(errTxt || "Gateway error", { status: upstream.status });
        }

        const json = await upstream.json();
        const content = json.choices?.[0]?.message?.content || "";
        
        try {
          const parsed = JSON.parse(content);
          // Handle case where AI returns { "prompts": [...] } or just [...]
          const prompts = Array.isArray(parsed) ? parsed : (parsed.prompts || Object.values(parsed)[0]);
          return Response.json({ prompts: Array.isArray(prompts) ? prompts : [] });
        } catch (e) {
          // Fallback parsing if JSON is slightly malformed but contains an array
          const match = content.match(/\[.*\]/s);
          if (match) {
            try {
              const prompts = JSON.parse(match[0]);
              return Response.json({ prompts });
            } catch (e2) {}
          }
          return new Response("Failed to parse AI response", { status: 500 });
        }
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { streamResponse, GatewayError } from "@lovable.dev/ai-gateway";
import { imageStyle } from "@/lib/image-plan";
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

        try {
          const body = await request.json();
          const { scriptContent, targetCount, start = 0, count = 12, style, continuity = [] } = body;
          if (typeof scriptContent !== "string" || !scriptContent.trim() || scriptContent.length > 150000) return new Response("Roteiro inválido.", { status: 400 });
          if (!Number.isSafeInteger(targetCount) || targetCount < 1 || !Number.isSafeInteger(start) || start < 0 || start >= targetCount || !Number.isSafeInteger(count) || count < 1 || count > 12 || start + count > targetCount) return new Response("Quantidade de cenas inválida.", { status: 400 });
          const visual = imageStyle(style);
          const prompt = `Divida o roteiro em ${targetCount} cenas cronológicas que cubram toda a narração. Nesta resposta produza EXATAMENTE ${count} prompts, apenas as cenas ${start + 1} a ${start + count}. Cada cena deve corresponder à sua posição proporcional na narração, sem repetir cenas anteriores. Escreva em INGLÊS e mostre os mesmos personagens, lugares, ações e emoções do trecho. Mantenha aparência, idade e roupas consistentes. Não invente acontecimentos. Estilo: ${visual.prompt}. Sem texto ou marca d'água. Cenas anteriores para continuidade: ${JSON.stringify(Array.isArray(continuity) ? continuity.slice(-2) : [])}.
Roteiro completo:
${scriptContent}`;
          const stream = await streamResponse({
            model: "openai/gpt-6-astra",
            input: [{ role: "user", content: prompt }],
            reasoning: { effort: "low" },
            text: { format: { type: "json_schema", name: "scene_prompts", strict: true, schema: {
              type: "object", properties: { prompts: { type: "array", items: { type: "string" }, minItems: count, maxItems: count } }, required: ["prompts"], additionalProperties: false,
            } } },
          }, { signal: request.signal });
          let content = "";
          for await (const event of stream) {
            if (event.type === "response.output_text.delta") content += event.delta;
          }
          const parsed = JSON.parse(content);
          if (!Array.isArray(parsed.prompts) || parsed.prompts.length !== count || !parsed.prompts.every((p: unknown) => typeof p === "string" && p.trim().length > 5)) return new Response("A IA não retornou todas as cenas solicitadas. Seus prompts anteriores foram preservados.", { status: 502 });
          return Response.json({ prompts: parsed.prompts });
        } catch (error) {
          console.error("Scene prompt generation failed", error);
          const status = error instanceof GatewayError ? error.httpStatus : undefined;
          return new Response(status === 402 ? "Créditos de IA esgotados." : status === 429 ? "Limite de requisições atingido. Aguarde antes de tentar novamente." : "Não foi possível gerar os prompts. Tente novamente após verificar o resultado anterior.", { status: status === 402 || status === 429 ? status : 502 });
        }
      },
    },
  },
});

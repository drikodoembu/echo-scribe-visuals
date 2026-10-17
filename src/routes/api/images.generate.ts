import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { generateImage, GatewayError } from "@lovable.dev/ai-gateway";
import { imageStyle } from "@/lib/image-plan";
import type { Database } from "@/integrations/supabase/types";

type Body = {
  prompt?: string;
  style?: string;
  title?: string;
  script_id?: string | null;
  aspect?: "9:16" | "16:9" | "1:1";
};

export const Route = createFileRoute("/api/images/generate")({
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
        const userId = userData.user.id;

        const body = (await request.json()) as Body;
        const prompt = body.prompt?.trim();
        if (!prompt) return new Response("prompt required", { status: 400 });
        if (prompt.length > 2000) return new Response("prompt too long", { status: 400 });

        const aspect = body.aspect ?? "9:16";
        if (!["9:16", "16:9", "1:1"].includes(aspect)) return new Response("Formato inválido", { status: 400 });
        const fullPrompt = `${prompt}\n\nStyle: ${imageStyle(body.style).prompt}. Aspect ratio: ${aspect}. No text, no watermark.`;
        let dataUrl: string;
        try {
          const result = await generateImage({
            model: "google/gemini-3-pro-image",
            contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
            generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: aspect } },
          }, { signal: request.signal });
          const image = result.data[0];
          const url = image?.b64_json ? `data:image/png;base64,${image.b64_json}` : image?.url;
          if (!url) return new Response("Nenhuma imagem retornada pelo modelo", { status: 502 });
          dataUrl = url;
        } catch (error) {
          console.error("Image generation failed", error);
          const status = error instanceof GatewayError ? error.httpStatus : undefined;
          return new Response(status === 402 ? "Créditos de IA esgotados." : status === 429 ? "Limite de requisições atingido." : "Falha na geração da imagem. Verifique o resultado antes de tentar novamente.", { status: status === 402 || status === 429 ? status : 502 });
        }

        let bytes: Uint8Array;
        let mime = "image/png";
        if (dataUrl.startsWith("data:")) {
          const [head, b64] = dataUrl.split(",");
          mime = head.slice(5).split(";")[0] || "image/png";
          if (!b64) return new Response("Imagem inválida", { status: 502 });
          const bin = atob(b64);
          bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        } else {
          const res = await fetch(dataUrl);
          if (!res.ok) return new Response("Falha ao baixar imagem gerada", { status: 502 });
          mime = res.headers.get("content-type") || "image/png";
          bytes = new Uint8Array(await res.arrayBuffer());
        }

        const ext = mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const uploadRes = await supabaseAdmin.storage
          .from("images")
          .upload(path, bytes, { contentType: mime, upsert: false });
        if (uploadRes.error) {
          return new Response(`Upload failed: ${uploadRes.error.message}`, { status: 500 });
        }

        const { data: signed, error: signErr } = await supabaseAdmin.storage
          .from("images")
          .createSignedUrl(path, 60 * 60 * 24);
        if (signErr) return new Response(`Sign failed: ${signErr.message}`, { status: 500 });

        const { data: inserted, error: insErr } = await supabaseAdmin
          .from("image_assets")
          .insert({
            user_id: userId,
            script_id: body.script_id ?? null,
            title: (body.title || prompt.slice(0, 60)).trim() || "Cena gerada",
            storage_path: path,
            mime_type: mime,
            size_bytes: bytes.byteLength,
          })
          .select("id")
          .single();
        if (insErr) return new Response(`Insert failed: ${insErr.message}`, { status: 500 });

        return Response.json({ id: inserted.id, signed_url: signed.signedUrl, storage_path: path });
      },
    },
  },
});
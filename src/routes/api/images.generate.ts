import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Body = {
  prompt?: string;
  title?: string;
  script_id?: string | null;
  aspect?: "9:16" | "16:9" | "1:1";
};

function pickImage(json: any): string | null {
  // Support standard OpenAI-like format
  if (json?.data?.[0]?.url) return json.data[0].url;
  if (json?.data?.[0]?.b64_json) return `data:image/png;base64,${json.data[0].b64_json}`;
  
  // Support Gemini-specific format if it differs
  if (json?.images?.[0]?.url) return json.images[0].url;
  
  // Last resort: deep search for anything that looks like a URL or base64
  const choices = json?.choices?.[0];
  const msg = choices?.message;
  const img = msg?.content?.match(/https?:\/\/[^\s"]+/)?.[0] || msg?.images?.[0]?.image_url?.url;
  
  return img || null;
}

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
        const lovableKey = process.env.LOVABLE_API_KEY;
        if (!lovableKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const fullPrompt = `${prompt}\n\nAspect ratio: ${aspect}. Cinematic, reverent Catholic aesthetic, dramatic light, high detail, no text, no watermark.`;

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lovableKey}`,
          },
          body: JSON.stringify({
            model: "google/gemini-3-pro-image",
            prompt: fullPrompt,
            n: 1,
            size: aspect === "9:16" ? "1024x1792" : aspect === "16:9" ? "1792x1024" : "1024x1024",
            response_format: "url"
          }),
        });

        if (!upstream.ok) {
          const errTxt = await upstream.text().catch(() => "");
          return new Response(errTxt || "Gateway error", { status: upstream.status });
        }

        const json = await upstream.json();
        const dataUrl = pickImage(json);
        if (!dataUrl) return new Response("Nenhuma imagem retornada pelo modelo", { status: 502 });

        let bytes: Uint8Array;
        let mime = "image/png";
        if (dataUrl.startsWith("data:")) {
          const [head, b64] = dataUrl.split(",");
          mime = head.slice(5).split(";")[0] || "image/png";
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
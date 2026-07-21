import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Body = {
  text?: string;
  voice?: string;
  title?: string;
  script_id?: string | null;
  model?: string;
};

const ALLOWED_VOICES = new Set([
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "sage",
  "shimmer",
  "verse",
]);

export const Route = createFileRoute("/api/audio/generate")({
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
        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

        const body = (await request.json()) as Body;
        const text = body.text?.trim();
        if (!text) return new Response("text required", { status: 400 });
        if (text.length > 5000) return new Response("text too long (max 5000)", { status: 400 });

        const voice = body.voice && ALLOWED_VOICES.has(body.voice) ? body.voice : "coral";
        const model = body.model || "openai/gpt-4o-mini-tts";
        const title = (body.title || text.slice(0, 60)).trim() || "Narração";

        const lovableKey = process.env.LOVABLE_API_KEY;
        if (!lovableKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": lovableKey,
          },
          body: JSON.stringify({
            model,
            input: text,
            voice,
            response_format: "mp3",
          }),
        });

        if (!upstream.ok) {
          const errTxt = await upstream.text().catch(() => "");
          return new Response(errTxt || "Gateway error", { status: upstream.status });
        }

        const audioBuf = new Uint8Array(await upstream.arrayBuffer());
        const path = `${userId}/${crypto.randomUUID()}.mp3`;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const uploadRes = await supabaseAdmin.storage
          .from("audio")
          .upload(path, audioBuf, { contentType: "audio/mpeg", upsert: false });
        if (uploadRes.error) {
          return new Response(`Upload failed: ${uploadRes.error.message}`, { status: 500 });
        }

        const { data: signed, error: signErr } = await supabaseAdmin.storage
          .from("audio")
          .createSignedUrl(path, 60 * 60 * 24);
        if (signErr) {
          return new Response(`Sign failed: ${signErr.message}`, { status: 500});
        }

        const { data: inserted, error: insErr } = await supabaseAdmin
          .from("audio_assets")
          .insert({
            user_id: userId,
            script_id: body.script_id ?? null,
            title,
            voice,
            model,
            format: "mp3",
            size_bytes: audioBuf.byteLength,
            storage_path: path,
          })
          .select()
          .single();
        if (insErr) {
          return new Response(`Insert failed: ${insErr.message}`, { status: 500 });
        }

        return Response.json({
          id: inserted.id,
          storage_path: path,
          signed_url: signed.signedUrl,
          size_bytes: audioBuf.byteLength,
          voice,
          model,
          title,
        });
      },
    },
  },
});
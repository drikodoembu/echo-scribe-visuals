import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/fftest")({ component: FF });

function FF() {
  const [msg, setMsg] = useState("idle");
  return (
    <button
      id="go"
      onClick={async () => {
        try {
          setMsg("loading");
          const { FFmpeg } = await import("@ffmpeg/ffmpeg");
          const ffmpeg = new FFmpeg();
          const CORE = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
          await ffmpeg.load({ coreURL: `${CORE}/ffmpeg-core.js`, wasmURL: `${CORE}/ffmpeg-core.wasm` });
          setMsg("loaded ok");
        } catch (e) {
          setMsg("ERR: " + (e as Error)?.message + " | " + String(e));
        }
      }}
    >
      {msg}
    </button>
  );
}

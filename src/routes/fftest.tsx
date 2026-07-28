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
          const { toBlobURL } = await import("@ffmpeg/util");
          const ffmpeg = new FFmpeg();
          ffmpeg.on("log", ({ message }) => console.log("FF:", message));
          const CORE = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
          await ffmpeg.load({
            coreURL: await toBlobURL(`${CORE}/ffmpeg-core.js`, "text/javascript"),
            wasmURL: await toBlobURL(`${CORE}/ffmpeg-core.wasm`, "application/wasm"),
            classWorkerURL: await toBlobURL("https://unpkg.com/@ffmpeg/ffmpeg@0.12.15/dist/umd/814.ffmpeg.js", "text/javascript"),
          });
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

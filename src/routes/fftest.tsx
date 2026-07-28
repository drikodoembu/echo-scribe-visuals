import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import coreURL from "@ffmpeg/core/dist/umd/ffmpeg-core.js?url";
import wasmURL from "@ffmpeg/core/dist/umd/ffmpeg-core.wasm?url";
import classWorkerURL from "@ffmpeg/ffmpeg/dist/umd/814.ffmpeg.js?url";

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
          ffmpeg.on("log", ({ message }) => console.log("FF:", message));
          await ffmpeg.load({
            coreURL: new URL(coreURL, location.href).href,
            wasmURL: new URL(wasmURL, location.href).href,
            classWorkerURL: new URL(classWorkerURL, location.href).href,
          });
          setMsg("loaded ok");
        } catch (e) {
          setMsg("ERR: " + String(e));
        }
      }}
    >
      {msg}
    </button>
  );
}

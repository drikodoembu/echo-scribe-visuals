import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
const CDN="https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
const coreURL=`${CDN}/ffmpeg-core.js`,wasmURL=`${CDN}/ffmpeg-core.wasm`;

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
          });
          await ffmpeg.exec(["-f","lavfi","-i","color=c=red:s=64x64:d=1","-t","1","-pix_fmt","yuv420p","out.mp4"]);
          const d = await ffmpeg.readFile("out.mp4");
          setMsg("encoded bytes " + (d as Uint8Array).byteLength);
        } catch (e) {
          setMsg("ERR: " + String(e));
        }
      }}
    >
      {msg}
    </button>
  );
}

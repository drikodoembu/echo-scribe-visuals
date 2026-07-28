import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Download, Film, Loader2, Play, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listScripts } from "@/lib/scripts.functions";
import { listAudioAssets } from "@/lib/audio.functions";
import { listImageAssets } from "@/lib/images.functions";
import { listMusicTracks } from "@/lib/music.functions";

export const Route = createFileRoute("/_authenticated/app/montagem")({
  component: MontagemPage,
});

type SceneImg = { id: string; url: string; title: string };

function MontagemPage() {
  const listScr = useServerFn(listScripts);
  const listAud = useServerFn(listAudioAssets);
  const listImg = useServerFn(listImageAssets);
  const listMus = useServerFn(listMusicTracks);

  const { data: scripts = [] } = useQuery({ queryKey: ["scripts"], queryFn: () => listScr() });
  const { data: audios = [] } = useQuery({ queryKey: ["audio_assets"], queryFn: () => listAud() });
  const { data: images = [] } = useQuery({ queryKey: ["image_assets"], queryFn: () => listImg() });
  const { data: musics = [] } = useQuery({ queryKey: ["music_tracks"], queryFn: () => listMus() });

  const [scriptId, setScriptId] = useState<string>("");
  const [audioId, setAudioId] = useState<string>("");
  const [musicId, setMusicId] = useState<string>("");
  const [scenes, setScenes] = useState<SceneImg[]>([]);
  const [format, setFormat] = useState<"9:16" | "16:9">("9:16");
  const [sceneDuration, setSceneDuration] = useState<number>(5);
  const [useNarrationLen, setUseNarrationLen] = useState<boolean>(true);
  const [musicVolume, setMusicVolume] = useState<number>(0.2);
  const [musicTempo, setMusicTempo] = useState<number>(1);
  const [musicPitchSemitones, setMusicPitchSemitones] = useState<number>(0);
  const [narrationVolume, setNarrationVolume] = useState<number>(1);

  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderStage, setRenderStage] = useState<string>("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const logRef = useRef<HTMLPreElement | null>(null);
  const [log, setLog] = useState<string>("");

  const selectedAudio = audios.find((a) => a.id === audioId);
  const selectedMusic = musics.find((m) => m.id === musicId);

  const availableImages = useMemo(() => {
    if (!scriptId) return images;
    return images.filter((i) => i.script_id === scriptId || !i.script_id);
  }, [images, scriptId]);

  function addScene(img: { id: string; signed_url: string | null; title: string }) {
    if (!img.signed_url) return;
    setScenes((s) => [...s, { id: img.id, url: img.signed_url!, title: img.title }]);
  }
  function removeScene(idx: number) {
    setScenes((s) => s.filter((_, i) => i !== idx));
  }
  function moveScene(idx: number, dir: -1 | 1) {
    setScenes((s) => {
      const next = [...s];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return s;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }

  const dims = format === "9:16" ? { w: 720, h: 1280 } : { w: 1280, h: 720 };
  const totalDur = useNarrationLen && selectedAudio?.duration_seconds
    ? selectedAudio.duration_seconds
    : Math.max(1, scenes.length) * sceneDuration;
  const perScene = scenes.length > 0 ? totalDur / scenes.length : sceneDuration;

  async function render() {
    if (scenes.length === 0) return toast.error("Adicione ao menos uma cena.");
    if (!selectedAudio?.signed_url) return toast.error("Selecione a narração.");

    setRendering(true);
    setRenderProgress(0);
    setLog("");
    setVideoUrl(null);
    setRenderStage("Carregando motor de vídeo…");

    try {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { fetchFile } = await import("@ffmpeg/util");
      const ffmpeg = new FFmpeg();
      ffmpeg.on("log", ({ message }) => {
        setLog((l) => (l + "\n" + message).slice(-8000));
      });
      ffmpeg.on("progress", ({ progress }) => {
        setRenderProgress(Math.min(99, Math.round(progress * 100)));
      });
      // The worker is a module worker, so it must load the ESM build of the core.
      const CORE = "https://unpkg.com/@ffmpeg/[email protected]/dist/esm";
      await ffmpeg.load({
        coreURL: `${CORE}/ffmpeg-core.js`,
        wasmURL: `${CORE}/ffmpeg-core.wasm`,
      });

      setRenderStage("Carregando mídias…");
      // Write images
      for (let i = 0; i < scenes.length; i++) {
        const buf = await fetchFile(scenes[i].url);
        await ffmpeg.writeFile(`img${i}.jpg`, buf);
      }
      // Write narration
      const narrationBuf = await fetchFile(selectedAudio.signed_url);
      await ffmpeg.writeFile("narration.dat", narrationBuf);
      // Write music (optional)
      const hasMusic = !!selectedMusic?.signed_url;
      if (hasMusic) {
        const musicBuf = await fetchFile(selectedMusic!.signed_url!);
        await ffmpeg.writeFile("music.dat", musicBuf);
      }

      setRenderStage("Renderizando (isso pode levar alguns minutos)…");

      const fps = 30;
      const { w, h } = dims;
      const perFrames = Math.max(1, Math.round(perScene * fps));

      // Build filter_complex for pan/Ken Burns per image
      const filters: string[] = [];
      for (let i = 0; i < scenes.length; i++) {
        // Alternate zoom-in / pan direction for variety
        const zoomIn = i % 2 === 0;
        const zExpr = zoomIn
          ? `min(zoom+0.0015,1.4)`
          : `if(lte(zoom,1.0),1.4,max(1.001,zoom-0.0015))`;
        // Pan direction alternates
        const dir = i % 4;
        let xExpr = `iw/2-(iw/zoom/2)`;
        let yExpr = `ih/2-(ih/zoom/2)`;
        if (dir === 0) xExpr = `(iw-iw/zoom)*(on/${perFrames})`;
        else if (dir === 1) xExpr = `(iw-iw/zoom)*(1-on/${perFrames})`;
        else if (dir === 2) yExpr = `(ih-ih/zoom)*(on/${perFrames})`;
        else yExpr = `(ih-ih/zoom)*(1-on/${perFrames})`;

        // Pre-scale image large so zoompan stays sharp
        filters.push(
          `[${i}:v]scale=${w * 3}:${h * 3}:force_original_aspect_ratio=increase,` +
            `crop=${w * 3}:${h * 3},` +
            `zoompan=z='${zExpr}':x='${xExpr}':y='${yExpr}':d=${perFrames}:s=${w}x${h}:fps=${fps},` +
            `setsar=1,format=yuv420p[v${i}]`,
        );
      }
      const concatInputs = scenes.map((_, i) => `[v${i}]`).join("");
      filters.push(`${concatInputs}concat=n=${scenes.length}:v=1:a=0[vout]`);

      // Audio filter graph
      // Narration is input index scenes.length; music if present is scenes.length + 1
      const narrIdx = scenes.length;
      filters.push(`[${narrIdx}:a]volume=${narrationVolume},aresample=44100[na]`);
      if (hasMusic) {
        const P = Math.pow(2, musicPitchSemitones / 12); // pitch factor
        const T = musicTempo; // final tempo multiplier
        const atempoFactor = T / P;
        // atempo supports 0.5..100; chain if outside
        const atempoChain = buildAtempoChain(atempoFactor);
        const musIdx = scenes.length + 1;
        filters.push(
          `[${musIdx}:a]asetrate=44100*${P.toFixed(6)},aresample=44100,${atempoChain},volume=${musicVolume}[mu]`,
        );
        filters.push(`[na][mu]amix=inputs=2:duration=first:dropout_transition=0,alimiter=limit=0.95[aout]`);
      }

      const args: string[] = [];
      for (let i = 0; i < scenes.length; i++) {
        args.push("-loop", "1", "-t", perScene.toFixed(3), "-i", `img${i}.jpg`);
      }
      args.push("-i", "narration.dat");
      if (hasMusic) args.push("-stream_loop", "-1", "-i", "music.dat");

      args.push("-filter_complex", filters.join(";"));
      args.push("-map", "[vout]");
      args.push("-map", hasMusic ? "[aout]" : "[na]");
      args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p");
      args.push("-c:a", "aac", "-b:a", "192k");
      args.push("-shortest", "-r", String(fps), "-movflags", "+faststart");
      args.push("out.mp4");

      await ffmpeg.exec(args);

      setRenderStage("Finalizando…");
      const data = (await ffmpeg.readFile("out.mp4")) as Uint8Array;
      // Copy into a fresh ArrayBuffer to satisfy Blob typing across ffmpeg builds
      const copy = new Uint8Array(data.byteLength);
      copy.set(data);
      const blob = new Blob([copy.buffer], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      setRenderProgress(100);
      setRenderStage("Pronto!");
      toast.success("Vídeo montado com sucesso.");
    } catch (err) {
      console.error(err);
      toast.error("Falha na montagem: " + (err as Error).message);
      setRenderStage("Erro");
    } finally {
      setRendering(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-3xl text-primary">Montagem</h1>
        <p className="text-sm text-muted-foreground">
          Monte seu vídeo diretamente no navegador: escolha roteiro, narração, cenas com efeito de pan
          (Ken Burns) e trilha musical com controle de volume, velocidade e tom.
        </p>
      </header>

      <div className="grid gap-4 rounded-xl border border-border bg-card/60 p-5 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Roteiro</Label>
          <Select value={scriptId} onValueChange={setScriptId}>
            <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
            <SelectContent>
              {scripts.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Narração</Label>
          <Select value={audioId} onValueChange={setAudioId}>
            <SelectTrigger><SelectValue placeholder="Selecione o áudio" /></SelectTrigger>
            <SelectContent>
              {audios.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.title}{a.duration_seconds ? ` · ${a.duration_seconds}s` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Formato</Label>
          <Select value={format} onValueChange={(v) => setFormat(v as "9:16" | "16:9")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="9:16">Shorts (9:16 · 720×1280)</SelectItem>
              <SelectItem value="16:9">Longo (16:9 · 1280×720)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Scenes */}
      <section className="space-y-3 rounded-xl border border-border bg-card/60 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg text-primary">Cenas ({scenes.length})</h2>
          <div className="flex items-center gap-3 text-xs">
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={useNarrationLen}
                onChange={(e) => setUseNarrationLen(e.target.checked)}
              />
              Dividir pelo tempo da narração
            </label>
            {!useNarrationLen && (
              <label className="flex items-center gap-1">
                Duração por cena (s)
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={sceneDuration}
                  onChange={(e) => setSceneDuration(Number(e.target.value) || 5)}
                  className="h-7 w-16"
                />
              </label>
            )}
            <span className="text-muted-foreground">
              ≈ {perScene.toFixed(1)}s/cena · total {totalDur.toFixed(0)}s
            </span>
          </div>
        </div>

        {scenes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma cena adicionada. Escolha imagens abaixo — cada cena receberá um efeito de pan/zoom automático.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {scenes.map((s, i) => (
              <div key={`${s.id}-${i}`} className="relative overflow-hidden rounded-lg border border-border bg-background">
                <img src={s.url} alt={s.title} className="aspect-video w-full object-cover" />
                <div className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">#{i + 1}</div>
                <div className="flex items-center justify-between gap-1 p-1.5 text-xs">
                  <span className="truncate">{s.title}</span>
                  <div className="flex items-center gap-1">
                    <button className="rounded p-1 hover:bg-secondary" onClick={() => moveScene(i, -1)} aria-label="Subir">
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button className="rounded p-1 hover:bg-secondary" onClick={() => moveScene(i, 1)} aria-label="Descer">
                      <ArrowDown className="h-3 w-3" />
                    </button>
                    <button className="rounded p-1 hover:bg-secondary text-destructive" onClick={() => removeScene(i)} aria-label="Remover">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-2">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Biblioteca de imagens {scriptId ? "(filtradas pelo roteiro)" : ""}
          </h3>
          {availableImages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma imagem disponível. Envie imagens na aba <em>Imagens</em>.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {availableImages.map((img) => (
                <button
                  key={img.id}
                  onClick={() => addScene(img)}
                  className="group relative overflow-hidden rounded-md border border-border hover:border-primary"
                  title={`Adicionar ${img.title}`}
                >
                  {img.signed_url ? (
                    <img src={img.signed_url} alt={img.title} className="aspect-square w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="aspect-square bg-muted" />
                  )}
                  <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/70 to-transparent p-1 opacity-0 group-hover:opacity-100">
                    <span className="text-[10px] text-white">+ adicionar</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Music */}
      <section className="space-y-3 rounded-xl border border-border bg-card/60 p-5">
        <h2 className="font-display text-lg text-primary">Trilha musical</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Música (opcional)</Label>
            <Select value={musicId} onValueChange={setMusicId}>
              <SelectTrigger><SelectValue placeholder="Sem música de fundo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem música</SelectItem>
                {musics.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedMusic?.signed_url && (
              <audio controls src={selectedMusic.signed_url} className="mt-1 h-9 w-full" preload="none" />
            )}
          </div>
          <div className="space-y-3">
            <RangeRow
              label={`Volume da música (${(musicVolume * 100).toFixed(0)}%)`}
              min={0} max={1} step={0.05} value={musicVolume} onChange={setMusicVolume}
              disabled={!selectedMusic}
            />
            <RangeRow
              label={`Velocidade (${musicTempo.toFixed(2)}×)`}
              min={0.5} max={2} step={0.05} value={musicTempo} onChange={setMusicTempo}
              disabled={!selectedMusic}
            />
            <RangeRow
              label={`Tom (${musicPitchSemitones > 0 ? "+" : ""}${musicPitchSemitones} semitons)`}
              min={-12} max={12} step={1} value={musicPitchSemitones} onChange={setMusicPitchSemitones}
              disabled={!selectedMusic}
            />
            <RangeRow
              label={`Volume da narração (${(narrationVolume * 100).toFixed(0)}%)`}
              min={0} max={2} step={0.05} value={narrationVolume} onChange={setNarrationVolume}
            />
          </div>
        </div>
      </section>

      {/* Render */}
      <section className="space-y-3 rounded-xl border border-border bg-card/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg text-primary">Renderização</h2>
            <p className="text-xs text-muted-foreground">
              Processado no seu navegador via FFmpeg.wasm. Para vídeos longos, prefira Chrome/Edge e mantenha a aba aberta.
            </p>
          </div>
          <Button
            onClick={render}
            disabled={rendering || scenes.length === 0 || !audioId}
            className="bg-primary text-primary-foreground"
          >
            {rendering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Montar vídeo
          </Button>
        </div>

        {(rendering || renderProgress > 0) && (
          <div className="space-y-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-primary transition-all" style={{ width: `${renderProgress}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{renderStage}</span>
              <span>{renderProgress}%</span>
            </div>
          </div>
        )}

        {videoUrl && (
          <div className="space-y-2">
            <video src={videoUrl} controls className="w-full max-w-md rounded-lg border border-border" />
            <a
              href={videoUrl}
              download={`catolicoteca-${format.replace(":", "x")}-${Date.now()}.mp4`}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90"
            >
              <Download className="h-4 w-4" /> Baixar MP4
            </a>
          </div>
        )}

        {log && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">Logs do FFmpeg</summary>
            <pre ref={logRef} className="mt-2 max-h-60 overflow-auto rounded bg-black/70 p-3 text-[11px] text-white">
              {log}
            </pre>
          </details>
        )}

        {scenes.length === 0 && (
          <div className="flex items-center gap-2 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
            <Film className="h-4 w-4 text-gold" />
            Adicione cenas e selecione a narração para habilitar a montagem.
          </div>
        )}
      </section>
    </div>
  );
}

function RangeRow({
  label, min, max, step, value, onChange, disabled,
}: {
  label: string; min: number; max: number; step: number;
  value: number; onChange: (n: number) => void; disabled?: boolean;
}) {
  return (
    <label className={`block space-y-1 ${disabled ? "opacity-50" : ""}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type="range"
        min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </label>
  );
}

// atempo filter only supports 0.5..100 per instance; chain for extremes.
function buildAtempoChain(factor: number): string {
  if (!isFinite(factor) || factor <= 0) return "atempo=1";
  const parts: string[] = [];
  let f = factor;
  while (f < 0.5) { parts.push("atempo=0.5"); f = f / 0.5; }
  while (f > 2) { parts.push("atempo=2"); f = f / 2; }
  parts.push(`atempo=${f.toFixed(6)}`);
  return parts.join(",");
}

import { pageHead } from "@/lib/page-head";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
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
  head: () => pageHead("Montagem", "Monte e exporte seus vídeos com narração, imagens e música."),
  component: MontagemPage,
});

type SceneImg = { id: string; url: string; title: string; weight: number };

function MontagemPage() {
  const listScr = useServerFn(listScripts);
  const listAud = useServerFn(listAudioAssets);
  const listImg = useServerFn(listImageAssets);
  const listMus = useServerFn(listMusicTracks);

  const { data: scripts = [] } = useQuery({ queryKey: ["scripts"], queryFn: () => listScr() });
  const { data: audios = [] } = useQuery({ queryKey: ["audio_assets"], queryFn: () => listAud() });
  const { data: images = [] } = useQuery({ queryKey: ["image_assets"], queryFn: () => listImg() });
  const { data: musics = [] } = useQuery({ queryKey: ["music_tracks"], queryFn: () => listMus() });

  const STORAGE_KEY = "montagem:draft:v1";
  const initial = (() => {
    if (typeof window === "undefined") return { scriptId: "", audioId: "", musicId: "", format: "9:16" as const, sceneDuration: 5, useNarrationLen: true };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { scriptId: "", audioId: "", musicId: "", format: "9:16" as const, sceneDuration: 5, useNarrationLen: true };
  })();

  const [scriptId, setScriptId] = useState<string>(initial.scriptId);
  const [audioId, setAudioId] = useState<string>(initial.audioId);
  const [musicId, setMusicId] = useState<string>(initial.musicId);
  const [scenes, setScenes] = useState<SceneImg[]>([]);
  const [format, setFormat] = useState<"9:16" | "16:9">(initial.format);
  const [sceneDuration, setSceneDuration] = useState<number>(initial.sceneDuration);
  const [useNarrationLen, setUseNarrationLen] = useState<boolean>(initial.useNarrationLen);
  const [musicVolume, setMusicVolume] = useState<number>(0.2);
  const [musicTempo, setMusicTempo] = useState<number>(1);
  const [musicPitchSemitones, setMusicPitchSemitones] = useState<number>(0);
  const [narrationVolume, setNarrationVolume] = useState<number>(1);

  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderStage, setRenderStage] = useState<string>("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const logRef = useRef<HTMLPreElement | null>(null);
  const progressWindow = useRef({ base: 0, span: 99 });
  const [log, setLog] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ scriptId, audioId, musicId, format, sceneDuration, useNarrationLen }));
    if (scriptId) localStorage.setItem("catolicoteca:active_script_id", scriptId);
  }, [scriptId, audioId, musicId, format, sceneDuration, useNarrationLen]);

  // Sync with global active script
  useEffect(() => {
    if (!scripts.length) return;
    const activeId = localStorage.getItem("catolicoteca:active_script_id");
    if (activeId && activeId !== scriptId) {
      const exists = scripts.find(s => s.id === activeId);
      if (exists) {
        setScriptId(activeId);
        // Also try to find matching audio/music for this script
        const a = audios.find(x => x.script_id === activeId);
        if (a) setAudioId(a.id);
      }
    }
  }, [scripts]);

  const selectedAudio = audios.find((a) => a.id === audioId);
  const selectedMusic = musics.find((m) => m.id === musicId);

  const availableImages = useMemo(() => {
    if (!scriptId) return images;
    return images.filter((i) => i.script_id === scriptId || !i.script_id);
  }, [images, scriptId]);

  function addScene(img: { id: string; signed_url: string | null; title: string }) {
    if (!img.signed_url) return;
    setScenes((s) => [...s, { id: img.id, url: img.signed_url!, title: img.title, weight: 1 }]);
  }
  function setSceneWeight(idx: number, weight: number) {
    setScenes((s) => s.map((sc, i) => (i === idx ? { ...sc, weight: Math.max(0.1, weight) } : sc)));
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

  // Real narration length (metadata in the DB can be missing or rounded).
  const [measuredDur, setMeasuredDur] = useState<number | null>(null);
  useEffect(() => {
    setMeasuredDur(null);
    const url = selectedAudio?.signed_url;
    if (!url) return;
    const el = new Audio();
    el.preload = "metadata";
    const onMeta = () => {
      if (isFinite(el.duration) && el.duration > 0) setMeasuredDur(el.duration);
    };
    el.addEventListener("loadedmetadata", onMeta);
    el.src = url;
    return () => {
      el.removeEventListener("loadedmetadata", onMeta);
      el.src = "";
    };
  }, [selectedAudio?.signed_url]);

  const narrationDur = measuredDur ?? selectedAudio?.duration_seconds ?? null;
  const totalDur =
    useNarrationLen && narrationDur ? narrationDur : Math.max(1, scenes.length) * sceneDuration;

  // Each scene gets a slice of the narration proportional to its weight,
  // so the images always cover exactly the audio length.
  const sceneDurations = useMemo(() => {
    if (scenes.length === 0) return [] as number[];
    const sumW = scenes.reduce((a, s) => a + (s.weight || 1), 0) || scenes.length;
    const raw = scenes.map((s) => (totalDur * (s.weight || 1)) / sumW);
    const clamped = raw.map((d) => Math.max(1, d));
    const sum = clamped.reduce((a, b) => a + b, 0);
    if (sum <= 0) return clamped;
    const scale = totalDur / sum;
    return scale < 1 ? clamped : clamped.map((d) => d * scale);
  }, [scenes, totalDur]);
  const perScene = scenes.length > 0 ? totalDur / scenes.length : sceneDuration;

  async function render() {
    if (scenes.length === 0) return toast.error("Adicione ao menos uma cena.");
    if (!selectedAudio?.signed_url) return toast.error("Selecione a narração.");

    setRendering(true);
    setRenderProgress(1);
    setLog("");
    setVideoUrl(null);
    setRenderStage("Carregando motor de vídeo…");
    progressWindow.current = { base: 0, span: 1 };

    try {
      const setStep = (stage: string, progress: number) => {
        setRenderStage(stage);
        setRenderProgress(Math.max(1, Math.min(99, Math.round(progress))));
      };

      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { fetchFile } = await import("@ffmpeg/util");
      setStep("Verificando motor de vídeo…", 2);

      const coreURL = new URL("/ffmpeg/ffmpeg-core.js", window.location.origin).href;
      const wasmAsset = (await fetch("/ffmpeg/ffmpeg-core.wasm.asset.json", { cache: "no-store" }).then((r) => {
        if (!r.ok) throw new Error("Não foi possível localizar o motor FFmpeg (WASM).");
        return r.json();
      })) as { url: string };
      const wasmURL = new URL(wasmAsset.url, window.location.origin).href;
      const coreCheck = await fetch(coreURL, { method: "HEAD", cache: "no-store" });
      const wasmCheck = await fetch(wasmURL, { method: "HEAD", cache: "no-store" });
      if (!coreCheck.ok || !wasmCheck.ok) {
        throw new Error("Arquivos do motor de vídeo indisponíveis. Recarregue a página e tente novamente.");
      }

      const ffmpeg = new FFmpeg();
      ffmpeg.on("log", ({ message }) => {
        setLog((l) => (l + "\n" + message).slice(-8000));
      });
      ffmpeg.on("progress", ({ progress }) => {
        const { base, span } = progressWindow.current;
        const p = Math.max(0, Math.min(1, progress));
        setRenderProgress(Math.min(99, Math.round(base + p * span)));
      });
      setStep("Inicializando FFmpeg.wasm…", 4);
      await ffmpeg.load({
        coreURL,
        wasmURL,
      });
      setStep("Motor carregado. Preparando mídias…", 8);

      // Write images
      for (let i = 0; i < scenes.length; i++) {
        setStep(`Carregando imagem ${i + 1} de ${scenes.length}…`, 8 + (i / Math.max(1, scenes.length)) * 8);
        const buf = await fetchFile(scenes[i].url);
        await ffmpeg.writeFile(`img${i}.jpg`, buf);
      }
      // Write narration
      setStep("Carregando narração…", 17);
      const narrationBuf = await fetchFile(selectedAudio.signed_url);
      const narrationFile = `narration.${mediaExtension(selectedAudio.format, selectedAudio.signed_url, "mp3")}`;
      await ffmpeg.writeFile(narrationFile, narrationBuf);
      // Write music (optional)
      const hasMusic = !!selectedMusic?.signed_url;
      let musicFile = "music.mp3";
      if (hasMusic) {
        setStep("Carregando trilha musical…", 19);
        const musicUrl = selectedMusic?.signed_url;
        if (!musicUrl) throw new Error("Trilha musical indisponível.");
        musicFile = `music.${mediaExtension(selectedMusic.format, musicUrl, "mp3")}`;
        const musicBuf = await fetchFile(musicUrl);
        await ffmpeg.writeFile(musicFile, musicBuf);
      }
      setStep("Mídias carregadas. Iniciando renderização…", 20);

      const fps = 30;
      const { w, h } = dims;

      // Render one scene at a time (low memory: ffmpeg.wasm is 32-bit and a
      // single filter graph with every image loaded at once runs out of RAM).
      for (let i = 0; i < scenes.length; i++) {
        setRenderStage(`Renderizando cena ${i + 1} de ${scenes.length}…`);
        progressWindow.current = { base: 20 + (i / scenes.length) * 65, span: 65 / scenes.length };
        setRenderProgress(Math.round(20 + (i / scenes.length) * 65));

        const perSceneSeconds = Math.max(1, sceneDurations[i] ?? perScene);
        const perFrames = Math.max(fps, Math.round(perSceneSeconds * fps));

        const zoomIn = i % 2 === 0;
        // Progresso 0→1 alcançando 100% no último quadro.
        const den = Math.max(1, perFrames - 1);
        const zExpr = zoomIn
          ? `1+0.25*on/${den}`
          : `1.25-0.25*on/${den}`;

        // Zoom-in: deslocamento direcional (amplitude cresce com o zoom).
        // Zoom-out: centralizado, sem deslocamento (evita parar no fim da cena).
        const dir = i % 4;
        let xExpr = `(iw-iw/zoom)/2`;
        let yExpr = `(ih-ih/zoom)/2`;

        if (zoomIn) {
          if (dir === 0) { // Esquerda para Direita
            xExpr = `(iw-iw/zoom)*(on/${den})`;
          } else { // Cima para Baixo (dir === 2)
            yExpr = `(ih-ih/zoom)*(on/${den})`;
          }
        }

        const sw = Math.round(w * 1.5);
        const sh = Math.round(h * 1.5);
        const vf =
          `scale=${sw}:${sh}:force_original_aspect_ratio=increase,crop=${sw}:${sh},` +
          `zoompan=z='${zExpr}':x='${xExpr}':y='${yExpr}':d=${perFrames}:s=${w}x${h}:fps=${fps},` +
          `setpts=PTS-STARTPTS,setsar=1,format=yuv420p`;

        const code = await ffmpeg.exec([
          "-y",
          "-i", `img${i}.jpg`,
          "-vf", vf,
          "-an",
          "-c:v", "libx264", "-preset", "ultrafast", "-crf", "26",
          "-pix_fmt", "yuv420p", "-r", String(fps), "-frames:v", String(perFrames),
          `seg${i}.mp4`,
        ]);
        if (code !== 0) throw new Error(`Falha ao renderizar a cena ${i + 1} (código ${code}).`);
        await ffmpeg.deleteFile(`img${i}.jpg`);
      }

      setRenderStage("Juntando cenas…");
      progressWindow.current = { base: 86, span: 5 };
      setRenderProgress(88);

      const list = scenes.map((_, i) => `file 'seg${i}.mp4'`).join("\n") + "\n";
      await ffmpeg.writeFile("list.txt", new TextEncoder().encode(list));

      const concatCode = await ffmpeg.exec([
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", "list.txt",
        "-c", "copy",
        "video.mp4",
      ]);
      if (concatCode !== 0) throw new Error(`Falha ao juntar as cenas (código ${concatCode}).`);

      setRenderStage("Mixando narração e trilha…");
      progressWindow.current = { base: 91, span: 7 };
      setRenderProgress(91);

      const filters: string[] = [];
      filters.push(`[1:a]volume=${narrationVolume},aresample=44100[na]`);
      if (hasMusic) {
        const P = Math.pow(2, musicPitchSemitones / 12);
        const atempoChain = buildAtempoChain(musicTempo / P);
        filters.push(
          `[2:a]asetrate=44100*${P.toFixed(6)},aresample=44100,${atempoChain},volume=${musicVolume}[mu]`,
        );
        filters.push(`[na][mu]amix=inputs=2:duration=first:dropout_transition=0[aout]`);
      }

      const args: string[] = ["-i", "video.mp4", "-i", narrationFile];
      args.unshift("-y");
      if (hasMusic) args.push("-stream_loop", "-1", "-i", musicFile);
      args.push("-filter_complex", filters.join(";"));
      args.push("-map", "0:v");
      args.push("-map", hasMusic ? "[aout]" : "[na]");
      args.push("-c:v", "copy", "-c:a", "aac", "-b:a", "160k");
      args.push("-shortest", "-movflags", "+faststart", "out.mp4");

      const muxCode = await ffmpeg.exec(args);
      if (muxCode !== 0) throw new Error(`Falha ao juntar áudio e vídeo (código ${muxCode}).`);

      setRenderStage("Finalizando…");
      const data = (await ffmpeg.readFile("out.mp4")) as Uint8Array;
      if (!data || data.byteLength === 0) throw new Error("O arquivo final ficou vazio.");
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
              total {totalDur.toFixed(1)}s
              {useNarrationLen && narrationDur ? " (narração)" : ""} · {scenes.length} cena(s)
            </span>
          </div>
        </div>

        {scenes.length === 0 ? (
          <div className="flex flex-col items-center justify-center space-y-4 rounded-lg border border-dashed border-gold/30 py-10 text-center">
            <Film className="h-10 w-10 text-gold/40" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-primary">Nenhuma cena adicionada</p>
              <p className="text-xs text-muted-foreground">
                Escolha as imagens na biblioteca abaixo para compor o vídeo.
              </p>
            </div>
            {scriptId && (
              <Button
                variant="outline"
                size="sm"
                className="border-gold/30 text-gold hover:bg-gold/10"
                onClick={() => {
                  const scriptImgs = images.filter(i => i.script_id === scriptId && i.signed_url);
                  if (scriptImgs.length > 0) {
                    scriptImgs.forEach(img => addScene(img as any));
                    toast.success(`${scriptImgs.length} imagens do roteiro adicionadas.`);
                  } else {
                    toast.error("Nenhuma imagem vinculada a este roteiro.");
                  }
                }}
              >
                Adicionar todas do roteiro
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {scenes.map((s, i) => (
              <div key={`${s.id}-${i}`} className="relative overflow-hidden rounded-lg border border-border bg-background">
                <img src={s.url} alt={s.title} className="aspect-video w-full object-cover" />
                <div className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">#{i + 1}</div>
                <div className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
                  {(sceneDurations[i] ?? perScene).toFixed(1)}s
                </div>
                <div className="flex items-center justify-between gap-1 p-1.5 text-xs">
                  <span className="truncate">{s.title}</span>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={s.weight}
                      onChange={(e) => setSceneWeight(i, Number(e.target.value) || 1)}
                      className="h-6 w-12 px-1 text-[11px]"
                      title="Peso da cena (proporção do tempo)"
                    />
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

function mediaExtension(format: string | null | undefined, signedUrl: string, fallback: string): string {
  const cleanFormat = (format ?? "").toLowerCase().replace(/^audio\//, "").replace(/[^a-z0-9]/g, "");
  if (cleanFormat === "mpeg") return "mp3";
  if (["mp3", "wav", "m4a", "aac", "ogg", "webm", "flac", "mp4"].includes(cleanFormat)) return cleanFormat;

  try {
    const pathname = new URL(signedUrl).pathname.toLowerCase();
    const ext = pathname.split(".").pop()?.replace(/[^a-z0-9]/g, "");
    if (ext && ["mp3", "wav", "m4a", "aac", "ogg", "webm", "flac", "mp4"].includes(ext)) return ext;
  } catch {
    // Signed URLs can vary by storage provider; fall back to the known default.
  }

  return fallback;
}

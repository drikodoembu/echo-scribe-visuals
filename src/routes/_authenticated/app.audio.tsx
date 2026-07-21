import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { Download, Loader2, Mic, Trash2, Upload } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import {
  deleteAudioAsset,
  listAudioAssets,
  saveAudioAsset,
} from "@/lib/audio.functions";
import { listScripts } from "@/lib/scripts.functions";

export const Route = createFileRoute("/_authenticated/app/audio")({
  component: AudioPage,
});

const ACCEPT = "audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/ogg,audio/webm,audio/flac,audio/x-m4a";

function AudioPage() {
  const qc = useQueryClient();
  const listAudio = useServerFn(listAudioAssets);
  const listScr = useServerFn(listScripts);
  const save = useServerFn(saveAudioAsset);
  const del = useServerFn(deleteAudioAsset);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["audio_assets"],
    queryFn: () => listAudio(),
  });
  const { data: scripts = [] } = useQuery({
    queryKey: ["scripts"],
    queryFn: () => listScr(),
  });

  const [scriptId, setScriptId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function pickScript(id: string) {
    setScriptId(id);
    const s = scripts.find((x) => x.id === id);
    if (s && !title) setTitle(s.title);
  }

  function onFilesChange(list: FileList | null) {
    const arr = list ? Array.from(list) : [];
    setFiles(arr);
    if (arr.length === 1 && !title) {
      setTitle(arr[0].name.replace(/\.[^.]+$/, ""));
    }
  }

  function removeFileAt(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function getAudioDuration(f: File): Promise<number | null> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(f);
      const el = document.createElement("audio");
      el.preload = "metadata";
      el.onloadedmetadata = () => {
        const d = isFinite(el.duration) ? Math.round(el.duration) : null;
        URL.revokeObjectURL(url);
        resolve(d);
      };
      el.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      el.src = url;
    });
  }

  async function upload() {
    if (files.length === 0) {
      toast.error("Selecione ao menos um arquivo de áudio.");
      return;
    }
    const { data: sess } = await supabase.auth.getUser();
    const userId = sess.user?.id;
    if (!userId) {
      toast.error("Sessão expirada.");
      return;
    }
    setUploading(true);
    setProgress(0);
    setCurrentIndex(0);
    let ok = 0;
    let fail = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setCurrentIndex(i + 1);
        try {
          const ext = (f.name.split(".").pop() || "mp3").toLowerCase();
          const path = `${userId}/${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("audio")
            .upload(path, f, {
              contentType: f.type || "audio/mpeg",
              upsert: false,
            });
          if (upErr) throw new Error(upErr.message);
          const duration = await getAudioDuration(f);
          const itemTitle =
            files.length === 1 && title.trim()
              ? title.trim()
              : f.name.replace(/\.[^.]+$/, "");
          await save({
            data: {
              title: itemTitle,
              storage_path: path,
              format: ext,
              size_bytes: f.size,
              duration_seconds: duration,
              script_id: scriptId || null,
            },
          });
          ok++;
        } catch (err) {
          fail++;
          toast.error(`${f.name}: ${(err as Error).message || "falha"}`);
        }
        setProgress(Math.round(((i + 1) / files.length) * 100));
      }
      if (ok > 0) toast.success(`${ok} áudio(s) enviado(s).${fail ? ` ${fail} falharam.` : ""}`);
      setFiles([]);
      setTitle("");
      setScriptId("");
      if (inputRef.current) inputRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["audio_assets"] });
    } finally {
      setUploading(false);
      setTimeout(() => {
        setProgress(0);
        setCurrentIndex(0);
      }, 600);
    }
  }

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Áudio removido.");
      qc.invalidateQueries({ queryKey: ["audio_assets"] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-3xl text-primary">Áudio</h1>
        <p className="text-sm text-muted-foreground">
          Envie sua narração pronta (MP3, WAV, M4A, OGG…) e associe a um roteiro.
        </p>
      </header>

      <div className="grid gap-4 rounded-xl border border-border bg-card/60 p-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Roteiro (opcional)</Label>
          <Select value={scriptId} onValueChange={pickScript}>
            <SelectTrigger>
              <SelectValue placeholder="Vincular a um roteiro…" />
            </SelectTrigger>
            <SelectContent>
              {scripts.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum roteiro salvo.</div>
              ) : (
                scripts.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="title">
            Título {files.length > 1 && <span className="text-xs text-muted-foreground">(ignorado — usa o nome de cada arquivo)</span>}
          </Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Narração — Humildade"
            disabled={files.length > 1}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="file">Arquivos de áudio (você pode selecionar vários)</Label>
          <Input
            id="file"
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            onChange={(e) => onFilesChange(e.target.files)}
          />
          {files.length > 0 && (
            <ul className="mt-1 space-y-1 rounded-md border border-border/60 bg-background/40 p-2 text-xs">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    {f.name} · {(f.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                  {!uploading && (
                    <button
                      type="button"
                      onClick={() => removeFileAt(i)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Remover ${f.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="md:col-span-2">
          {uploading && (
            <div className="mb-3 space-y-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Enviando {currentIndex} de {files.length}…
              </p>
            </div>
          )}
          <Button
            onClick={upload}
            disabled={uploading || files.length === 0}
            className="bg-primary text-primary-foreground"
          >
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {files.length > 1 ? `Enviar ${files.length} áudios` : "Enviar áudio"}
          </Button>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg text-primary">Suas narrações</h2>
        {isLoading ? (
          <div className="rounded-lg border border-border bg-card/60 p-4 text-sm text-muted-foreground">
            Carregando…
          </div>
        ) : assets.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card/40 p-6 text-sm text-muted-foreground">
            <Mic className="mb-2 h-5 w-5 text-gold" /> Nenhum áudio ainda. Envie o primeiro acima.
          </div>
        ) : (
          <div className="space-y-3">
            {assets.map((a) => (
              <div
                key={a.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card/60 p-4 md:flex-row md:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{a.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.format?.toUpperCase()} ·{" "}
                    {a.duration_seconds ? `${a.duration_seconds}s` : "—"} ·{" "}
                    {a.size_bytes ? `${(a.size_bytes / 1024 / 1024).toFixed(2)} MB` : "—"}
                  </div>
                </div>
                {a.signed_url && (
                  <audio controls src={a.signed_url} className="h-10 md:w-64" preload="none" />
                )}
                <div className="flex items-center gap-2">
                  {a.signed_url && (
                    <a
                      href={a.signed_url}
                      download={`${a.title}.${a.format || "mp3"}`}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary"
                    >
                      <Download className="h-3 w-3" /> Baixar
                    </a>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(a.id)}
                    disabled={deleteMutation.isPending}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
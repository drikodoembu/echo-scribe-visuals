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
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function pickScript(id: string) {
    setScriptId(id);
    const s = scripts.find((x) => x.id === id);
    if (s && !title) setTitle(s.title);
  }

  function onFileChange(f: File | null) {
    setFile(f);
    if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ""));
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
    if (!file) {
      toast.error("Selecione um arquivo de áudio.");
      return;
    }
    if (!title.trim()) {
      toast.error("Informe um título.");
      return;
    }
    const { data: sess } = await supabase.auth.getUser();
    const userId = sess.user?.id;
    if (!userId) {
      toast.error("Sessão expirada.");
      return;
    }
    setUploading(true);
    setProgress(10);
    try {
      const ext = (file.name.split(".").pop() || "mp3").toLowerCase();
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("audio")
        .upload(path, file, {
          contentType: file.type || "audio/mpeg",
          upsert: false,
        });
      if (upErr) throw new Error(upErr.message);
      setProgress(70);
      const duration = await getAudioDuration(file);
      setProgress(85);
      await save({
        data: {
          title: title.trim(),
          storage_path: path,
          format: ext,
          size_bytes: file.size,
          duration_seconds: duration,
          script_id: scriptId || null,
        },
      });
      setProgress(100);
      toast.success("Áudio enviado.");
      setFile(null);
      setTitle("");
      setScriptId("");
      if (inputRef.current) inputRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["audio_assets"] });
    } catch (err) {
      toast.error((err as Error).message || "Falha no upload.");
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 500);
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
          <Label htmlFor="title">Título</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Narração — Humildade"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="file">Arquivo de áudio</Label>
          <Input
            id="file"
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />
          {file && (
            <p className="text-xs text-muted-foreground">
              {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          )}
        </div>
        <div className="md:col-span-2">
          {uploading && (
            <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          <Button
            onClick={upload}
            disabled={uploading || !file}
            className="bg-primary text-primary-foreground"
          >
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Enviar áudio
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
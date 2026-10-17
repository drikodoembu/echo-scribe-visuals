import { pageHead } from "@/lib/page-head";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { Download, Loader2, Music, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteMusicTrack,
  listMusicTracks,
  saveMusicTrack,
} from "@/lib/music.functions";

export const Route = createFileRoute("/_authenticated/app/musicas")({
  head: () => pageHead("Músicas", "Organize as trilhas musicais dos seus vídeos."),
  component: MusicPage,
});

const ACCEPT = "audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/ogg,audio/webm,audio/flac,audio/x-m4a";

function MusicPage() {
  const qc = useQueryClient();
  const list = useServerFn(listMusicTracks);
  const save = useServerFn(saveMusicTrack);
  const del = useServerFn(deleteMusicTrack);

  const { data: tracks = [], isLoading } = useQuery({
    queryKey: ["music_tracks"],
    queryFn: () => list(),
  });

  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function onFileChange(f: File | null) {
    setFile(f);
    if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  }

  async function getDuration(f: File): Promise<number | null> {
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
    if (!file) return toast.error("Selecione um arquivo.");
    if (!title.trim()) return toast.error("Informe um título.");
    const { data: sess } = await supabase.auth.getUser();
    const userId = sess.user?.id;
    if (!userId) return toast.error("Sessão expirada.");
    setUploading(true);
    setProgress(10);
    try {
      const ext = (file.name.split(".").pop() || "mp3").toLowerCase();
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("music")
        .upload(path, file, { contentType: file.type || "audio/mpeg", upsert: false });
      if (upErr) throw new Error(upErr.message);
      setProgress(70);
      const duration = await getDuration(file);
      setProgress(90);
      await save({
        data: {
          title: title.trim(),
          storage_path: path,
          format: ext,
          size_bytes: file.size,
          duration_seconds: duration,
        },
      });
      setProgress(100);
      toast.success("Música enviada.");
      setFile(null);
      setTitle("");
      if (inputRef.current) inputRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["music_tracks"] });
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
      toast.success("Música removida.");
      qc.invalidateQueries({ queryKey: ["music_tracks"] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-3xl text-primary">Músicas</h1>
        <p className="text-sm text-muted-foreground">
          Envie trilhas instrumentais para usar como fundo na montagem do vídeo.
        </p>
      </header>

      <div className="grid gap-4 rounded-xl border border-border bg-card/60 p-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="mtitle">Título</Label>
          <Input
            id="mtitle"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Cordas sacras — contemplativo"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mfile">Arquivo</Label>
          <Input
            id="mfile"
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
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
          <Button onClick={upload} disabled={uploading || !file} className="bg-primary text-primary-foreground">
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Enviar música
          </Button>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg text-primary">Sua biblioteca</h2>
        {isLoading ? (
          <div className="rounded-lg border border-border bg-card/60 p-4 text-sm text-muted-foreground">Carregando…</div>
        ) : tracks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card/40 p-6 text-sm text-muted-foreground">
            <Music className="mb-2 h-5 w-5 text-gold" /> Nenhuma música ainda.
          </div>
        ) : (
          <div className="space-y-3">
            {tracks.map((t) => (
              <div
                key={t.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card/60 p-4 md:flex-row md:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{t.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.format?.toUpperCase()} · {t.duration_seconds ? `${t.duration_seconds}s` : "—"} ·{" "}
                    {t.size_bytes ? `${(t.size_bytes / 1024 / 1024).toFixed(2)} MB` : "—"}
                  </div>
                </div>
                {t.signed_url && <audio controls src={t.signed_url} className="h-10 md:w-64" preload="none" />}
                <div className="flex items-center gap-2">
                  {t.signed_url && (
                    <a
                      href={t.signed_url}
                      download={`${t.title}.${t.format || "mp3"}`}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary"
                    >
                      <Download className="h-3 w-3" /> Baixar
                    </a>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(t.id)}
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

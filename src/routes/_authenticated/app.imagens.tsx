import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { Download, Image as ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
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
  deleteImageAsset,
  listImageAssets,
  saveImageAsset,
} from "@/lib/images.functions";
import { listScripts } from "@/lib/scripts.functions";

export const Route = createFileRoute("/_authenticated/app/imagens")({
  component: ImagesPage,
});

const ACCEPT = "image/png,image/jpeg,image/webp,image/avif,image/gif";

function ImagesPage() {
  const qc = useQueryClient();
  const list = useServerFn(listImageAssets);
  const listScr = useServerFn(listScripts);
  const save = useServerFn(saveImageAsset);
  const del = useServerFn(deleteImageAsset);

  const { data: images = [], isLoading } = useQuery({
    queryKey: ["image_assets"],
    queryFn: () => list(),
  });
  const { data: scripts = [] } = useQuery({
    queryKey: ["scripts"],
    queryFn: () => listScr(),
  });

  const [scriptId, setScriptId] = useState<string>("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const inputRef = useRef<HTMLInputElement | null>(null);

  function readImageDims(f: File): Promise<{ w: number | null; h: number | null }> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => {
        resolve({ w: img.naturalWidth || null, h: img.naturalHeight || null });
        URL.revokeObjectURL(url);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ w: null, h: null });
      };
      img.src = url;
    });
  }

  async function upload() {
    if (files.length === 0) {
      toast.error("Selecione ao menos uma imagem.");
      return;
    }
    const { data: sess } = await supabase.auth.getUser();
    const userId = sess.user?.id;
    if (!userId) {
      toast.error("Sessão expirada.");
      return;
    }
    setUploading(true);
    setProgress({ done: 0, total: files.length });
    let ok = 0;
    for (const file of files) {
      try {
        const ext = (file.name.split(".").pop() || "png").toLowerCase();
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("images")
          .upload(path, file, { contentType: file.type || "image/png", upsert: false });
        if (upErr) throw new Error(upErr.message);
        const { w, h } = await readImageDims(file);
        await save({
          data: {
            title: file.name.replace(/\.[^.]+$/, ""),
            storage_path: path,
            mime_type: file.type || null,
            size_bytes: file.size,
            width: w,
            height: h,
            script_id: scriptId || null,
          },
        });
        ok++;
      } catch (err) {
        toast.error(`${file.name}: ${(err as Error).message}`);
      } finally {
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    }
    if (ok > 0) toast.success(`${ok} imagem(ns) enviada(s).`);
    setUploading(false);
    setFiles([]);
    if (inputRef.current) inputRef.current.value = "";
    qc.invalidateQueries({ queryKey: ["image_assets"] });
  }

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Imagem removida.");
      qc.invalidateQueries({ queryKey: ["image_assets"] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const pct =
    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-3xl text-primary">Imagens</h1>
        <p className="text-sm text-muted-foreground">
          Envie os fundos e cenas que você gerou (Midjourney, SDXL, Flux, etc.) e vincule ao roteiro.
        </p>
      </header>

      <div className="grid gap-4 rounded-xl border border-border bg-card/60 p-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Roteiro (opcional)</Label>
          <Select value={scriptId} onValueChange={setScriptId}>
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
          <Label htmlFor="imgs">Arquivos (múltiplos)</Label>
          <Input
            id="imgs"
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          {files.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {files.length} arquivo(s) selecionado(s).
            </p>
          )}
        </div>
        <div className="md:col-span-2">
          {uploading && (
            <div className="mb-3 space-y-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="text-xs text-muted-foreground">
                {progress.done} / {progress.total}
              </div>
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
            Enviar {files.length > 0 ? `(${files.length})` : ""}
          </Button>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg text-primary">Suas imagens</h2>
        {isLoading ? (
          <div className="rounded-lg border border-border bg-card/60 p-4 text-sm text-muted-foreground">
            Carregando…
          </div>
        ) : images.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card/40 p-6 text-sm text-muted-foreground">
            <ImageIcon className="mb-2 h-5 w-5 text-gold" /> Nenhuma imagem ainda.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {images.map((img) => (
              <div
                key={img.id}
                className="group relative overflow-hidden rounded-lg border border-border bg-card/60"
              >
                {img.signed_url ? (
                  <img
                    src={img.signed_url}
                    alt={img.title}
                    className="aspect-square w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex aspect-square items-center justify-center bg-muted text-muted-foreground">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                )}
                <div className="space-y-1 p-2 text-xs">
                  <div className="truncate font-medium">{img.title}</div>
                  <div className="text-muted-foreground">
                    {img.width && img.height ? `${img.width}×${img.height}` : "—"}
                    {img.size_bytes ? ` · ${(img.size_bytes / 1024).toFixed(0)} KB` : ""}
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    {img.signed_url ? (
                      <a
                        href={img.signed_url}
                        download={img.title}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <Download className="h-3 w-3" /> Baixar
                      </a>
                    ) : (
                      <span />
                    )}
                    <button
                      onClick={() => deleteMutation.mutate(img.id)}
                      disabled={deleteMutation.isPending}
                      className="text-destructive hover:opacity-80"
                      aria-label="Excluir imagem"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
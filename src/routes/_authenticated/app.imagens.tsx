import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { Download, Image as ImageIcon, Loader2, Sparkles, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { parseScript } from "@/lib/scripts.prompt";

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

  const [genScriptId, setGenScriptId] = useState<string>("");
  const [scenePrompts, setScenePrompts] = useState<string[]>([]);
  const [freePrompt, setFreePrompt] = useState("");
  const [aspect, setAspect] = useState<"9:16" | "16:9" | "1:1">("9:16");
  const [genBusy, setGenBusy] = useState(false);
  const [genProgress, setGenProgress] = useState({ done: 0, total: 0 });

  function pickGenScript(id: string) {
    setGenScriptId(id);
    const s = scripts.find((x) => x.id === id);
    setScenePrompts(s ? parseScript(s.content ?? "").imagePrompts : []);
  }

  async function generateOne(prompt: string, title: string) {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) throw new Error("Sessão expirada.");
    const res = await fetch("/api/images/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ prompt, title, aspect, script_id: genScriptId || null }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Limite de requisições atingido.");
      if (res.status === 402) throw new Error("Créditos de IA esgotados no workspace.");
      throw new Error(msg || `Falha (${res.status})`);
    }
  }

  async function generateBatch(prompts: string[]) {
    if (prompts.length === 0) {
      toast.error("Nenhum prompt para gerar.");
      return;
    }
    setGenBusy(true);
    setGenProgress({ done: 0, total: prompts.length });
    let ok = 0;
    for (let i = 0; i < prompts.length; i++) {
      try {
        await generateOne(prompts[i], `Cena ${i + 1}`);
        ok++;
      } catch (err) {
        toast.error(`Cena ${i + 1}: ${(err as Error).message}`);
      } finally {
        setGenProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    }
    if (ok > 0) toast.success(`${ok} imagem(ns) gerada(s).`);
    setGenBusy(false);
    qc.invalidateQueries({ queryKey: ["image_assets"] });
  }

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
          Gere as cenas do roteiro com IA ou envie as suas próprias imagens.
        </p>
      </header>

      <div className="grid gap-4 rounded-xl border border-gold/30 bg-card/60 p-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <h2 className="font-display text-lg text-gold">Gerar cenas com IA</h2>
          <p className="text-xs text-muted-foreground">
            Usa os prompts de imagem do roteiro. Cada cena é salva na sua biblioteca.
          </p>
        </div>
        <div className="space-y-2">
          <Label>Roteiro</Label>
          <Select value={genScriptId} onValueChange={pickGenScript}>
            <SelectTrigger>
              <SelectValue placeholder="Escolher roteiro…" />
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
          <Label>Formato</Label>
          <Select value={aspect} onValueChange={(v) => setAspect(v as typeof aspect)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="9:16">9:16 — Shorts</SelectItem>
              <SelectItem value="16:9">16:9 — vídeo longo</SelectItem>
              <SelectItem value="1:1">1:1 — quadrado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {scenePrompts.length > 0 && (
          <div className="space-y-2 md:col-span-2">
            <Label>Cenas do roteiro ({scenePrompts.length})</Label>
            <ul className="space-y-2">
              {scenePrompts.map((p, i) => (
                <li
                  key={i}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-background/40 p-3 text-xs"
                >
                  <span className="leading-relaxed">
                    <strong className="text-gold">Cena {i + 1}.</strong> {p}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={genBusy}
                    onClick={() => generateBatch([p])}
                  >
                    Gerar
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="free-prompt">Prompt avulso (opcional)</Label>
          <Textarea
            id="free-prompt"
            value={freePrompt}
            onChange={(e) => setFreePrompt(e.target.value)}
            placeholder="Ex.: empty candlelit cathedral at dawn, warm golden light, cinematic"
            className="min-h-[90px] text-sm"
          />
        </div>

        <div className="space-y-3 md:col-span-2">
          {genBusy && genProgress.total > 0 && (
            <div className="space-y-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-gold transition-all"
                  style={{ width: `${Math.round((genProgress.done / genProgress.total) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Gerando {genProgress.done} de {genProgress.total}…
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => generateBatch(scenePrompts)}
              disabled={genBusy || scenePrompts.length === 0}
              className="bg-primary text-primary-foreground"
            >
              {genBusy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Gerar todas as cenas
            </Button>
            <Button
              variant="outline"
              onClick={() => generateBatch([freePrompt.trim()])}
              disabled={genBusy || !freePrompt.trim()}
            >
              Gerar prompt avulso
            </Button>
          </div>
        </div>
      </div>

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
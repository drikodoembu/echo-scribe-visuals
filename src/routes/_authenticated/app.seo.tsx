import { pageHead } from "@/lib/page-head";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Check, Copy, Loader2, Search, Sparkles, Trash2 } from "lucide-react";
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
import { listScripts } from "@/lib/scripts.functions";
import { parseScript } from "@/lib/scripts.prompt";
import { deleteVideoSeo, listVideoSeo, saveVideoSeo } from "@/lib/seo.functions";

export const Route = createFileRoute("/_authenticated/app/seo")({
  component: SeoPage,
  head: () => pageHead("SEO do vídeo", "Prepare títulos, descrições e palavras-chave para seus vídeos."),
});

type Chapter = { time: string; label: string };

type SeoDraft = {
  id: string | null;
  script_id: string | null;
  format: "short" | "long";
  title: string;
  title_options: string[];
  description: string;
  tags: string[];
  hashtags: string[];
  keywords: string[];
  thumbnail_text: string;
  chapters: Chapter[];
  pinned_comment: string;
  category: string | null;
  model: string | null;
};

const EMPTY: SeoDraft = {
  id: null,
  script_id: null,
  format: "short",
  title: "",
  title_options: [],
  description: "",
  tags: [],
  hashtags: [],
  keywords: [],
  thumbnail_text: "",
  chapters: [],
  pinned_comment: "",
  category: null,
  model: null,
};

function toList(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 gap-1 px-2 text-xs"
      onClick={async () => {
        if (!value) return;
        await navigator.clipboard.writeText(value);
        setDone(true);
        toast.success("Copiado.");
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {label ?? "Copiar"}
    </Button>
  );
}

function SeoPage() {
  const qc = useQueryClient();
  const listScr = useServerFn(listScripts);
  const listSeo = useServerFn(listVideoSeo);
  const save = useServerFn(saveVideoSeo);
  const del = useServerFn(deleteVideoSeo);

  const { data: scripts = [] } = useQuery({ queryKey: ["scripts"], queryFn: () => listScr() });
  const { data: saved = [], isLoading } = useQuery({
    queryKey: ["video_seo"],
    queryFn: () => listSeo(),
  });

  const [draft, setDraft] = useState<SeoDraft>(EMPTY);
  const [busy, setBusy] = useState(false);

  const script = useMemo(
    () => scripts.find((s) => s.id === draft.script_id) ?? null,
    [scripts, draft.script_id],
  );

  const titleLen = draft.title.length;
  const descLen = draft.description.length;

  function pickScript(id: string) {
    const s = scripts.find((x) => x.id === id);
    setDraft((d) => ({
      ...d,
      id: null,
      script_id: id,
      format: (s?.format as "short" | "long") ?? "short",
      title: d.title || (s?.title ?? ""),
    }));
  }

  async function generate() {
    if (!script) {
      toast.error("Selecione um roteiro.");
      return;
    }
    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Sessão expirada.");
      const { narration } = parseScript(script.content ?? "");
      const res = await fetch("/api/seo/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: script.title,
          topic: script.topic,
          saint: script.saint,
          format: script.format,
          narration,
        }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || `Falha (${res.status})`);
      }
      const data = (await res.json()) as Omit<SeoDraft, "id" | "script_id" | "format">;
      setDraft((d) => ({ ...d, ...data }));
      toast.success("SEO gerado.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const saveMut = useMutation({
    mutationFn: () => save({ data: draft }),
    onSuccess: (row) => {
      toast.success("SEO salvo.");
      setDraft((d) => ({ ...d, id: (row as { id?: string } | null)?.id ?? d.id }));
      qc.invalidateQueries({ queryKey: ["video_seo"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Removido.");
      qc.invalidateQueries({ queryKey: ["video_seo"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const fullBlock = [
    draft.title,
    "",
    draft.description,
    "",
    draft.hashtags.join(" "),
    "",
    `Tags: ${draft.tags.join(", ")}`,
  ].join("\n");

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary">
          <Search className="h-3.5 w-3.5" /> Otimização
        </div>
        <h1 className="font-display text-4xl text-foreground">SEO do vídeo</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Gere título, descrição, tags, hashtags, capítulos e texto de thumbnail otimizados para o
          YouTube a partir de cada roteiro.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="space-y-2">
            <Label>Roteiro / vídeo</Label>
            <Select value={draft.script_id ?? ""} onValueChange={pickScript}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um roteiro" />
              </SelectTrigger>
              <SelectContent>
                {scripts.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Formato</Label>
            <Select
              value={draft.format}
              onValueChange={(v) => setDraft((d) => ({ ...d, format: v as "short" | "long" }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="short">Short (9:16)</SelectItem>
                <SelectItem value="long">Vídeo longo (16:9)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={generate} disabled={busy || !draft.script_id} className="w-full gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Gerar SEO completo
          </Button>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || !draft.title}
          >
            {saveMut.isPending ? "Salvando..." : draft.id ? "Atualizar" : "Salvar SEO"}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setDraft(EMPTY)}>
            Limpar
          </Button>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-2 flex items-center justify-between">
              <Label>Título</Label>
              <span className={titleLen > 70 ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                {titleLen}/70
              </span>
            </div>
            <div className="flex gap-2">
              <Input
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder="Título otimizado"
              />
              <CopyButton value={draft.title} />
            </div>
            {draft.title_options.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Variações</p>
                {draft.title_options.map((t, i) => (
                  <button
                    key={`${t}-${i}`}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, title: t }))}
                    className="block w-full rounded-md border border-border/60 px-3 py-2 text-left text-sm text-foreground/90 transition hover:border-primary/60 hover:bg-accent"
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-2 flex items-center justify-between">
              <Label>Descrição</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{descLen}/5000</span>
                <CopyButton value={draft.description} />
              </div>
            </div>
            <Textarea
              rows={8}
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="Descrição do vídeo"
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-2 flex items-center justify-between">
                <Label>Tags</Label>
                <CopyButton value={draft.tags.join(", ")} />
              </div>
              <Textarea
                rows={4}
                value={draft.tags.join(", ")}
                onChange={(e) => setDraft((d) => ({ ...d, tags: toList(e.target.value) }))}
                placeholder="separe por vírgula"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {draft.tags.join(", ").length}/500 caracteres — {draft.tags.length} tags
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-2 flex items-center justify-between">
                <Label>Hashtags</Label>
                <CopyButton value={draft.hashtags.join(" ")} />
              </div>
              <Textarea
                rows={4}
                value={draft.hashtags.join(" ")}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    hashtags: e.target.value
                      .split(/\s+/)
                      .map((h) => h.trim())
                      .filter(Boolean)
                      .map((h) => (h.startsWith("#") ? h : `#${h}`)),
                  }))
                }
                placeholder="#catolico #fe"
              />
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-2 flex items-center justify-between">
                <Label>Texto da thumbnail</Label>
                <CopyButton value={draft.thumbnail_text} />
              </div>
              <Input
                value={draft.thumbnail_text}
                onChange={(e) => setDraft((d) => ({ ...d, thumbnail_text: e.target.value }))}
                placeholder="FÉ QUE MOVE"
              />
              <div className="mt-3 flex h-24 items-center justify-center rounded-xl border border-primary/30 bg-gradient-to-br from-primary/15 to-transparent px-4">
                <span className="font-display text-2xl uppercase tracking-wide text-primary">
                  {draft.thumbnail_text || "PRÉVIA"}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-2 flex items-center justify-between">
                <Label>Palavras-chave</Label>
                <CopyButton value={draft.keywords.join(", ")} />
              </div>
              <Textarea
                rows={4}
                value={draft.keywords.join(", ")}
                onChange={(e) => setDraft((d) => ({ ...d, keywords: toList(e.target.value) }))}
                placeholder="separe por vírgula"
              />
            </div>
          </div>

          {draft.format === "long" && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-2 flex items-center justify-between">
                <Label>Capítulos</Label>
                <CopyButton
                  value={draft.chapters.map((c) => `${c.time} ${c.label}`).join("\n")}
                />
              </div>
              <Textarea
                rows={5}
                value={draft.chapters.map((c) => `${c.time} ${c.label}`).join("\n")}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    chapters: e.target.value
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .map((line) => {
                        const [time, ...rest] = line.split(/\s+/);
                        return { time, label: rest.join(" ") };
                      })
                      .filter((c) => c.time && c.label),
                  }))
                }
                placeholder={"00:00 Introdução\n01:20 A citação"}
              />
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-2 flex items-center justify-between">
              <Label>Comentário fixado</Label>
              <CopyButton value={draft.pinned_comment} />
            </div>
            <Textarea
              rows={3}
              value={draft.pinned_comment}
              onChange={(e) => setDraft((d) => ({ ...d, pinned_comment: e.target.value }))}
            />
          </div>

          <div className="flex justify-end">
            <CopyButton value={fullBlock} label="Copiar bloco completo" />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl text-foreground">SEO salvos</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : saved.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum SEO salvo ainda.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {saved.map((row) => (
              <li
                key={row.id}
                className="rounded-2xl border border-border bg-card p-4 text-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{row.title || "(sem título)"}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {row.description}
                    </p>
                    <p className="mt-2 text-xs text-primary">
                      {(row.tags ?? []).slice(0, 6).join(" · ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() =>
                        setDraft({
                          id: row.id,
                          script_id: row.script_id,
                          format: (row.format as "short" | "long") ?? "short",
                          title: row.title ?? "",
                          title_options: (row.title_options as string[]) ?? [],
                          description: row.description ?? "",
                          tags: row.tags ?? [],
                          hashtags: row.hashtags ?? [],
                          keywords: row.keywords ?? [],
                          thumbnail_text: row.thumbnail_text ?? "",
                          chapters: (row.chapters as Chapter[]) ?? [],
                          pinned_comment: row.pinned_comment ?? "",
                          category: row.category,
                          model: row.model,
                        })
                      }
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-destructive"
                      onClick={() => delMut.mutate(row.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
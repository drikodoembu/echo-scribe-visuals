import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Copy, Eye, Loader2, Plus, Save, Sparkles, StopCircle, Trash2 } from "lucide-react";
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
  deleteScript,
  listScripts,
  saveScript,
} from "@/lib/scripts.functions";
import { SCRIPT_SYSTEM_PROMPT, buildScriptPrompt, parseScript } from "@/lib/scripts.prompt";

export const Route = createFileRoute("/_authenticated/app/roteiros")({
  component: RoteirosPage,
});

type Format = "short" | "long";
type ScriptRow = Awaited<ReturnType<typeof listScripts>>[number];

function RoteirosPage() {
  const qc = useQueryClient();
  const list = useServerFn(listScripts);
  const save = useServerFn(saveScript);
  const del = useServerFn(deleteScript);

  const { data: scripts = [], isLoading } = useQuery({
    queryKey: ["scripts"],
    queryFn: () => list(),
  });

  // Persistência local — não perde ao trocar de aba.
  const STORAGE_KEY = "roteiros:draft:v1";
  type Draft = {
    selectedId: string | null;
    title: string;
    topic: string;
    saint: string;
    format: Format;
    duration: number;
    content: string;
  };
  const initial: Draft = (() => {
    if (typeof window === "undefined") {
      return { selectedId: null, title: "", topic: "", saint: "", format: "short", duration: 55, content: "" };
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...JSON.parse(raw) } as Draft;
    } catch {
      // ignore
    }
    return { selectedId: null, title: "", topic: "", saint: "", format: "short", duration: 55, content: "" };
  })();

  const [selectedId, setSelectedId] = useState<string | null>(initial.selectedId);
  const [title, setTitle] = useState(initial.title);
  const [topic, setTopic] = useState(initial.topic);
  const [saint, setSaint] = useState(initial.saint);
  const [format, setFormat] = useState<Format>(initial.format);
  const [duration, setDuration] = useState(initial.duration);
  const [content, setContent] = useState(initial.content);
  const [streaming, setStreaming] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Salva rascunho automaticamente
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ selectedId, title, topic, saint, format, duration, content }),
      );
    } catch {
      // ignore quota
    }
  }, [selectedId, title, topic, saint, format, duration, content]);

  function loadScript(s: ScriptRow) {
    setSelectedId(s.id);
    setTitle(s.title);
    setTopic(s.topic);
    setSaint(s.saint ?? "");
    setFormat((s.format as Format) ?? "short");
    setDuration(s.duration_seconds);
    setContent(s.content);
  }

  function newScript() {
    setSelectedId(null);
    setTitle("");
    setTopic("");
    setSaint("");
    setFormat("short");
    setDuration(55);
    setContent("");
  }

  const previewUserPrompt = buildScriptPrompt({
    topic: topic.trim(),
    saint: saint.trim() || undefined,
    format,
    duration,
  });

  const parsed = parseScript(content);

  async function copyText(text: string, label = "Texto") {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado.`);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  async function copyPreview() {
    const full = `SYSTEM:\n${SCRIPT_SYSTEM_PROMPT}\n\nUSER:\n${previewUserPrompt}`;
    try {
      await navigator.clipboard.writeText(full);
      toast.success("Prompt copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  async function generate() {
    if (!topic.trim()) {
      toast.error("Informe o tema do roteiro.");
      return;
    }
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      toast.error("Sessão expirada. Faça login novamente.");
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming(true);
    setContent("");

    try {
      const res = await fetch("/api/scripts/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ topic, saint: saint || undefined, format, duration }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const msg = await res.text().catch(() => "Falha ao gerar roteiro");
        if (res.status === 429) toast.error("Limite de uso atingido. Tente novamente em instantes.");
        else if (res.status === 402) toast.error("Créditos de IA esgotados no workspace.");
        else toast.error(msg || `Erro ${res.status}`);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setContent(acc);
      }
      if (!title.trim()) {
        setTitle(topic.slice(0, 80));
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        toast.error((err as Error).message || "Erro ao gerar roteiro.");
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !topic.trim() || !content.trim()) {
        throw new Error("Preencha título, tema e conteúdo antes de salvar.");
      }
      return save({
        data: {
          id: selectedId,
          title: title.trim(),
          topic: topic.trim(),
          saint: saint.trim() || null,
          format,
          duration_seconds: duration,
          content,
          model: "gemini-2.5-flash",
        },
      });
    },
    onSuccess: (saved) => {
      toast.success("Roteiro salvo.");
      if (saved && typeof saved === "object" && "id" in saved) {
        setSelectedId((saved as { id: string }).id);
      }
      qc.invalidateQueries({ queryKey: ["scripts"] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Roteiro removido.");
      qc.invalidateQueries({ queryKey: ["scripts"] });
      newScript();
    },
    onError: (err) => toast.error((err as Error).message),
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-primary">Seus roteiros</h2>
          <Button size="sm" variant="secondary" onClick={newScript}>
            <Plus className="mr-1 h-4 w-4" /> Novo
          </Button>
        </div>
        <div className="space-y-1 rounded-2xl border border-border bg-card/70 p-2 shadow-sm backdrop-blur">
          {isLoading ? (
            <div className="p-3 text-base text-muted-foreground">Carregando…</div>
          ) : scripts.length === 0 ? (
            <div className="p-3 text-base text-muted-foreground">
              Nenhum roteiro ainda. Gere o primeiro ao lado.
            </div>
          ) : (
            scripts.map((s) => (
              <button
                key={s.id}
                onClick={() => loadScript(s)}
                className={`w-full rounded-lg px-3 py-2.5 text-left text-base transition hover:bg-secondary/60 ${
                  selectedId === s.id ? "bg-secondary text-secondary-foreground" : ""
                }`}
              >
                <div className="truncate font-medium">{s.title}</div>
                <div className="truncate text-sm text-muted-foreground">
                  {s.format === "short" ? "Shorts" : "Longo"} · {s.duration_seconds}s
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="space-y-6">
        <header className="space-y-1">
          <h1 className="font-display text-4xl text-primary md:text-5xl">Roteiros</h1>
          <p className="text-base text-muted-foreground">
            Gancho, citação de santo, aplicação e chamada — gerados via streaming.
          </p>
        </header>

        <div className="grid gap-5 rounded-2xl border border-border bg-card/70 p-6 shadow-sm backdrop-blur md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="title" className="text-sm font-medium">Título</Label>
            <Input
              id="title"
              placeholder="Ex.: A humildade segundo Santa Teresinha"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-11 text-base"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="topic" className="text-sm font-medium">Tema *</Label>
            <Textarea
              id="topic"
              rows={3}
              placeholder="Sobre o que é o vídeo?"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="text-base leading-relaxed"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="saint" className="text-sm font-medium">Santo (opcional)</Label>
            <Input
              id="saint"
              placeholder="Ex.: Santo Agostinho"
              value={saint}
              onChange={(e) => setSaint(e.target.value)}
              className="h-11 text-base"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Formato</Label>
            <Select
              value={format}
              onValueChange={(v) => {
                const f = v as Format;
                setFormat(f);
                setDuration(f === "short" ? 55 : 180);
              }}
            >
              <SelectTrigger className="h-11 text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="short">Shorts (9:16)</SelectItem>
                <SelectItem value="long">Vídeo longo (16:9)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="duration" className="text-sm font-medium">Duração (segundos)</Label>
            <Input
              id="duration"
              type="number"
              min={20}
              max={600}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value) || 0)}
              className="h-11 text-base"
            />
          </div>
        </div>

        {/* Barra de ação sticky — sempre visível, inclusive Salvar */}
        <div className="sticky top-4 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/90 p-3 shadow-lg backdrop-blur">
          {streaming ? (
            <Button onClick={stop} variant="destructive" size="lg">
              <StopCircle className="mr-2 h-5 w-5" /> Parar
            </Button>
          ) : (
            <Button onClick={generate} size="lg" className="bg-primary text-primary-foreground shadow-md hover:shadow-lg">
              <Sparkles className="mr-2 h-5 w-5" /> Gerar roteiro
            </Button>
          )}
          <Button
            variant="default"
            size="lg"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || streaming || !content.trim()}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Save className="mr-2 h-5 w-5" />
            )}
            Salvar roteiro
          </Button>
          {!content.trim() && !streaming && (
            <span className="text-sm text-muted-foreground">
              Gere ou edite o conteúdo abaixo para habilitar Salvar.
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {selectedId && (
              <Button
                variant="ghost"
                size="lg"
                onClick={() => deleteMutation.mutate(selectedId)}
                disabled={deleteMutation.isPending}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-2 h-5 w-5" /> Excluir
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card/70 shadow-sm backdrop-blur">
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-6 py-4 text-left"
          >
            <span className="inline-flex items-center gap-2 text-base font-medium text-primary">
              <Eye className="h-4 w-4" /> Prévia do prompt enviado à IA
            </span>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${
                showPreview ? "rotate-180" : ""
              }`}
            />
          </button>
          {showPreview && (
            <div className="space-y-4 border-t border-border px-6 py-5">
              <p className="text-sm text-muted-foreground">
                Este é o conteúdo exato enviado ao modelo <code>gemini-2.5-flash</code>{" "}
                quando você clica em <em>Gerar roteiro</em>. Ajuste tema, santo, formato ou
                duração acima para ver a atualização.
              </p>
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  System
                </Label>
                <pre className="whitespace-pre-wrap rounded-md bg-secondary/40 p-3 font-mono text-sm leading-relaxed text-foreground">
                  {SCRIPT_SYSTEM_PROMPT}
                </pre>
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  User
                </Label>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-secondary/40 p-3 font-mono text-sm leading-relaxed text-foreground">
                  {previewUserPrompt}
                </pre>
              </div>
              <div className="flex justify-end">
                <Button size="sm" variant="secondary" onClick={copyPreview}>
                  <Copy className="mr-2 h-4 w-4" /> Copiar prompt completo
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="content" className="text-base font-medium">Prévia do roteiro</Label>
            {streaming && (
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> gerando…
              </span>
            )}
          </div>
          <Textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="O roteiro aparecerá aqui em tempo real. Você pode editar antes de salvar."
            className="min-h-[420px] rounded-2xl border-border bg-card/70 font-serif text-lg leading-relaxed shadow-sm backdrop-blur"
          />
        </div>

        {(parsed.narration || parsed.imagePrompts.length > 0) && (
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-border bg-card/70 p-5 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg text-primary">Roteiro para narrar</h3>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => copyText(parsed.narration, "Roteiro")}
                  disabled={!parsed.narration}
                >
                  <Copy className="mr-1 h-3 w-3" /> Copiar
                </Button>
              </div>
              <pre className="max-h-[460px] overflow-auto whitespace-pre-wrap font-serif text-base leading-relaxed text-foreground">
                {parsed.narration || "—"}
              </pre>
            </div>

            <div className="space-y-3 rounded-2xl border border-border bg-card/70 p-5 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg text-primary">
                  Prompts de imagem ({parsed.imagePrompts.length})
                </h3>
                {parsed.imagePrompts.length > 0 && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      copyText(parsed.imagePrompts.join("\n\n"), "Todos os prompts")
                    }
                  >
                    <Copy className="mr-1 h-3 w-3" /> Copiar todos
                  </Button>
                )}
              </div>
              {parsed.imagePrompts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Os prompts de imagem aparecerão aqui após a geração — cole cada um no seu gerador (Midjourney/SDXL/Flux).
                </p>
              ) : (
                <ol className="max-h-[460px] space-y-2 overflow-auto pr-1">
                  {parsed.imagePrompts.map((p, i) => (
                    <li
                      key={i}
                      className="rounded-lg border border-border bg-background/60 p-3 text-sm"
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="font-medium text-gold">#{i + 1}</span>
                        <button
                          onClick={() => copyText(p, `Prompt #${i + 1}`)}
                          className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 hover:bg-secondary"
                        >
                          <Copy className="h-3 w-3" /> Copiar
                        </button>
                      </div>
                      <p className="whitespace-pre-wrap font-mono leading-snug text-foreground">
                        {p}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
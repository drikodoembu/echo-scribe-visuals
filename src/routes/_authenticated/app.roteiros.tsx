import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  Copy,
  Image as ImageIcon,
  Loader2,
  Mic,
  Plus,
  Save,
  Sparkles,
  StopCircle,
  Trash2,
} from "lucide-react";
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
    customPrompt: string;
  };
  const initial: Draft = (() => {
    if (typeof window === "undefined") {
      return { selectedId: null, title: "", topic: "", saint: "", format: "short", duration: 55, content: "", customPrompt: "" };
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...JSON.parse(raw) } as Draft;
    } catch {
      // ignore
    }
    return { selectedId: null, title: "", topic: "", saint: "", format: "short", duration: 55, content: "", customPrompt: "" };
  })();

  const [selectedId, setSelectedId] = useState<string | null>(initial.selectedId);
  const [title, setTitle] = useState(initial.title);
  const [topic, setTopic] = useState(initial.topic);
  const [saint, setSaint] = useState(initial.saint);
  const [format, setFormat] = useState<Format>(initial.format);
  const [duration, setDuration] = useState(initial.duration);
  const [content, setContent] = useState(initial.content);
  const [customPrompt, setCustomPrompt] = useState(initial.customPrompt);
  const [streaming, setStreaming] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Salva rascunho automaticamente
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ selectedId, title, topic, saint, format, duration, content, customPrompt }),
      );
    } catch {
      // ignore quota
    }
  }, [selectedId, title, topic, saint, format, duration, content, customPrompt]);

  function loadScript(s: ScriptRow) {
    setSelectedId(s.id);
    setTitle(s.title);
    setTopic(s.topic);
    setSaint(s.saint ?? "");
    setFormat((s.format as Format) ?? "short");
    setDuration(s.duration_seconds);
    setContent(s.content);
    // Note: If you want to persist customPrompt in DB, you'd need to add it to the schema.
    // For now, it stays in localStorage.
  }

  function newScript() {
    setSelectedId(null);
    setTitle("");
    setTopic("");
    setSaint("");
    setFormat("short");
    setDuration(55);
    setContent("");
    // We keep the custom prompt even for new scripts unless the user clears it
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
        body: JSON.stringify({ topic, saint: saint || undefined, format, duration, customPrompt: customPrompt.trim() || undefined }),
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
    <div className="mx-auto w-full max-w-[1400px] space-y-10 text-foreground">
      {/* HEADER + STICKY ACTION BAR */}
      <header className="flex flex-col gap-6 border-b border-border/60 pb-8 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />
            Irmão Gabriel · Direção espiritual
          </div>
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-gold md:text-6xl">
            Roteiro de<br />Produção
          </h1>
          <p className="max-w-xl text-base font-light leading-relaxed text-muted-foreground">
            Gancho, citação, aplicação e chamada final — refinados no tom sereno do
            Irmão Gabriel para o canal Catolicoteca.
          </p>
        </div>

        <div className="sticky top-4 z-40 flex flex-wrap items-center gap-2 self-start rounded-2xl border border-border bg-card/80 p-2 shadow-[var(--shadow-gold)] backdrop-blur-md">
          {streaming ? (
            <Button onClick={stop} variant="destructive" size="lg" className="rounded-xl">
              <StopCircle className="mr-2 h-5 w-5" /> Parar
            </Button>
          ) : (
            <Button
              onClick={generate}
              size="lg"
              className="rounded-xl bg-primary font-semibold text-primary-foreground shadow-md hover:brightness-110"
            >
              <Sparkles className="mr-2 h-5 w-5" /> Gerar
            </Button>
          )}
          <Button
            variant="outline"
            size="lg"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || streaming || !content.trim()}
            className="rounded-xl border-border font-medium"
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Save className="mr-2 h-5 w-5" />
            )}
            Salvar
          </Button>
          <div className="mx-1 hidden h-6 w-px bg-border md:block" />
          {selectedId && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => deleteMutation.mutate(selectedId)}
              disabled={deleteMutation.isPending}
              className="rounded-xl text-muted-foreground hover:text-destructive"
              title="Excluir roteiro"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={newScript}
            className="rounded-xl text-muted-foreground hover:text-foreground"
            title="Novo roteiro"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* LEFT COLUMN — Controls + Library */}
        <aside className="space-y-6 lg:col-span-1">
          <div className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">
                Título do Projeto
              </Label>
              <Input
                id="title"
                placeholder="Ex.: A humildade segundo Santa Teresinha"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-11 rounded-lg bg-background/60 text-base"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="topic" className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">
                Tema Central *
              </Label>
              <Textarea
                id="topic"
                rows={4}
                placeholder="Descreva a essência teológica…"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="resize-none rounded-lg bg-background/60 text-base leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="saint" className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">
                  Santo
                </Label>
                <Input
                  id="saint"
                  placeholder="Ex.: Agostinho"
                  value={saint}
                  onChange={(e) => setSaint(e.target.value)}
                  className="h-11 rounded-lg bg-background/60 text-base"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="duration" className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">
                  Duração (s)
                </Label>
                <Input
                  id="duration"
                  type="number"
                  min={20}
                  max={600}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value) || 0)}
                  className="h-11 rounded-lg bg-background/60 text-base"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">
                Formato de Saída
              </Label>
              <Select
                value={format}
                onValueChange={(v) => {
                  const f = v as Format;
                  setFormat(f);
                  setDuration(f === "short" ? 55 : 180);
                }}
              >
                <SelectTrigger className="h-11 rounded-lg bg-background/60 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Shorts (9:16)</SelectItem>
                  <SelectItem value="long">Vídeo longo (16:9)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Prompt Config */}
          <div className="overflow-hidden rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="flex w-full items-center justify-between bg-card/60 p-4 text-left transition-colors hover:bg-card"
            >
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
                Configurações de Prompt (IA)
              </span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${
                  showPreview ? "rotate-180" : ""
                }`}
              />
            </button>
            {showPreview && (
              <div className="space-y-4 border-t border-border bg-card/30 p-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">
                    Instruções Personalizadas (Opcional)
                  </Label>
                  <Textarea
                    placeholder="Quero poder alterar as instrçoes do prompt deixe essa atual como opçao mas quero inserir outra conf de prompt IA"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    rows={4}
                    className="resize-none rounded-lg bg-background/60 text-xs font-mono leading-relaxed"
                  />
                  <p className="text-[9px] leading-tight text-muted-foreground">
                    Se preenchido, o Irmão Gabriel seguirá estas orientações adicionais. Deixe em branco para usar o padrão teológico tradicional.
                  </p>
                </div>

                <div className="h-px bg-border/50" />

                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">System (Padrão)</p>
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-background/60 p-3 font-mono text-[10px] leading-relaxed text-foreground/70">
                    {SCRIPT_SYSTEM_PROMPT}
                  </pre>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">User (Gerado)</p>
                  <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-background/60 p-3 font-mono text-[10px] leading-relaxed text-foreground/70">
                    {previewUserPrompt}
                  </pre>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" variant="secondary" onClick={copyPreview} className="h-8 text-[10px]">
                    <Copy className="mr-2 h-3 w-3" /> Copiar prompt completo
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Library */}
          <div className="space-y-3 rounded-2xl border border-border bg-card/40 p-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold">
                <BookOpen className="h-3.5 w-3.5" /> Biblioteca
              </span>
              <Button size="sm" variant="ghost" onClick={newScript} className="h-7 rounded-md text-xs">
                <Plus className="mr-1 h-3.5 w-3.5" /> Novo
              </Button>
            </div>
            <div className="space-y-1">
              {isLoading ? (
                <div className="p-3 text-sm text-muted-foreground">Carregando…</div>
              ) : scripts.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">
                  Nenhum roteiro ainda. Gere o primeiro.
                </div>
              ) : (
                scripts.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => loadScript(s)}
                    className={`w-full rounded-lg border px-3 py-2.5 text-left transition ${
                      selectedId === s.id
                        ? "border-gold/40 bg-gold/10"
                        : "border-transparent hover:border-border hover:bg-background/40"
                    }`}
                  >
                    <div className="truncate text-sm font-medium text-foreground">{s.title}</div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {s.format === "short" ? "Shorts · 9:16" : "Longo · 16:9"} · {s.duration_seconds}s
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </aside>

        {/* RIGHT COLUMN — Editor + Outputs */}
        <div className="space-y-8 lg:col-span-2">
          {/* Streaming Editor */}
          <div className="relative rounded-2xl border border-border bg-card p-8 shadow-2xl md:p-10">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
            <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-background px-4 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
              Editor de Streaming
            </div>

            <div className="mb-6 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
                Texto em construção
              </span>
              {streaming ? (
                <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
                  Gerando…
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {content.length.toLocaleString()} caracteres
                </span>
              )}
            </div>

            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="O roteiro aparecerá aqui em tempo real. Você pode editar antes de salvar."
              className="min-h-[520px] w-full resize-none border-0 bg-transparent p-0 font-serif text-lg leading-[1.8] text-foreground shadow-none focus-visible:ring-0 md:text-xl"
            />

            {!content.trim() && !streaming && (
              <p className="mt-4 text-sm text-muted-foreground">
                Preencha o tema ao lado e clique em <span className="text-gold">Gerar</span> para começar.
              </p>
            )}
          </div>

          {/* Output Cards */}
          {(parsed.narration || parsed.imagePrompts.length > 0) && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-4 rounded-2xl border border-border bg-card/40 p-6">
                <div className="flex items-center justify-between">
                  <h3 className="inline-flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.18em] text-gold">
                    <Mic className="h-4 w-4" /> Roteiro para Narrar
                  </h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyText(parsed.narration, "Roteiro")}
                    disabled={!parsed.narration}
                    className="h-8 rounded-md"
                  >
                    <Copy className="mr-1 h-3.5 w-3.5" /> Copiar
                  </Button>
                </div>
                <div className="rounded-lg border-l-2 border-gold bg-background/50 p-4">
                  <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap font-serif text-base leading-[1.75] text-foreground">
                    {parsed.narration || "—"}
                  </pre>
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-border bg-card/40 p-6">
                <div className="flex items-center justify-between">
                  <h3 className="inline-flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.18em] text-gold">
                    <ImageIcon className="h-4 w-4" /> Prompts de Imagem ({parsed.imagePrompts.length})
                  </h3>
                  {parsed.imagePrompts.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyText(parsed.imagePrompts.join("\n\n"), "Todos os prompts")}
                      className="h-8 rounded-md"
                    >
                      <Copy className="mr-1 h-3.5 w-3.5" /> Copiar todos
                    </Button>
                  )}
                </div>
                {parsed.imagePrompts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Os prompts aparecerão aqui após a geração — cole cada um no seu gerador (Midjourney/SDXL/Flux).
                  </p>
                ) : (
                  <ol className="max-h-[420px] space-y-2 overflow-auto pr-1">
                    {parsed.imagePrompts.map((p, i) => (
                      <li
                        key={i}
                        className="group flex gap-3 rounded-lg border border-transparent p-3 text-sm transition hover:border-border hover:bg-background/40"
                      >
                        <span className="mt-0.5 font-mono text-xs font-bold text-gold">
                          {String(i + 1).padStart(2, "0")}.
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted-foreground">
                            {p}
                          </p>
                          <button
                            onClick={() => copyText(p, `Prompt #${i + 1}`)}
                            className="mt-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-gold"
                          >
                            <Copy className="h-3 w-3" /> Copiar
                          </button>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
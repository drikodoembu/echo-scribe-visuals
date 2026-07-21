import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { Loader2, Plus, Save, Sparkles, Trash2, StopCircle } from "lucide-react";
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

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [saint, setSaint] = useState("");
  const [format, setFormat] = useState<Format>("short");
  const [duration, setDuration] = useState(55);
  const [content, setContent] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

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
          model: "google/gemini-3.5-flash",
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
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-primary">Seus roteiros</h2>
          <Button size="sm" variant="secondary" onClick={newScript}>
            <Plus className="mr-1 h-4 w-4" /> Novo
          </Button>
        </div>
        <div className="space-y-1 rounded-xl border border-border bg-card/60 p-2">
          {isLoading ? (
            <div className="p-3 text-sm text-muted-foreground">Carregando…</div>
          ) : scripts.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">
              Nenhum roteiro ainda. Gere o primeiro ao lado.
            </div>
          ) : (
            scripts.map((s) => (
              <button
                key={s.id}
                onClick={() => loadScript(s)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm transition hover:bg-secondary/60 ${
                  selectedId === s.id ? "bg-secondary text-secondary-foreground" : ""
                }`}
              >
                <div className="truncate font-medium">{s.title}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {s.format === "short" ? "Shorts" : "Longo"} · {s.duration_seconds}s
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="space-y-5">
        <header className="space-y-1">
          <h1 className="font-display text-3xl text-primary">Roteiros</h1>
          <p className="text-sm text-muted-foreground">
            Gancho, citação de santo, aplicação e chamada — gerados via streaming.
          </p>
        </header>

        <div className="grid gap-4 rounded-xl border border-border bg-card/60 p-5 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              placeholder="Ex.: A humildade segundo Santa Teresinha"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="topic">Tema *</Label>
            <Textarea
              id="topic"
              rows={2}
              placeholder="Sobre o que é o vídeo?"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="saint">Santo (opcional)</Label>
            <Input
              id="saint"
              placeholder="Ex.: Santo Agostinho"
              value={saint}
              onChange={(e) => setSaint(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Formato</Label>
            <Select
              value={format}
              onValueChange={(v) => {
                const f = v as Format;
                setFormat(f);
                setDuration(f === "short" ? 55 : 180);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="short">Shorts (9:16)</SelectItem>
                <SelectItem value="long">Vídeo longo (16:9)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="duration">Duração (segundos)</Label>
            <Input
              id="duration"
              type="number"
              min={20}
              max={600}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value) || 0)}
            />
          </div>
          <div className="flex flex-wrap items-end gap-2 md:col-span-2">
            {streaming ? (
              <Button onClick={stop} variant="destructive">
                <StopCircle className="mr-2 h-4 w-4" /> Parar
              </Button>
            ) : (
              <Button onClick={generate} className="bg-primary text-primary-foreground">
                <Sparkles className="mr-2 h-4 w-4" /> Gerar roteiro
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || streaming || !content.trim()}
            >
              {saveMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar
            </Button>
            {selectedId && (
              <Button
                variant="ghost"
                onClick={() => deleteMutation.mutate(selectedId)}
                disabled={deleteMutation.isPending}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Excluir
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="content">Prévia do roteiro</Label>
            {streaming && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> gerando…
              </span>
            )}
          </div>
          <Textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="O roteiro aparecerá aqui em tempo real. Você pode editar antes de salvar."
            className="min-h-[320px] font-serif text-base leading-relaxed"
          />
        </div>
      </section>
    </div>
  );
}
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Download, Loader2, Mic, Play, Sparkles, Trash2 } from "lucide-react";
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
import { deleteAudioAsset, listAudioAssets } from "@/lib/audio.functions";
import { listScripts } from "@/lib/scripts.functions";

export const Route = createFileRoute("/_authenticated/app/audio")({
  component: AudioPage,
});

const VOICES = [
  { id: "coral", label: "Coral (feminina, calorosa)" },
  { id: "sage", label: "Sage (feminina, serena)" },
  { id: "shimmer", label: "Shimmer (feminina, suave)" },
  { id: "alloy", label: "Alloy (neutra)" },
  { id: "ash", label: "Ash (masculina, grave)" },
  { id: "ballad", label: "Ballad (masculina, reverente)" },
  { id: "echo", label: "Echo (masculina, clara)" },
  { id: "verse", label: "Verse (masculina, expressiva)" },
];

function AudioPage() {
  const qc = useQueryClient();
  const listAudio = useServerFn(listAudioAssets);
  const listScr = useServerFn(listScripts);
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
  const [voice, setVoice] = useState("coral");
  const [text, setText] = useState("");
  const [generating, setGenerating] = useState(false);

  function pickScript(id: string) {
    setScriptId(id);
    const s = scripts.find((x) => x.id === id);
    if (s) {
      setTitle(s.title);
      setText(s.content);
    }
  }

  async function generate() {
    if (!text.trim()) {
      toast.error("Informe o texto da narração.");
      return;
    }
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      toast.error("Sessão expirada.");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/audio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          text,
          voice,
          title: title || text.slice(0, 60),
          script_id: scriptId || null,
        }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        if (res.status === 429) toast.error("Limite de uso atingido. Tente novamente.");
        else if (res.status === 402) toast.error("Créditos de IA esgotados no workspace.");
        else toast.error(msg || `Erro ${res.status}`);
        return;
      }
      toast.success("Áudio gerado.");
      qc.invalidateQueries({ queryKey: ["audio_assets"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setGenerating(false);
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
          Narração via Lovable AI (OpenAI TTS). Escolha um roteiro ou cole o texto e gere um MP3.
        </p>
      </header>

      <div className="grid gap-4 rounded-xl border border-border bg-card/60 p-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Roteiro (opcional)</Label>
          <Select value={scriptId} onValueChange={pickScript}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um roteiro salvo…" />
            </SelectTrigger>
            <SelectContent>
              {scripts.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  Nenhum roteiro salvo ainda.
                </div>
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
          <Label>Voz</Label>
          <Select value={voice} onValueChange={setVoice}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VOICES.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="title">Título</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Narração — Humildade segundo Santa Teresinha"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="text">Texto da narração</Label>
          <Textarea
            id="text"
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Cole aqui o roteiro ou texto a ser narrado (até 5000 caracteres)."
            className="font-serif text-base leading-relaxed"
          />
          <div className="text-right text-xs text-muted-foreground">
            {text.length} / 5000
          </div>
        </div>
        <div className="md:col-span-2">
          <Button onClick={generate} disabled={generating} className="bg-primary text-primary-foreground">
            {generating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Gerar narração
          </Button>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg text-primary">Suas narrações</h2>
        <div className="space-y-3">
          {isLoading ? (
            <div className="rounded-lg border border-border bg-card/60 p-4 text-sm text-muted-foreground">
              Carregando…
            </div>
          ) : assets.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card/40 p-6 text-sm text-muted-foreground">
              <Mic className="mb-2 h-5 w-5 text-gold" /> Nenhuma narração ainda. Gere a primeira acima.
            </div>
          ) : (
            assets.map((a) => (
              <div
                key={a.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card/60 p-4 md:flex-row md:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{a.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.voice} · {a.format?.toUpperCase()} ·{" "}
                    {a.size_bytes ? `${Math.round((a.size_bytes / 1024) * 10) / 10} KB` : "—"}
                  </div>
                </div>
                {a.signed_url && (
                  <audio controls src={a.signed_url} className="h-10 md:w-64" preload="none" />
                )}
                <div className="flex items-center gap-2">
                  {a.signed_url && (
                    <a
                      href={a.signed_url}
                      download={`${a.title}.mp3`}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary"
                    >
                      <Download className="h-3 w-3" /> MP3
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
            ))
          )}
        </div>
      </section>
    </div>
  );
}

// Keep import to avoid tree-shaking noise for Play icon reserved for future waveform
void Play;

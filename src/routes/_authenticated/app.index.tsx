import { pageHead } from "@/lib/page-head";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpen,
  Calendar,
  Image as ImageIcon,
  Mic,
  Music,
  Video,
  Youtube,
  BarChart3,
  Settings,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => pageHead("Painel", "Seu estúdio de roteiros, narração, imagens e montagem de vídeos."),
  component: Dashboard,
});

const MODULES = [
  { to: "/app/roteiros", title: "Roteiros", desc: "Gere roteiros de 50-60s com gancho e citação de santo.", icon: BookOpen },
  { to: "/app/audio", title: "Áudio", desc: "Voz em português via ElevenLabs.", icon: Mic },
  { to: "/app/imagens", title: "Imagens", desc: "Fundos sacros com IA (streaming).", icon: ImageIcon },
  { to: "/app/musicas", title: "Músicas", desc: "Trilhas litúrgicas por estilo.", icon: Music },
  { to: "/app/montagem", title: "Montagem", desc: "MP4 9:16 ou 16:9 direto no navegador (FFmpeg.wasm).", icon: Video },
  { to: "/app/publicacao", title: "Publicação YouTube", desc: "Upload direto, agendamento e histórico.", icon: Youtube },
  { to: "/app/agenda", title: "Agenda", desc: "Cronograma automatizado de publicação.", icon: Calendar },
  { to: "/app/analytics", title: "Analytics", desc: "Views, inscritos e ganhos estimados.", icon: BarChart3 },
  { to: "/app/configuracoes", title: "Configurações", desc: "Vozes, estilos, chaves e cronograma.", icon: Settings },
] as const;

function Dashboard() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-gold">Ad maiorem Dei gloriam</p>
        <h1 className="font-display text-4xl text-primary">Painel</h1>
        <p className="text-muted-foreground">
          Cada módulo abaixo é uma etapa do seu fluxo — do roteiro à publicação.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => (
          <Link
            key={m.to}
            to={m.to}
            className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-gold)]"
          >
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-accent/15 text-accent-foreground ring-1 ring-accent/30">
              <m.icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-lg text-primary">{m.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{m.desc}</p>
            </div>
            <span className="mt-auto text-xs font-medium text-gold opacity-0 transition group-hover:opacity-100">
              Abrir módulo →
            </span>
          </Link>
        ))}
      </div>

      <section className="rounded-xl border border-dashed border-border bg-secondary/40 p-6 text-sm text-muted-foreground">
        <strong className="text-foreground">Próximo passo:</strong> configure suas chaves de API e
        conecte seu canal do YouTube em <Link to="/app/configuracoes" className="text-primary underline">Configurações</Link>.
      </section>
    </div>
  );
}
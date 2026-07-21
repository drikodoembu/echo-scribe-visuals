import { createFileRoute, Link } from "@tanstack/react-router";
import { Cross, Sparkles, Youtube, Wand2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="bg-sacred-gradient min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <Cross className="h-6 w-6 text-primary" />
          <span className="font-display text-lg font-semibold tracking-wide">
            Catolicoteca <span className="text-gold">Auto Creator</span>
          </span>
        </div>
        <Link
          to="/auth"
          className="rounded-md border border-primary/20 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
        >
          Entrar
        </Link>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col items-center gap-8 px-6 pb-24 pt-16 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Ora et labora, com IA
        </span>
        <h1 className="font-display text-5xl leading-tight text-primary md:text-6xl">
          Do sopro do Espírito ao Shorts publicado.
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground md:text-xl">
          Um estúdio completo para o seu canal católico: roteiro com citação de santos,
          áudio, imagem, música, montagem no navegador e publicação direta no YouTube.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to="/auth"
            className="rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground shadow-[var(--shadow-sacred)] transition hover:opacity-95"
          >
            Entrar no estúdio
          </Link>
          <a
            href="#modulos"
            className="rounded-md border border-primary/20 bg-background/60 px-6 py-3 font-medium text-primary transition hover:bg-background"
          >
            Ver módulos
          </a>
        </div>

        <section id="modulos" className="mt-20 grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-border/60 bg-card p-6 text-left shadow-sm transition hover:shadow-[var(--shadow-gold)]"
            >
              <f.icon className="mb-3 h-6 w-6 text-gold" />
              <h3 className="font-display text-lg text-primary">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border/50 py-6 text-center text-xs text-muted-foreground">
        Ad maiorem Dei gloriam · Catolicoteca © {new Date().getFullYear()}
      </footer>
    </div>
  );
}

const FEATURES = [
  { icon: Wand2, title: "Roteiros com IA", desc: "Gancho, citação de santo, explicação e chamada — em 50 a 60 segundos." },
  { icon: Sparkles, title: "Áudio, imagem e música", desc: "Vozes em pt-BR, imagens sacras e trilhas por estilo litúrgico." },
  { icon: Youtube, title: "Montagem + publicação", desc: "Monta no navegador (FFmpeg.wasm) e publica direto no YouTube com agendamento." },
];

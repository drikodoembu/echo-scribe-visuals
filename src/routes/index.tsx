import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Sparkles, Youtube, Wand2 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Auto Creator · Estúdio de histórias do cotidiano com IA" },
      {
        name: "description",
        content:
          "Crie roteiros de histórias do cotidiano, narração, imagens, trilha e monte vídeos Shorts e longos direto no navegador. Publique no YouTube em um só fluxo.",
      },
      { name: "keywords", content: "histórias do cotidiano, roteiros com IA, YouTube Shorts, narração automática, criação de vídeos, Auto Creator" },
      { property: "og:title", content: "Auto Creator · Estúdio de histórias com IA" },
      { property: "og:description", content: "Da ideia ao Shorts publicado — roteiro, áudio, imagem, montagem e publicação no YouTube." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Auto Creator" },
      { name: "twitter:description", content: "Estúdio completo de histórias do cotidiano: roteiro, mídia e publicação no YouTube com IA." },
    ],
    links: [{ rel: "canonical", href: "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Auto Creator",
          applicationCategory: "MultimediaApplication",
          operatingSystem: "Web",
          inLanguage: "pt-BR",
          description:
            "Estúdio de histórias do cotidiano com IA para criar roteiros, áudio, imagens, montagem e publicação no YouTube.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" },
        }),
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="bg-sacred-gradient min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <span className="font-display text-lg font-semibold tracking-wide">
            Auto <span className="text-gold">Creator</span>
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
          <Sparkles className="h-3.5 w-3.5" /> Histórias que prendem, com IA
        </span>
        <h1 className="font-display text-5xl leading-tight text-primary md:text-6xl">
          Da ideia ao Shorts publicado.
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground md:text-xl">
          Um estúdio completo para o seu canal de histórias do cotidiano: roteiro,
          narração, imagem, música, montagem no navegador e publicação direta no YouTube.
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
        Auto Creator © {new Date().getFullYear()}
      </footer>
    </div>
  );
}

const FEATURES = [
  { icon: Wand2, title: "Roteiros com IA", desc: "Gancho, história do cotidiano, reflexão e chamada — em 50 a 60 segundos." },
  { icon: Sparkles, title: "Áudio, imagem e música", desc: "Vozes em pt-BR, imagens geradas por IA e trilhas por estilo." },
  { icon: Youtube, title: "Montagem + publicação", desc: "Monta no navegador (FFmpeg.wasm) e publica direto no YouTube com agendamento." },
];

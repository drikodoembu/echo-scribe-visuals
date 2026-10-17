import { pageHead } from "@/lib/page-head";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/configuracoes")({
  head: () => pageHead("Configurações", "Preferências do seu estúdio Auto Creator."),
  component: Placeholder,
});

function Placeholder() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl text-primary">Configurações</h1>
      <p className="text-muted-foreground">
        Em breve: seleção de voz padrão, estilo visual, chaves de API, conexão com o YouTube
        e cronograma de publicação.
      </p>
      <div className="rounded-xl border border-dashed border-border bg-secondary/40 p-6 text-sm">
        Módulo em construção — próxima etapa da implementação.
      </div>
    </div>
  );
}
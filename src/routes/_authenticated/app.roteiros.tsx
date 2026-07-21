import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/roteiros")({
  component: Placeholder,
});

function Placeholder() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl text-primary">Roteiros</h1>
      <p className="text-muted-foreground">
        Gere roteiros de 50–60s com gancho, citação de santo, aplicação e chamada.
        Streaming token a token via Lovable AI Gateway.
      </p>
      <div className="rounded-xl border border-dashed border-border bg-secondary/40 p-6 text-sm">
        Módulo em construção — próxima etapa da implementação.
      </div>
    </div>
  );
}
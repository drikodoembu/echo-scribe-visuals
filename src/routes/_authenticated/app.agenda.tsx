import { pageHead } from "@/lib/page-head";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/agenda")({
  head: () => pageHead("Agenda", "Área de agenda de publicações do Auto Creator."),
  component: Placeholder,
});

function Placeholder() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl text-primary capitalize">agenda</h1>
      <p className="text-muted-foreground">Módulo em construção — próxima etapa da implementação.</p>
    </div>
  );
}

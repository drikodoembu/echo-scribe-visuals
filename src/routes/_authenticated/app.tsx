import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Calendar,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Mic,
  Music,
  Settings,
  Search,
  Video,
  Youtube,
  Moon,
  Sun,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppShell,
});

type NavItem = {
  to: "/app" | "/app/roteiros" | "/app/audio" | "/app/imagens" | "/app/musicas" | "/app/montagem" | "/app/seo" | "/app/publicacao" | "/app/agenda" | "/app/configuracoes";
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

const NAV: readonly NavItem[] = [
  { to: "/app", label: "Painel", icon: LayoutDashboard, exact: true },
  { to: "/app/roteiros", label: "Roteiros", icon: BookOpen },
  { to: "/app/audio", label: "Áudio", icon: Mic },
  { to: "/app/imagens", label: "Imagens", icon: ImageIcon },
  { to: "/app/musicas", label: "Músicas", icon: Music },
  { to: "/app/montagem", label: "Montagem", icon: Video },
  { to: "/app/seo", label: "SEO", icon: Search },
  { to: "/app/publicacao", label: "Publicação", icon: Youtube },
  { to: "/app/agenda", label: "Agenda", icon: Calendar },
  { to: "/app/configuracoes", label: "Configurações", icon: Settings },
];

function AppShell() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [dark, setDark] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const stored = typeof window !== "undefined" ? localStorage.getItem("theme") : null;
    // Dark por padrão; usuário pode alternar para claro.
    const useDark = stored ? stored === "dark" : true;
    if (useDark) {
      document.documentElement.classList.add("dark");
      setDark(true);
    } else {
      document.documentElement.classList.remove("dark");
      setDark(false);
    }
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Você saiu.");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 px-6 py-6">
          <BookOpen className="h-5 w-5 text-sidebar-primary" />
          <span className="font-display text-base font-semibold tracking-wide">
            Auto Creator
          </span>
        </div>
        <nav aria-label="Menu principal" className="flex-1 space-y-1 px-3">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact ?? false }}
              activeProps={{ className: "bg-sidebar-accent text-sidebar-primary", "aria-current": "page" }}
              className="group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border/60 p-4 text-xs text-sidebar-foreground/60">
          <div className="mb-2 truncate">{email}</div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm"
              onClick={toggleTheme}
              className="flex items-center gap-1 rounded-md border border-sidebar-border/60 px-2 py-1 hover:bg-sidebar-accent"
            >
              {dark ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
              {dark ? "Claro" : "Escuro"}
            </Button>
            <Button variant="ghost" size="sm"
              onClick={handleSignOut}
              className="flex items-center gap-1 rounded-md border border-sidebar-border/60 px-2 py-1 hover:bg-sidebar-accent"
            >
              <LogOut className="h-3 w-3" /> Sair
            </Button>
          </div>
        </div>
      </aside>

      <header className="min-w-0 border-b border-sidebar-border bg-sidebar text-sidebar-foreground md:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="flex items-center gap-2 font-display font-semibold">
            <BookOpen className="h-5 w-5 text-sidebar-primary" /> Auto Creator
          </span>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={dark ? "Ativar tema claro" : "Ativar tema escuro"} title={dark ? "Ativar tema claro" : "Ativar tema escuro"}>
              {dark ? <Sun /> : <Moon />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sair" title="Sair"><LogOut /></Button>
          </div>
        </div>
        <nav aria-label="Menu principal" className="flex gap-1 overflow-x-auto px-3 pb-3">
          {NAV.map((item) => (
            <Link key={item.to} to={item.to}
              activeOptions={{ exact: item.exact ?? false }}
              activeProps={{ className: "bg-sidebar-accent text-sidebar-primary", "aria-current": "page" }}
              className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              <item.icon className="h-4 w-4" />{item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="min-w-0 flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
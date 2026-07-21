import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Calendar,
  Cross,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Mic,
  Music,
  Settings,
  Video,
  Youtube,
  Moon,
  Sun,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppShell,
});

type NavItem = {
  to: "/app" | "/app/roteiros" | "/app/audio" | "/app/imagens" | "/app/musicas" | "/app/montagem" | "/app/publicacao" | "/app/agenda" | "/app/configuracoes";
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
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 px-6 py-6">
          <Cross className="h-5 w-5 text-sidebar-primary" />
          <span className="font-display text-base font-semibold tracking-wide">
            Catolicoteca
          </span>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact ?? false }}
              className="group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground [&.active]:bg-sidebar-accent [&.active]:text-sidebar-primary"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border/60 p-4 text-xs text-sidebar-foreground/60">
          <div className="mb-2 truncate">{email}</div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="flex items-center gap-1 rounded-md border border-sidebar-border/60 px-2 py-1 hover:bg-sidebar-accent"
            >
              {dark ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
              {dark ? "Claro" : "Escuro"}
            </button>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1 rounded-md border border-sidebar-border/60 px-2 py-1 hover:bg-sidebar-accent"
            >
              <LogOut className="h-3 w-3" /> Sair
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

import { Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeSelector } from "@/components/ui/theme-selector";
import { NotificationCenter } from "@/components/Notifications/NotificationCenter";
import { GlobalSearch, useGlobalSearch } from "@/components/GlobalSearch/GlobalSearch";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AppHeader() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { logout, user, session, profile } = useAuth();
  const { open, setOpen } = useGlobalSearch();

  const handleLogout = () => {
    logout();
    toast({ title: "Logout realizado", description: "Você foi desconectado com sucesso" });
  };

  const getUserDisplayName = () => {
    if (profile?.full_name && !['Usuário', 'Advogado(a)'].includes(profile.full_name)) return profile.full_name;
    if (user?.name && !['Usuário', 'Advogado(a)'].includes(user.name)) return user.name;
    if (session?.user?.user_metadata?.full_name) return session.user.user_metadata.full_name;
    if (session?.user?.user_metadata?.name) return session.user.user_metadata.name;
    const emailToUse = profile?.email || user?.email || session?.user?.email;
    if (emailToUse) {
      return emailToUse.split('@')[0].split(/[.\-_]/)
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
    return "Usuário";
  };

  const displayEmail = profile?.email || user?.email || session?.user?.email || "email@exemplo.com";
  const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);

  return (
    <header className="h-16 md:h-20 border-b border-black/5 dark:border-border bg-background sticky top-0 z-50 flex items-center justify-between px-4 md:px-6 gap-3">

      {/* Sidebar trigger */}
      <SidebarTrigger className="h-10 w-10 hover:bg-primary/10 transition-colors rounded-xl flex items-center justify-center shrink-0" />

      {/* Barra de busca — trigger que abre o Command Dialog */}
      <button
        onClick={() => setOpen(true)}
        className="hidden lg:flex flex-1 max-w-xl items-center gap-3 h-11 px-4 rounded-2xl border border-black/5 dark:border-border bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-all text-left group"
      >
        <Search className="h-4 w-4 text-muted-foreground/40 shrink-0 group-hover:text-muted-foreground/70 transition-colors" />
        <span className="flex-1 text-sm text-muted-foreground/40 font-medium group-hover:text-muted-foreground/60 transition-colors">
          Buscar casos, clientes, tarefas...
        </span>
        <kbd className="hidden sm:flex h-5 select-none items-center gap-0.5 rounded border border-black/8 dark:border-border bg-muted/40 px-1.5 font-mono text-[10px] font-medium text-muted-foreground/30 shrink-0">
          {isMac ? "⌘" : "Ctrl"} K
        </kbd>
      </button>

      {/* Botão de busca mobile */}
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden h-10 w-10 flex items-center justify-center rounded-xl hover:bg-muted/60 transition-colors"
      >
        <Search className="h-4 w-4 text-muted-foreground/60" />
      </button>

      {/* Ações */}
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        <NotificationCenter />

        <div className="h-10 w-10 flex items-center justify-center p-1 rounded-xl bg-primary/5 border border-black/5 dark:border-border hover:bg-primary/10 transition-colors">
          <ThemeSelector />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost"
              className="h-10 w-10 md:h-12 md:w-12 rounded-2xl p-0 hover:bg-primary/10 transition-all border border-black/5 dark:border-border relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <User className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 p-2 rounded-3xl bg-popover/95 border-black/5 dark:border-border shadow-premium mt-4">
            <DropdownMenuLabel className="p-4">
              <div className="flex flex-col space-y-1">
                <p className="text-base font-extrabold uppercase tracking-tight">{getUserDisplayName()}</p>
                <p className="text-xs text-muted-foreground font-medium truncate">{displayEmail}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-black/5 dark:bg-muted/30 mx-2" />
            <div className="grid gap-1 py-2">
              <DropdownMenuItem
                className="rounded-xl px-4 py-3 cursor-pointer hover:bg-primary/10 focus:bg-primary/10 font-bold transition-all"
                onClick={() => navigate("/perfil")}
              >
                Meu Perfil
              </DropdownMenuItem>
              <DropdownMenuItem
                className="rounded-xl px-4 py-3 cursor-pointer hover:bg-primary/10 focus:bg-primary/10 font-bold transition-all"
                onClick={() => navigate("/configuracoes")}
              >
                Configurações
              </DropdownMenuItem>
            </div>
            <DropdownMenuSeparator className="bg-black/5 dark:bg-muted/30 mx-2" />
            <DropdownMenuItem
              className="text-destructive rounded-xl px-4 py-3 cursor-pointer hover:bg-destructive/10 focus:bg-destructive/10 font-bold transition-all mt-1"
              onClick={handleLogout}
            >
              Encerrar Sessão
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Dialog de busca global */}
      <GlobalSearch open={open} onOpenChange={setOpen} />
    </header>
  );
}

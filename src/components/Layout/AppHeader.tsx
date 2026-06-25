
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeSelector } from "@/components/ui/theme-selector";
import { NotificationCenter } from "@/components/Notifications/NotificationCenter";
import { GlobalSearchBar } from "@/components/GlobalSearch/GlobalSearch";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AppHeader() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { logout, user, session, profile } = useAuth();

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

  return (
    <header className="h-16 md:h-20 border-b border-black/5 dark:border-border bg-background sticky top-0 z-50 flex items-center gap-3 px-4 md:px-6">

      <SidebarTrigger className="h-10 w-10 hover:bg-primary/10 transition-colors rounded-xl flex items-center justify-center shrink-0" />

      {/* Busca inline */}
      <GlobalSearchBar />

      {/* Ações */}
      <div className="flex items-center gap-2 md:gap-3 ml-auto shrink-0">
        <NotificationCenter />

        <div className="h-10 w-10 flex items-center justify-center p-1 rounded-xl bg-primary/5 border border-black/5 dark:border-border hover:bg-primary/10 transition-colors">
          <ThemeSelector />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost"
              className="h-10 w-10 md:h-11 md:w-11 rounded-2xl p-0 hover:bg-primary/10 transition-all border border-black/5 dark:border-border relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <User className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 p-2 rounded-3xl bg-popover/95 border-black/5 dark:border-border shadow-xl mt-4">
            <DropdownMenuLabel className="p-4">
              <p className="text-base font-extrabold uppercase tracking-tight">{getUserDisplayName()}</p>
              <p className="text-xs text-muted-foreground font-medium truncate mt-0.5">{displayEmail}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-black/5 dark:bg-muted/30 mx-2" />
            <div className="grid gap-1 py-2">
              <DropdownMenuItem className="rounded-xl px-4 py-3 cursor-pointer hover:bg-primary/10 focus:bg-primary/10 font-bold" onClick={() => navigate("/perfil")}>
                Meu Perfil
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-xl px-4 py-3 cursor-pointer hover:bg-primary/10 focus:bg-primary/10 font-bold" onClick={() => navigate("/configuracoes")}>
                Configurações
              </DropdownMenuItem>
            </div>
            <DropdownMenuSeparator className="bg-black/5 dark:bg-muted/30 mx-2" />
            <DropdownMenuItem className="text-destructive rounded-xl px-4 py-3 cursor-pointer hover:bg-destructive/10 focus:bg-destructive/10 font-bold mt-1" onClick={handleLogout}>
              Encerrar Sessão
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

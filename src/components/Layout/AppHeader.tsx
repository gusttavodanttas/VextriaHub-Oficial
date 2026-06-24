
import { Bell, Search, User, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeSelector } from "@/components/ui/theme-selector";
import { NotificationCenter } from "@/components/Notifications/NotificationCenter";
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

  const handleLogout = () => {
    console.log("Logout clicado - AppHeader");
    
    // Usar a função logout do contexto
    logout();
    
    toast({
      title: "Logout realizado",
      description: "Você foi desconectado com sucesso",
    });
  };

  const handlePlanClick = () => {
    toast({
      title: "Plano Atual",
      description: "Você está no plano Premium - Funcionalidade em desenvolvimento",
    });
  };

  const getUserDisplayName = () => {
    // 1. Tentar pegar o nome real do banco de dados (que não sejam os placeholders de fallback)
    if (profile?.full_name && !['Usuário', 'Advogado(a)'].includes(profile.full_name)) return profile.full_name;
    if (user?.name && !['Usuário', 'Advogado(a)'].includes(user.name)) return user.name;
    
    // 2. Tentar pegar dos metadados da sessão (caso o front-end injetou no OAuth, ex: Google)
    if (session?.user?.user_metadata?.full_name) return session.user.user_metadata.full_name;
    if (session?.user?.user_metadata?.name) return session.user.user_metadata.name;

    // 3. Fallback amigável usando a primeira parte do email se houver
    const emailToUse = profile?.email || user?.email || session?.user?.email;
    if (emailToUse) {
      const emailPrefix = emailToUse.split('@')[0];
      // Capitalizar e remover pontos (ex: joao.silva -> Joao Silva)
      return emailPrefix
        .split(/[.\-_]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
    
    return "Usuário";
  };

  const displayEmail = profile?.email || user?.email || session?.user?.email || "email@exemplo.com";

  return (
    <header className="h-16 md:h-20 border-b border-black/5 dark:border-white/5 bg-background/40 backdrop-blur-2xl sticky top-0 z-50 flex items-center justify-between px-6 md:px-10">
      {/* Sidebar Trigger & Branding Mobile */}
      <div className="flex items-center gap-4">
        <SidebarTrigger className="h-10 w-10 hover:bg-primary/10 transition-colors rounded-xl flex items-center justify-center" />
      </div>

      {/* Premium Search Bar */}
      <div className="hidden lg:flex flex-1 max-w-xl mx-8">
        <div className="relative w-full group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-transparent blur-sm opacity-0 group-focus-within:opacity-100 transition duration-500" />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Buscar casos, clientes, tarefas..."
            className="pl-12 bg-black/[0.03] dark:bg-white/[0.03] border-black/5 dark:border-white/5 h-12 rounded-2xl text-base focus:ring-2 focus:ring-primary/20 transition-all font-medium shadow-inner"
          />
        </div>
      </div>

      {/* Actions Section */}
      <div className="flex items-center gap-3 md:gap-5">
        <NotificationCenter />

        <div className="h-10 w-10 flex items-center justify-center p-1 rounded-xl bg-primary/5 border border-black/5 dark:border-white/5 hover:bg-primary/10 transition-colors">
          <ThemeSelector />
        </div>

        {/* User Profile Hook */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-12 w-12 rounded-2xl p-0 hover:bg-primary/10 transition-all border border-black/5 dark:border-white/5 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <User className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 p-2 rounded-3xl bg-popover/95 backdrop-blur-2xl border-black/5 dark:border-white/10 shadow-premium mt-4">
            <DropdownMenuLabel className="p-4">
              <div className="flex flex-col space-y-1">
                <p className="text-base font-extrabold uppercase tracking-tight text-gradient">{getUserDisplayName()}</p>
                <p className="text-xs text-muted-foreground font-medium truncate">{displayEmail}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-black/5 dark:bg-white/5 mx-2" />
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
            <DropdownMenuSeparator className="bg-black/5 dark:bg-white/5 mx-2" />
            <DropdownMenuItem 
              className="text-destructive rounded-xl px-4 py-3 cursor-pointer hover:bg-destructive/10 focus:bg-destructive/10 font-bold transition-all mt-1"
              onClick={handleLogout}
            >
              Encerrar Sessão
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

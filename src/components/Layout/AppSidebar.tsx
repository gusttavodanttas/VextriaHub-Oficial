import { useState } from "react";
import { 
  Home, 
  FileText, 
  Users, 
  Calendar, 
  BookOpen,
  Settings,
  UserCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  UserCheck,
  Tag,
  BarChart3,
  UserPlus,
  CalendarDays,
  DollarSign,
  Target,
  UsersIcon,
  MessageSquareText,
  Shield,
  Building2,
  AlertCircle,
  Clock,
  CreditCard
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { usePlanFeatures } from '@/hooks/usePlanFeatures';

const menuItems = [
  { title: "Início", url: "/dashboard", icon: Home },
  { 
    title: "Processos", 
    url: "/processos", 
    icon: FileText,
    items: [
      { title: "Meus Processos", url: "/processos?tab=carteira" },
      { title: "Importar / Novo", url: "/processos?tab=novo" },
    ]
  },
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "CRM", url: "/crm", icon: UserPlus },
  { title: "Agenda", url: "/agenda", icon: CalendarDays },
  { title: "Audiências", url: "/audiencias", icon: Calendar },
  { title: "Atendimentos", url: "/atendimentos", icon: UserCheck },
  { title: "Tarefas", url: "/tarefas", icon: Calendar },
  { title: "Timesheet", url: "/timesheet", icon: Clock },
  { title: "Prazos", url: "/prazos", icon: AlertCircle },
  { title: "Publicações", url: "/publicacoes", icon: BookOpen },
  { title: "Consultivo", url: "/consultivo", icon: MessageSquareText },
];

// Itens exclusivos para ADMs
const adminOnlyItems = [
  { title: "Gráficos", url: "/graficos", icon: BarChart3 },
  { title: "Financeiro", url: "/financeiro", icon: DollarSign },
  { title: "Metas", url: "/metas", icon: Target },
  { title: "Etiquetas", url: "/etiquetas", icon: Tag },
  { title: "Equipe", url: "/equipe", icon: UsersIcon },
];

const bottomItems = [
  { title: "Perfil", url: "/perfil", icon: UserCircle },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const { state, toggleSidebar, isMobile } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { logout } = useAuth();
  const { toast } = useToast();
  const { 
    canViewAdmin, 
    canManageOffice, 
    canViewGraficos, 
    canViewFinanceiro, 
    canViewMetas, 
    canViewEtiquetas, 
    canViewEquipe 
  } = usePermissions();
  const { isSuperAdmin, isAdmin, user } = useAuth();

  // Debug das permissões
  console.log('📋 Sidebar Permissions Debug:', {
    user: user?.email,
    isAdmin,
    isSuperAdmin,
    canViewGraficos,
    canViewFinanceiro,
    canViewMetas,
    canViewEtiquetas,
    canViewEquipe,
    canViewAdmin,
    canManageOffice
  });

  // Filtrar itens administrativos baseado em permissões específicas
  const filteredAdminItems = adminOnlyItems.filter(item => {
    switch (item.url) {
      case '/graficos':
        return canViewGraficos;
      case '/financeiro':
        return canViewFinanceiro;
      case '/metas':
        return canViewMetas;
      case '/etiquetas':
        return canViewEtiquetas;
      case '/equipe':
        return canViewEquipe;
      default:
        return false;
    }
  });

  // Itens da Plataforma exclusivos para Super Admin principal
  const isMainSuperAdmin = user?.email?.toLowerCase().trim() === 'contato@vextriahub.com.br';
  
  const platformItems = [
    { title: "Métricas", url: "/admin?tab=dashboard", icon: BarChart3 },
    { title: "Escritórios", url: "/admin?tab=offices", icon: Building2 },
    { title: "Assinaturas", url: "/admin?tab=subscriptions", icon: CreditCard },
    { title: "Solicitações", url: "/admin?tab=requests", icon: AlertCircle },
  ];

  // Combinar itens do menu baseado no papel do usuário
  // Se for o super_admin principal, mostra APENAS os itens da plataforma
  const allMenuItems = isMainSuperAdmin ? platformItems : [...menuItems, ...filteredAdminItems];

  const handleLogout = () => {
    console.log("Logout clicado - AppSidebar");
    
    // Usar a função logout do contexto
    logout();
    
    toast({
      title: "Logout realizado",
      description: "Você foi desconectado com sucesso",
    });
  };

  const location = useLocation();

  const isLinkActive = (url: string) => {
    const currentPathWithSearch = location.pathname + location.search;
    
    // Tratamento especial para o Dashboard Global (/admin sem parâmetro ou com tab=dashboard)
    if (url === '/admin?tab=dashboard') {
      return currentPathWithSearch === '/admin' || currentPathWithSearch === '/admin?tab=dashboard';
    }

    // Se a URL do item tem query param, faz match exato
    if (url.includes('?')) {
      return currentPathWithSearch === url;
    }

    // Caso contrário, match pelo pathname (comportamento padrão)
    return location.pathname === url;
  };

  const getNavClasses = (isActiveManual: boolean) =>
    `flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-500 text-sm md:text-[15px] w-full group relative overflow-hidden ${
      isActiveManual 
        ? "bg-primary text-primary-foreground font-black shadow-premium scale-[1.02] z-10" 
        : "hover:bg-primary/10 text-sidebar-foreground hover:text-primary hover:translate-x-1 font-bold"
    }`;

  return (
    <Sidebar className="border-r border-black/5 dark:border-white/5 bg-sidebar-background/40 backdrop-blur-2xl" collapsible="icon">
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 md:p-4 border-b border-black/5 dark:border-sidebar-border">
          {(!isCollapsed || isMobile) ? (
            <div className="flex items-center">
              <img 
                src="/vextria-logo.svg" 
                alt="VextriaHub" 
                className="h-8 md:h-10 w-auto"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center w-full">
              <img 
                src="/vextria-icon.svg" 
                alt="VextriaHub" 
                className="h-8 w-8"
              />
            </div>
          )}
          {!isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 md:h-8 md:w-8 rounded-xl hover:bg-primary/10"
              onClick={toggleSidebar}
            >
              {isCollapsed ? <ChevronRight className="h-3 w-3 md:h-4 md:w-4" /> : <ChevronLeft className="h-3 w-3 md:h-4 md:w-4" />}
            </Button>
          )}
        </div>

        <SidebarContent className="flex-1 px-2 md:px-3">
          <SidebarGroup>
            <SidebarGroupLabel className={`text-[10px] font-black uppercase tracking-widest px-4 mb-2 ${(isCollapsed && !isMobile) ? "sr-only" : ""}`}>
              {isSuperAdmin ? 'Gestão da Plataforma' : 'Menu Principal'}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {allMenuItems.map((item) => {
                  const isActive = isLinkActive(item.url);
                  const hasSubItems = item.items && item.items.length > 0;
                  
                  if (hasSubItems) {
                    return (
                      <Collapsible
                        key={item.title}
                        asChild
                        defaultOpen={location.pathname.startsWith(item.url)}
                        className="group/collapsible"
                      >
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton tooltip={item.title} className={getNavClasses(isActive)}>
                              <item.icon className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
                              {(!isCollapsed || isMobile) && (
                                <>
                                  <span className="truncate flex-1">{item.title}</span>
                                  <ChevronDown className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                                </>
                              )}
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-black/10 dark:border-white/10 px-2.5 py-0.5 mt-1">
                              {item.items.map((subItem) => (
                                <NavLink
                                  key={subItem.title}
                                  to={subItem.url}
                                  className={({ isActive }) => 
                                    `flex h-9 items-center gap-2 rounded-lg px-3 text-[13px] transition-all duration-300 font-bold ${
                                      isActive 
                                        ? "text-primary bg-primary/10" 
                                        : "text-sidebar-foreground/70 hover:text-primary hover:bg-primary/5"
                                    }`
                                  }
                                >
                                  {subItem.title}
                                </NavLink>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    );
                  }

                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild className="p-0" isActive={isActive}>
                        <NavLink to={item.url} end={!item.url.includes('?')} className={() => getNavClasses(isActive)}>
                          <item.icon className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
                          {(!isCollapsed || isMobile) && <span className="truncate">{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <Separator className="my-3 md:my-4 bg-black/5 dark:bg-white/5" />

          {/* Menu de Administração (Oculto para Super Admin porque já está no menu principal) */}
          {(canViewAdmin || canManageOffice) && !isMainSuperAdmin && !isSuperAdmin && (
            <SidebarGroup>
              <SidebarGroupLabel className={`text-[10px] font-black uppercase tracking-widest px-4 mb-2 ${(isCollapsed && !isMobile) ? "sr-only" : ""}`}>
                Administração
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {canViewAdmin && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild className="p-0" isActive={isLinkActive('/admin')}>
                        <NavLink to="/admin" className={({ isActive }) => getNavClasses(isActive || isLinkActive('/admin'))}>
                          <Shield className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
                          {(!isCollapsed || isMobile) && <span className="truncate">Administração</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {canManageOffice && !isSuperAdmin && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild className="p-0" isActive={isLinkActive('/escritorio')}>
                        <NavLink to="/escritorio" className={({ isActive }) => getNavClasses(isActive || isLinkActive('/escritorio'))}>
                          <Building2 className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
                          {(!isCollapsed || isMobile) && <span className="truncate">Meu Escritório</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {(canViewAdmin || canManageOffice) && !isMainSuperAdmin && !isSuperAdmin && <Separator className="my-3 md:my-4 bg-black/5 dark:bg-white/5" />}

          {/* Configurações - oculto para Super Admin */}
          {!isMainSuperAdmin && !isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className={`text-[10px] font-black uppercase tracking-widest px-4 mb-2 ${(isCollapsed && !isMobile) ? "sr-only" : ""}`}>
              Configurações
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {bottomItems.map((item) => {
                  const isActive = isLinkActive(item.url);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild className="p-0" isActive={isActive}>
                        <NavLink to={item.url} className={() => getNavClasses(isActive)}>
                          <item.icon className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
                          {(!isCollapsed || isMobile) && <span className="truncate">{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          )}
        </SidebarContent>

        <SidebarFooter className="p-2 md:p-3 border-t border-black/5 dark:border-sidebar-border">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton 
                onClick={handleLogout}
                className="flex items-center gap-2 md:gap-3 px-3 py-3 rounded-2xl transition-all duration-200 text-sm md:text-base w-full text-destructive hover:bg-destructive/10 hover:text-destructive h-auto font-black uppercase tracking-widest"
              >
                <LogOut className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
                {(!isCollapsed || isMobile) && <span className="truncate">Sair do Hub</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

      </div>
    </Sidebar>
  );
}

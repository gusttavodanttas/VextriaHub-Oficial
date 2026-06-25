import { useState } from "react";
import {
  Home, FileText, Users, Calendar, BookOpen, Settings, UserCircle, LogOut,
  ChevronLeft, ChevronRight, ChevronDown, UserCheck, Tag, BarChart3, UserPlus,
  CalendarDays, DollarSign, Target, UsersIcon, MessageSquareText, Shield,
  Building2, AlertCircle, Clock, CreditCard, Trash2,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const menuItems = [
  { title: "Início", url: "/dashboard", icon: Home },
  {
    title: "Processos", url: "/processos", icon: FileText,
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
  { title: "Tarefas", url: "/tarefas", icon: Clock },
  { title: "Timesheet", url: "/timesheet", icon: Clock },
  { title: "Prazos", url: "/prazos", icon: AlertCircle },
  { title: "Publicações", url: "/publicacoes", icon: BookOpen },
  { title: "Consultivo", url: "/consultivo", icon: MessageSquareText },
];

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
  const { canViewAdmin, canManageOffice, canViewGraficos, canViewFinanceiro, canViewMetas, canViewEtiquetas, canViewEquipe } = usePermissions();
  const { isSuperAdmin, user } = useAuth();

  const filteredAdminItems = adminOnlyItems.filter(item => {
    switch (item.url) {
      case '/graficos': return canViewGraficos;
      case '/financeiro': return canViewFinanceiro;
      case '/metas': return canViewMetas;
      case '/etiquetas': return canViewEtiquetas;
      case '/equipe': return canViewEquipe;
      default: return false;
    }
  });

  const isMainSuperAdmin = user?.email?.toLowerCase().trim() === 'contato@vextriahub.com.br';

  const platformItems = [
    { title: "Métricas", url: "/admin?tab=dashboard", icon: BarChart3 },
    { title: "Escritórios", url: "/admin?tab=offices", icon: Building2 },
    { title: "Assinaturas", url: "/admin?tab=subscriptions", icon: CreditCard },
    { title: "Solicitações", url: "/admin?tab=requests", icon: AlertCircle },
    { title: "Lixeira", url: "/lixeira", icon: Trash2 },
  ];

  const allMenuItems = isMainSuperAdmin ? platformItems : [...menuItems, ...filteredAdminItems];

  const handleLogout = () => {
    logout();
    toast({ title: "Logout realizado", description: "Você foi desconectado com sucesso" });
  };

  const location = useLocation();

  const isLinkActive = (url: string) => {
    const cur = location.pathname + location.search;
    if (url === '/admin?tab=dashboard') return cur === '/admin' || cur === '/admin?tab=dashboard';
    if (url.includes('?')) return cur === url;
    return location.pathname === url;
  };

  const getNavClasses = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-[13px] w-full ${
      active
        ? "bg-primary text-primary-foreground font-black shadow-md"
        : "hover:bg-muted/60 text-sidebar-foreground hover:text-foreground font-semibold"
    }`;

  // collapsed = icon mode on desktop
  const collapsed = isCollapsed && !isMobile;

  const wrapTooltip = (key: string, label: string, el: React.ReactNode) =>
    collapsed ? (
      <Tooltip key={key}>
        <TooltipTrigger asChild>{el as React.ReactElement}</TooltipTrigger>
        <TooltipContent side="right" className="font-semibold text-xs">{label}</TooltipContent>
      </Tooltip>
    ) : (el as React.ReactElement);

  return (
    <TooltipProvider delayDuration={0}>
      <Sidebar className="border-r border-black/5 dark:border-border bg-sidebar-background/40" collapsible="icon">
        <div className="flex h-full flex-col">

          {/* Header */}
          <div className={`flex items-center border-b border-black/5 dark:border-sidebar-border transition-all duration-200 ${collapsed ? "justify-center p-3" : "justify-between p-3"}`}>
            {!collapsed
              ? <img src="/vextria-logo.svg" alt="VextriaHub" className="h-8 w-auto" />
              : <img src="/vextria-icon.svg" alt="VextriaHub" className="h-7 w-7" />
            }
            {!isMobile && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg hover:bg-muted/60 shrink-0"
                onClick={toggleSidebar}
              >
                {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
              </Button>
            )}
          </div>

          <SidebarContent className="flex-1 px-2 py-3 overflow-x-hidden">
            <SidebarGroup>
              {!collapsed && (
                <SidebarGroupLabel className="text-[9px] font-black uppercase tracking-widest px-3 mb-1.5 text-muted-foreground/40">
                  {isSuperAdmin ? 'Plataforma' : 'Menu Principal'}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu className="space-y-0.5">
                  {allMenuItems.map((item) => {
                    const isActive = isLinkActive(item.url);
                    const hasSubItems = 'items' in item && item.items && item.items.length > 0;

                    if (hasSubItems && 'items' in item) {
                      return (
                        <Collapsible
                          key={item.title}
                          asChild
                          defaultOpen={location.pathname.startsWith(item.url.split('?')[0])}
                          className="group/collapsible"
                        >
                          <SidebarMenuItem>
                            <CollapsibleTrigger asChild>
                              <SidebarMenuButton tooltip={item.title} className={getNavClasses(isActive)}>
                                <item.icon className="h-4 w-4 shrink-0" />
                                {!collapsed && (
                                  <>
                                    <span className="truncate flex-1">{item.title}</span>
                                    <ChevronDown className="ml-auto h-3.5 w-3.5 opacity-40 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                                  </>
                                )}
                              </SidebarMenuButton>
                            </CollapsibleTrigger>
                            {!collapsed && (
                              <CollapsibleContent>
                                <div className="ml-7 flex flex-col gap-0.5 border-l border-black/8 dark:border-border pl-3 py-1 mt-0.5">
                                  {item.items!.map((sub) => (
                                    <NavLink
                                      key={sub.title}
                                      to={sub.url}
                                      className={({ isActive }) =>
                                        `flex h-8 items-center rounded-lg px-2 text-xs transition-all duration-150 font-semibold ${
                                          isActive
                                            ? "text-primary bg-primary/10"
                                            : "text-sidebar-foreground/60 hover:text-foreground hover:bg-muted/50"
                                        }`
                                      }
                                    >
                                      {sub.title}
                                    </NavLink>
                                  ))}
                                </div>
                              </CollapsibleContent>
                            )}
                          </SidebarMenuItem>
                        </Collapsible>
                      );
                    }

                    const menuEl = (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild className="p-0" isActive={isActive}>
                          <NavLink to={item.url} end={!item.url.includes('?')} className={() => getNavClasses(isActive)}>
                            <item.icon className="h-4 w-4 shrink-0" />
                            {!collapsed && <span className="truncate">{item.title}</span>}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );

                    return wrapTooltip(item.title, item.title, menuEl);
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <Separator className="my-3 bg-black/5 dark:bg-muted/30" />

            {(canViewAdmin || canManageOffice) && !isMainSuperAdmin && !isSuperAdmin && (
              <SidebarGroup>
                {!collapsed && (
                  <SidebarGroupLabel className="text-[9px] font-black uppercase tracking-widest px-3 mb-1.5 text-muted-foreground/40">
                    Administração
                  </SidebarGroupLabel>
                )}
                <SidebarGroupContent>
                  <SidebarMenu className="space-y-0.5">
                    {canViewAdmin && (() => {
                      const isActive = isLinkActive('/admin');
                      return wrapTooltip('admin', 'Administração', (
                        <SidebarMenuItem key="admin">
                          <SidebarMenuButton asChild className="p-0" isActive={isActive}>
                            <NavLink to="/admin" className={() => getNavClasses(isActive)}>
                              <Shield className="h-4 w-4 shrink-0" />
                              {!collapsed && <span className="truncate">Administração</span>}
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ));
                    })()}
                    {canManageOffice && !isSuperAdmin && (() => {
                      const isActive = isLinkActive('/escritorio');
                      return wrapTooltip('escritorio', 'Meu Escritório', (
                        <SidebarMenuItem key="escritorio">
                          <SidebarMenuButton asChild className="p-0" isActive={isActive}>
                            <NavLink to="/escritorio" className={() => getNavClasses(isActive)}>
                              <Building2 className="h-4 w-4 shrink-0" />
                              {!collapsed && <span className="truncate">Meu Escritório</span>}
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ));
                    })()}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {(canViewAdmin || canManageOffice) && !isMainSuperAdmin && !isSuperAdmin && (
              <Separator className="my-3 bg-black/5 dark:bg-muted/30" />
            )}

            {!isMainSuperAdmin && !isSuperAdmin && (
              <SidebarGroup>
                {!collapsed && (
                  <SidebarGroupLabel className="text-[9px] font-black uppercase tracking-widest px-3 mb-1.5 text-muted-foreground/40">
                    Conta
                  </SidebarGroupLabel>
                )}
                <SidebarGroupContent>
                  <SidebarMenu className="space-y-0.5">
                    {bottomItems.map((item) => {
                      const isActive = isLinkActive(item.url);
                      return wrapTooltip(item.title, item.title, (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild className="p-0" isActive={isActive}>
                            <NavLink to={item.url} className={() => getNavClasses(isActive)}>
                              <item.icon className="h-4 w-4 shrink-0" />
                              {!collapsed && <span className="truncate">{item.title}</span>}
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ));
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>

          <SidebarFooter className="p-2 border-t border-black/5 dark:border-sidebar-border">
            <SidebarMenu>
              <SidebarMenuItem>
                {wrapTooltip('logout', 'Sair do Hub', (
                  <SidebarMenuButton
                    onClick={handleLogout}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-[13px] w-full text-destructive hover:bg-destructive/10 h-auto font-bold ${collapsed ? "justify-center" : ""}`}
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">Sair do Hub</span>}
                  </SidebarMenuButton>
                ))}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>

        </div>
      </Sidebar>
    </TooltipProvider>
  );
}

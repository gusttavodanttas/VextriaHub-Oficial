import { useState, useMemo } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Settings, Sun, Moon, Palette, Monitor,
  Users, FileText, Clock, Users2, Plug, Check, ChevronRight, Bell,
} from "lucide-react";

import { TeamManagement } from "@/components/Settings/TeamManagement";
import { ProcessTypeSimple } from "@/components/Settings/ProcessTypeSimple";
import { DeadlineConfig } from "@/components/Settings/DeadlineConfig";
import { ClientOriginConfig } from "@/components/Settings/ClientOriginConfig";
import { NotificationPrefs } from "@/components/Settings/NotificationPrefs";
import { IntegrationsPanel } from "@/components/Integrations/IntegrationsPanel";
import { useUserRole } from "@/hooks/useUserRole";
import { useTheme } from "@/contexts/ThemeContext";

// Pré-visualização das cores reais de cada tema
const THEME_OPTIONS = [
  { value: "light", label: "Claro", icon: Sun, bg: "hsl(210 40% 98%)", fg: "hsl(222 84% 12%)", primary: "hsl(200 100% 40%)" },
  { value: "dark", label: "Escuro", icon: Moon, bg: "hsl(240 10% 6%)", fg: "hsl(0 0% 92%)", primary: "hsl(200 100% 50%)" },
  { value: "blue", label: "Azul", icon: Palette, bg: "hsl(222 84% 6%)", fg: "hsl(210 40% 92%)", primary: "hsl(200 100% 50%)" },
  { value: "auto", label: "Automático", icon: Monitor, bg: "linear-gradient(135deg, hsl(210 40% 98%) 50%, hsl(240 10% 6%) 50%)", fg: "hsl(200 100% 45%)", primary: "hsl(200 100% 50%)" },
] as const;

interface Section {
  id: string;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
  adminOnly?: boolean;
}

const SECTIONS: Section[] = [
  { id: "geral", label: "Aparência", desc: "Tema da plataforma", icon: Palette, group: "Preferências" },
  { id: "notificacoes", label: "Notificações", desc: "Alertas que você recebe", icon: Bell, group: "Preferências" },
  { id: "clientes", label: "Clientes", desc: "Origens de captação", icon: Users, group: "Operação" },
  { id: "processos", label: "Processos", desc: "Tipos de processo", icon: FileText, group: "Operação" },
  { id: "prazos", label: "Prazos", desc: "Tipos de prazo e atos", icon: Clock, group: "Operação" },
  { id: "equipes", label: "Equipes", desc: "Times e membros", icon: Users2, group: "Operação" },
  { id: "integracao", label: "Integração", desc: "Apps conectados", icon: Plug, group: "Integrações" },
];

const GROUP_ORDER = ["Preferências", "Operação", "Integrações"];

const Configuracoes = () => {
  const [activeTab, setActiveTab] = useState("geral");
  const { canManageOffice } = useUserRole();
  const { theme, setTheme } = useTheme();

  const sections = useMemo(
    () => SECTIONS.filter((s) => !s.adminOnly || canManageOffice),
    [canManageOffice]
  );
  const grouped = useMemo(() => {
    const map: Record<string, Section[]> = {};
    sections.forEach((s) => { (map[s.group] ??= []).push(s); });
    return GROUP_ORDER.filter((g) => map[g]?.length).map((g) => ({ group: g, items: map[g] }));
  }, [sections]);

  const active = sections.find((s) => s.id === activeTab) ?? sections[0];

  const renderContent = () => {
    switch (active.id) {
      case "clientes": return <ClientOriginConfig />;
      case "processos": return <ProcessTypeSimple />;
      case "prazos": return <DeadlineConfig />;
      case "equipes": return <TeamManagement />;
      case "notificacoes": return <NotificationPrefs />;
      case "integracao": return <IntegrationsPanel />;
      default: return <AparenciaSection theme={theme} setTheme={setTheme} />;
    }
  };

  return (
    <div className="flex-1 p-4 md:p-8 space-y-8 overflow-x-hidden entry-animate">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-primary/10 border border-primary/20 shadow-premium">
          <Settings className="h-6 w-6 md:h-7 md:w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl md:text-4xl font-black tracking-tight">Configurações</h1>
          <p className="text-xs md:text-sm text-muted-foreground font-medium">
            Aparência e configurações operacionais
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Navegação lateral (mobile: pills roláveis) */}
        <nav className="flex lg:flex-col gap-1.5 overflow-x-auto no-scrollbar pb-1 lg:pb-0 lg:sticky lg:top-4 lg:self-start">
          {grouped.map(({ group, items }) => (
            <div key={group} className="contents lg:block lg:space-y-1">
              <p className="hidden lg:block px-3 pt-4 pb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
                {group}
              </p>
              {items.map((s) => {
                const Icon = s.icon;
                const isActive = active.id === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveTab(s.id)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "group shrink-0 lg:w-full flex items-center gap-3 rounded-2xl px-3.5 py-2.5 lg:py-3 text-left transition-all border",
                      isActive
                        ? "bg-primary/10 border-primary/30 shadow-sm"
                        : "border-transparent hover:bg-muted/50"
                    )}
                  >
                    <span className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-xl shrink-0 transition-colors",
                      isActive ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground group-hover:text-foreground"
                    )}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 hidden lg:block flex-1">
                      <span className={cn("block text-sm font-bold truncate", isActive && "text-primary")}>{s.label}</span>
                      <span className="block text-[11px] text-muted-foreground/70 truncate">{s.desc}</span>
                    </span>
                    {/* mobile: só o rótulo ao lado do ícone */}
                    <span className={cn("lg:hidden text-xs font-bold whitespace-nowrap", isActive && "text-primary")}>{s.label}</span>
                    <ChevronRight className={cn(
                      "hidden lg:block h-4 w-4 ml-auto shrink-0 transition-all",
                      isActive ? "text-primary opacity-100" : "text-muted-foreground/30 opacity-0 group-hover:opacity-100"
                    )} />
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Conteúdo */}
        <div className="min-w-0 space-y-6">{renderContent()}</div>
      </div>
    </div>
  );
};

/* ---------- Seção "Aparência" ---------- */
function AparenciaSection({ theme, setTheme }: { theme: string; setTheme: (t: any) => void }) {
  return (
    <>
      {/* Aparência com preview real */}
      <Card className="glass-card rounded-[2rem] border-black/5 dark:border-border overflow-hidden shadow-premium">
        <CardHeader className="border-b border-black/5 dark:border-border pb-4 flex flex-row items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Palette className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-black">Aparência</CardTitle>
            <CardDescription className="text-xs font-medium">Escolha o tema. Aplica na hora.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {THEME_OPTIONS.map((t) => {
              const isActive = theme === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTheme(t.value)}
                  aria-pressed={isActive}
                  className={cn(
                    "relative flex flex-col gap-3 p-3 rounded-2xl border-2 transition-all text-left",
                    isActive ? "border-primary shadow-md ring-2 ring-primary/20" : "border-black/5 dark:border-border hover:border-primary/40"
                  )}
                >
                  {isActive && (
                    <span className="absolute top-2.5 right-2.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  )}
                  {/* mini preview */}
                  <div className="h-16 rounded-xl border border-black/10 dark:border-white/10 p-2 flex flex-col justify-between overflow-hidden" style={{ background: t.bg }}>
                    <div className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full" style={{ background: t.primary }} />
                      <span className="h-1.5 w-8 rounded-full opacity-70" style={{ background: t.fg }} />
                    </div>
                    <div className="space-y-1">
                      <span className="block h-1.5 w-10 rounded-full opacity-40" style={{ background: t.fg }} />
                      <span className="block h-1.5 w-6 rounded-full opacity-25" style={{ background: t.fg }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-0.5">
                    <t.icon className={cn("h-3.5 w-3.5", isActive ? "text-primary" : "text-muted-foreground")} />
                    <span className={cn("text-xs font-black", isActive && "text-primary")}>{t.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

export default Configuracoes;

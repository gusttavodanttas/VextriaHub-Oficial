import { useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Settings, Sun, Moon, Palette, Monitor, UserCircle, Mail, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { TeamManagement } from "@/components/Settings/TeamManagement";
import { ProcessTypeSimple } from "@/components/Settings/ProcessTypeSimple";
import { DeadlineConfig } from "@/components/Settings/DeadlineConfig";
import { ClientOriginConfig } from "@/components/Settings/ClientOriginConfig";
import { OfficeSettings } from "@/components/Office/OfficeSettings";
import { GoogleCalendarIntegration } from "@/components/Integrations/GoogleCalendarIntegration";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

const THEME_OPTIONS = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "blue", label: "Azul", icon: Palette },
  { value: "auto", label: "Automático", icon: Monitor },
] as const;

const Configuracoes = () => {
  const [activeTab, setActiveTab] = useState("geral");
  const { canManageOffice } = useUserRole();
  const { profile, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const displayName = profile?.full_name || user?.name || "—";
  const displayEmail = profile?.email || user?.email || "—";

  return (
    <div className="flex-1 p-4 md:p-8 space-y-8 md:space-y-12 overflow-x-hidden entry-animate">
      {/* Page Header Moderno */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10 border border-primary/20 shadow-premium">
              <Settings className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary drop-shadow-sm">
              Configurações
            </h1>
          </div>
          <p className="text-sm md:text-lg text-muted-foreground font-black uppercase tracking-widest text-[10px] opacity-60 px-1">
            Ajuste as preferências globais e personalize a inteligência do seu escritório.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8 min-w-0 w-full">
        <div className="glass-card p-2 rounded-[2rem] border-black/5 dark:border-border w-full overflow-x-auto h-auto no-scrollbar shadow-premium">
          <TabsList className="bg-transparent h-auto p-0 flex flex-nowrap gap-1 min-w-max">
            {[
              { id: "geral", label: "Geral" },
              { id: "clientes", label: "Clientes" },
              { id: "processos", label: "Processos" },
              { id: "prazos", label: "Prazos" },
              { id: "equipes", label: "Equipes" },
              ...(canManageOffice ? [{ id: "escritorio", label: "Escritório" }] : []),
              { id: "integracao", label: "Integração" }
            ].map((tab) => (
              <TabsTrigger 
                key={tab.id}
                value={tab.id} 
                className="rounded-2xl px-6 py-2.5 font-black uppercase tracking-widest text-[10px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-premium transition-all whitespace-nowrap"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

              <TabsContent value="geral" className="space-y-6">
                {/* Conta */}
                <Card className="glass-card rounded-[2rem] border-black/5 dark:border-border overflow-hidden shadow-premium">
                  <CardHeader className="border-b border-black/5 dark:border-border pb-4">
                    <CardTitle className="text-xl font-black">Sua Conta</CardTitle>
                    <CardDescription className="text-xs font-medium">Dados da sua conta. Edite no seu Perfil.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex items-center gap-3 p-4 rounded-2xl bg-black/[0.02] dark:bg-muted/30 border border-black/5 dark:border-border">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0"><UserCircle className="h-5 w-5" /></div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Nome</p>
                          <p className="font-bold truncate">{displayName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-4 rounded-2xl bg-black/[0.02] dark:bg-muted/30 border border-black/5 dark:border-border">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0"><Mail className="h-5 w-5" /></div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">E-mail</p>
                          <p className="font-bold truncate">{displayEmail}</p>
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" className="rounded-xl gap-2 font-bold" onClick={() => navigate("/perfil")}>
                      <ExternalLink className="h-4 w-4" /> Editar no Perfil
                    </Button>
                  </CardContent>
                </Card>

                {/* Aparência (tema real) */}
                <Card className="glass-card rounded-[2rem] border-black/5 dark:border-border overflow-hidden shadow-premium">
                  <CardHeader className="border-b border-black/5 dark:border-border pb-4">
                    <CardTitle className="text-xl font-black">Aparência</CardTitle>
                    <CardDescription className="text-xs font-medium">Escolha o tema da plataforma. Aplica na hora.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {THEME_OPTIONS.map((t) => {
                        const Icon = t.icon;
                        const active = theme === t.value;
                        return (
                          <button key={t.value} type="button" onClick={() => setTheme(t.value)}
                            className={cn(
                              "flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-all",
                              active ? "border-primary bg-primary/5 shadow-md" : "border-black/5 dark:border-border hover:bg-muted/40"
                            )}>
                            <Icon className={cn("h-6 w-6", active ? "text-primary" : "text-muted-foreground")} />
                            <span className={cn("text-xs font-black", active && "text-primary")}>{t.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="clientes" className="space-y-4">
                <ClientOriginConfig />
              </TabsContent>

              <TabsContent value="processos" className="space-y-4">
                <ProcessTypeSimple />
              </TabsContent>

              <TabsContent value="prazos" className="space-y-4">
                <DeadlineConfig />
              </TabsContent>

              <TabsContent value="equipes" className="space-y-4">
                <TeamManagement />
              </TabsContent>

              {canManageOffice && (
                <TabsContent value="escritorio" className="space-y-4">
                  <OfficeSettings />
                </TabsContent>
              )}

              <TabsContent value="integracao" className="space-y-4">
                <GoogleCalendarIntegration />
              </TabsContent>
      </Tabs>
    </div>
  );
};

export default Configuracoes;

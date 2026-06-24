import { useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Settings } from "lucide-react";

import { TeamManagement } from "@/components/Settings/TeamManagement";
import { ProcessTypeSimple } from "@/components/Settings/ProcessTypeSimple";
import { DeadlineConfig } from "@/components/Settings/DeadlineConfig";
import { ClientOriginConfig } from "@/components/Settings/ClientOriginConfig";
import { OfficeSettings } from "@/components/Office/OfficeSettings";
import { GoogleCalendarIntegration } from "@/components/Integrations/GoogleCalendarIntegration";
import { useUserRole } from "@/hooks/useUserRole";

interface SettingsFormValues {
  name: string;
  email: string;
  notifications: boolean;
  theme: string;
  language: string;
  timezone: string;
  dateFormat: Date | undefined;
  timeFormat: string;
  privacy: string;
  security: string;
  accessibility: string;
  advanced: string;
}

const Configuracoes = () => {
  const [activeTab, setActiveTab] = useState("geral");
  const { canManageOffice, isSuperAdmin } = useUserRole();
  const [formValues, setFormValues] = useState<SettingsFormValues>({
    name: "Usuário",
    email: "usuario@exemplo.com",
    notifications: true,
    theme: "light",
    language: "pt-BR",
    timezone: "America/Sao_Paulo",
    dateFormat: undefined,
    timeFormat: "12h",
    privacy: "public",
    security: "strong",
    accessibility: "enhanced",
    advanced: "enabled",
  });

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = event.target;
    const checked = (event.target as HTMLInputElement).checked;
    setFormValues({
      ...formValues,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleDateChange = (date: Date | undefined) => {
    setFormValues({
      ...formValues,
      dateFormat: date,
    });
  };

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
        <div className="glass-card p-2 rounded-[2rem] border-black/5 dark:border-white/10 w-full overflow-x-auto h-auto no-scrollbar shadow-premium">
          <TabsList className="bg-transparent h-auto p-0 flex flex-nowrap gap-1 min-w-max">
            {[
              { id: "geral", label: "Geral" },
              { id: "usuarios", label: "Usuários" },
              { id: "permissoes", label: "Permissões" },
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
                <Card className="glass-card rounded-[2rem] border-black/5 dark:border-white/5 overflow-hidden shadow-premium">
                  <CardHeader className="border-b border-black/5 dark:border-white/5 pb-4">
                    <CardTitle className="text-xl font-black">Informações Gerais</CardTitle>
                    <CardDescription className="text-xs font-medium">
                      Gerencie suas informações pessoais e preferências
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nome</Label>
                        <Input
                          id="name"
                          name="name"
                          value={formValues.name}
                          onChange={handleInputChange}
                          className="h-12 rounded-2xl bg-black/[0.02] dark:bg-white/5 border-black/5 dark:border-white/10"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Email</Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          value={formValues.email}
                          onChange={handleInputChange}
                          className="h-12 rounded-2xl bg-black/[0.02] dark:bg-white/5 border-black/5 dark:border-white/10"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="notifications">Notificações</Label>
                        <Switch
                          id="notifications"
                          name="notifications"
                          checked={formValues.notifications}
                          onCheckedChange={(checked) =>
                            setFormValues({ ...formValues, notifications: checked })
                          }
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card rounded-[2rem] border-black/5 dark:border-white/5 overflow-hidden shadow-premium">
                  <CardHeader className="border-b border-black/5 dark:border-white/5 pb-4">
                    <CardTitle className="text-xl font-black">Preferências</CardTitle>
                    <CardDescription className="text-xs font-medium">
                      Personalize a aparência e o comportamento do sistema
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="theme" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Tema</Label>
                        <Select
                          value={formValues.theme}
                          onValueChange={(value) =>
                            setFormValues({ ...formValues, theme: value })
                          }
                        >
                          <SelectTrigger className="h-12 rounded-2xl bg-black/[0.02] dark:bg-white/5 border-black/5 dark:border-white/10 font-bold">
                            <SelectValue placeholder="Selecione o tema" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="light">Claro</SelectItem>
                            <SelectItem value="dark">Escuro</SelectItem>
                            <SelectItem value="system">Sistema</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="language" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Idioma</Label>
                        <Select
                          value={formValues.language}
                          onValueChange={(value) =>
                            setFormValues({ ...formValues, language: value })
                          }
                        >
                          <SelectTrigger className="h-12 rounded-2xl bg-black/[0.02] dark:bg-white/5 border-black/5 dark:border-white/10 font-bold">
                            <SelectValue placeholder="Selecione o idioma" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                            <SelectItem value="en-US">Inglês (Estados Unidos)</SelectItem>
                            <SelectItem value="es-ES">Espanhol (Espanha)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="timezone" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Fuso Horário</Label>
                        <Select
                          value={formValues.timezone}
                          onValueChange={(value) =>
                            setFormValues({ ...formValues, timezone: value })
                          }
                        >
                          <SelectTrigger className="h-12 rounded-2xl bg-black/[0.02] dark:bg-white/5 border-black/5 dark:border-white/10 font-bold">
                            <SelectValue placeholder="Selecione o fuso horário" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="America/Sao_Paulo">
                              America/Sao_Paulo
                            </SelectItem>
                            <SelectItem value="America/New_York">America/New_York</SelectItem>
                            <SelectItem value="Europe/London">Europe/London</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Formato de Data</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full h-12 rounded-2xl bg-black/[0.02] dark:bg-white/5 border-black/5 dark:border-white/10 justify-start text-left font-bold",
                                !formValues.dateFormat && "text-muted-foreground"
                              )}
                            >
                              {formValues.dateFormat ? (
                                format(formValues.dateFormat, "PPP", { locale: ptBR })
                              ) : (
                                <span>Selecione a data</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={formValues.dateFormat}
                              onSelect={handleDateChange}
                              className="rounded-md border"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="timeFormat" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Formato de Hora</Label>
                        <Select
                          value={formValues.timeFormat}
                          onValueChange={(value) =>
                            setFormValues({ ...formValues, timeFormat: value })
                          }
                        >
                          <SelectTrigger className="h-12 rounded-2xl bg-black/[0.02] dark:bg-white/5 border-black/5 dark:border-white/10 font-bold">
                            <SelectValue placeholder="Selecione o formato" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="12h">12h</SelectItem>
                            <SelectItem value="24h">24h</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="usuarios" className="space-y-6">
                <Card className="glass-card rounded-[2rem] border-black/5 dark:border-white/5 overflow-hidden shadow-premium">
                  <CardHeader className="border-b border-black/5 dark:border-white/5 pb-4">
                    <CardTitle className="text-xl font-black">Gerenciamento de Usuários</CardTitle>
                    <CardDescription className="text-xs font-medium uppercase tracking-widest opacity-60">
                      Adicione, edite e remova usuários do sistema
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-12 text-center">
                    <div className="p-8 rounded-full bg-primary/5 border border-primary/10 w-fit mx-auto mb-4">
                      <Users className="h-12 w-12 text-primary/30" />
                    </div>
                    <p className="text-muted-foreground font-black uppercase tracking-widest text-[10px]">Módulo em calibração</p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="permissoes" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Gerenciamento de Permissões</CardTitle>
                    <CardDescription>
                      Defina as permissões de acesso para cada usuário
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p>Em desenvolvimento</p>
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

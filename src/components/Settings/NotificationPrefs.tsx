import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Bell, Clock, CalendarDays, CheckSquare, Headset, DollarSign } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Pref { key: string; label: string; desc: string; icon: React.ComponentType<{ className?: string }>; }

const PREFS: Pref[] = [
  { key: "prazos", label: "Prazos", desc: "Avisos de prazos próximos do vencimento", icon: Clock },
  { key: "audiencias", label: "Audiências", desc: "Lembretes de audiências agendadas", icon: CalendarDays },
  { key: "tarefas", label: "Tarefas", desc: "Tarefas atribuídas e vencimentos", icon: CheckSquare },
  { key: "atendimentos", label: "Atendimentos", desc: "Novos atendimentos e retornos", icon: Headset },
  { key: "financeiro", label: "Financeiro", desc: "Recebimentos e contas a pagar", icon: DollarSign },
];

const DEFAULTS: Record<string, boolean> = { prazos: true, audiencias: true, tarefas: true, atendimentos: true, financeiro: false };

export function NotificationPrefs() {
  const { user } = useAuth();
  const storageKey = `notif_prefs_${user?.id || "anon"}`;
  const [prefs, setPrefs] = useState<Record<string, boolean>>(DEFAULTS);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setPrefs({ ...DEFAULTS, ...JSON.parse(saved) });
    } catch { /* ignore */ }
  }, [storageKey]);

  const toggle = (key: string, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
  };

  return (
    <Card className="glass-card rounded-[2rem] border-black/5 dark:border-border overflow-hidden shadow-premium">
      <CardHeader className="border-b border-black/5 dark:border-border pb-4 flex flex-row items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <Bell className="h-5 w-5" />
        </div>
        <div>
          <CardTitle className="text-lg font-black">Notificações</CardTitle>
          <CardDescription className="text-xs font-medium">Escolha sobre o que você quer ser avisado</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-5 md:p-6">
        <div className="grid gap-2.5">
          {PREFS.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.key} className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-black/5 dark:border-border bg-black/[0.01] dark:bg-white/[0.01]">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-xl bg-muted/60 flex items-center justify-center text-muted-foreground shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm">{p.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.desc}</p>
                  </div>
                </div>
                <Switch checked={!!prefs[p.key]} onCheckedChange={(v) => toggle(p.key, v)} />
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground/60 mt-4">
          Estas preferências serão aplicadas aos alertas do sistema. O envio por e-mail será ativado quando a integração de e-mail estiver disponível.
        </p>
      </CardContent>
    </Card>
  );
}

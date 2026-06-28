import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Mail, MessageCircle, Webhook, Plug, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Integration {
  id: string;
  nome: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  status: "disponivel" | "em_breve";
}

const INTEGRATIONS: Integration[] = [
  { id: "gcal", nome: "Google Calendar", desc: "Sincronize audiências e prazos com sua agenda do Google.", icon: Calendar, color: "text-blue-500 bg-blue-500/10", status: "em_breve" },
  { id: "email", nome: "Notificações por E-mail", desc: "Receba alertas de prazos e lembretes por e-mail.", icon: Mail, color: "text-amber-500 bg-amber-500/10", status: "em_breve" },
  { id: "whatsapp", nome: "WhatsApp", desc: "Avisos de prazos e atendimentos direto no WhatsApp.", icon: MessageCircle, color: "text-emerald-500 bg-emerald-500/10", status: "em_breve" },
  { id: "webhooks", nome: "API & Webhooks", desc: "Conecte o VextriaHub a outros sistemas via API.", icon: Webhook, color: "text-purple-500 bg-purple-500/10", status: "em_breve" },
];

export function IntegrationsPanel() {
  return (
    <Card className="glass-card rounded-[2rem] border-black/5 dark:border-border overflow-hidden shadow-premium">
      <CardHeader className="border-b border-black/5 dark:border-border pb-4 flex flex-row items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <Plug className="h-5 w-5" />
        </div>
        <div>
          <CardTitle className="text-lg font-black">Integrações</CardTitle>
          <CardDescription className="text-xs font-medium">Conecte o VextriaHub às ferramentas que você já usa</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="p-5 md:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {INTEGRATIONS.map((it) => {
            const Icon = it.icon;
            const soon = it.status === "em_breve";
            return (
              <div
                key={it.id}
                className="flex flex-col gap-3 p-4 rounded-2xl border border-black/5 dark:border-border bg-black/[0.01] dark:bg-white/[0.01] hover:border-primary/20 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className={cn("h-11 w-11 rounded-2xl flex items-center justify-center shrink-0", it.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm">{it.nome}</h4>
                      {soon && (
                        <Badge variant="secondary" className="rounded-full text-[9px] font-black uppercase tracking-wide gap-1 px-2">
                          <Clock className="h-2.5 w-2.5" /> Em breve
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{it.desc}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" disabled={soon} className="rounded-xl font-bold w-full">
                  {soon ? "Em breve" : "Conectar"}
                </Button>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-muted-foreground/60 font-medium mt-4 text-center">
          Quer priorizar alguma integração? Fale com o suporte.
        </p>
      </CardContent>
    </Card>
  );
}

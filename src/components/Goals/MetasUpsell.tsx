import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Target, Crown, TrendingUp, Layers, Users, ArrowRight, Flame } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";

// Tela que ocupa /metas quando o plano do escritório não inclui o módulo.
// Antes a rota caía em "Acesso negado · Permissão necessária: canViewMetas",
// que não diz ao escritório que é uma questão de plano nem como resolver.

const BENEFICIOS = [
  {
    icon: TrendingUp,
    titulo: "Metas individuais",
    texto: "Receita, processos ou clientes por período, com anel de progresso e marcador do ritmo esperado para saber se está atrasado antes do fim do mês.",
  },
  {
    icon: Layers,
    titulo: "Metas por demanda",
    texto: "Por tipo de processo: quantos casos e quanto faturamento cada frente deve trazer, com o atual calculado automaticamente.",
  },
  {
    icon: Users,
    titulo: "Metas do escritório e das equipes",
    texto: "Visão consolidada e por equipe, para acompanhar quem está no ritmo e distribuir o esforço.",
  },
];

export function MetasUpsell() {
  const navigate = useNavigate();
  const { canManageOffice } = usePermissions();
  const { isOfficeAdmin } = useAuth();
  const podeAssinar = canManageOffice || isOfficeAdmin;

  return (
    <div className="flex-1 p-4 md:p-8 overflow-x-hidden entry-animate">
      <div className="max-w-4xl mx-auto w-full space-y-8">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Target className="h-6 w-6 md:h-8 md:w-8 text-primary" />
              </div>
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60 drop-shadow-sm">
                Metas & Objetivos
              </h1>
            </div>
            <p className="text-sm md:text-lg text-muted-foreground font-medium max-w-2xl">
              Acompanhe o progresso do escritório em tempo real e saiba, todo dia, se o mês vai fechar no ritmo.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 self-start md:self-center px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-widest">
            <Crown className="h-3.5 w-3.5" /> Módulo Premium
          </span>
        </div>

        <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-violet-500/5 p-6 md:p-8 space-y-6 shadow-premium">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><Flame className="h-5 w-5" /></div>
            <div>
              <p className="font-black text-lg leading-tight">Metas faz parte do plano Premium</p>
              <p className="text-sm text-muted-foreground mt-1">
                Seu plano atual não inclui este módulo. Ao migrar para o Premium, o Conselheiro IA também é liberado.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {BENEFICIOS.map(b => (
              <div key={b.titulo} className="rounded-2xl border border-border bg-card p-4 space-y-2">
                <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><b.icon className="h-4 w-4" /></div>
                <p className="font-bold text-sm">{b.titulo}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{b.texto}</p>
              </div>
            ))}
          </div>

          {podeAssinar ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Button size="lg" onClick={() => navigate("/pagamento?plano=premium")}
                className="rounded-xl h-12 font-black uppercase text-xs tracking-widest px-8 gap-2 shadow-premium">
                Ver o plano Premium <ArrowRight className="h-4 w-4" />
              </Button>
              <p className="text-xs text-muted-foreground">A troca de plano vale na hora e os dados do escritório não mudam.</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Para liberar as Metas, peça ao administrador do escritório que migre o plano para o Premium.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

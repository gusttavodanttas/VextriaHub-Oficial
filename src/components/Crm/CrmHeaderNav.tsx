// Cabeçalho + menus de navegação do CRM (extraídos de pages/Crm.tsx).
import { UserCheck, Plus, Target, TrendingUp, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PermissionGuard } from "@/components/Auth/PermissionGuard";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Props {
  onNovoLead: () => void;
  /** Abre uma das telas específicas (funil-vendas, oportunidades, relatorios, metas). */
  onMenuClick: (view: string) => void;
}

export function CrmHeaderNav({ onNovoLead, onMenuClick }: Props) {
  return (
    <>
      {/* Page Header Moderno */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <UserCheck className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60 drop-shadow-sm">
              Gestão de Relacionamento
            </h1>
          </div>
          <p className="text-sm md:text-lg text-muted-foreground font-medium max-w-2xl">
            Converta prospecções em contratos e gerencie seu funil de vendas com inteligência.
          </p>
        </div>
        
        <PermissionGuard permission="canManageCRM">
          <div className="flex items-center gap-3 glass-morphism p-2 rounded-2xl shadow-premium">
            <Button
              onClick={onNovoLead}
              size="lg"
              className="rounded-xl h-12 shadow-premium bg-primary hover:bg-primary/90 font-bold px-8"
            >
              <Plus className="h-5 w-5 mr-2" />
              Novo Lead
            </Button>
          </div>
        </PermissionGuard>
      </div>

      {/* Navigation Groups Premium */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="glass-card p-2 rounded-2xl flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="rounded-xl font-bold px-6 h-11 hover:bg-primary/10 hover:text-primary transition-all">
                Pipeline & Prospecção
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80 rounded-2xl border-black/5 dark:border-border bg-background p-2">
              <DropdownMenuItem className="rounded-xl p-4 cursor-pointer hover:bg-primary/10 mb-1 transition-all" onSelect={() => onMenuClick("funil-vendas")}>
                <Target className="h-5 w-5 text-primary mr-4" />
                <div>
                  <p className="font-extrabold text-sm">Funil Estratégico</p>
                  <p className="text-[10px] text-muted-foreground font-medium">Fluxo completo de vendas</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-xl p-4 cursor-pointer hover:bg-primary/10 transition-all" onSelect={() => onMenuClick("oportunidades")}>
                <TrendingUp className="h-5 w-5 text-primary mr-4" />
                <div>
                  <p className="font-extrabold text-sm">Oportunidades Ativas</p>
                  <p className="text-[10px] text-muted-foreground font-medium">Gestão de leads qualificados</p>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="glass-card p-2 rounded-2xl flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="rounded-xl font-bold px-6 h-11 hover:bg-primary/10 hover:text-primary transition-all">
                Análises Dinâmicas
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80 rounded-2xl border-black/5 dark:border-border bg-background p-2">
              <DropdownMenuItem className="rounded-xl p-4 cursor-pointer hover:bg-primary/10 mb-1 transition-all" onSelect={() => onMenuClick("relatorios")}>
                <BarChart3 className="h-5 w-5 text-primary mr-4" />
                <div>
                  <p className="font-extrabold text-sm">Performance CRM</p>
                  <p className="text-[10px] text-muted-foreground font-medium">Relatórios e ROI</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-xl p-4 cursor-pointer hover:bg-primary/10 transition-all" onSelect={() => onMenuClick("metas")}>
                <Target className="h-5 w-5 text-primary mr-4" />
                <div>
                  <p className="font-extrabold text-sm">Metas Comerciais</p>
                  <p className="text-[10px] text-muted-foreground font-medium">KPIs de aquisição</p>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="glass-card p-2 rounded-2xl flex items-center gap-1 ml-auto">
          <Button variant="ghost" className="rounded-xl font-bold px-6 h-11 hover:bg-black/5 dark:hover:bg-muted/30 opacity-60 hover:opacity-100 transition-all" onClick={() => window.location.href = '/configuracoes'}>
            Parâmetros CRM
          </Button>
        </div>
      </div>
    </>
  );
}

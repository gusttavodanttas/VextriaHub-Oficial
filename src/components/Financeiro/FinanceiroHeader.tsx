// Cabeçalho da página Financeiro (extraído de pages/Financeiro.tsx): título +
// barra de ações (categorias, prioridades, importar, exportar, novos lançamentos).
import { Button } from "@/components/ui/button";
import { PermissionGuard } from "@/components/Auth/PermissionGuard";
import { DollarSign, TrendingDown, Plus, Settings2, ListOrdered, FileSpreadsheet, Download } from "lucide-react";
import type { TipoType } from "./shared";

interface Props {
  onGerenciarCategorias: () => void;
  onGerenciarPrioridades: () => void;
  onImportar: () => void;
  onExportar: () => void;
  exportarDesabilitado: boolean;
  onNovo: (tipo: TipoType) => void;
}

export function FinanceiroHeader({ onGerenciarCategorias, onGerenciarPrioridades, onImportar, onExportar, exportarDesabilitado, onNovo }: Props) {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <DollarSign className="h-6 w-6 md:h-8 md:w-8 text-primary" />
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight">Gestão Financeira</h1>
        </div>
        <p className="text-sm md:text-lg text-muted-foreground font-medium max-w-2xl">
          Visualize o fluxo de caixa, honorários e a saúde financeira do seu escritório.
        </p>
      </div>

      <div className="flex items-center gap-2 glass-morphism p-2 rounded-2xl border border-black/5 dark:border-border bg-black/[0.02] dark:bg-muted/30 shadow-premium">
        <PermissionGuard permission="canManageFinanceiro">
          <Button size="icon" variant="ghost" className="h-11 w-11 rounded-xl" onClick={onGerenciarCategorias} title="Gerenciar categorias" aria-label="Gerenciar categorias">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
          </Button>
          <Button size="icon" variant="ghost" className="h-11 w-11 rounded-xl" onClick={onGerenciarPrioridades} title="Gerenciar grupos de prioridade" aria-label="Gerenciar grupos de prioridade">
            <ListOrdered className="h-5 w-5 text-muted-foreground" />
          </Button>
          <Button size="icon" variant="ghost" className="h-11 w-11 rounded-xl" onClick={onImportar} title="Importar planilha (Excel/CSV)" aria-label="Importar planilha">
            <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
          </Button>
        </PermissionGuard>
        <Button size="icon" variant="ghost" className="h-11 w-11 rounded-xl" onClick={onExportar} disabled={exportarDesabilitado} title="Exportar lançamentos (CSV)" aria-label="Exportar lançamentos">
          <Download className="h-5 w-5 text-muted-foreground" />
        </Button>
        <PermissionGuard permission="canManageFinanceiro">
          <Button size="lg"
            className="rounded-xl h-11 px-5 font-black uppercase text-xs tracking-widest bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20"
            onClick={() => onNovo("despesa")}>
            <TrendingDown className="mr-2 h-4 w-4" />Nova Despesa
          </Button>
          <Button size="lg"
            className="rounded-xl h-11 px-7 font-black uppercase text-xs tracking-widest bg-primary hover:bg-primary/90 shadow-premium"
            onClick={() => onNovo("receita")}>
            <Plus className="mr-2 h-5 w-5" />Nova Receita
          </Button>
        </PermissionGuard>
      </div>
    </div>
  );
}

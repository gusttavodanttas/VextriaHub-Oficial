// Extraído de Admin.tsx: a visão de super-admin e a de admin de escritório
// renderizavam a mesma seção de "Solicitações de Exclusão" (~180 linhas quase
// idênticas, só variando espaçamento/tamanho) — achado do relatório "Raio-X
// VextriaHub". Consolidado aqui pra uma correção valer nos dois lugares; como
// efeito, a variante de admin de escritório ganhou o loading/empty state que só
// a de super-admin tinha, e dados_registro (JSON que pode vir null) passou a
// ser acessado com segurança em vez de `as any` sem checagem.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, Check, X, Clock, User, FileText, AlertCircle, TrendingUp, Activity } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ExclusaoPendente } from "@/types/database";
import type { useMultiSelect } from "@/hooks/useMultiSelect";

const getTabelaDisplayName = (tabela: string) => {
  const nomes: Record<string, string> = {
    clientes: 'Cliente',
    processos: 'Processo',
    audiencias: 'Audiência',
    prazos: 'Prazo',
    tarefas: 'Tarefa',
    atendimentos: 'Atendimento',
    metas: 'Meta',
    financeiro: 'Financeiro',
  };
  return nomes[tabela] || tabela;
};

const getTabelaIcon = (tabela: string) => {
  const icones: Record<string, any> = {
    clientes: User,
    processos: FileText,
    audiencias: Clock,
    prazos: AlertCircle,
    tarefas: Check,
    atendimentos: User,
    metas: FileText,
    financeiro: FileText,
  };
  return icones[tabela] || FileText;
};

// dados_registro é Json (Supabase) — pode vir null, string, número ou array, não só
// o objeto esperado. Normaliza pra um objeto plano antes de ler campos dele, senão
// `dadosRegistro.nome` estoura em runtime quando o valor é null.
const asRegistroObj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

interface ExclusoesPendentesSectionProps {
  exclusoesPendentes: ExclusaoPendente[];
  requestsLoading: boolean;
  isEmpty: boolean;
  multiSelect: ReturnType<typeof useMultiSelect<ExclusaoPendente>>;
  processando: string | null;
  onAprovar: (id: string) => void;
  onRejeitar: (id: string) => void;
  onAprovarSelecionados: () => void;
  /** Visão de super-admin usa cards mais compactos; a de admin de escritório, mais espaçosos. */
  dense?: boolean;
  /** Só a visão de admin de escritório mostra este cabeçalho — na de super-admin o título já vem do sidebar. */
  header?: { title: string; description: string };
}

export function ExclusoesPendentesSection({
  exclusoesPendentes,
  requestsLoading,
  isEmpty,
  multiSelect,
  processando,
  onAprovar,
  onRejeitar,
  onAprovarSelecionados,
  dense = false,
  header,
}: ExclusoesPendentesSectionProps) {
  return (
    <div className="space-y-6">
      {header && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-black tracking-tight">{header.title}</h2>
            <p className="text-sm text-muted-foreground font-medium mt-1">{header.description}</p>
          </div>
          {!multiSelect.isNoneSelected && (
            <Button
              onClick={onAprovarSelecionados}
              disabled={processando === 'multiplo'}
              size="lg"
              className="rounded-2xl h-14 px-8 font-black uppercase text-xs tracking-widest shadow-premium bg-primary hover:bg-primary/90 transition-all"
            >
              <Check className="h-5 w-5 mr-2" />
              Aprovar Selecionados ({multiSelect.selectedCount})
            </Button>
          )}
        </div>
      )}

      {/* Stats Rápido */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-[2rem] shadow-premium border border-black/5 dark:border-border hover-lift group">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Pendentes</p>
            <AlertCircle className="h-5 w-5 text-amber-500" />
          </div>
          <p className="text-4xl font-black text-amber-500">{exclusoesPendentes.length}</p>
        </div>

        <div className="glass-card p-6 rounded-[2rem] shadow-premium border border-black/5 dark:border-border hover-lift group">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Selecionadas</p>
            <Check className="h-5 w-5 text-primary" />
          </div>
          <p className="text-4xl font-black text-foreground">{multiSelect.selectedCount}</p>
        </div>

        <div className="glass-card p-6 rounded-[2rem] shadow-premium border border-black/5 dark:border-border hover-lift group">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Categorias</p>
            <TrendingUp className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="text-4xl font-black text-emerald-500">{new Set(exclusoesPendentes.map((e) => e.tabela)).size}</p>
        </div>
      </div>

      {!header && !multiSelect.isNoneSelected && (
        <div className="glass-card p-6 rounded-3xl bg-primary/5 border-primary/20 flex flex-col md:flex-row items-center justify-between gap-6 entry-animate fade-in zoom-in duration-300">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary rounded-2xl shadow-premium">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <p className="text-lg font-extrabold">{multiSelect.selectedCount} Solicitações Selecionadas</p>
              <p className="text-sm font-medium opacity-70">Ações em massa para otimização de fluxo.</p>
            </div>
          </div>
          <Button
            onClick={onAprovarSelecionados}
            size="lg"
            className="rounded-2xl h-14 px-10 text-lg font-bold shadow-premium bg-primary hover:bg-primary/90"
          >
            <Check className="mr-2 h-6 w-6" />
            Aprovar Massa
          </Button>
        </div>
      )}

      {requestsLoading && (
        <Card>
          <CardContent className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando solicitações...</p>
          </CardContent>
        </Card>
      )}

      {isEmpty && !requestsLoading && (
        <Card>
          <CardContent className="text-center py-12">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nenhuma solicitação pendente</h3>
            <p className="text-muted-foreground">
              Todas as solicitações de exclusão foram processadas.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Selection Controls */}
      {exclusoesPendentes.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-4">
            <Checkbox
              checked={multiSelect.isAllSelected}
              onCheckedChange={() =>
                multiSelect.isAllSelected ? multiSelect.clearSelection() : multiSelect.selectAll()
              }
            />
            <span className="text-sm text-muted-foreground">
              {multiSelect.selectedCount > 0
                ? `${multiSelect.selectedCount} de ${exclusoesPendentes.length} selecionado(s)`
                : "Selecionar todos"}
            </span>
          </div>
          {multiSelect.selectedCount > 0 && (
            <Button variant="outline" size="sm" onClick={multiSelect.clearSelection}>
              Limpar seleção
            </Button>
          )}
        </div>
      )}

      {/* Exclusões Pendentes */}
      <div className={dense ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "grid grid-cols-1 md:grid-cols-2 gap-6"}>
        {exclusoesPendentes.map((exclusao) => {
          const TabelaIcon = getTabelaIcon(exclusao.tabela);
          const dadosRegistro = asRegistroObj(exclusao.dados_registro);
          const solicitante = exclusao as unknown as { user?: { full_name?: string | null; email?: string | null } | null };

          return (
            <Card
              key={exclusao.id}
              className={`glass-card ${dense ? "rounded-[2rem]" : "rounded-[2.5rem]"} border-black/5 dark:border-border transition-all duration-500 overflow-hidden hover-lift ${
                multiSelect.isSelected(exclusao.id) ? "ring-2 ring-primary bg-primary/[0.02]" : ""
              }`}
            >
              <CardHeader className={dense ? "pb-3 px-6 pt-6" : "pb-3 px-8 pt-8"}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={multiSelect.isSelected(exclusao.id)}
                      onCheckedChange={() => multiSelect.toggleItem(exclusao.id)}
                      className={`rounded-lg ${dense ? "h-5 w-5" : "h-6 w-6"} border-black/10 dark:border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary`}
                    />
                    <div className="flex items-center gap-3">
                      <div className={`${dense ? "p-2.5" : "p-3"} rounded-2xl bg-primary/10 text-primary shadow-inner`}>
                        <TabelaIcon className={dense ? "h-5 w-5" : "h-6 w-6"} />
                      </div>
                      <div>
                        <CardTitle className={dense ? "text-lg font-black tracking-tight" : "text-xl font-black tracking-tight"}>
                          {getTabelaDisplayName(exclusao.tabela)}
                        </CardTitle>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                          {format(new Date(exclusao.solicitado_em), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  </div>
                  <Badge className={`bg-amber-500/10 text-amber-500 border-amber-500/20 font-black text-[10px] uppercase tracking-widest ${dense ? "px-3 py-1" : "px-4 py-1.5"} rounded-xl`}>
                    Pendente
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className={dense ? "p-6 pt-2 space-y-5" : "p-8 pt-4 space-y-6"}>
                {/* Informações do registro */}
                <div className={`${dense ? "p-5 rounded-3xl" : "p-6 rounded-[2rem]"} bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-border shadow-inner`}>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 opacity-60">Dados do Registro</h4>
                  <div className="grid grid-cols-1 gap-2 text-sm font-bold text-foreground/80">
                    {typeof dadosRegistro.nome === "string" && dadosRegistro.nome && (
                      <div className="flex items-center justify-between py-1 border-b border-black/5 dark:border-border">
                        <span className="text-muted-foreground font-medium">Nome:</span>
                        <span>{dadosRegistro.nome}</span>
                      </div>
                    )}
                    {typeof dadosRegistro.titulo === "string" && dadosRegistro.titulo && (
                      <div className="flex items-center justify-between py-1 border-b border-black/5 dark:border-border">
                        <span className="text-muted-foreground font-medium">Título:</span>
                        <span>{dadosRegistro.titulo}</span>
                      </div>
                    )}
                    {typeof dadosRegistro.numero_processo === "string" && dadosRegistro.numero_processo && (
                      <div className="flex items-center justify-between py-1 border-b border-black/5 dark:border-border">
                        <span className="text-muted-foreground font-medium">Nº Processo:</span>
                        <span className="font-mono">{dadosRegistro.numero_processo}</span>
                      </div>
                    )}
                    {typeof dadosRegistro.email === "string" && dadosRegistro.email && (
                      <div className="flex items-center justify-between py-1 border-b border-black/5 dark:border-border">
                        <span className="text-muted-foreground font-medium">Email:</span>
                        <span className="text-primary">{dadosRegistro.email}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between py-1">
                      <span className="text-muted-foreground font-medium">Status Atual:</span>
                      <Badge variant="outline" className="rounded-lg font-black text-[9px] uppercase">
                        {typeof dadosRegistro.status === "string" && dadosRegistro.status ? dadosRegistro.status : 'N/A'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Informações da solicitação */}
                <div className={dense ? "space-y-4 pt-2" : "space-y-6"}>
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-primary/5 border border-primary/10">
                    <div className="p-2 bg-primary/10 rounded-xl">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-widest text-primary/60">Solicitado por</p>
                      <p className="text-xs font-black truncate">
                        {solicitante.user?.full_name || solicitante.user?.email || 'Usuário desconhecido'}
                      </p>
                    </div>
                  </div>

                  {exclusao.motivo && (
                    <div className="px-4 py-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-border italic text-xs text-muted-foreground leading-relaxed">
                      "{exclusao.motivo}"
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => onRejeitar(exclusao.id)}
                      disabled={processando === exclusao.id}
                      className="rounded-2xl h-12 font-black uppercase text-[10px] tracking-widest border-black/5 dark:border-border hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20 transition-all"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Rejeitar
                    </Button>
                    <Button
                      size="lg"
                      onClick={() => onAprovar(exclusao.id)}
                      disabled={processando === exclusao.id}
                      className="rounded-2xl h-12 font-black uppercase text-[10px] tracking-widest shadow-premium bg-primary hover:bg-primary/90 transition-all"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Aprovar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

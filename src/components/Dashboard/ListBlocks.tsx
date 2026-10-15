import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AlertCircle, CheckSquare, ArrowRight, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { estaAtrasado, atrasoLabel, dataFatalDoItem } from "@/lib/atraso";
import { concluirPrazoDb } from "@/lib/concluirItens";
import { assertRowsAffected, getErrorMessage } from "@/lib/errors";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";

// Erro de carga do bloco — antes a falha virava "Nenhum prazo/tarefa pendente".
function ErroBloco({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="py-6 text-center space-y-1.5">
      <p className="text-xs font-bold text-destructive">Não foi possível carregar.</p>
      <button type="button" onClick={onRetry} className="text-[11px] font-bold underline text-muted-foreground hover:text-foreground">Tentar novamente</button>
    </div>
  );
}

const pick = (o: any, keys: string[], fb: string) => { for (const k of keys) if (o?.[k]) return String(o[k]); return fb; };
// data DATE ("YYYY-MM-DD") ancorada ao meio-dia local p/ não mostrar 1 dia a menos (fuso BRT).
const fmt = (d?: string | null) => {
  if (!d) return "";
  const dt = new Date(String(d).length <= 10 ? `${d}T12:00:00` : d);
  return isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
};

// Data de vencimento do item. Atrasado sai em vermelho, com há quanto tempo venceu.
function Vencimento({ data }: { data?: string | null }) {
  const atrasado = estaAtrasado(data);
  return (
    <span
      title={atrasado ? atrasoLabel(data) : undefined}
      className={cn(
        "text-[10px] font-black shrink-0",
        atrasado ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground/50",
      )}
    >
      {fmt(data)}
      {atrasado && <span className="ml-1 font-bold normal-case tracking-normal opacity-80">· {atrasoLabel(data)}</span>}
    </span>
  );
}

function Shell({ icon: Icon, title, to, children }: { icon: any; title: string; to: string; children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="rounded-2xl border border-black/5 dark:border-border bg-card/40 p-4 space-y-2.5 h-full">
      <button onClick={() => navigate(to)} className="flex items-center gap-1.5 w-full group">
        <Icon className="h-3 w-3 text-muted-foreground/50" />
        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">{title}</span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 ml-auto group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
      </button>
      {children}
    </div>
  );
}

export function PrazosBlock() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const officeId = user?.office_id;

  const { toast } = useToast();
  const { canManagePrazos } = usePermissions();

  const { data: items = [], isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard-prazos", officeId],
    enabled: !!officeId,
    staleTime: 60_000, // mostra o cache na hora e revalida em bg (sem piscar ao voltar)
    queryFn: async () => {
      if (!officeId) return [];
      const { data, error: qErr } = await supabase.from("prazos").select("*").eq("office_id", officeId).eq("deletado", false)
        .neq("status", "concluido").order("data_fim_prazo", { ascending: true, nullsFirst: false }).limit(6);
      if (qErr) throw qErr;
      return data || [];
    },
  });

  // Concluir o prazo na própria tela inicial (sem abrir a página de Prazos). Usa a
  // mesma lógica compartilhada (concluirItens) e confere as linhas: antes o update
  // não checava nem o erro — o prazo "sumia" da lista e voltava no refetch.
  const concluir = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canManagePrazos) return;
    try {
      const { data, error: updErr } = await concluirPrazoDb(id, user?.id);
      assertRowsAffected(data, updErr, 1);
      toast({ title: "Prazo concluído" });
    } catch (err) {
      toast({ title: "Não foi possível concluir", description: getErrorMessage(err), variant: "destructive" });
    }
    qc.invalidateQueries({ queryKey: ["dashboard-prazos", officeId] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats", officeId] });
    qc.invalidateQueries({ queryKey: ["prazos"] });
  };

  return (
    <Shell icon={AlertCircle} title="Próximos Prazos" to="/prazos">
      {isLoading ? <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-primary/40" /></div>
        : error ? <ErroBloco onRetry={() => refetch()} />
        : items.length === 0 ? <p className="text-sm text-muted-foreground/50 font-medium py-6 text-center">Nenhum prazo pendente.</p>
          : <div className="space-y-1">
            {items.map((p: any) => (
              <div key={p.id} className="group flex items-center gap-2 p-2 rounded-xl hover:bg-card/80 transition-all">
                {canManagePrazos && <button onClick={(e) => concluir(p.id, e)} title="Concluir prazo" aria-label="Concluir prazo"
                  className="shrink-0 h-5 w-5 rounded-full border-2 border-muted-foreground/30 hover:border-emerald-500 hover:bg-emerald-500/10 flex items-center justify-center transition-all">
                  <Check className="h-3 w-3 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>}
                <button onClick={() => navigate(`/prazos?openId=${p.id}`)} className="flex items-center gap-2.5 flex-1 min-w-0 text-left group/row" title="Abrir prazo">
                  <span className="text-xs font-bold truncate flex-1 group-hover/row:text-primary transition-colors">{pick(p, ["titulo", "tipo_prazo", "numero_processo"], "Prazo")}</span>
                  {/* Prazo vencido e ainda pendente lê como vencido — antes era cinza,
                      idêntico a um que só vence no mês que vem. */}
                  <Vencimento data={dataFatalDoItem(p)} />
                </button>
              </div>
            ))}
          </div>}
    </Shell>
  );
}

export function TarefasBlock() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const officeId = user?.office_id;

  const { data: items = [], isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard-tarefas", officeId],
    enabled: !!officeId,
    staleTime: 60_000,
    queryFn: async () => {
      if (!officeId) return [];
      const { data, error: qErr } = await supabase.from("tarefas").select("id, titulo, data_vencimento, prioridade").eq("office_id", officeId).eq("deletado", false).eq("concluida", false)
        .order("data_vencimento", { ascending: true, nullsFirst: false }).limit(6);
      if (qErr) throw qErr;
      return data || [];
    },
  });

  const cor = (p?: string) => p === "alta" ? "bg-rose-500" : p === "baixa" ? "bg-slate-400" : "bg-amber-500";

  return (
    <Shell icon={CheckSquare} title="Minhas Tarefas" to="/tarefas">
      {isLoading ? <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-primary/40" /></div>
        : error ? <ErroBloco onRetry={() => refetch()} />
        : items.length === 0 ? <p className="text-sm text-muted-foreground/50 font-medium py-6 text-center">Nenhuma tarefa pendente.</p>
          : <div className="space-y-1">
            {items.map((t: any) => (
              <button key={t.id} onClick={() => navigate(`/tarefas?openId=${t.id}`)} className="group flex items-center gap-2.5 p-2 rounded-xl hover:bg-card/80 transition-all w-full text-left">
                <span className={cn("h-2 w-2 rounded-full shrink-0", cor(t.prioridade))} />
                <span className="text-xs font-bold truncate flex-1 group-hover:text-primary transition-colors">{t.titulo || "Tarefa"}</span>
                <Vencimento data={t.data_vencimento} />
              </button>
            ))}
          </div>}
    </Shell>
  );
}

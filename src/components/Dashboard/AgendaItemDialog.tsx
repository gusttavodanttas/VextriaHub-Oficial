import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, ExternalLink, Calendar, User, AlertCircle, Clock, Headphones, BookOpen, CheckSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { continueOccurrences, RecRule } from "@/lib/recorrencia";

export type AgendaType = "prazo" | "audiencia" | "tarefa" | "atendimento" | "consultivo";

const CFG: Record<AgendaType, { label: string; route: string; dateField: string; titleField: string; Icon: any; canConclude: boolean }> = {
  prazo:       { label: "Prazo",       route: "/prazos",       dateField: "data_fim_prazo",  titleField: "titulo",           Icon: AlertCircle, canConclude: true },
  audiencia:   { label: "Audiência",   route: "/audiencias",   dateField: "data_audiencia",  titleField: "titulo",           Icon: Clock,       canConclude: false },
  tarefa:      { label: "Tarefa",      route: "/tarefas",      dateField: "data_vencimento", titleField: "titulo",           Icon: CheckSquare, canConclude: true },
  atendimento: { label: "Atendimento", route: "/atendimentos", dateField: "data_atendimento",titleField: "tipo_atendimento", Icon: Headphones,  canConclude: false },
  consultivo:  { label: "Consultivo",  route: "/consultivo",   dateField: "prazo",           titleField: "titulo",           Icon: BookOpen,    canConclude: true },
};

const fmt = (d?: string | null) => { if (!d) return "—"; try { return new Date(d.length <= 10 ? `${d}T12:00:00` : d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", ...(d.length > 10 ? { hour: "2-digit", minute: "2-digit" } : {}) }); } catch { return "—"; } };

interface Props {
  item: { type: AgendaType; id: string } | null;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

export function AgendaItemDialog({ item, onOpenChange, onChanged }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [row, setRow] = useState<any>(null);
  const [clienteNome, setClienteNome] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const cfg = item ? CFG[item.type] : null;

  useEffect(() => {
    if (!item) { setRow(null); setClienteNome(null); return; }
    let cancel = false;
    (async () => {
      setLoading(true);
      const table = CFG[item.type].label === "Prazo" ? "prazos" : item.type === "audiencia" ? "audiencias" : item.type === "tarefa" ? "tarefas" : item.type === "atendimento" ? "atendimentos" : "consultivos";
      const { data } = await supabase.from(table as any).select("*").eq("id", item.id).maybeSingle();
      if (cancel) return;
      setRow(data);
      if (data?.cliente_id) {
        const { data: c } = await supabase.from("clientes").select("nome").eq("id", data.cliente_id).maybeSingle();
        if (!cancel) setClienteNome(c?.nome || null);
      } else setClienteNome(null);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [item?.type, item?.id]);

  const concluir = async () => {
    if (!item || !cfg) return;
    setSaving(true);
    const now = new Date().toISOString();
    let error: any = null;
    if (item.type === "tarefa") {
      ({ error } = await supabase.from("tarefas").update({ concluida: true, concluida_em: now, concluida_por: user?.id, recorrencia_restantes: 0 } as any).eq("id", item.id));
      if (error) ({ error } = await supabase.from("tarefas").update({ concluida: true }).eq("id", item.id));
      // recorrência encadeada: gera a próxima ocorrência
      if (!error && row?.recorrencia_regra && (row.recorrencia_restantes ?? 0) > 0 && row.data_vencimento) {
        const next = continueOccurrences(new Date(`${row.data_vencimento}T12:00:00`), row.recorrencia_regra as RecRule, 1)[0];
        await supabase.from("tarefas").insert([{
          titulo: row.titulo, descricao: row.descricao ?? null, prioridade: row.prioridade ?? "media",
          cliente_id: row.cliente_id ?? null, processo_id: row.processo_id ?? null, atendimento_id: row.atendimento_id ?? null,
          responsavel_id: row.responsavel_id ?? null, recorrencia_grupo: row.recorrencia_grupo ?? null,
          recorrencia_regra: row.recorrencia_regra, recorrencia_restantes: (row.recorrencia_restantes ?? 0) - 1,
          data_vencimento: format(next, "yyyy-MM-dd"), office_id: row.office_id, user_id: row.user_id ?? user?.id,
          concluida: false, deletado: false,
        }]);
      }
    } else if (item.type === "prazo") {
      ({ error } = await supabase.from("prazos").update({ status: "concluido", concluido_em: now, concluido_por: user?.id } as any).eq("id", item.id));
      if (error) ({ error } = await supabase.from("prazos").update({ status: "concluido" }).eq("id", item.id));
    } else if (item.type === "consultivo") {
      ({ error } = await supabase.from("consultivos").update({ status: "concluido" }).eq("id", item.id));
    }
    setSaving(false);
    if (error) { toast({ title: "Erro ao concluir", description: error.message, variant: "destructive" }); return; }
    toast({ title: `${cfg.label} concluído(a)` });
    onChanged?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="w-[95vw] max-w-md rounded-3xl">
        {cfg && (
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-black">
              <span className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><cfg.Icon className="h-4 w-4" /></span>
              <span className="truncate">{cfg.label}</span>
            </DialogTitle>
            <DialogDescription className="sr-only">Detalhes do item da agenda</DialogDescription>
          </DialogHeader>
        )}

        {loading || !row || !cfg ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary/40" /></div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="font-black text-base leading-tight">{row[cfg.titleField] || cfg.label}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{fmt(row[cfg.dateField])}</span>
                {clienteNome && <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{clienteNome}</span>}
                {row.status && <Badge variant="outline" className="text-[10px] font-black uppercase rounded-md px-2 py-0">{row.status}</Badge>}
              </div>
            </div>
            {(row.descricao || row.observacoes || row.local) && (
              <p className="text-sm text-muted-foreground bg-muted/30 rounded-xl p-3">{row.descricao || row.observacoes || row.local}</p>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              {cfg.canConclude && row.status !== "concluido" && !row.concluida && (
                <Button onClick={concluir} disabled={saving} className="flex-1 rounded-xl font-bold gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Concluir
                </Button>
              )}
              <Button variant="outline" className="flex-1 rounded-xl gap-2" onClick={() => { onOpenChange(false); navigate(cfg.route); }}>
                <ExternalLink className="h-4 w-4" /> Abrir na aba
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

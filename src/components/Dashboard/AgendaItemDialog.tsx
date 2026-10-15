import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, ExternalLink, Calendar, User, AlertCircle, Clock, Headphones, BookOpen, CheckSquare, Gavel, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { AVISO_RECORRENCIA_FALHOU, concluirTarefaDb, concluirPrazoDb, gerarProximaOcorrenciaTarefa } from "@/lib/concluirItens";
import { assertRowsAffected, getErrorMessage } from "@/lib/errors";
import { captureError } from "@/lib/monitoring";
import { usePermissions } from "@/hooks/usePermissions";
import { AgendarPublicacaoDialog } from "@/components/Processos/AgendarPublicacaoDialog";
import { pareceAudiencia, extrairAudienciaSugerida } from "@/components/Prazos/shared";

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
  const qc = useQueryClient();
  const [row, setRow] = useState<any>(null);
  const [clienteNome, setClienteNome] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [agendarOpen, setAgendarOpen] = useState(false);
  const [agendarRow, setAgendarRow] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [ed, setEd] = useState({ data: "", hora: "", local: "", tipo: "", titulo: "", prioridade: "media" });

  const cfg = item ? CFG[item.type] : null;
  // Concluir/editar/marcar realizada gravam direto no banco — respeitam o canManage*
  // do tipo (antes qualquer um que abrisse o item pelo Dashboard via os botões).
  const perms = usePermissions();
  const canManage = !item ? false : ({
    prazo: perms.canManagePrazos, audiencia: perms.canManageAudiencias, tarefa: perms.canManageTarefas,
    atendimento: perms.canEditAtendimentos, consultivo: perms.canManageConsultivo,
  } as Record<AgendaType, boolean>)[item.type];

  useEffect(() => {
    if (!item) { setRow(null); setClienteNome(null); setLoadError(null); return; }
    let cancel = false;
    setEditing(false);
    (async () => {
      setLoading(true);
      setLoadError(null);
      const table = CFG[item.type].label === "Prazo" ? "prazos" : item.type === "audiencia" ? "audiencias" : item.type === "tarefa" ? "tarefas" : item.type === "atendimento" ? "atendimentos" : "consultivos";
      const { data, error } = await supabase.from(table as any).select("*").eq("id", item.id).maybeSingle();
      if (cancel) return;
      // Antes: erro ou item inexistente (excluído, sem acesso) deixava `row` nulo e o
      // dialog preso no spinner para sempre.
      if (error || !data) {
        setRow(null);
        setLoadError(error ? getErrorMessage(error, "Não foi possível carregar o item.") : "Item não encontrado — ele pode ter sido excluído ou você não tem acesso a ele.");
        setLoading(false);
        return;
      }
      setRow(data);
      // `table as any` faz o select retornar SelectQueryError; tipamos o mínimo que usamos.
      const rec = data as unknown as { cliente_id?: string | null } | null;
      if (rec?.cliente_id) {
        const { data: c } = await supabase.from("clientes").select("nome").eq("id", rec.cliente_id).maybeSingle();
        if (!cancel) setClienteNome(c?.nome || null);
      } else setClienteNome(null);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [item?.type, item?.id, reloadKey]);

  // Após mutar direto no banco, invalida as queries do dashboard e das páginas para
  // os blocos irmãos (Próximos Prazos, KPIs) e as abas não ficarem com dado velho.
  const invalidarTudo = () => {
    ["dashboard-stats", "dashboard-prazos", "dashboard-tarefas", "prazos", "tarefas", "audiencias", "consultivos"]
      .forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };

  const concluir = async () => {
    if (!item || !cfg || !canManage) return;
    setSaving(true);
    let recorrenciaFalhou = false;
    try {
      // Todas as variantes conferem linhas afetadas: a RLS bloqueando devolve 0 linhas
      // sem erro, e o dialog dizia "concluído" com o item intocado.
      if (item.type === "tarefa") {
        // Lógica (update + fallback + recorrência) em lib/concluirItens.ts —
        // compartilhada com useTarefas.tsx, pra não haver 2 cópias divergindo.
        const { data, error } = await concluirTarefaDb(item.id, user?.id);
        assertRowsAffected(data, error, 1);
        if (row?.recorrencia_regra && (row.recorrencia_restantes ?? 0) > 0 && row.data_vencimento) {
          const { error: recErr } = await gerarProximaOcorrenciaTarefa(row, row.office_id, row.user_id ?? user?.id ?? "");
          if (recErr) { captureError(recErr, { context: "AgendaItemDialog.gerarProximaOcorrencia", tarefaId: item.id }); recorrenciaFalhou = true; }
        }
      } else if (item.type === "prazo") {
        const { data, error } = await concluirPrazoDb(item.id, user?.id);
        assertRowsAffected(data, error, 1);
      } else if (item.type === "consultivo") {
        const { data, error } = await supabase.from("consultivos").update({ status: "concluido" }).eq("id", item.id).select("id");
        assertRowsAffected(data, error, 1);
      }
    } catch (e) {
      setSaving(false);
      toast({ title: "Erro ao concluir", description: getErrorMessage(e), variant: "destructive" });
      return;
    }
    setSaving(false);
    if (recorrenciaFalhou) toast({ title: "Série recorrente interrompida", description: AVISO_RECORRENCIA_FALHOU, variant: "destructive" });
    else toast({ title: `${cfg.label} concluído(a)` });
    invalidarTudo();
    onChanged?.();
    onOpenChange(false);
  };

  const startEdit = () => {
    if (item?.type === "audiencia") {
      const dt = row?.data_audiencia ? new Date(row.data_audiencia) : null;
      const valid = dt && !isNaN(dt.getTime()) ? dt : null;
      setEd({ data: valid ? format(valid, "yyyy-MM-dd") : "", hora: valid ? format(valid, "HH:mm") : "", local: row?.local || "", tipo: row?.tipo || "", titulo: row?.titulo || "", prioridade: row?.prioridade || "media" });
    } else {
      setEd({ data: String(row?.data_fim_prazo || row?.data_vencimento || "").slice(0, 10), hora: "", local: "", tipo: "", titulo: row?.titulo || "", prioridade: row?.prioridade || "media" });
    }
    setEditing(true);
  };

  const salvar = async () => {
    if (!item || !canManage) return;
    if (!ed.data) { toast({ title: "Informe a data", variant: "destructive" }); return; }
    setSaving(true);
    try {
      if (item.type === "audiencia") {
        const iso = new Date(`${ed.data}T${ed.hora || "00:00"}`).toISOString();
        const patch = { data_audiencia: iso, local: ed.local || null, tipo: ed.tipo || null, titulo: ed.titulo || row.titulo };
        const { data, error } = await supabase.from("audiencias").update(patch).eq("id", item.id).select("id");
        assertRowsAffected(data, error, 1);
        setRow({ ...row, ...patch });
      } else {
        // prazo: grava as DUAS datas (data_fim_prazo é a que Agenda/Dashboard/Relatórios leem)
        const patch = { data_fim_prazo: ed.data, data_vencimento: ed.data, titulo: ed.titulo || row.titulo, prioridade: ed.prioridade };
        const { data, error } = await supabase.from("prazos").update(patch).eq("id", item.id).select("id");
        assertRowsAffected(data, error, 1);
        setRow({ ...row, ...patch });
      }
    } catch (e) {
      setSaving(false);
      toast({ title: "Erro ao salvar", description: getErrorMessage(e), variant: "destructive" });
      return;
    }
    setSaving(false);
    toast({ title: `${cfg?.label || "Item"} atualizado` });
    invalidarTudo();
    setEditing(false);
    onChanged?.();
  };

  const marcarRealizada = async () => {
    if (!item || !canManage) return;
    setSaving(true);
    const { data, error } = await supabase.from("audiencias").update({ status: "realizada" }).eq("id", item.id).select("id");
    setSaving(false);
    try { assertRowsAffected(data, error, 1); } catch (e) {
      toast({ title: "Erro ao marcar como realizada", description: getErrorMessage(e), variant: "destructive" });
      return;
    }
    toast({ title: "Audiência marcada como realizada" });
    invalidarTudo();
    onChanged?.();
    onOpenChange(false);
  };

  const audSug = agendarRow ? extrairAudienciaSugerida(agendarRow.descricao || "") : { data: null, hora: null, tipo: null };

  return (
    <>
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className={cn(
          "w-[95vw] max-w-md rounded-3xl max-h-[85vh] overflow-y-auto",
          // Mobile: vira "bottom sheet" colado embaixo, largura total e rolável
          "max-sm:w-full max-sm:max-w-none max-sm:left-0 max-sm:translate-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-3xl max-sm:max-h-[88vh]"
        )}
      >
        {cfg && (
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-black">
              <span className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><cfg.Icon className="h-4 w-4" /></span>
              <span className="truncate">{cfg.label}</span>
            </DialogTitle>
            <DialogDescription className="sr-only">Detalhes do item da agenda</DialogDescription>
          </DialogHeader>
        )}

        {loadError ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <p className="text-sm text-muted-foreground">{loadError}</p>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setReloadKey((k) => k + 1)}>Tentar de novo</Button>
          </div>
        ) : loading || !row || !cfg ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary/40" /></div>
        ) : editing ? (
          <div className="space-y-3">
            <label className="block text-[11px] font-black uppercase tracking-widest text-muted-foreground/70">Título
              <Input value={ed.titulo} onChange={(e) => setEd({ ...ed, titulo: e.target.value })} className="rounded-xl mt-1" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/70">{item?.type === "audiencia" ? "Data da audiência" : "Data do prazo"}
                <Input type="date" value={ed.data} onChange={(e) => setEd({ ...ed, data: e.target.value })} className="rounded-xl mt-1" />
              </label>
              {item?.type === "audiencia" ? (
                <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/70">Hora
                  <Input type="time" value={ed.hora} onChange={(e) => setEd({ ...ed, hora: e.target.value })} className="rounded-xl mt-1" />
                </label>
              ) : (
                <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/70">Prioridade
                  <select value={ed.prioridade} onChange={(e) => setEd({ ...ed, prioridade: e.target.value })} className="w-full rounded-xl mt-1 h-10 px-3 bg-background border border-input text-sm">
                    <option value="alta">Alta</option>
                    <option value="media">Média</option>
                    <option value="baixa">Baixa</option>
                  </select>
                </label>
              )}
            </div>
            {item?.type === "audiencia" && (
              <>
                <label className="block text-[11px] font-black uppercase tracking-widest text-muted-foreground/70">Local
                  <Input value={ed.local} onChange={(e) => setEd({ ...ed, local: e.target.value })} placeholder="Fórum, sala virtual, link..." className="rounded-xl mt-1" />
                </label>
                <label className="block text-[11px] font-black uppercase tracking-widest text-muted-foreground/70">Tipo
                  <Input value={ed.tipo} onChange={(e) => setEd({ ...ed, tipo: e.target.value })} placeholder="Ex: Audiência de Conciliação" className="rounded-xl mt-1" />
                </label>
              </>
            )}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setEditing(false)} disabled={saving}>Cancelar</Button>
              <Button className="flex-1 rounded-xl font-bold gap-2" onClick={salvar} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Salvar
              </Button>
            </div>
          </div>
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

            {/* Ações compactas (ícone + tooltip) — texto nos botões estourava a largura e criava scroll lateral */}
            <TooltipProvider delayDuration={150}>
              <div className="flex items-center justify-end gap-2 pt-1">
                {canManage && item?.type === "prazo" && row.status !== "concluido" && (row.possivel_audiencia || pareceAudiencia(row.descricao || "")) && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" aria-label="Agendar audiência" onClick={() => { const r = row; onOpenChange(false); setTimeout(() => { try { document.body.style.pointerEvents = ""; } catch { /* */ } setAgendarRow(r); setAgendarOpen(true); }, 300); }} className="h-10 w-10 p-0 rounded-xl shrink-0">
                        <Gavel className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Agendar audiência</TooltipContent>
                  </Tooltip>
                )}
                {canManage && (item?.type === "audiencia" || item?.type === "prazo") && row.status !== "concluido" && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" aria-label={item?.type === "audiencia" ? "Editar audiência" : "Editar prazo"} onClick={startEdit} className="h-10 w-10 p-0 rounded-xl shrink-0">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{item?.type === "audiencia" ? "Editar audiência" : "Editar prazo"}</TooltipContent>
                  </Tooltip>
                )}
                {canManage && item?.type === "audiencia" && row.status !== "realizada" && row.status !== "cancelada" && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" aria-label="Marcar como realizada" onClick={marcarRealizada} disabled={saving} className="h-10 w-10 p-0 rounded-xl shrink-0 text-emerald-600">
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Marcar como realizada</TooltipContent>
                  </Tooltip>
                )}
                {canManage && cfg.canConclude && row.status !== "concluido" && !row.concluida && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button aria-label="Concluir" onClick={concluir} disabled={saving} className="h-10 w-10 p-0 rounded-xl shrink-0">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Concluir</TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" aria-label="Abrir na aba" className="h-10 w-10 p-0 rounded-xl shrink-0" onClick={() => { onOpenChange(false); navigate(`${cfg.route}?openId=${item?.id}`); }}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Abrir na aba</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>
        )}
      </DialogContent>
    </Dialog>
    {agendarRow && (
      <AgendarPublicacaoDialog
        open={agendarOpen}
        onOpenChange={(v) => { setAgendarOpen(v); if (!v) setAgendarRow(null); }}
        defaultTipo="audiencia"
        publicacaoId={agendarRow.publicacao_id || undefined}
        numeroProcesso={agendarRow.numero_processo || undefined}
        processoId={agendarRow.processo_id || null}
        tituloSugerido={agendarRow.titulo || undefined}
        descricaoSugerida={agendarRow.descricao || undefined}
        dataSugerida={(agendarRow.audiencia_data_sugerida || audSug.data) || undefined}
        horaSugerida={(agendarRow.audiencia_hora_sugerida || audSug.hora) || undefined}
        tipoAudienciaSugerido={(agendarRow.audiencia_tipo_sugerido || audSug.tipo) || undefined}
        prazoOrigemId={item?.type === "prazo" ? agendarRow.id : null}
        onSuccess={() => { setAgendarOpen(false); setAgendarRow(null); onChanged?.(); }}
      />
    )}
    </>
  );
}

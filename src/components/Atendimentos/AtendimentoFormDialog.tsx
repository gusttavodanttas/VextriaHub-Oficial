// Formulário de criar/editar atendimento — extraído de pages/Atendimentos.tsx.
import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RECORRENCIAS } from "@/lib/recorrencia";
import { fmtSafe } from "@/lib/dates";
import { atendimentoFormSchema, firstZodError } from "@/lib/validation";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ClientSelect } from "@/components/Clientes/ClientSelect";
import { AvisoDiasSelect } from "@/components/Notifications/AvisoDiasSelect";
import { MessageSquare, FileText, AlertCircle, Loader2, Repeat } from "lucide-react";
import {
  NONE, TIPOS_FIXOS, haConflito, tipoInfo, toNull,
  type Atendimento, type ClienteOpt, type ProcessoOpt, type MembroOpt,
  type FormState, type StatusType,
} from "./shared";

export const AtendimentoFormDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  initial: FormState;
  editId?: string;
  officeId: string;
  userId: string;
  extras: string[];
  membros?: MembroOpt[];
  existing?: Atendimento[];
  onSave: (data: any) => void;
  onUpdate: (data: any) => void;
  loading: boolean;
}> = ({ open, onClose, initial, editId, officeId, userId, extras, membros = [], existing = [], onSave, onUpdate, loading }) => {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(initial);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  useEffect(() => { if (open) setForm(initial); }, [open]);

  // Ao editar, se não há cliente mas há processo vinculado, puxa o cliente do processo
  useEffect(() => {
    if (!open || !editId) return;
    const semCliente = initial.cliente_id === NONE || !initial.cliente_id;
    const temProcesso = initial.processo_id !== NONE && !!initial.processo_id;
    if (!semCliente || !temProcesso) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("processos").select("cliente_id").eq("id", initial.processo_id).maybeSingle();
      if (!cancelled && data?.cliente_id) setForm((prev) => ({ ...prev, cliente_id: data.cliente_id as string }));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editId]);

  const { data: clientes = [] } = useQuery<ClienteOpt[]>({
    queryKey: ["clientes-at", officeId],
    enabled: !!officeId,
    queryFn: async () => {
      const { data } = await supabase.from("clientes").select("id, nome")
        .eq("office_id", officeId).eq("deletado", false).order("nome");
      return (data ?? []) as ClienteOpt[];
    },
  });

  const clienteSelecionado = form.cliente_id !== NONE && !!form.cliente_id;

  const { data: processos = [] } = useQuery<ProcessoOpt[]>({
    queryKey: ["processos-at", officeId, form.cliente_id],
    enabled: !!officeId && clienteSelecionado,
    queryFn: async () => {
      const { data } = await supabase.from("processos")
        .select("id, numero_processo, titulo")
        .eq("office_id", officeId)
        .eq("cliente_id", form.cliente_id)
        .eq("deletado", false);
      return (data ?? []).map((p: any) => ({
        id: p.id,
        titulo: p.titulo || p.numero_processo || p.id,
        numero: p.numero_processo || "",
      }));
    },
  });

  // Conflito de horário: mesmo responsável, status ativo, janelas sobrepostas
  const conflitos = useMemo(() => {
    if (form.status !== "agendado" && form.status !== "pendente") return [];
    if (!form.data_atendimento || !form.hora_atendimento) return [];
    const startMs = new Date(`${form.data_atendimento}T${form.hora_atendimento}:00`).getTime();
    if (Number.isNaN(startMs)) return [];
    const dur = form.duracao ? Number(form.duracao) : 0;
    const resp = form.responsavel_id;
    return existing.filter((it) => {
      if (editId && it.id === editId) return false;
      if (it.status !== "agendado" && it.status !== "pendente") return false;
      const itResp = (it as any).responsavel_id;
      if (resp && itResp && itResp !== resp) return false;
      return haConflito(startMs, dur, it);
    });
  }, [existing, form.data_atendimento, form.hora_atendimento, form.duracao, form.responsavel_id, form.status, editId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Rede de segurança além do required do HTML (regras em @/lib/validation)
    const val = atendimentoFormSchema.safeParse(form);
    if (!val.success) {
      toast({ title: "Campos obrigatórios", description: firstZodError(val.error), variant: "destructive" });
      return;
    }
    const datetime = `${form.data_atendimento}T${form.hora_atendimento}:00`;
    const recorrente = !editId && form.recorrencia !== "nenhuma";
    const payload: any = {
      tipo_atendimento: toNull(form.tipo_atendimento),
      data_atendimento: datetime,
      observacoes: form.observacoes.trim() || null,
      status: form.status,
      cliente_id: toNull(form.cliente_id),
      processo_id: toNull(form.processo_id),
      user_id: userId,
      office_id: officeId,
      deletado: false,
      responsavel_id: form.responsavel_id || userId || null,
      duracao: form.duracao ? Number(form.duracao) : null,
      ...((form.avisos_dias != null || editId) ? { avisos_dias: form.avisos_dias } : {}),
      ...((form.resultado.trim() || (editId && form.status === "realizado")) ? { resultado: form.resultado.trim() || null } : {}),
    };
    if (recorrente) {
      const n = Math.max(1, Math.min(52, parseInt(form.ocorrencias) || 1));
      payload.recorrencia_grupo = (crypto as any).randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      payload.recorrencia_regra = form.recorrencia;
      payload.recorrencia_restantes = n - 1;
    }
    if (editId) onUpdate({ id: editId, ...payload });
    else onSave(payload);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-sm p-0 rounded-3xl border border-black/5 dark:border-border shadow-premium" style={{maxHeight:"88vh",overflowY:"auto"}}>
        <div className="px-5 pt-4 pb-3 bg-gradient-to-br from-primary/8 via-primary/4 to-transparent">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 bg-primary/10 text-primary">
                <MessageSquare className="h-4 w-4" />
              </div>
              <DialogTitle className="text-lg font-black tracking-tight">
                {editId ? "Editar Atendimento" : "Novo Atendimento"}
              </DialogTitle>
            </div>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-3">
          {/* Tipo */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tipo *</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {TIPOS_FIXOS.map(({ value, label, Icon }) => (
                <button key={value} type="button"
                  onClick={() => set("tipo_atendimento", value)}
                  className={cn(
                    "flex items-center gap-2 py-2 px-3 rounded-xl border text-left transition-all text-[11px] font-black uppercase tracking-wide",
                    form.tipo_atendimento === value
                      ? "bg-primary/10 border-primary/40 text-primary"
                      : "border-black/8 dark:border-border text-muted-foreground hover:border-foreground/20 hover:bg-muted/30"
                  )}>
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{label}</span>
                </button>
              ))}
              {extras.map((label) => (
                <button key={label} type="button"
                  onClick={() => set("tipo_atendimento", label)}
                  className={cn(
                    "flex items-center gap-2 py-2 px-3 rounded-xl border text-left transition-all text-[11px] font-black uppercase tracking-wide",
                    form.tipo_atendimento === label
                      ? "bg-primary/10 border-primary/40 text-primary"
                      : "border-black/8 dark:border-border text-muted-foreground hover:border-foreground/20 hover:bg-muted/30"
                  )}>
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Data + Hora + Status em linha */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Data *</Label>
              <Input required type="date" value={form.data_atendimento}
                onChange={(e) => set("data_atendimento", e.target.value)}
                className="rounded-xl h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Hora *</Label>
              <Input required type="time" value={form.hora_atendimento}
                onChange={(e) => set("hora_atendimento", e.target.value)}
                className="rounded-xl h-9 text-sm" />
            </div>
          </div>

          {/* Aviso de conflito de horário */}
          {conflitos.length > 0 && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-700 dark:text-amber-500 font-semibold leading-snug">
                Conflito de horário com {conflitos.length} atendimento{conflitos.length > 1 ? "s" : ""}:{" "}
                {conflitos.slice(0, 2).map((c) =>
                  `${c.clientes?.nome || tipoInfo(c.tipo_atendimento).label} (${fmtSafe(c.data_atendimento, "HH:mm")})`
                ).join(", ")}{conflitos.length > 2 ? "…" : ""}
              </p>
            </div>
          )}

          {/* Status + Cliente em linha */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v as StatusType)}>
                <SelectTrigger className="rounded-xl h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agendado">Agendado</SelectItem>
                  <SelectItem value="realizado">Realizado</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cliente</Label>
              <ClientSelect
                value={form.cliente_id === NONE ? "" : form.cliente_id}
                onValueChange={(id) => { set("cliente_id", id); set("processo_id", NONE); }}
                placeholder="Selecionar cliente"
              />
            </div>
          </div>

          {/* Processo */}
          {clienteSelecionado && (
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Processo</Label>
              <Select value={form.processo_id} onValueChange={(v) => set("processo_id", v)}>
                <SelectTrigger className="rounded-xl h-9 text-sm"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhum</SelectItem>
                  {processos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.titulo}{p.numero && p.numero !== p.titulo ? ` — ${p.numero}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Responsável */}
          {membros.length > 0 && (
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Responsável</Label>
              <Select value={form.responsavel_id} onValueChange={(v) => set("responsavel_id", v)}>
                <SelectTrigger className="rounded-xl h-9 text-sm"><SelectValue placeholder="Selecionar responsável" /></SelectTrigger>
                <SelectContent>
                  {membros.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Duração + Avisar */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Duração (min)</Label>
              <Input type="number" min={0} value={form.duracao}
                onChange={(e) => set("duracao", e.target.value)}
                placeholder="Ex: 60" className="rounded-xl h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Avisar</Label>
              <AvisoDiasSelect value={form.avisos_dias} onChange={(v) => set("avisos_dias", v)} />
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-1">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Observações</Label>
            <Textarea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)}
              className="rounded-xl text-sm resize-none" rows={2}
              placeholder="Detalhes do atendimento..." />
          </div>

          {/* Resultado (somente quando realizado) */}
          {form.status === "realizado" && (
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Resultado / desfecho</Label>
              <Textarea value={form.resultado} onChange={(e) => set("resultado", e.target.value)}
                className="rounded-xl text-sm resize-none" rows={2}
                placeholder="O que ficou decidido?" />
            </div>
          )}

          {/* Recorrência (somente em novo atendimento) */}
          {!editId && (
            <div className="rounded-2xl border border-black/5 dark:border-border bg-card/40 p-3 space-y-2">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                <Repeat className="h-3.5 w-3.5" /> Recorrência
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select value={form.recorrencia} onValueChange={(v) => set("recorrencia", v)}>
                  <SelectTrigger className="rounded-xl h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RECORRENCIAS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {form.recorrencia !== "nenhuma" && (
                  <div className="flex items-center gap-2">
                    <Input type="number" min={1} max={52} value={form.ocorrencias}
                      onChange={(e) => set("ocorrencias", e.target.value)}
                      className="rounded-xl h-9 text-sm" />
                    <span className="text-[11px] text-muted-foreground font-semibold whitespace-nowrap">vezes</span>
                  </div>
                )}
              </div>
              {form.recorrencia !== "nenhuma" && (
                <p className="text-[11px] text-muted-foreground/70">
                  Cria o 1º atendimento; ao concluí-lo, o próximo é gerado automaticamente (até {Math.max(1, Math.min(52, parseInt(form.ocorrencias) || 1))} ocorrências).
                </p>
              )}
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}
              className="flex-1 rounded-xl h-9 font-black uppercase text-[10px] tracking-widest">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || form.tipo_atendimento === NONE}
              className="flex-1 rounded-xl h-9 font-black uppercase text-[10px] tracking-widest shadow-premium">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : editId ? "Salvar" : "Registrar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

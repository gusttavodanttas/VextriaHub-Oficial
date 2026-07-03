import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarPlus, Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Audiencia, AudienciaInput } from "@/hooks/useAudiencias";
import { useAuth } from "@/contexts/AuthContext";
import { ClientSelect } from "@/components/Clientes/ClientSelect";
import { AvisoDiasSelect } from "@/components/Notifications/AvisoDiasSelect";
import { format } from "date-fns";

interface MembroOption { id: string; label: string; }
interface ProcessoOption { id: string; label: string; cliente_id: string | null; }

interface NovaAudienciaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipos: string[];
  membros?: MembroOption[];
  processos?: ProcessoOption[];
  existentes?: { id: string; data_audiencia: string }[];
  audiencia?: Audiencia | null;
  onSubmit: (input: AudienciaInput, id?: string) => Promise<void>;
  onManageTipos?: () => void;
}

const statusOptions = [
  { value: "agendada", label: "Agendada" },
  { value: "confirmada", label: "Confirmada" },
  { value: "pendente", label: "Pendente" },
  { value: "realizada", label: "Realizada" },
  { value: "cancelada", label: "Cancelada" },
];

const NONE = "__none__";
const empty = { titulo: "", cliente_id: "", processo_id: NONE, data: "", hora: "", tipo: "", local: "", observacao: "", status: "agendada", responsavel_id: "", avisos_dias: null as number[] | null };

// Monta o estado do formulário a partir de uma audiência (ou vazio para nova).
// Parse de data defensivo: data inválida nunca pode derrubar o preenchimento do resto.
function buildForm(audiencia: Audiencia | null | undefined, userId?: string): typeof empty {
  if (!audiencia) return { ...empty, responsavel_id: userId || "" };
  let data = "", hora = "";
  if (audiencia.data_audiencia) {
    const dt = new Date(audiencia.data_audiencia);
    if (!isNaN(dt.getTime())) { data = format(dt, "yyyy-MM-dd"); hora = format(dt, "HH:mm"); }
  }
  return {
    titulo: audiencia.titulo || "",
    cliente_id: audiencia.cliente_id || "",
    processo_id: (audiencia as any).processo_id || NONE,
    data,
    hora,
    tipo: audiencia.tipo || "",
    local: audiencia.local || "",
    observacao: audiencia.observacoes || "",
    status: audiencia.status || "agendada",
    responsavel_id: (audiencia as any).responsavel_id || userId || "",
    avisos_dias: (audiencia as any).avisos_dias ?? null,
  };
}

export const NovaAudienciaDialog = ({ open, onOpenChange, tipos, membros = [], processos = [], existentes = [], audiencia, onSubmit, onManageTipos }: NovaAudienciaDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  // Preenche JÁ na montagem (síncrono) — não depende de efeito. Com o key de
  // remontagem no pai, cada edição recria o componente com a audiência certa.
  const [formData, setFormData] = useState(() => buildForm(audiencia, user?.id));

  const isEdit = !!audiencia;

  // Reforço: se a audiência/estado de abertura mudar sem remmontar, re-sincroniza.
  useEffect(() => {
    if (!open) return;
    const nova = buildForm(audiencia, user?.id);
    console.log("[VX] dialog effect → open:", open, "| audiencia:", audiencia, "| form.titulo:", nova.titulo, "| form.data:", nova.data);
    setFormData(nova);
  }, [open, audiencia, user?.id]);

  // Processos do cliente selecionado
  const processosFiltrados = useMemo(
    () => formData.cliente_id ? processos.filter((p) => p.cliente_id === formData.cliente_id) : processos,
    [processos, formData.cliente_id]
  );

  // Alerta de conflito: já existe audiência no mesmo dia + horário?
  const conflito = useMemo(() => {
    if (!formData.data || !formData.hora) return null;
    const alvo = `${formData.data}T${formData.hora}`;
    return existentes.find((e) => {
      if (e.id === audiencia?.id) return false;
      const d = new Date(e.data_audiencia);
      if (isNaN(d.getTime())) return false; // data inválida nunca pode derrubar o render
      return format(d, "yyyy-MM-dd'T'HH:mm") === alvo;
    }) || null;
  }, [existentes, formData.data, formData.hora, audiencia?.id]);

  const handleClienteChange = (cliente_id: string) => {
    setFormData((prev) => {
      const valido = prev.processo_id !== NONE && processos.some((p) => p.id === prev.processo_id && p.cliente_id === cliente_id);
      return { ...prev, cliente_id, processo_id: valido ? prev.processo_id : NONE };
    });
  };

  const handleProcessoChange = (processo_id: string) => {
    setFormData((prev) => {
      const proc = processos.find((p) => p.id === processo_id);
      const next = { ...prev, processo_id };
      if (processo_id !== NONE && proc?.cliente_id && !prev.cliente_id) next.cliente_id = proc.cliente_id;
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titulo || !formData.data || !formData.hora || !formData.tipo) {
      toast({ title: "Campos obrigatórios", description: "Preencha título, data, horário e tipo.", variant: "destructive" });
      return;
    }
    const data_audiencia = new Date(`${formData.data}T${formData.hora}:00`).toISOString();
    const input: AudienciaInput = {
      titulo: formData.titulo,
      tipo: formData.tipo,
      data_audiencia,
      local: formData.local || null,
      status: formData.status,
      observacoes: formData.observacao || null,
      cliente_id: formData.cliente_id || null,
      processo_id: formData.processo_id === NONE ? null : formData.processo_id,
      responsavel_id: formData.responsavel_id || user?.id || null,
    };
    // só envia aviso_dias quando definido (ou ao editar) — evita depender da coluna no uso padrão
    if (formData.avisos_dias != null || isEdit) (input as any).avisos_dias = formData.avisos_dias;
    setSaving(true);
    try {
      await onSubmit(input, audiencia?.id);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-500"><CalendarPlus className="h-5 w-5" /></div>
            {isEdit ? "Editar Audiência" : "Nova Audiência"}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? "Atualize os dados da audiência." : "Preencha os dados para agendar uma nova audiência."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="titulo">Título *</Label>
              <Input id="titulo" value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                placeholder="Ex: Audiência de Conciliação" className="rounded-xl" required />
            </div>
            <div className="space-y-2">
              <Label>Cliente</Label>
              <ClientSelect value={formData.cliente_id} onValueChange={(id) => handleClienteChange(id)} placeholder="Selecionar cliente" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                Processo
                {formData.cliente_id && <span className="ml-1 text-[10px] font-bold text-muted-foreground/50">({processosFiltrados.length} do cliente)</span>}
              </Label>
              <Select value={formData.processo_id} onValueChange={handleProcessoChange}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Vincular processo (opcional)" /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value={NONE}>Nenhum</SelectItem>
                  {processosFiltrados.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                  {formData.cliente_id && processosFiltrados.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground/60">Nenhum processo deste cliente</div>
                  )}
                </SelectContent>
              </Select>
            </div>
            {membros.length > 0 && (
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Select value={formData.responsavel_id} onValueChange={(v) => setFormData({ ...formData, responsavel_id: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecionar responsável" /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {membros.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data">Data *</Label>
              <Input id="data" type="date" value={formData.data}
                onChange={(e) => setFormData({ ...formData, data: e.target.value })} className="rounded-xl" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hora">Horário *</Label>
              <Input id="hora" type="time" value={formData.hora}
                onChange={(e) => setFormData({ ...formData, hora: e.target.value })} className="rounded-xl" required />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="tipo">Tipo *</Label>
                {onManageTipos && (
                  <button type="button" onClick={onManageTipos} className="text-[11px] font-bold text-primary hover:underline">
                    Gerenciar tipos
                  </button>
                )}
              </div>
              <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  {tipos.length === 0 && <SelectItem value="none" disabled>Nenhum tipo cadastrado</SelectItem>}
                  {tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {conflito && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] font-semibold text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" /> Já existe uma audiência neste dia e horário. Confira para não marcar em conflito.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="local">Local</Label>
              <Input id="local" value={formData.local}
                onChange={(e) => setFormData({ ...formData, local: e.target.value })}
                placeholder="Ex: Sala 205 - Fórum Central" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  {statusOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Avisar</Label>
              <AvisoDiasSelect value={formData.avisos_dias} onChange={(v) => setFormData({ ...formData, avisos_dias: v })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacao">Observações</Label>
            <Textarea id="observacao" placeholder="Observações sobre a audiência..." value={formData.observacao}
              onChange={(e) => setFormData({ ...formData, observacao: e.target.value })} rows={3} className="rounded-xl" />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1 rounded-xl" disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 rounded-xl font-bold" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? "Salvar alterações" : "Criar Audiência"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

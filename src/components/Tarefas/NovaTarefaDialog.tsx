import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckSquare, Loader2, Repeat, MessageCircle, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { RECORRENCIAS, generateOccurrences, type RecRule } from "@/lib/recorrencia";
import type { Tarefa, TarefaInput } from "@/hooks/useTarefas";
import { useTarefaComentarios } from "@/hooks/useTarefaComentarios";
import { useAuth } from "@/contexts/AuthContext";
import { AvisoDiasSelect } from "@/components/Notifications/AvisoDiasSelect";

interface Option { id: string; label: string; cliente_id?: string | null; }

interface NovaTarefaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientes: Option[];
  processos: Option[];
  atendimentos: Option[];
  membros?: Option[];
  tarefa?: Tarefa | null;
  onSubmit: (input: TarefaInput, id?: string) => Promise<void>;
  onSubmitMany: (inputs: TarefaInput[]) => Promise<void>;
}

const prioridades = [
  { value: "alta", label: "Alta" },
  { value: "media", label: "Média" },
  { value: "baixa", label: "Baixa" },
];

const NONE = "__none__";
const empty = { titulo: "", descricao: "", data_vencimento: "", prioridade: "media", cliente_id: NONE, processo_id: NONE, atendimento_id: NONE, recorrencia: "nenhuma", ocorrencias: "4", responsavel_id: NONE, avisos_dias: null as number[] | null };

const iniciaisDe = (nome: string) =>
  nome.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase() || "?";

const TarefaComentarios = ({ tarefaId, membros }: { tarefaId: string; membros: Option[] }) => {
  const { user } = useAuth();
  const { comentarios, isLoading, add, remove } = useTarefaComentarios(tarefaId);
  const [texto, setTexto] = useState("");
  const nomeDe = (uid: string) => membros.find((m) => m.id === uid)?.label || "Membro";

  const enviar = () => {
    if (!texto.trim()) return;
    add.mutate(texto, { onSuccess: () => setTexto("") });
  };

  return (
    <div className="rounded-2xl border border-black/5 dark:border-border bg-card/40 p-3 space-y-3">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground/70">
        <MessageCircle className="h-3.5 w-3.5" /> Comentários
        {comentarios.length > 0 && <span className="text-muted-foreground/40">· {comentarios.length}</span>}
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground/50">Carregando…</p>
      ) : comentarios.length === 0 ? (
        <p className="text-xs text-muted-foreground/40 italic">Nenhum comentário ainda.</p>
      ) : (
        <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
          {comentarios.map((c) => {
            const nome = nomeDe(c.user_id);
            const meu = c.user_id === user?.id;
            return (
              <div key={c.id} className="flex gap-2.5 group/c">
                <div className="h-7 w-7 rounded-full bg-primary/10 text-primary text-[10px] font-black flex items-center justify-center shrink-0">
                  {iniciaisDe(nome)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold">{nome}</span>
                    <span className="text-[10px] text-muted-foreground/50">{format(parseISO(c.created_at), "dd/MM/yy HH:mm")}</span>
                    {meu && (
                      <button type="button" onClick={() => remove.mutate(c.id)}
                        className="ml-auto opacity-0 group-hover/c:opacity-100 text-muted-foreground/40 hover:text-rose-500 transition-opacity"
                        title="Excluir comentário">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground/90 whitespace-pre-wrap break-words">{c.texto}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-2">
        <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={1}
          placeholder="Escreva um comentário… (Ctrl+Enter envia)" className="rounded-xl resize-none text-sm min-h-[2.25rem]"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); enviar(); } }} />
        <Button type="button" size="sm" onClick={enviar} disabled={!texto.trim() || add.isPending} className="rounded-xl self-end h-9">
          {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar"}
        </Button>
      </div>
    </div>
  );
};

export const NovaTarefaDialog = ({ open, onOpenChange, clientes, processos, atendimentos, membros = [], tarefa, onSubmit, onSubmitMany }: NovaTarefaDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ ...empty, responsavel_id: user?.id || NONE });
  const isEdit = !!tarefa;

  // Processos do cliente selecionado (se nenhum cliente, mostra todos)
  const processosFiltrados = useMemo(() => {
    if (formData.cliente_id === NONE) return processos;
    return processos.filter((p) => p.cliente_id === formData.cliente_id);
  }, [processos, formData.cliente_id]);

  // Ao trocar de cliente, limpa o processo se ele não pertence ao novo cliente
  const handleClienteChange = (cliente_id: string) => {
    setFormData((prev) => {
      const aindaValido = cliente_id !== NONE
        && prev.processo_id !== NONE
        && processos.some((p) => p.id === prev.processo_id && p.cliente_id === cliente_id);
      return { ...prev, cliente_id, processo_id: aindaValido ? prev.processo_id : NONE };
    });
  };

  // Vínculo reverso: ao escolher um processo, preenche o cliente dele (se ainda vazio)
  const handleProcessoChange = (processo_id: string) => {
    setFormData((prev) => {
      const proc = processos.find((p) => p.id === processo_id);
      const next: typeof prev = { ...prev, processo_id };
      if (processo_id !== NONE && proc?.cliente_id && prev.cliente_id === NONE) {
        next.cliente_id = proc.cliente_id;
      }
      return next;
    });
  };

  useEffect(() => {
    if (!open) return;
    if (tarefa) {
      setFormData({
        titulo: tarefa.titulo || "",
        descricao: tarefa.descricao || "",
        data_vencimento: tarefa.data_vencimento || "",
        prioridade: tarefa.prioridade || "media",
        cliente_id: tarefa.cliente_id || NONE,
        processo_id: tarefa.processo_id || NONE,
        atendimento_id: tarefa.atendimento_id || NONE,
        recorrencia: tarefa.recorrencia_regra || "nenhuma",
        ocorrencias: tarefa.recorrencia_restantes != null ? String(tarefa.recorrencia_restantes + 1) : "4",
        responsavel_id: tarefa.responsavel_id || user?.id || NONE,
        avisos_dias: (tarefa as any).avisos_dias ?? null,
      });
    } else {
      setFormData({ ...empty, responsavel_id: user?.id || NONE });
    }
  }, [open, tarefa]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titulo.trim()) {
      toast({ title: "Campo obrigatório", description: "Informe o título da tarefa.", variant: "destructive" });
      return;
    }
    const recorrente = formData.recorrencia !== "nenhuma";
    if (!isEdit && recorrente && !formData.data_vencimento) {
      toast({ title: "Data necessária", description: "Defina o vencimento para gerar a recorrência.", variant: "destructive" });
      return;
    }

    const base: TarefaInput = {
      titulo: formData.titulo.trim(),
      descricao: formData.descricao || null,
      data_vencimento: formData.data_vencimento || null,
      prioridade: formData.prioridade,
      cliente_id: formData.cliente_id === NONE ? null : formData.cliente_id,
      processo_id: formData.processo_id === NONE ? null : formData.processo_id,
      atendimento_id: formData.atendimento_id === NONE ? null : formData.atendimento_id,
      responsavel_id: formData.responsavel_id === NONE ? (user?.id || null) : formData.responsavel_id,
      ...((formData.avisos_dias != null || isEdit) ? { avisos_dias: formData.avisos_dias } : {}),
    };

    const n = Math.max(1, Math.min(52, parseInt(formData.ocorrencias) || 1));
    const novoGrupo = () => ((crypto as any).randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

    setSaving(true);
    try {
      if (isEdit) {
        // Editar a recorrência da tarefa existente (define, altera ou limpa)
        const recPatch = recorrente
          ? { recorrencia_grupo: tarefa!.recorrencia_grupo || novoGrupo(), recorrencia_regra: formData.recorrencia, recorrencia_restantes: n - 1 }
          : { recorrencia_grupo: null, recorrencia_regra: null, recorrencia_restantes: null };
        await onSubmit({ ...base, ...recPatch }, tarefa?.id);
      } else if (recorrente) {
        // Recorrência ENCADEADA: cria só a 1ª; as próximas são geradas ao concluir cada uma.
        await onSubmit({
          ...base,
          recorrencia_grupo: novoGrupo(),
          recorrencia_regra: formData.recorrencia,
          recorrencia_restantes: n - 1,
        });
      } else {
        await onSubmit(base, tarefa?.id);
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-500"><CheckSquare className="h-5 w-5" /></div>
            {isEdit ? "Editar Tarefa" : "Nova Tarefa"}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? "Atualize os dados da tarefa." : "Preencha os dados para criar uma nova tarefa."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input id="titulo" value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              placeholder="Ex: Protocolar petição inicial" className="rounded-xl" required />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data">Vencimento</Label>
              <Input id="data" type="date" value={formData.data_vencimento}
                onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value })} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prioridade">Prioridade</Label>
              <Select value={formData.prioridade} onValueChange={(v) => setFormData({ ...formData, prioridade: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  {prioridades.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Avisar</Label>
              <AvisoDiasSelect value={formData.avisos_dias} onChange={(v) => setFormData({ ...formData, avisos_dias: v })} />
            </div>
          </div>

          {/* Responsável */}
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

          {/* Vínculos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={formData.cliente_id} onValueChange={handleClienteChange}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value={NONE}>Nenhum</SelectItem>
                  {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                Processo
                {formData.cliente_id !== NONE && (
                  <span className="ml-1 text-[10px] font-bold text-muted-foreground/50">({processosFiltrados.length} do cliente)</span>
                )}
              </Label>
              <Select value={formData.processo_id} onValueChange={handleProcessoChange}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value={NONE}>Nenhum</SelectItem>
                  {processosFiltrados.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                  {formData.cliente_id !== NONE && processosFiltrados.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground/60">Nenhum processo deste cliente</div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Atendimento</Label>
              <Select value={formData.atendimento_id} onValueChange={(v) => setFormData({ ...formData, atendimento_id: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value={NONE}>Nenhum</SelectItem>
                  {atendimentos.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea id="descricao" placeholder="Detalhes da tarefa..." value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} rows={2} className="rounded-xl" />
          </div>

          {/* Recorrência */}
          <div className="rounded-2xl border border-black/5 dark:border-border bg-card/40 p-3 space-y-3">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground/70">
              <Repeat className="h-3.5 w-3.5" /> Recorrência
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select value={formData.recorrencia} onValueChange={(v) => setFormData({ ...formData, recorrencia: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  {RECORRENCIAS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {formData.recorrencia !== "nenhuma" && (
                <div className="flex items-center gap-2">
                  <Input type="number" min={1} max={52} value={formData.ocorrencias}
                    onChange={(e) => setFormData({ ...formData, ocorrencias: e.target.value })}
                    className="rounded-xl" />
                  <span className="text-xs text-muted-foreground font-semibold whitespace-nowrap">ocorrências</span>
                </div>
              )}
            </div>
            {formData.recorrencia !== "nenhuma" && (
              <p className="text-[11px] text-muted-foreground">
                {isEdit
                  ? `Ao concluir, a próxima é gerada automaticamente (mais ${Math.max(0, (parseInt(formData.ocorrencias) || 1) - 1)} após esta).`
                  : `Cria a 1ª tarefa; ao concluí-la, a próxima é gerada automaticamente (até ${Math.max(1, Math.min(52, parseInt(formData.ocorrencias) || 1))} ocorrências).`}
              </p>
            )}
            {isEdit && formData.recorrencia === "nenhuma" && tarefa?.recorrencia_regra && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">Salvar com "Não repetir" encerra a recorrência desta tarefa.</p>
            )}
          </div>

          {/* Comentários (só ao editar uma tarefa existente) */}
          {isEdit && tarefa?.id && <TarefaComentarios tarefaId={tarefa.id} membros={membros} />}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1 rounded-xl" disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 rounded-xl font-bold" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? "Salvar alterações" : "Criar Tarefa"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

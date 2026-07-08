// Follow-up após concluir um atendimento — extraído de pages/Atendimentos.tsx.
import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTarefas } from "@/hooks/useTarefas";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, CalendarPlus, ListTodo, PhoneCall, ArrowRight, Loader2 } from "lucide-react";
import { tipoInfo, type Atendimento } from "./shared";

export const FollowUpDialog: React.FC<{
  item: Atendimento | null;
  onClose: () => void;
  onAgendarProximo: (item: Atendimento) => void;
}> = ({ item, onClose, onAgendarProximo }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { create: createTarefa } = useTarefas();

  const [modo, setModo] = useState<null | "tarefa" | "contato">(null);
  const [resultado, setResultado] = useState("");
  const [tarefaTitulo, setTarefaTitulo] = useState("");
  const [tarefaData, setTarefaData] = useState("");
  const [contatoData, setContatoData] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setModo(null);
      setResultado(item.resultado ?? "");
      setTarefaTitulo(`Follow-up — ${item.clientes?.nome || tipoInfo(item.tipo_atendimento).label}`);
      setTarefaData(format(addDays(new Date(), 3), "yyyy-MM-dd"));
      setContatoData(format(addDays(new Date(), 30), "yyyy-MM-dd"));
    }
  }, [item]);

  if (!item) return null;

  // Salva o desfecho no atendimento (best-effort) se houve mudança
  const persistResultado = async () => {
    const val = resultado.trim();
    if (val === (item.resultado ?? "").trim()) return;
    await supabase.from("atendimentos").update({ resultado: val || null }).eq("id", item.id);
    queryClient.invalidateQueries({ queryKey: ["atendimentos"] });
  };

  const fechar = async () => { await persistResultado(); onClose(); };
  const irProximo = async () => { await persistResultado(); onAgendarProximo(item); };

  const salvarTarefa = async () => {
    if (!tarefaTitulo.trim()) return;
    setSaving(true);
    await persistResultado();
    createTarefa.mutate(
      {
        titulo: tarefaTitulo.trim(),
        descricao: null,
        data_vencimento: tarefaData || null,
        prioridade: "media",
        cliente_id: item.cliente_id ?? null,
        processo_id: item.processo_id ?? null,
        atendimento_id: item.id,
        responsavel_id: item.responsavel_id ?? user?.id ?? null,
      },
      { onSuccess: () => { setSaving(false); onClose(); }, onError: () => setSaving(false) }
    );
  };

  const salvarContato = async () => {
    if (!item.cliente_id || !contatoData) return;
    setSaving(true);
    await persistResultado();
    const { error } = await supabase.from("clientes")
      .update({ proximo_contato: contatoData }).eq("id", item.cliente_id);
    setSaving(false);
    if (error) { toast({ title: "Erro ao salvar contato", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Próximo contato definido!" });
    onClose();
  };

  return (
    <Dialog open={!!item} onOpenChange={(o) => { if (!o) fechar(); }}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-sm p-0 rounded-3xl border border-black/5 dark:border-border shadow-premium overflow-hidden" style={{maxHeight:"88vh",overflowY:"auto"}}>
        <div className="px-5 pt-4 pb-3 bg-gradient-to-br from-emerald-500/10 via-emerald-500/4 to-transparent">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <DialogTitle className="text-lg font-black tracking-tight">Atendimento concluído</DialogTitle>
            </div>
          </DialogHeader>
          <p className="text-xs text-muted-foreground/70 mt-1.5 ml-0.5">
            {item.clientes?.nome ? `${item.clientes.nome} · ` : ""}Quer já encaminhar o próximo passo?
          </p>
        </div>

        <div className="px-5 pb-5 pt-3 space-y-2">
          {/* Resultado / desfecho */}
          <div className="space-y-1 pb-1">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Resultado / desfecho (opcional)</Label>
            <Textarea value={resultado} onChange={(e) => setResultado(e.target.value)}
              rows={2} className="rounded-xl text-sm resize-none"
              placeholder="O que ficou decidido neste atendimento?" />
          </div>

          {/* Próximo atendimento */}
          <button onClick={irProximo}
            className="w-full flex items-center gap-3 rounded-xl border border-black/8 dark:border-border px-3 py-2.5 text-left hover:border-primary/40 hover:bg-primary/5 transition-all group">
            <span className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><CalendarPlus className="h-4 w-4" /></span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold">Agendar próximo atendimento</span>
              <span className="block text-[11px] text-muted-foreground/60">Mesmo cliente, daqui a 7 dias</span>
            </span>
            <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
          </button>

          {/* Criar tarefa */}
          {modo !== "tarefa" ? (
            <button onClick={() => setModo("tarefa")}
              className="w-full flex items-center gap-3 rounded-xl border border-black/8 dark:border-border px-3 py-2.5 text-left hover:border-purple-500/40 hover:bg-purple-500/5 transition-all">
              <span className="h-8 w-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0"><ListTodo className="h-4 w-4" /></span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold">Criar tarefa de follow-up</span>
                <span className="block text-[11px] text-muted-foreground/60">Lembrete vinculado a este atendimento</span>
              </span>
            </button>
          ) : (
            <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 px-3 py-3 space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-purple-600">
                <ListTodo className="h-3.5 w-3.5" /> Nova tarefa
              </div>
              <Input value={tarefaTitulo} onChange={(e) => setTarefaTitulo(e.target.value)}
                placeholder="Título da tarefa" className="rounded-lg h-9 text-sm" />
              <Input type="date" value={tarefaData} onChange={(e) => setTarefaData(e.target.value)}
                className="rounded-lg h-9 text-sm" />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setModo(null)} className="flex-1 rounded-lg h-8 text-[10px] font-black uppercase tracking-widest">Voltar</Button>
                <Button size="sm" onClick={salvarTarefa} disabled={saving || !tarefaTitulo.trim()} className="flex-1 rounded-lg h-8 text-[10px] font-black uppercase tracking-widest">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Criar tarefa"}
                </Button>
              </div>
            </div>
          )}

          {/* Próximo contato (CRM) */}
          {item.cliente_id && (modo !== "contato" ? (
            <button onClick={() => setModo("contato")}
              className="w-full flex items-center gap-3 rounded-xl border border-black/8 dark:border-border px-3 py-2.5 text-left hover:border-blue-500/40 hover:bg-blue-500/5 transition-all">
              <span className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0"><PhoneCall className="h-4 w-4" /></span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold">Definir próximo contato</span>
                <span className="block text-[11px] text-muted-foreground/60">Agenda de relacionamento (CRM)</span>
              </span>
            </button>
          ) : (
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 px-3 py-3 space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-blue-600">
                <PhoneCall className="h-3.5 w-3.5" /> Próximo contato
              </div>
              <Input type="date" value={contatoData} onChange={(e) => setContatoData(e.target.value)}
                className="rounded-lg h-9 text-sm" />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setModo(null)} className="flex-1 rounded-lg h-8 text-[10px] font-black uppercase tracking-widest">Voltar</Button>
                <Button size="sm" onClick={salvarContato} disabled={saving || !contatoData} className="flex-1 rounded-lg h-8 text-[10px] font-black uppercase tracking-widest">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Salvar"}
                </Button>
              </div>
            </div>
          ))}

          <Button variant="ghost" onClick={fechar}
            className="w-full rounded-xl h-9 mt-1 font-black uppercase text-[10px] tracking-widest text-muted-foreground/60">
            {resultado.trim() ? "Salvar e fechar" : "Pular por agora"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

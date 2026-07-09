import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CalendarClock, CheckSquare, Gavel } from "lucide-react";
import { agendarPublicacaoSchema, firstZodError } from "@/lib/validation";

export type AcaoTipo = "prazo" | "tarefa" | "audiencia";

interface AgendarPublicacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  // contexto da publicação (opcional)
  publicacaoId?: string;
  numeroProcesso?: string;
  // processo já resolvido pelo chamador (evita depender do formato do número)
  processoId?: string | null;
  tituloSugerido?: string;
  // teor/observação inicial (ex.: conteúdo da publicação que originou o prazo)
  descricaoSugerida?: string;
  // tipo inicial selecionado ao abrir
  defaultTipo?: AcaoTipo;
}

const TIPOS_AUDIENCIA = [
  "Audiência de Conciliação",
  "Audiência de Instrução",
  "Audiência de Justificação",
  "Audiência UNA",
  "Audiência de Saneamento",
  "Audiência de Debates",
  "Audiência Trabalhista",
  "Audiência Criminal",
];

const META: Record<AcaoTipo, { label: string; icon: typeof CalendarClock; color: string }> = {
  prazo: { label: "Prazo", icon: CalendarClock, color: "text-amber-500" },
  tarefa: { label: "Tarefa", icon: CheckSquare, color: "text-sky-500" },
  audiencia: { label: "Audiência", icon: Gavel, color: "text-violet-500" },
};

export const AgendarPublicacaoDialog = ({
  open,
  onOpenChange,
  onSuccess,
  publicacaoId,
  numeroProcesso,
  processoId: processoIdProp,
  tituloSugerido,
  descricaoSugerida,
  defaultTipo = "prazo",
}: AgendarPublicacaoDialogProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [tipo, setTipo] = useState<AcaoTipo>(defaultTipo);

  const descricaoInicial = () =>
    descricaoSugerida?.trim()
      || (numeroProcesso ? `Vinculado à publicação do processo ${numeroProcesso}` : "");

  const [form, setForm] = useState({
    titulo: tituloSugerido || "",
    descricao: descricaoInicial(),
    data: "",
    hora: "",
    prioridade: "media",
    local: "",
    tipoAudiencia: "Audiência de Conciliação",
  });

  useEffect(() => {
    if (open) {
      setTipo(defaultTipo);
      setForm({
        titulo: tituloSugerido || "",
        descricao: descricaoInicial(),
        data: "",
        hora: "",
        prioridade: "media",
        local: "",
        tipoAudiencia: "Audiência de Conciliação",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultTipo, tituloSugerido, numeroProcesso, descricaoSugerida]);

  // Resolve o processo (e o cliente dele). Se o chamador já sabe o id, usa direto.
  // Senão compara apenas os DÍGITOS dos dois lados — processos guardam o número
  // sem formatação, publicações guardam formatado.
  const resolveProcesso = async (): Promise<{ id: string; cliente_id: string | null } | null> => {
    if (!user?.office_id) return null;

    if (processoIdProp) {
      const { data } = await supabase.from("processos").select("id, cliente_id").eq("id", processoIdProp).maybeSingle();
      if (data) return { id: data.id, cliente_id: data.cliente_id ?? null };
    }

    if (!numeroProcesso) return null;
    const alvo = String(numeroProcesso).replace(/\D/g, "");
    if (!alvo) return null;

    const { data } = await supabase
      .from("processos")
      .select("id, numero_processo, cliente_id")
      .eq("office_id", user.office_id)
      .eq("deletado", false);
    const achado = (data ?? []).find((p) => String(p.numero_processo ?? "").replace(/\D/g, "") === alvo);
    return achado ? { id: achado.id, cliente_id: achado.cliente_id ?? null } : null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      toast({ title: "Erro", description: "Usuário não autenticado.", variant: "destructive" });
      return;
    }
    const val = agendarPublicacaoSchema.safeParse(form);
    if (!val.success) {
      toast({ title: "Campo obrigatório", description: firstZodError(val.error), variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const proc = await resolveProcesso();
      const processoId = proc?.id ?? null;
      const clienteId = proc?.cliente_id ?? null;

      if (tipo === "prazo") {
        const { error } = await supabase.from("prazos").insert({
          user_id: user.id,
          office_id: user.office_id,
          processo_id: processoId,
          titulo: form.titulo,
          descricao: form.descricao,
          data_vencimento: form.data,
          prioridade: form.prioridade,
          status: "pendente",
        });
        if (error) throw error;
      } else if (tipo === "tarefa") {
        const { error } = await supabase.from("tarefas").insert({
          user_id: user.id,
          office_id: user.office_id,
          processo_id: processoId,
          cliente_id: clienteId,
          titulo: form.titulo,
          descricao: form.descricao,
          data_vencimento: form.data,
          prioridade: form.prioridade,
          status: "pendente",
          concluida: false,
        });
        if (error) throw error;
      } else {
        const datetime = new Date(`${form.data}T${form.hora || "00:00"}`);
        const { error } = await supabase.from("audiencias").insert({
          user_id: user.id,
          office_id: user.office_id,
          processo_id: processoId,
          cliente_id: clienteId,
          titulo: form.titulo,
          data_audiencia: datetime.toISOString(),
          local: form.local || null,
          tipo: form.tipoAudiencia,
          observacoes: form.descricao || null,
          status: "agendada",
        });
        if (error) throw error;
      }

      if (!processoId && numeroProcesso) {
        toast({
          title: "Salvo, mas sem vínculo ao processo",
          description: `Nenhum processo cadastrado com o número ${numeroProcesso}. Cadastre-o e o vínculo poderá ser refeito.`,
        });
      }

      toast({ title: `${META[tipo].label} agendado(a)`, description: "Salvo com sucesso." });
      onOpenChange(false);
      onSuccess?.();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Tente novamente.";
      toast({ title: "Erro ao salvar", description: msg, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const Icon = META[tipo].icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-md bg-background border border-border p-0 rounded-[2rem] shadow-2xl overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border bg-muted/20">
          <DialogTitle className="flex items-center gap-2 text-lg font-black text-foreground">
            <Icon className={`h-5 w-5 ${META[tipo].color}`} />
            Agendar {META[tipo].label}
          </DialogTitle>
          {numeroProcesso && (
            <p className="text-[11px] text-muted-foreground font-mono mt-1">Processo: {numeroProcesso}</p>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Seletor de tipo */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as AcaoTipo)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="prazo">Prazo</SelectItem>
                <SelectItem value="tarefa">Tarefa</SelectItem>
                <SelectItem value="audiencia">Audiência</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Título *</Label>
            <Input
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder={tipo === "audiencia" ? "Ex: Audiência de conciliação" : "Ex: Contestação, Manifestação..."}
              className="rounded-xl"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {tipo === "audiencia" ? "Data da audiência *" : "Data de vencimento *"}
              </Label>
              <Input
                type="date"
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
                className="rounded-xl"
                required
              />
            </div>
            {tipo === "audiencia" ? (
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Horário</Label>
                <Input
                  type="time"
                  value={form.hora}
                  onChange={(e) => setForm({ ...form, hora: e.target.value })}
                  className="rounded-xl"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Prioridade</Label>
                <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v })}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="baixa">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {tipo === "audiencia" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tipo de audiência</Label>
                <Select value={form.tipoAudiencia} onValueChange={(v) => setForm({ ...form, tipoAudiencia: v })}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {TIPOS_AUDIENCIA.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Local</Label>
                <Input
                  value={form.local}
                  onChange={(e) => setForm({ ...form, local: e.target.value })}
                  placeholder="Fórum, sala virtual, endereço..."
                  className="rounded-xl"
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Observações</Label>
            <Textarea
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              placeholder="Detalhes..."
              rows={3}
              className="rounded-xl resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1 rounded-xl" disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 rounded-xl" disabled={isLoading}>
              {isLoading ? "Salvando…" : `Salvar ${META[tipo].label}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

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
import { CalendarClock, Newspaper, Shield, AlertOctagon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PrazoFormData {
  id?: string;
  titulo: string;
  descricao?: string | null;
  data_publicacao?: string | null;
  data_prazo_interno?: string | null;
  data_fim_prazo?: string | null;
  prioridade: string;
  processo_id?: string | null;
  office_id?: string | null;
  user_id?: string;
}

interface NovoPrazoStandaloneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  publicacaoId?: string;
  numeroProcesso?: string;
  tituloSugerido?: string;
  prazoParaEditar?: PrazoFormData;
}

const DATE_FIELDS = [
  {
    key: 'dataPublicacao' as const,
    dbKey: 'data_publicacao',
    label: 'Data da Publicação',
    hint: 'Quando foi publicado no diário',
    icon: Newspaper,
    color: 'text-sky-500',
    ring: 'focus-within:ring-sky-500/30 border-sky-500/20',
    bg: 'bg-sky-500/5',
    required: false,
  },
  {
    key: 'dataPrazoInterno' as const,
    dbKey: 'data_prazo_interno',
    label: 'Prazo Interno',
    hint: 'Limite interno do escritório',
    icon: Shield,
    color: 'text-amber-500',
    ring: 'focus-within:ring-amber-500/30 border-amber-500/20',
    bg: 'bg-amber-500/5',
    required: false,
  },
  {
    key: 'dataPrazoFatal' as const,
    dbKey: 'data_fim_prazo',
    label: 'Prazo Fatal',
    hint: 'Data limite legal — obrigatório',
    icon: AlertOctagon,
    color: 'text-red-500',
    ring: 'focus-within:ring-red-500/30 border-red-500/20',
    bg: 'bg-red-500/5',
    required: true,
  },
] as const;

type DateKey = typeof DATE_FIELDS[number]['key'];

type FormState = {
  titulo: string;
  descricao: string;
  dataPublicacao: string;
  dataPrazoInterno: string;
  dataPrazoFatal: string;
  prioridade: string;
};

function emptyForm(tituloSugerido?: string, numeroProcesso?: string): FormState {
  return {
    titulo: tituloSugerido || "",
    descricao: numeroProcesso ? `Prazo vinculado à publicação do processo ${numeroProcesso}` : "",
    dataPublicacao: "",
    dataPrazoInterno: "",
    dataPrazoFatal: "",
    prioridade: "media",
  };
}

function prazoToForm(prazo: PrazoFormData): FormState {
  return {
    titulo: prazo.titulo,
    descricao: prazo.descricao || "",
    dataPublicacao: prazo.data_publicacao || "",
    dataPrazoInterno: prazo.data_prazo_interno || "",
    dataPrazoFatal: prazo.data_fim_prazo || "",
    prioridade: prazo.prioridade || "media",
  };
}

export const NovoPrazoStandaloneDialog = ({
  open,
  onOpenChange,
  onSuccess,
  publicacaoId,
  numeroProcesso,
  tituloSugerido,
  prazoParaEditar,
}: NovoPrazoStandaloneDialogProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<FormState>(emptyForm(tituloSugerido, numeroProcesso));

  const isEditing = !!prazoParaEditar?.id;

  useEffect(() => {
    if (open) {
      setFormData(prazoParaEditar ? prazoToForm(prazoParaEditar) : emptyForm(tituloSugerido, numeroProcesso));
    }
  }, [open, prazoParaEditar, tituloSugerido, numeroProcesso]);

  const set = (field: string, value: string) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.titulo || !formData.dataPrazoFatal) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o título e o prazo fatal.",
        variant: "destructive",
      });
      return;
    }

    if (!user?.id) {
      toast({ title: "Erro", description: "Usuário não autenticado.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      if (isEditing) {
        // UPDATE
        const updates: Record<string, unknown> = {
          titulo: formData.titulo,
          descricao: formData.descricao || null,
          data_fim_prazo: formData.dataPrazoFatal,
          prioridade: formData.prioridade,
        };
        if (formData.dataPublicacao) updates.data_publicacao = formData.dataPublicacao;
        else updates.data_publicacao = null;
        if (formData.dataPrazoInterno) updates.data_prazo_interno = formData.dataPrazoInterno;
        else updates.data_prazo_interno = null;

        const { error } = await supabase.from('prazos').update(updates).eq('id', prazoParaEditar!.id!);
        if (error) throw error;
        toast({ title: "Prazo atualizado", description: "As alterações foram salvas." });
      } else {
        // INSERT
        let processoId: string | null = null;
        if (numeroProcesso && user.office_id) {
          const { data } = await supabase
            .from('processos')
            .select('id')
            .eq('numero_processo', numeroProcesso.replace(/\D/g, ''))
            .eq('office_id', user.office_id)
            .maybeSingle();
          processoId = data?.id || null;
        }

        const payload: Record<string, unknown> = {
          user_id: user.id,
          office_id: user.office_id,
          processo_id: processoId,
          publicacao_id: publicacaoId || null,
          titulo: formData.titulo,
          descricao: formData.descricao || null,
          data_fim_prazo: formData.dataPrazoFatal,
          prioridade: formData.prioridade,
          status: 'pendente',
        };
        if (formData.dataPublicacao) payload.data_publicacao = formData.dataPublicacao;
        if (formData.dataPrazoInterno) payload.data_prazo_interno = formData.dataPrazoInterno;

        const { error } = await supabase.from('prazos').insert(payload);
        if (error) throw error;
        toast({ title: "Prazo adicionado", description: "O prazo foi salvo com sucesso." });
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Tente novamente.";
      toast({ title: "Erro ao salvar", description: msg, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onOpenChange(false); }}>
      <DialogContent className="max-w-md bg-background border border-border p-0 rounded-2xl shadow-2xl overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2.5 text-base font-black text-foreground">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
              <CalendarClock className="h-4 w-4" />
            </div>
            {isEditing ? "Editar Prazo" : "Agendar Prazo"}
          </DialogTitle>
          {numeroProcesso && (
            <p className="text-[11px] text-muted-foreground font-mono mt-1 ml-0.5">
              Processo: {numeroProcesso}
            </p>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Título */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Título <span className="text-red-500">*</span>
            </Label>
            <Input
              value={formData.titulo}
              onChange={e => set('titulo', e.target.value)}
              placeholder="Ex: Contestação, Recurso, Manifestação..."
              className="rounded-xl h-10"
              required
            />
          </div>

          {/* 3 datas */}
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Datas
            </Label>
            <div className="space-y-2">
              {DATE_FIELDS.map(({ key, label, hint, icon: Icon, color, ring, bg, required }) => (
                <div
                  key={key}
                  className={cn(
                    'grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border px-3 py-2.5 transition-all ring-1 ring-transparent',
                    bg, ring
                  )}
                >
                  <div className={cn('shrink-0', color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-foreground/80 leading-none mb-0.5">
                      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 leading-none">{hint}</p>
                  </div>
                  <input
                    type="date"
                    value={formData[key as DateKey]}
                    onChange={e => set(key, e.target.value)}
                    required={required}
                    className="w-36 h-8 px-2 rounded-lg text-xs bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Prioridade */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Prioridade
            </Label>
            <Select value={formData.prioridade} onValueChange={v => set('prioridade', v)}>
              <SelectTrigger className="rounded-xl h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="alta">🔴 Alta</SelectItem>
                <SelectItem value="media">🟡 Média</SelectItem>
                <SelectItem value="baixa">🟢 Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Observações
            </Label>
            <Textarea
              value={formData.descricao}
              onChange={e => set('descricao', e.target.value)}
              placeholder="Detalhes adicionais do prazo..."
              rows={2}
              className="rounded-xl resize-none text-sm"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 rounded-xl h-10"
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 rounded-xl h-10 font-black" disabled={isLoading}>
              {isLoading ? "Salvando…" : isEditing ? "Salvar Alterações" : "Criar Prazo"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

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

interface NovoPrazoStandaloneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  publicacaoId?: string;
  numeroProcesso?: string;
  tituloSugerido?: string;
}

const DATE_FIELDS = [
  {
    key: 'dataPublicacao',
    dbKey: 'data_publicacao',
    label: 'Data da Publicação',
    hint: 'Quando foi publicado no diário',
    icon: Newspaper,
    color: 'text-sky-500',
    bg: 'bg-sky-500/8 border-sky-500/20',
    required: false,
  },
  {
    key: 'dataPrazoInterno',
    dbKey: 'data_prazo_interno',
    label: 'Prazo Interno',
    hint: 'Limite interno do escritório',
    icon: Shield,
    color: 'text-amber-500',
    bg: 'bg-amber-500/8 border-amber-500/20',
    required: false,
  },
  {
    key: 'dataPrazoFatal',
    dbKey: 'data_fim_prazo',
    label: 'Prazo Fatal',
    hint: 'Data limite legal — obrigatório',
    icon: AlertOctagon,
    color: 'text-red-500',
    bg: 'bg-red-500/8 border-red-500/20',
    required: true,
  },
] as const;

type DateKey = typeof DATE_FIELDS[number]['key'];

export const NovoPrazoStandaloneDialog = ({
  open,
  onOpenChange,
  onSuccess,
  publicacaoId,
  numeroProcesso,
  tituloSugerido,
}: NovoPrazoStandaloneDialogProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    titulo: tituloSugerido || "",
    descricao: numeroProcesso ? `Prazo vinculado à publicação do processo ${numeroProcesso}` : "",
    dataPublicacao: "",
    dataPrazoInterno: "",
    dataPrazoFatal: "",
    prioridade: "media",
  });

  useEffect(() => {
    if (open) resetForm();
  }, [open, tituloSugerido, numeroProcesso]);

  const resetForm = () => {
    setFormData({
      titulo: tituloSugerido || "",
      descricao: numeroProcesso ? `Prazo vinculado à publicação do processo ${numeroProcesso}` : "",
      dataPublicacao: "",
      dataPrazoInterno: "",
      dataPrazoFatal: "",
      prioridade: "media",
    });
  };

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
      onOpenChange(false);
      resetForm();
      onSuccess?.();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Tente novamente.";
      toast({ title: "Erro ao salvar", description: msg, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg bg-background border border-border p-0 rounded-[2rem] shadow-2xl overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border bg-muted/20">
          <DialogTitle className="flex items-center gap-2 text-lg font-black text-foreground">
            <CalendarClock className="h-5 w-5 text-amber-500" />
            Agendar Prazo
          </DialogTitle>
          {numeroProcesso && (
            <p className="text-[11px] text-muted-foreground font-mono mt-1">
              Processo: {numeroProcesso}
            </p>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Título */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Título *
            </Label>
            <Input
              value={formData.titulo}
              onChange={e => set('titulo', e.target.value)}
              placeholder="Ex: Contestação, Recurso, Manifestação..."
              className="rounded-xl"
              required
            />
          </div>

          {/* 3 campos de data */}
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Datas
            </p>
            <div className="grid gap-2">
              {DATE_FIELDS.map(({ key, label, hint, icon: Icon, color, bg, required }) => (
                <div
                  key={key}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-3',
                    bg
                  )}
                >
                  <div className={cn('shrink-0', color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      {label}{required && ' *'}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60">{hint}</p>
                  </div>
                  <Input
                    type="date"
                    value={formData[key as DateKey]}
                    onChange={e => set(key, e.target.value)}
                    required={required}
                    className="w-40 rounded-lg h-8 text-xs border-border/60"
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

          {/* Observações */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Observações
            </Label>
            <Textarea
              value={formData.descricao}
              onChange={e => set('descricao', e.target.value)}
              placeholder="Detalhes do prazo..."
              rows={2}
              className="rounded-xl resize-none"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => { resetForm(); onOpenChange(false); }}
              className="flex-1 rounded-xl"
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 rounded-xl" disabled={isLoading}>
              {isLoading ? "Salvando…" : "Salvar Prazo"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

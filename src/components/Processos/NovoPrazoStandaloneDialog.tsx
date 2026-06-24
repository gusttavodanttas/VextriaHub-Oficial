import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CalendarClock } from "lucide-react";

interface NovoPrazoStandaloneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  // contexto da publicação (opcional)
  publicacaoId?: string;
  numeroProcesso?: string;
  tituloSugerido?: string;
}

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
    dataVencimento: "",
    prioridade: "media",
    status: "pendente",
  });

  // Atualizar defaults quando a publicação muda
  const resetForm = () => {
    setFormData({
      titulo: tituloSugerido || "",
      descricao: numeroProcesso ? `Prazo vinculado à publicação do processo ${numeroProcesso}` : "",
      dataVencimento: "",
      prioridade: "media",
      status: "pendente",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.titulo || !formData.dataVencimento) {
      toast({ title: "Campos obrigatórios", description: "Preencha o título e a data de vencimento.", variant: "destructive" });
      return;
    }

    if (!user?.id) {
      toast({ title: "Erro", description: "Usuário não autenticado.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      // Resolver processo_id pelo número do processo (se houver)
      let processoId: string | null = null;
      if (numeroProcesso && user.office_id) {
        const { data } = await supabase
          .from('processos')
          .select('id')
          .eq('numero_processo', numeroProcesso)
          .eq('office_id', user.office_id)
          .maybeSingle();
        processoId = data?.id || null;
      }

      const { error } = await supabase.from('prazos').insert({
        user_id: user.id,
        office_id: user.office_id,
        processo_id: processoId,
        titulo: formData.titulo,
        descricao: formData.descricao,
        data_vencimento: formData.dataVencimento,
        prioridade: formData.prioridade,
        status: formData.status,
      });

      if (error) throw error;

      toast({ title: "Prazo adicionado", description: "O prazo foi salvo com sucesso." });
      onOpenChange(false);
      resetForm();
      onSuccess?.();
    } catch (error: any) {
      console.error('Erro ao adicionar prazo:', error);
      toast({ title: "Erro ao salvar", description: error.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-md bg-background border border-border p-0 rounded-[2rem] shadow-2xl overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border bg-muted/20">
          <DialogTitle className="flex items-center gap-2 text-lg font-black text-foreground">
            <CalendarClock className="h-5 w-5 text-amber-500" />
            Agendar Prazo
          </DialogTitle>
          {numeroProcesso && (
            <p className="text-[11px] text-muted-foreground font-mono mt-1">Processo: {numeroProcesso}</p>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="titulo" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Título *</Label>
            <Input
              id="titulo"
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              placeholder="Ex: Contestação, Recurso, Manifestação..."
              className="rounded-xl"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dataVencimento" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Data de Vencimento *</Label>
            <Input
              id="dataVencimento"
              type="date"
              value={formData.dataVencimento}
              onChange={(e) => setFormData({ ...formData, dataVencimento: e.target.value })}
              className="rounded-xl"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prioridade" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Prioridade</Label>
            <Select value={formData.prioridade} onValueChange={(v) => setFormData({ ...formData, prioridade: v })}>
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

          <div className="space-y-1.5">
            <Label htmlFor="descricao" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Observações</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Detalhes do prazo..."
              rows={3}
              className="rounded-xl resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { resetForm(); onOpenChange(false); }} className="flex-1 rounded-xl" disabled={isLoading}>
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

import { useState, useEffect } from "react";
import { ArrowLeft, Calendar, Mail, Plus, Edit, Trash2, Loader2, MessageSquare, Clock, Phone } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Atendimento } from "@/types/database";
import { cn } from "@/lib/utils";

interface Props {
  onBack: () => void;
  opportunity: any;
}

export function CrmOportunidadeDetail({ onBack, opportunity }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [historyItems, setHistoryItems] = useState<Atendimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<Atendimento | null>(null);
  const [editingHistoryItem, setEditingHistoryItem] = useState<Atendimento | null>(null);
  const [showNewHistoryDialog, setShowNewHistoryDialog] = useState(false);
  const [newHistoryForm, setNewHistoryForm] = useState({
    title: '',
    date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    description: '',
    type: 'Reunião',
    status: 'realizado'
  });

  const fetchHistory = async () => {
    if (!opportunity?.id) return;
    
    try {
      setLoading(true);
      const { data: interactions, error: fetchError } = await supabase
        .from('atendimentos')
        .select('*')
        .eq('cliente_id', opportunity.id)
        .eq('deletado', false)
        .order('data_atendimento', { ascending: false });

      if (fetchError) throw fetchError;
      setHistoryItems(interactions || []);
    } catch (err) {
      console.error('Erro ao buscar histórico:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [opportunity?.id]);

  const handleCreateNewHistory = async () => {
    if (!user?.office_id || !opportunity?.id) return;

    try {
      const { data, error } = await supabase
        .from('atendimentos')
        .insert([{
          office_id: user.office_id,
          user_id: user.id,
          cliente_id: opportunity.id,
          tipo_atendimento: newHistoryForm.type,
          data_atendimento: new Date(newHistoryForm.date).toISOString(),
          observacoes: `${newHistoryForm.title}\n\n${newHistoryForm.description}`,
          status: newHistoryForm.status
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Interação salva",
        description: "O histórico foi atualizado com sucesso.",
      });

      setHistoryItems(prev => [data, ...prev]);
      setShowNewHistoryDialog(false);
      setNewHistoryForm({
        title: '',
        date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        description: '',
        type: 'Reunião',
        status: 'realizado'
      });
    } catch (err) {
      console.error('Erro ao criar histórico:', err);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar a interação.",
        variant: "destructive"
      });
    }
  };

  const handleSaveHistoryEdit = async () => {
    if (!editingHistoryItem) return;

    try {
      const { error } = await supabase
        .from('atendimentos')
        .update({
          tipo_atendimento: editingHistoryItem.tipo_atendimento,
          data_atendimento: editingHistoryItem.data_atendimento,
          observacoes: editingHistoryItem.observacoes,
          status: editingHistoryItem.status
        })
        .eq('id', editingHistoryItem.id);

      if (error) throw error;

      toast({
        title: "Interação atualizada",
        description: "O registro foi alterado com sucesso.",
      });

      setHistoryItems(prev => prev.map(item => 
        item.id === editingHistoryItem.id ? editingHistoryItem : item
      ));
      setEditingHistoryItem(null);
    } catch (err) {
      console.error('Erro ao editar histórico:', err);
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível salvar as alterações.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteHistoryItem = async (id: string) => {
    try {
      const { error } = await supabase
        .from('atendimentos')
        .update({ deletado: true })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Registro removido",
        description: "A interação foi excluída do histórico.",
      });

      setHistoryItems(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      console.error('Erro ao excluir histórico:', err);
    }
  };

  const getInteractionIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'reunião': return <Calendar className="h-4 w-4" />;
      case 'proposta': return <Mail className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} className="rounded-xl h-12 w-12 p-0 border border-black/5 dark:border-white/5 hover:bg-primary/10 hover:text-primary transition-all">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight">{opportunity?.nome}</h2>
            <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest opacity-60">Detalhes da Oportunidade</p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card className="glass-card border-black/5 dark:border-white/5 rounded-[2rem] overflow-hidden">
            <CardHeader className="border-b border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01]">
              <CardTitle className="text-lg font-bold">Resumo do Lead</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-black/5 dark:bg-white/5 rounded-xl">
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Status Atual</span>
                  <Badge className={cn("px-4 py-1 rounded-lg font-black text-[10px] uppercase tracking-widest", 
                    opportunity?.status === 'quente' ? 'bg-red-500/10 text-red-600 border-red-500/20' : 
                    opportunity?.status === 'morno' ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' :
                    'bg-blue-500/10 text-blue-600 border-blue-500/20'
                  )}>
                    {opportunity?.status}
                  </Badge>
                </div>
                
                <div className="grid gap-4">
                  <div className="flex items-center gap-3 text-sm font-medium">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Mail className="h-4 w-4" />
                    </div>
                    <span className="truncate">{opportunity?.email || 'Sem e-mail'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm font-medium">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Phone className="h-4 w-4" />
                    </div>
                    <span>{opportunity?.telefone || 'Sem telefone'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm font-medium">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <span>Desde {opportunity?.created_at ? format(new Date(opportunity.created_at), "dd/MM/yyyy") : '—'}</span>
                  </div>
                </div>
              </div>

              <Separator className="opacity-50" />

              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground opacity-60">Ações Rápidas</h4>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="rounded-xl font-bold h-11 text-xs gap-2">
                    <Mail className="h-4 w-4" /> E-mail
                  </Button>
                  <Button variant="outline" className="rounded-xl font-bold h-11 text-xs gap-2">
                    <Phone className="h-4 w-4" /> Ligar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="glass-card border-black/5 dark:border-white/5 rounded-[2rem] overflow-hidden h-full">
            <CardHeader className="border-b border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold">Linha do Tempo</CardTitle>
                <CardDescription className="text-xs font-medium uppercase tracking-widest opacity-60">Histórico de interações e follow-ups</CardDescription>
              </div>
              <Button onClick={() => setShowNewHistoryDialog(true)} size="sm" className="rounded-xl font-bold shadow-lg shadow-primary/20">
                <Plus className="h-4 w-4 mr-2" />
                Nova Interação
              </Button>
            </CardHeader>
            <CardContent className="p-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground opacity-40">Carregando interações...</p>
                </div>
              ) : historyItems.length > 0 ? (
                <div className="space-y-6 relative before:absolute before:left-6 before:top-2 before:bottom-2 before:w-px before:bg-black/5 dark:before:bg-white/10">
                  {historyItems.map((item) => (
                    <div key={item.id} className="relative pl-12 group">
                      <div className="absolute left-4 top-1 -translate-x-1/2 w-4 h-4 rounded-full bg-background border-2 border-primary z-10 group-hover:scale-125 transition-all" />
                      
                      <div className="glass-card p-5 rounded-2xl border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] group-hover:bg-primary/[0.02] transition-all">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-3">
                             <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                               {getInteractionIcon(item.tipo_atendimento)}
                             </div>
                             <span className="font-black text-xs uppercase tracking-widest text-primary">{item.tipo_atendimento}</span>
                             <span className="text-[10px] font-bold text-muted-foreground/40">•</span>
                             <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                               {format(new Date(item.data_atendimento), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                             </span>
                          </div>
                          
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => setEditingHistoryItem(item)}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-rose-500 hover:bg-rose-500/10" onClick={() => handleDeleteHistoryItem(item.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="text-sm font-medium text-foreground whitespace-pre-wrap leading-relaxed opacity-80">
                          {item.observacoes}
                        </div>

                        <div className="mt-4 flex items-center gap-2">
                           <Badge variant="outline" className={cn("px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tighter", 
                             item.status === 'realizado' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-orange-500/10 text-orange-600 border-orange-500/20'
                           )}>
                             {item.status}
                           </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                  <div className="p-4 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                    <MessageSquare className="h-10 w-10 text-muted-foreground/20" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-foreground">Sem histórico</p>
                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                      Registre a primeira interação para começar a construir a jornada deste lead.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="rounded-xl font-bold mt-2" onClick={() => setShowNewHistoryDialog(true)}>
                    Registrar Agora
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de Novo Histórico */}
      <Dialog open={showNewHistoryDialog} onOpenChange={setShowNewHistoryDialog}>
        <DialogContent className="max-w-xl rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="bg-primary p-8 text-primary-foreground">
            <DialogTitle className="text-2xl font-black tracking-tight">Nova Interação</DialogTitle>
            <DialogDescription className="text-primary-foreground/60 font-medium">Descreva o que aconteceu no contato com {opportunity?.nome}</DialogDescription>
          </DialogHeader>
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Tipo de Contato</Label>
                <Select value={newHistoryForm.type} onValueChange={(v) => setNewHistoryForm(prev => ({...prev, type: v}))}>
                  <SelectTrigger className="h-12 rounded-xl bg-black/5 dark:bg-white/5 border-none font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="Reunião">Reunião</SelectItem>
                    <SelectItem value="Proposta">Proposta</SelectItem>
                    <SelectItem value="Ligação">Ligação</SelectItem>
                    <SelectItem value="Mensagem">Mensagem (WhatsApp)</SelectItem>
                    <SelectItem value="Negociação">Negociação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Data e Hora</Label>
                <Input
                  type="datetime-local"
                  className="h-12 rounded-xl bg-black/5 dark:bg-white/5 border-none font-bold"
                  value={newHistoryForm.date}
                  onChange={(e) => setNewHistoryForm(prev => ({...prev, date: e.target.value}))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Resumo / Título</Label>
              <Input
                className="h-12 rounded-xl bg-black/5 dark:bg-white/5 border-none font-bold"
                placeholder="Ex: Apresentação da proposta de honorários"
                value={newHistoryForm.title}
                onChange={(e) => setNewHistoryForm(prev => ({...prev, title: e.target.value}))}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Observações Detalhadas</Label>
              <Textarea
                className="rounded-xl bg-black/5 dark:bg-white/5 border-none font-medium min-h-[120px]"
                placeholder="Detalhe o que foi conversado, acordos feitos e próximos passos..."
                value={newHistoryForm.description}
                onChange={(e) => setNewHistoryForm(prev => ({...prev, description: e.target.value}))}
              />
            </div>

            <div className="flex justify-between items-center pt-4">
               <div className="flex items-center gap-2">
                 <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Status:</Label>
                 <Badge 
                   variant="outline" 
                   className="cursor-pointer hover:bg-emerald-500/20 transition-all font-black text-[10px] px-3 py-1 rounded-lg border-emerald-500/30 text-emerald-600 bg-emerald-500/5"
                   onClick={() => setNewHistoryForm(prev => ({...prev, status: prev.status === 'realizado' ? 'agendado' : 'realizado'}))}
                 >
                   {newHistoryForm.status}
                 </Badge>
               </div>
               <div className="flex gap-3">
                 <Button variant="ghost" className="rounded-xl font-bold px-6 h-12" onClick={() => setShowNewHistoryDialog(false)}>Cancelar</Button>
                 <Button className="rounded-xl font-black px-8 h-12 shadow-lg shadow-primary/20" onClick={handleCreateNewHistory}>Salvar Interação</Button>
               </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Edição */}
      <Dialog open={!!editingHistoryItem} onOpenChange={(o) => !o && setEditingHistoryItem(null)}>
        <DialogContent className="max-w-xl rounded-[2rem] p-8 space-y-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Editar Interação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Observações</Label>
                <Textarea
                  className="rounded-xl bg-black/5 dark:bg-white/5 border-none font-medium min-h-[150px]"
                  value={editingHistoryItem?.observacoes || ''}
                  onChange={(e) => setEditingHistoryItem(prev => prev ? {...prev, observacoes: e.target.value} : null)}
                />
             </div>
             
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Status</Label>
                  <Select 
                    value={editingHistoryItem?.status || 'realizado'} 
                    onValueChange={(v) => setEditingHistoryItem(prev => prev ? {...prev, status: v} : null)}
                  >
                    <SelectTrigger className="h-11 rounded-xl bg-black/5 dark:bg-white/5 border-none font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="realizado">Realizado</SelectItem>
                      <SelectItem value="agendado">Agendado</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Tipo</Label>
                  <Select 
                    value={editingHistoryItem?.tipo_atendimento || 'Reunião'} 
                    onValueChange={(v) => setEditingHistoryItem(prev => prev ? {...prev, tipo_atendimento: v} : null)}
                  >
                    <SelectTrigger className="h-11 rounded-xl bg-black/5 dark:bg-white/5 border-none font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="Reunião">Reunião</SelectItem>
                      <SelectItem value="Proposta">Proposta</SelectItem>
                      <SelectItem value="Ligação">Ligação</SelectItem>
                      <SelectItem value="Mensagem">Mensagem</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
             </div>
          </div>
          <DialogFooter className="pt-4">
            <Button variant="ghost" className="rounded-xl font-bold" onClick={() => setEditingHistoryItem(null)}>Descartar</Button>
            <Button className="rounded-xl font-black px-6" onClick={handleSaveHistoryEdit}>Atualizar Registro</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


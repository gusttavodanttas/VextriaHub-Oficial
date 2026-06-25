import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Trash2,
  RotateCcw,
  Search,
  FileText,
  CalendarClock,
  Gavel,
  Users,
  ListTodo,
  Timer,
  Megaphone,
  Loader2,
  AlertTriangle,
  Clock,
  X,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCNJ } from '@/utils/formatCNJ';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface LixeiraItem {
  id: string;
  tabela: string;
  titulo: string;
  descricao?: string;
  excluido_em: string;
  office_id?: string;
  office_name?: string;
  user_id?: string;
  dados: Record<string, any>;
}

const TABELA_CONFIG: Record<string, { label: string; icon: React.ComponentType; color: string }> = {
  processos: { label: 'Processo', icon: FileText, color: 'text-blue-600 bg-blue-500/10 border-blue-500/20' },
  publicacoes: { label: 'Publicação', icon: Megaphone, color: 'text-violet-600 bg-violet-500/10 border-violet-500/20' },
  prazos: { label: 'Prazo', icon: CalendarClock, color: 'text-amber-600 bg-amber-500/10 border-amber-500/20' },
  audiencias: { label: 'Audiência', icon: Gavel, color: 'text-purple-600 bg-purple-500/10 border-purple-500/20' },
  atendimentos: { label: 'Atendimento', icon: Users, color: 'text-sky-600 bg-sky-500/10 border-sky-500/20' },
  tarefas: { label: 'Tarefa', icon: ListTodo, color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
  timesheets: { label: 'Timesheet', icon: Timer, color: 'text-orange-600 bg-orange-500/10 border-orange-500/20' },
  processos_descartados: { label: 'Descartado (OAB)', icon: X, color: 'text-rose-600 bg-rose-500/10 border-rose-500/20' },
};

const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');
const fmtDateTime = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function Lixeira() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<LixeiraItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTabela, setFilterTabela] = useState<string>('all');
  const [filterOffice, setFilterOffice] = useState<string>('all');
  const [restoring, setRestoring] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LixeiraItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      // Carregar mapa de escritórios
      const { data: offices } = await supabase.from('offices').select('id, name');
      const officeMap: Record<string, string> = {};
      (offices || []).forEach(o => { officeMap[o.id] = o.name; });

      const results: LixeiraItem[] = [];

      // Processos deletados (soft-delete)
      const { data: procs } = await supabase.from('processos').select('*').eq('deletado', true).order('updated_at', { ascending: false });
      (procs || []).forEach(p => results.push({
        id: p.id, tabela: 'processos',
        titulo: p.titulo || formatCNJ(p.numero_processo),
        descricao: `CNJ: ${formatCNJ(p.numero_processo)}`,
        excluido_em: p.updated_at, office_id: p.office_id, office_name: officeMap[p.office_id] || '—', user_id: p.user_id, dados: p,
      }));

      // Publicações arquivadas
      const { data: pubs } = await supabase.from('publicacoes').select('*').eq('status', 'arquivada').order('created_at', { ascending: false });
      (pubs || []).forEach(p => results.push({
        id: p.id, tabela: 'publicacoes',
        titulo: p.titulo,
        descricao: `${fmtDate(p.data_publicacao)} · ${p.tribunal || ''}`,
        excluido_em: p.created_at, office_id: p.office_id, office_name: officeMap[p.office_id] || '—', user_id: p.user_id, dados: p,
      }));

      // Prazos deletados
      const { data: prazos } = await supabase.from('prazos').select('*').eq('deletado', true).order('updated_at', { ascending: false });
      (prazos || []).forEach(p => results.push({
        id: p.id, tabela: 'prazos',
        titulo: p.titulo,
        descricao: `Vencimento: ${fmtDate(p.data_vencimento)}`,
        excluido_em: p.updated_at, office_id: p.office_id, office_name: officeMap[p.office_id] || '—', user_id: p.user_id, dados: p,
      }));

      // Audiências deletadas
      const { data: auds } = await supabase.from('audiencias').select('*').eq('deletado', true).order('updated_at', { ascending: false });
      (auds || []).forEach(a => results.push({
        id: a.id, tabela: 'audiencias',
        titulo: a.titulo,
        descricao: `Data: ${fmtDateTime(a.data_audiencia)}`,
        excluido_em: a.updated_at, office_id: a.office_id, office_name: officeMap[a.office_id] || '—', user_id: a.user_id, dados: a,
      }));

      // Atendimentos deletados
      const { data: atds } = await supabase.from('atendimentos').select('*').eq('deletado', true).order('updated_at', { ascending: false });
      (atds || []).forEach(a => results.push({
        id: a.id, tabela: 'atendimentos',
        titulo: a.tipo_atendimento,
        descricao: `Data: ${fmtDateTime(a.data_atendimento)}`,
        excluido_em: a.updated_at, office_id: a.office_id, office_name: officeMap[a.office_id] || '—', user_id: a.user_id, dados: a,
      }));

      // Tarefas deletadas
      const { data: tarefas } = await supabase.from('tarefas').select('*').eq('deletado', true).order('updated_at', { ascending: false });
      (tarefas || []).forEach(t => results.push({
        id: t.id, tabela: 'tarefas',
        titulo: t.titulo,
        descricao: t.descricao || '',
        excluido_em: t.updated_at, user_id: t.user_id, dados: t,
      }));

      // Timesheets deletados
      const { data: tss } = await supabase.from('timesheets').select('*').eq('deletado', true).order('updated_at', { ascending: false });
      (tss || []).forEach(t => results.push({
        id: t.id, tabela: 'timesheets',
        titulo: t.tarefa_descricao,
        descricao: `${t.categoria} · ${t.duracao_minutos || 0}min`,
        excluido_em: t.updated_at || t.created_at || '', office_id: t.office_id, office_name: officeMap[t.office_id || ''] || '—', user_id: t.user_id, dados: t,
      }));

      // Processos descartados da busca OAB
      const { data: desc } = await supabase.from('processos_descartados').select('*').order('created_at', { ascending: false });
      (desc || []).forEach(d => results.push({
        id: d.id, tabela: 'processos_descartados',
        titulo: d.titulo || formatCNJ(d.numero_processo),
        descricao: `CNJ: ${formatCNJ(d.numero_processo)} · ${d.tribunal || ''}`,
        excluido_em: d.created_at, office_id: d.office_id, office_name: officeMap[d.office_id] || '—', user_id: d.user_id, dados: d,
      }));

      results.sort((a, b) => new Date(b.excluido_em).getTime() - new Date(a.excluido_em).getTime());
      setItems(results);
    } catch (err) {
      console.error('Erro ao buscar lixeira:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleRestore = async (item: LixeiraItem) => {
    setRestoring(item.id);
    try {
      if (item.tabela === 'processos') {
        await supabase.from('processos').update({ deletado: false, deletado_pendente: false }).eq('id', item.id);
      } else if (item.tabela === 'publicacoes') {
        await supabase.from('publicacoes').update({ status: 'lida' }).eq('id', item.id);
      } else if (item.tabela === 'processos_descartados') {
        await supabase.from('processos_descartados').delete().eq('id', item.id);
      } else {
        await supabase.from(item.tabela as string).update({ deletado: false, deletado_pendente: false }).eq('id', item.id);
      }
      toast({ title: 'Restaurado', description: `${TABELA_CONFIG[item.tabela]?.label || item.tabela} restaurado com sucesso.` });
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast({ title: 'Erro ao restaurar', description: e.message, variant: 'destructive' });
    } finally {
      setRestoring(null);
    }
  };

  const handlePermanentDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      if (confirmDelete.tabela === 'processos_descartados') {
        await supabase.from('processos_descartados').delete().eq('id', confirmDelete.id);
      } else {
        await supabase.from(confirmDelete.tabela as string).delete().eq('id', confirmDelete.id);
      }
      toast({ title: 'Excluído permanentemente' });
      setItems(prev => prev.filter(i => i.id !== confirmDelete.id));
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  const filtered = items.filter(i => {
    const matchSearch = !search || i.titulo.toLowerCase().includes(search.toLowerCase()) || (i.descricao || '').toLowerCase().includes(search.toLowerCase());
    const matchTabela = filterTabela === 'all' || i.tabela === filterTabela;
    const matchOffice = filterOffice === 'all' || i.office_id === filterOffice;
    return matchSearch && matchTabela && matchOffice;
  });

  const tabelaCounts = items.reduce((acc, i) => {
    acc[i.tabela] = (acc[i.tabela] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const officeList = Array.from(new Set(items.filter(i => i.office_id && i.office_name && i.office_name !== '—').map(i => JSON.stringify({ id: i.office_id, name: i.office_name })))).map(s => JSON.parse(s) as { id: string; name: string });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
              <Trash2 className="h-5 w-5" />
            </div>
            Lixeira
          </h1>
          <p className="text-muted-foreground mt-1 text-sm ml-1">
            Itens excluídos por usuários. Restaure ou exclua permanentemente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-black text-xs">{items.length} itens</Badge>
          <Button variant="outline" size="sm" onClick={fetchAll} className="rounded-xl h-9 gap-1.5 text-xs font-bold">
            <RotateCcw className="h-3.5 w-3.5" /> Atualizar
          </Button>
        </div>
      </div>

      {/* Filtros por tipo */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterTabela('all')}
          className={cn("px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", filterTabela === 'all' ? 'bg-foreground text-background' : 'bg-muted/50 text-muted-foreground hover:bg-muted')}
        >
          Todos ({items.length})
        </button>
        {Object.entries(tabelaCounts).map(([tabela, count]) => {
          const config = TABELA_CONFIG[tabela];
          if (!config) return null;
          const Icon = config.icon;
          return (
            <button
              key={tabela}
              onClick={() => setFilterTabela(tabela)}
              className={cn("px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5", filterTabela === tabela ? 'bg-foreground text-background' : 'bg-muted/50 text-muted-foreground hover:bg-muted')}
            >
              <Icon className="h-3 w-3" />
              {config.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Filtro por escritório */}
      {officeList.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterOffice('all')}
            className={cn("px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5", filterOffice === 'all' ? 'bg-foreground text-background' : 'bg-muted/50 text-muted-foreground hover:bg-muted')}
          >
            <Building2 className="h-3 w-3" /> Todos escritórios
          </button>
          {officeList.map(o => (
            <button
              key={o.id}
              onClick={() => setFilterOffice(o.id)}
              className={cn("px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5", filterOffice === o.id ? 'bg-foreground text-background' : 'bg-muted/50 text-muted-foreground hover:bg-muted')}
            >
              <Building2 className="h-3 w-3" /> {o.name}
            </button>
          ))}
        </div>
      )}

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
        <Input
          placeholder="Buscar na lixeira..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-10 rounded-xl bg-background border-border text-sm"
        />
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-center space-y-3 opacity-30">
          <Trash2 className="h-14 w-14" />
          <p className="font-black uppercase tracking-widest text-sm">Lixeira vazia</p>
          <p className="text-xs max-w-xs">Nenhum item excluído encontrado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const config = TABELA_CONFIG[item.tabela] || { label: item.tabela, icon: FileText, color: 'text-slate-600 bg-slate-500/10 border-slate-500/20' };
            const Icon = config.icon;
            return (
              <Card key={`${item.tabela}-${item.id}`} className="border-border/50 bg-muted/10 rounded-2xl overflow-hidden hover:border-border transition-all">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className={cn("p-2.5 rounded-xl border shrink-0", config.color)}>
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest", config.color)}>
                        {config.label}
                      </Badge>
                    </div>
                    <p className="font-bold text-sm truncate">{item.titulo}</p>
                    {item.descricao && <p className="text-xs text-muted-foreground truncate mt-0.5">{item.descricao}</p>}
                    {item.office_name && item.office_name !== '—' && (
                      <p className="text-[10px] text-muted-foreground/70 mt-1 flex items-center gap-1">
                        <Building2 className="h-3 w-3" /> {item.office_name}
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0 space-y-2">
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end">
                      <Clock className="h-3 w-3" />
                      {item.excluido_em ? fmtDateTime(item.excluido_em) : '—'}
                    </p>
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-xl text-[10px] gap-1 font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 border-emerald-500/20"
                        disabled={restoring === item.id}
                        onClick={() => handleRestore(item)}
                      >
                        {restoring === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                        Restaurar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 rounded-xl text-[10px] gap-1 font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                        onClick={() => setConfirmDelete(item)}
                      >
                        <Trash2 className="h-3 w-3" />
                        Excluir
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Confirm permanent delete */}
      <AlertDialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-500" />
              Excluir permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O item <strong>"{confirmDelete?.titulo}"</strong> será removido definitivamente do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handlePermanentDelete} disabled={deleting} className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white gap-1.5">
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

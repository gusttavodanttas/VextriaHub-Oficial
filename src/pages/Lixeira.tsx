import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { assertRowsAffected, getErrorMessage } from '@/lib/errors';
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
  UserCircle2,
  Target,
  Wallet,
  Handshake,
  Scale,
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
  dados: any;
}

const TABELA_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  processos: { label: 'Processo', icon: FileText, color: 'text-blue-600 bg-blue-500/10 border-blue-500/20' },
  publicacoes: { label: 'Publicação', icon: Megaphone, color: 'text-violet-600 bg-violet-500/10 border-violet-500/20' },
  prazos: { label: 'Prazo', icon: CalendarClock, color: 'text-amber-600 bg-amber-500/10 border-amber-500/20' },
  audiencias: { label: 'Audiência', icon: Gavel, color: 'text-purple-600 bg-purple-500/10 border-purple-500/20' },
  atendimentos: { label: 'Atendimento', icon: Users, color: 'text-sky-600 bg-sky-500/10 border-sky-500/20' },
  tarefas: { label: 'Tarefa', icon: ListTodo, color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
  timesheets: { label: 'Timesheet', icon: Timer, color: 'text-orange-600 bg-orange-500/10 border-orange-500/20' },
  processos_descartados: { label: 'Descartado (OAB)', icon: X, color: 'text-rose-600 bg-rose-500/10 border-rose-500/20' },
  // Estas 3 também passam pela fila de exclusões pendentes (Admin > Solicitações),
  // mas até aqui não tinham NENHUMA tela para restaurar/purgar depois de aprovadas
  // — o registro ficava soft-deletado (deletado=true) pra sempre, sem volta.
  clientes: { label: 'Cliente', icon: UserCircle2, color: 'text-teal-600 bg-teal-500/10 border-teal-500/20' },
  metas: { label: 'Meta', icon: Target, color: 'text-fuchsia-600 bg-fuchsia-500/10 border-fuchsia-500/20' },
  financeiro: { label: 'Financeiro', icon: Wallet, color: 'text-lime-600 bg-lime-500/10 border-lime-500/20' },
  // Excluir aqui virou soft-delete nesta rodada (antes era DELETE físico, sem
  // Lixeira nenhuma pra restaurar/purgar).
  correspondentes: { label: 'Correspondente', icon: Handshake, color: 'text-cyan-600 bg-cyan-500/10 border-cyan-500/20' },
  diligencias: { label: 'Diligência', icon: Scale, color: 'text-indigo-600 bg-indigo-500/10 border-indigo-500/20' },
};

const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');
const fmtDateTime = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const TABELAS_PERMITIDAS = new Set(Object.keys(TABELA_CONFIG));

// Lixeira busca em 10 tabelas diferentes e mescla tudo no cliente — não existe uma
// tabela única pra paginar de verdade sem uma RPC dedicada no backend (UNION ALL das
// 10). Cap de segurança por tabela: evita fetch sem limite algum num escritório (ou
// super-admin olhando todos) com volume real de exclusões, mesmo padrão já usado em
// useAudiencias/useTarefas antes de pautas dedicadas de paginação existirem.
const TRASH_TABLE_CAP = 500;

function fromTabela(tabela: string) {
  if (!TABELAS_PERMITIDAS.has(tabela)) throw new Error(`Tabela não permitida: ${tabela}`);
  return supabase.from(tabela as 'processos');
}

export default function Lixeira() {
  const { user, isSuperAdmin, officeUser } = useAuth();
  const officeId = officeUser?.office_id || user?.office_id;
  const { toast } = useToast();
  const [items, setItems] = useState<LixeiraItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTabela, setFilterTabela] = useState<string>('all');
  const [filterOffice, setFilterOffice] = useState<string>('all');
  const [restoring, setRestoring] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LixeiraItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [cappedTabelas, setCappedTabelas] = useState<string[]>([]);

  const fetchAll = async () => {
    if (!officeId && !isSuperAdmin) return;
    setLoading(true);
    try {
      const officeMap: Record<string, string> = {};
      if (isSuperAdmin) {
        const { data: offices } = await supabase.from('offices').select('id, name');
        (offices || []).forEach(o => { officeMap[o.id] = o.name; });
      } else if (officeId) {
        const { data: office } = await supabase.from('offices').select('id, name').eq('id', officeId).maybeSingle();
        if (office) officeMap[office.id] = office.name;
      }

      const applyTenantFilter = <T extends { eq(column: string, value: string): T }>(query: T): T =>
        isSuperAdmin ? query : query.eq('office_id', officeId!);

      const results: LixeiraItem[] = [];

      const { data: procs } = await applyTenantFilter(supabase.from('processos').select('*').eq('deletado', true)).order('updated_at', { ascending: false }).limit(TRASH_TABLE_CAP);
      (procs || []).forEach(p => results.push({
        id: p.id, tabela: 'processos',
        titulo: p.titulo || formatCNJ(p.numero_processo),
        descricao: `CNJ: ${formatCNJ(p.numero_processo)}`,
        excluido_em: p.updated_at, office_id: p.office_id, office_name: officeMap[p.office_id] || '—', user_id: p.user_id, dados: p,
      }));

      const { data: pubs } = await applyTenantFilter(supabase.from('publicacoes').select('*').eq('status', 'arquivada')).order('created_at', { ascending: false }).limit(TRASH_TABLE_CAP);
      (pubs || []).forEach(p => results.push({
        id: p.id, tabela: 'publicacoes',
        titulo: p.titulo,
        descricao: `${fmtDate(p.data_publicacao)} · ${p.tribunal || ''}`,
        excluido_em: p.created_at, office_id: p.office_id, office_name: officeMap[p.office_id] || '—', user_id: p.user_id ?? undefined, dados: p,
      }));

      const { data: prazos } = await applyTenantFilter(supabase.from('prazos').select('*').eq('deletado', true)).order('created_at', { ascending: false }).limit(TRASH_TABLE_CAP);
      (prazos || []).forEach(p => results.push({
        id: p.id, tabela: 'prazos',
        titulo: p.titulo ?? '',
        descricao: `Vencimento: ${p.data_vencimento ? fmtDate(p.data_vencimento) : '—'}`,
        excluido_em: p.created_at, office_id: p.office_id, office_name: officeMap[p.office_id] || '—', user_id: p.user_id ?? undefined, dados: p,
      }));

      const { data: auds } = await applyTenantFilter(supabase.from('audiencias').select('*').eq('deletado', true)).order('updated_at', { ascending: false }).limit(TRASH_TABLE_CAP);
      (auds || []).forEach(a => results.push({
        id: a.id, tabela: 'audiencias',
        titulo: a.titulo,
        descricao: `Data: ${fmtDateTime(a.data_audiencia)}`,
        excluido_em: a.updated_at, office_id: a.office_id, office_name: officeMap[a.office_id] || '—', user_id: a.user_id, dados: a,
      }));

      const { data: atds } = await applyTenantFilter(supabase.from('atendimentos').select('*').eq('deletado', true)).order('updated_at', { ascending: false }).limit(TRASH_TABLE_CAP);
      (atds || []).forEach(a => results.push({
        id: a.id, tabela: 'atendimentos',
        titulo: a.tipo_atendimento,
        descricao: `Data: ${fmtDateTime(a.data_atendimento)}`,
        excluido_em: a.updated_at, office_id: a.office_id, office_name: officeMap[a.office_id] || '—', user_id: a.user_id, dados: a,
      }));

      const { data: tarefas } = await applyTenantFilter(supabase.from('tarefas').select('*').eq('deletado', true)).order('updated_at', { ascending: false }).limit(TRASH_TABLE_CAP);
      (tarefas || []).forEach(t => results.push({
        id: t.id, tabela: 'tarefas',
        titulo: t.titulo,
        descricao: t.descricao || '',
        // office_id/office_name faltavam só aqui: a lista de admin mostrava escritório
        // em branco e o tenantGuard do restore ficava sem escopo (só a RLS segurava). (v11)
        excluido_em: t.updated_at, office_id: t.office_id, office_name: officeMap[t.office_id] || '—', user_id: t.user_id, dados: t,
      }));

      const { data: tss } = await applyTenantFilter(supabase.from('timesheets').select('*').eq('deletado', true)).order('updated_at', { ascending: false }).limit(TRASH_TABLE_CAP);
      (tss || []).forEach(t => results.push({
        id: t.id, tabela: 'timesheets',
        titulo: t.tarefa_descricao,
        descricao: `${t.categoria} · ${t.duracao_minutos || 0}min`,
        excluido_em: t.updated_at || t.created_at || '', office_id: t.office_id, office_name: officeMap[t.office_id || ''] || '—', user_id: t.user_id, dados: t,
      }));

      const { data: clis } = await applyTenantFilter(supabase.from('clientes').select('*').eq('deletado', true)).order('updated_at', { ascending: false }).limit(TRASH_TABLE_CAP);
      (clis || []).forEach(c => results.push({
        id: c.id, tabela: 'clientes',
        titulo: c.nome,
        descricao: c.email || c.telefone || '',
        excluido_em: c.updated_at, office_id: c.office_id, office_name: officeMap[c.office_id] || '—', user_id: (c as any).user_id, dados: c,
      }));

      const { data: metasRows } = await applyTenantFilter(supabase.from('metas').select('*').eq('deletado', true)).order('updated_at', { ascending: false }).limit(TRASH_TABLE_CAP);
      (metasRows || []).forEach(m => results.push({
        id: m.id, tabela: 'metas',
        titulo: m.titulo,
        descricao: `Meta: R$ ${Number(m.valor_meta || 0).toFixed(2)}`,
        excluido_em: m.updated_at, office_id: m.office_id, office_name: officeMap[m.office_id] || '—', user_id: m.user_id, dados: m,
      }));

      const { data: fin } = await applyTenantFilter(supabase.from('financeiro').select('*').eq('deletado', true)).order('updated_at', { ascending: false }).limit(TRASH_TABLE_CAP);
      (fin || []).forEach(f => results.push({
        id: f.id, tabela: 'financeiro',
        titulo: f.descricao || (f.tipo === 'receita' ? 'Receita' : 'Despesa'),
        descricao: `${f.tipo} · R$ ${Number(f.valor || 0).toFixed(2)}`,
        excluido_em: f.updated_at, office_id: f.office_id, office_name: officeMap[f.office_id] || '—', user_id: f.user_id, dados: f,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela dinâmica: o genérico estoura o limite de instanciação do Supabase só aqui
      const { data: desc } = await applyTenantFilter<any>(supabase.from('processos_descartados').select('*')).order('created_at', { ascending: false }).limit(TRASH_TABLE_CAP);
      (desc || []).forEach((d: any) => results.push({
        id: d.id, tabela: 'processos_descartados',
        titulo: d.titulo || formatCNJ(d.numero_processo),
        descricao: `CNJ: ${formatCNJ(d.numero_processo)} · ${d.tribunal || ''}`,
        excluido_em: d.created_at, office_id: d.office_id, office_name: officeMap[d.office_id] || '—', user_id: d.user_id, dados: d,
      }));

      // correspondentes/diligencias ainda não estão nos tipos gerados do Supabase
      // (mesmo débito técnico documentado em useCorrespondentes.tsx) — acesso via `as any`.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: corrs } = await applyTenantFilter<any>((supabase as any).from('correspondentes').select('*').eq('deletado', true)).order('updated_at', { ascending: false }).limit(TRASH_TABLE_CAP);
      (corrs || []).forEach((c: any) => results.push({
        id: c.id, tabela: 'correspondentes',
        titulo: c.nome,
        descricao: c.oab ? `OAB ${c.oab}${c.uf ? '/' + c.uf : ''}` : (c.email || c.telefone || ''),
        excluido_em: c.updated_at, office_id: c.office_id, office_name: officeMap[c.office_id] || '—', user_id: c.user_id, dados: c,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: dils } = await applyTenantFilter<any>((supabase as any).from('diligencias').select('*').eq('deletado', true)).order('updated_at', { ascending: false }).limit(TRASH_TABLE_CAP);
      (dils || []).forEach((d: any) => results.push({
        id: d.id, tabela: 'diligencias',
        titulo: d.descricao || `Diligência (${d.tipo || 'outro'})`,
        descricao: `${d.comarca || ''}${d.uf ? '/' + d.uf : ''} · R$ ${Number(d.valor || 0).toFixed(2)}`.trim(),
        excluido_em: d.updated_at, office_id: d.office_id, office_name: officeMap[d.office_id] || '—', user_id: d.user_id, dados: d,
      }));

      results.sort((a, b) => new Date(b.excluido_em).getTime() - new Date(a.excluido_em).getTime());
      setItems(results);

      // Cada tabela é buscada com .limit(TRASH_TABLE_CAP) acima — se alguma bateu no
      // teto, pode haver mais itens não exibidos nela (a lista deixa de ser exaustiva
      // pra essa tabela). Avisa em vez de deixar parecer que "isso é tudo".
      const countsPorTabela: Record<string, number> = {};
      for (const r of results) countsPorTabela[r.tabela] = (countsPorTabela[r.tabela] || 0) + 1;
      setCappedTabelas(
        Object.entries(countsPorTabela)
          .filter(([, count]) => count >= TRASH_TABLE_CAP)
          .map(([tabela]) => TABELA_CONFIG[tabela]?.label || tabela)
      );
    } catch (err) {
      console.error('Erro ao buscar lixeira:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [officeId, isSuperAdmin]);

  const tenantGuard = <T extends { eq(column: string, value: string): T }>(query: T, item: LixeiraItem): T =>
    (!isSuperAdmin && item.office_id) ? query.eq('office_id', item.office_id) : query;

  const handleRestore = async (item: LixeiraItem) => {
    setRestoring(item.id);
    try {
      // Postgres/PostgREST NÃO lança erro quando a RLS bloqueia um UPDATE/DELETE — só
      // casa 0 linhas e devolve sucesso. O comentário anterior já avisava disso, mas o
      // código nunca chegou a encadear `.select('id')` pra conferir a contagem — um
      // restore barrado pela RLS mostrava "sucesso" com a linha intocada no banco,
      // reaparecendo só depois de um F5. assertRowsAffected fecha essa checagem de vez.
      let data: { id: string }[] | null, error: unknown;
      if (item.tabela === 'processos') {
        ({ data, error } = await tenantGuard(supabase.from('processos').update({ deletado: false, deletado_pendente: false }).eq('id', item.id), item).select('id'));
      } else if (item.tabela === 'publicacoes') {
        ({ data, error } = await tenantGuard(supabase.from('publicacoes').update({ status: 'lida' }).eq('id', item.id), item).select('id'));
      } else if (item.tabela === 'processos_descartados') {
        ({ data, error } = await tenantGuard(supabase.from('processos_descartados').delete().eq('id', item.id), item).select('id'));
      } else {
        if (!TABELAS_PERMITIDAS.has(item.tabela)) throw new Error('Tabela não permitida');
        // prazos/correspondentes/diligencias não têm a coluna deletado_pendente —
        // enviar o campo faz o restore inteiro falhar (item fica preso na lixeira).
        const restorePatch: Record<string, unknown> = { deletado: false };
        if (!['prazos', 'correspondentes', 'diligencias'].includes(item.tabela)) restorePatch.deletado_pendente = false;
        // item.tabela é dinâmico (guardado só em runtime por TABELAS_PERMITIDAS) --
        // não dá pra tipar estaticamente o shape exato do update pra uma tabela
        // que só se conhece em tempo de execução.
        ({ data, error } = await tenantGuard(fromTabela(item.tabela).update(restorePatch as any).eq('id', item.id), item).select('id'));
      }
      assertRowsAffected(data, error, 1);
      toast({ title: 'Restaurado', description: `${TABELA_CONFIG[item.tabela]?.label || item.tabela} restaurado com sucesso.` });
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (err: unknown) {
      toast({ title: 'Erro ao restaurar', description: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setRestoring(null);
    }
  };

  const handlePermanentDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      if (!TABELAS_PERMITIDAS.has(confirmDelete.tabela)) throw new Error('Tabela não permitida');
      const { data, error } = await tenantGuard(fromTabela(confirmDelete.tabela).delete().eq('id', confirmDelete.id), confirmDelete).select('id');
      assertRowsAffected(data, error, 1);
      toast({ title: 'Excluído permanentemente' });
      setItems(prev => prev.filter(i => i.id !== confirmDelete.id));
    } catch (err: unknown) {
      toast({ title: 'Erro', description: getErrorMessage(err), variant: 'destructive' });
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

      {/* Aviso de teto atingido */}
      {cappedTabelas.length > 0 && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-medium">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Mostrando só os {TRASH_TABLE_CAP} itens mais recentes de: {cappedTabelas.join(', ')}. Pode haver mais itens excluídos nessas categorias não exibidos aqui.
          </span>
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

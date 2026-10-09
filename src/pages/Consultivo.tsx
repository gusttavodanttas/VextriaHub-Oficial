import { useState, useEffect, useMemo, useDeferredValue } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useConsultivos, useConsultivosLista, useConsultivosStatusCounts, useConsultivoCategoriaValoresEmUso, Consultivo } from "@/hooks/useConsultivos";
import { useOfficeUsers } from "@/hooks/useOfficeUsers";
import { useConsultivoCategorias } from "@/hooks/useConsultivoCategorias";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { PermissionGuard } from "@/components/Auth/PermissionGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  MessageSquareText, Plus, Search, Filter, X, ArrowLeft,
  FileText, TrendingUp, Clock, CheckCircle2, AlertTriangle,
  ChevronLeft, ChevronRight, Settings,
} from "lucide-react";
import {
  BLANK_FORM, DEFAULT_CATS, PRIORIDADES, STATUS_MAP, type CatCfg,
} from "@/components/Consultivo/consultivoConfig";
import { CategoryManagerDialog } from "@/components/Consultivo/CategoryManagerDialog";
import { ConsultivoCard, StatCard } from "@/components/Consultivo/ConsultivoCard";
import { ConsultivoFormDialog } from "@/components/Consultivo/ConsultivoFormDialog";

// Página Consultivo: estado dos filtros, paginação e do formulário. A
// apresentação (card, diálogos, configuração) vive em src/components/Consultivo/.

const PAGE_SIZE = 24;

export default function ConsultivoPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { canManageConsultivo } = usePermissions();
  const { create, update, remove } = useConsultivos();
  const { users: officeUsers } = useOfficeUsers();
  const membros = useMemo(() => officeUsers.map(u => ({
    id: u.user_id,
    label: u.profile?.full_name || u.profile?.email || "Membro",
  })), [officeUsers]);
  const {
    data: categorias, loading: catLoading, error: catError, refetch: refetchCat,
    create: createCat, update: updateCat, remove: removeCat,
  } = useConsultivoCategorias();
  const categoriaValoresEmUso = useConsultivoCategoriaValoresEmUso();
  const statusCounts = useConsultivosStatusCounts();

  const [filtroClienteNome, setFiltroClienteNome] = useState<string | null>(null);
  const [filtroClienteId, setFiltroClienteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const dSearch = useDeferredValue(search);
  const [filterCat, setFilterCat] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPri, setFilterPri] = useState("all");
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [catMgrOpen, setCatMgrOpen] = useState(false);
  const [editItem, setEditItem] = useState<Consultivo | null>(null);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const s = location.state;
    if (s?.clientFilter) setFiltroClienteNome(s.clientFilter);
    if (s?.clientId) setFiltroClienteId(s.clientId);
  }, [location]);

  // Volta pra página 1 sempre que um filtro muda — senão o usuário pode ficar
  // numa página que não existe mais para o novo recorte.
  useEffect(() => { setPage(1); }, [dSearch, filterCat, filterStatus, filterPri, filtroClienteId]);

  const { data, total, loading, error, refetch } = useConsultivosLista({
    page, pageSize: PAGE_SIZE,
    status: filterStatus, categoria: filterCat, prioridade: filterPri,
    clienteId: filtroClienteId, search: dSearch,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // effective categories: DB ones if exist, otherwise defaults for UI. Quando o
  // escritório já tem categorias reais, consultivos antigos gravados com uma
  // categoria padrão (DEFAULT_CATS) que nunca foi migrada pro office ficam
  // "órfãos": sem entrada em `categorias`, apareciam com o slug cru como rótulo
  // e sem nenhum filtro que os alcançasse. Sintetiza uma entrada pra cada
  // categoria órfã em uso no escritório (não só na página atual — vem de
  // categoriaValoresEmUso, uma busca leve e não paginada) usando o rótulo
  // padrão quando bate com um slug conhecido.
  const effectiveCats = useMemo<CatCfg[]>(() => {
    if (categorias.length === 0) {
      return DEFAULT_CATS.map((d, i) => ({ ...d, id: d.valor, office_id: null, ordem: i, created_at: "" }));
    }
    const known = new Set(categorias.map((c) => c.valor));
    const orfas = categoriaValoresEmUso.filter((v) => !known.has(v));
    const orfasCfg = orfas.map((valor, i) => {
      const padrao = DEFAULT_CATS.find((d) => d.valor === valor);
      return {
        valor, label: padrao?.label ?? valor, cor: padrao?.cor ?? "blue", icone: padrao?.icone ?? "FileText",
        id: `orfa:${valor}`, office_id: null, ordem: categorias.length + i, created_at: "",
      };
    });
    return [...categorias, ...orfasCfg];
  }, [categorias, categoriaValoresEmUso]);

  function getCatCfg(valor: string): CatCfg {
    const cat = effectiveCats.find(c => c.valor === valor);
    if (!cat) return { label: valor, cor: "blue", icone: "FileText", valor };
    return cat;
  }

  const totalGeral = statusCounts.total;
  const pendentes  = statusCounts.pendente;
  const andamento  = statusCounts.em_andamento;
  const concluidos = statusCounts.concluido;

  // Filtro (busca/categoria/status/prioridade/cliente) já roda no servidor via
  // useConsultivosLista — `data` já vem filtrada e paginada.
  const filtered = data;

  const defaultCatVal = effectiveCats[0]?.valor ?? "";

  const openCreate = () => {
    setEditItem(null);
    setForm({ ...BLANK_FORM, cliente_id: filtroClienteId || "", categoria: defaultCatVal, responsavel_id: user?.id || "" });
    setDialogOpen(true);
  };

  const openEdit = (item: Consultivo) => {
    setEditItem(item);
    setForm({
      titulo: item.titulo,
      descricao: item.descricao || "",
      categoria: item.categoria,
      prioridade: item.prioridade || "media",
      status: item.status || "pendente",
      tags: (item.tags || []).join(", "),
      observacoes: item.observacoes || "",
      cliente_id: item.cliente_id || "",
      responsavel_id: item.responsavel_id || user?.id || "",
      prazo: item.prazo || "",
    });
    setDialogOpen(true);
  };

  // Abre o consultivo específico vindo de ?openId= (ex.: painel da equipe) —
  // busca direta por id (o item pode não estar na página atualmente carregada,
  // já que a lista agora é paginada).
  useEffect(() => {
    const openId = searchParams.get("openId");
    if (!openId) return;
    (async () => {
      const { data: row } = await supabase
        .from("consultivos")
        .select("*, clientes(nome)")
        .eq("id", openId)
        .maybeSingle();
      if (row) openEdit(row as Consultivo);
    })();
    navigate("/consultivo", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const handleSave = async () => {
    if (!canManageConsultivo || !form.titulo.trim()) return;
    setSaving(true);
    const payload = {
      titulo: form.titulo.trim(),
      descricao: form.descricao || null,
      categoria: form.categoria,
      prioridade: form.prioridade || null,
      status: form.status || null,
      tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      observacoes: form.observacoes || null,
      cliente_id: form.cliente_id || null,
      responsavel_id: form.responsavel_id || user?.id || null,
      prazo: form.prazo || null,
    };
    const ok = editItem ? await update(editItem.id, payload as any) : await create(payload as any);
    setSaving(false);
    if (ok) setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!canManageConsultivo) return;
    await remove(id);
    setDialogOpen(false);
    setEditItem(null);
  };

  const handleQuickStatus = async (item: Consultivo, status: string) => {
    if (!canManageConsultivo) return;
    await update(item.id, { status });
  };

  return (
    <div className="flex-1 p-4 md:p-8 overflow-x-hidden entry-animate">
      <div className="max-w-7xl mx-auto w-full space-y-6">

        {/* header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            {filtroClienteNome && (
              <Button variant="ghost" size="icon" onClick={() => navigate("/clientes")}
                className="rounded-xl hover:bg-primary/10 hover:text-primary" aria-label="Voltar para clientes">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
              <MessageSquareText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Consultivo</h1>
              <p className="text-sm text-muted-foreground">
                {filtroClienteNome ? `Consultas de ${filtroClienteNome}` : "Pareceres, contratos e consultas jurídicas"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {filtroClienteNome && (
              <Button variant="outline" size="sm"
                onClick={() => { setFiltroClienteNome(null); setFiltroClienteId(null); }}
                className="rounded-xl text-xs font-bold gap-1.5">
                <X className="h-3.5 w-3.5" />Limpar filtro
              </Button>
            )}
            <PermissionGuard permission="canManageConsultivo">
              <Button variant="outline" size="sm" onClick={() => setCatMgrOpen(true)}
                className="rounded-xl font-bold gap-1.5">
                <Settings className="h-4 w-4" />Categorias
              </Button>
            </PermissionGuard>
            <PermissionGuard permission="canManageConsultivo">
              <Button onClick={openCreate} className="rounded-xl font-black gap-2">
                <Plus className="h-4 w-4" />Novo Consultivo
              </Button>
            </PermissionGuard>
          </div>
        </div>

        {/* filtro cliente banner */}
        {filtroClienteNome && (
          <div className="flex items-center gap-3 p-3.5 bg-primary/5 border border-primary/20 rounded-2xl">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Filter className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm text-primary font-medium">
              Filtrado para: <strong className="font-black">{filtroClienteNome}</strong>
            </span>
          </div>
        )}

        {/* stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total"        value={totalGeral} Icon={FileText}     color="text-primary"     bg="bg-primary/10" />
          <StatCard label="Pendentes"    value={pendentes}  Icon={Clock}        color="text-amber-500"   bg="bg-amber-500/10" />
          <StatCard label="Em Andamento" value={andamento}  Icon={TrendingUp}   color="text-blue-500"    bg="bg-blue-500/10" />
          <StatCard label="Concluídos"   value={concluidos} Icon={CheckCircle2} color="text-emerald-500" bg="bg-emerald-500/10" />
        </div>

        {/* filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input placeholder="Buscar consultivos..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 rounded-xl border-black/8 dark:border-border" />
          </div>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-44 rounded-xl border-black/8 dark:border-border"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {effectiveCats.map(c => <SelectItem key={c.valor} value={c.valor}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40 rounded-xl border-black/8 dark:border-border"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {STATUS_MAP.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterPri} onValueChange={setFilterPri}>
            <SelectTrigger className="w-36 rounded-xl border-black/8 dark:border-border"><SelectValue placeholder="Prioridade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {PRIORIDADES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {catError && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="flex-1">Categorias não carregaram ({catError}) — os consultivos podem aparecer sem categoria.</span>
            <Button size="sm" variant="outline" onClick={() => refetchCat()} className="h-7 rounded-lg text-xs">Tentar de novo</Button>
          </div>
        )}

        {/* list */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="p-5 rounded-2xl bg-destructive/10">
              <AlertTriangle className="h-10 w-10 text-destructive/60" />
            </div>
            <div>
              <p className="font-bold text-base">Não foi possível carregar os consultivos</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
            <Button variant="outline" onClick={refetch} className="rounded-xl font-black gap-2 mt-2">
              Tentar novamente
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="p-5 rounded-2xl bg-muted/40">
              <MessageSquareText className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <div>
              <p className="font-bold text-base">Nenhum consultivo encontrado</p>
              <p className="text-sm text-muted-foreground mt-1">
                {filtroClienteNome
                  ? `Crie o primeiro consultivo para ${filtroClienteNome}.`
                  : `Clique em "Novo Consultivo" para começar.`}
              </p>
            </div>
            <PermissionGuard permission="canManageConsultivo">
              <Button onClick={openCreate} className="rounded-xl font-black gap-2 mt-2">
                <Plus className="h-4 w-4" />Novo Consultivo
              </Button>
            </PermissionGuard>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(item => (
              <ConsultivoCard
                key={item.id}
                item={item}
                cat={getCatCfg(item.categoria)}
                onEdit={openEdit}
                onQuickStatus={handleQuickStatus}
                onClienteClick={(nome, clienteId) => navigate("/clientes", { state: { clientFilter: nome, clientId: clienteId } })}
              />
            ))}
          </div>
        )}

        {/* Paginação */}
        {!loading && !error && totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 pt-2">
            <p className="text-xs font-semibold text-muted-foreground">
              Página {page} de {totalPages} · {total} consultivo{total === 1 ? "" : "s"}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 rounded-lg text-xs font-bold gap-1"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 rounded-lg text-xs font-bold gap-1"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Próxima <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <ConsultivoFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        isEdit={!!editItem}
        form={form}
        setForm={setForm}
        categorias={effectiveCats}
        membros={membros}
        canManage={canManageConsultivo}
        saving={saving}
        onSave={handleSave}
        onDelete={editItem && canManageConsultivo ? () => handleDelete(editItem.id) : undefined}
        onGerenciarCategorias={() => { setDialogOpen(false); setCatMgrOpen(true); }}
      />

      <CategoryManagerDialog
        open={catMgrOpen}
        onOpenChange={setCatMgrOpen}
        categorias={categorias}
        onCreate={createCat}
        onUpdate={updateCat}
        onRemove={removeCat}
      />
    </div>
  );
}

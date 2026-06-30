import { useState, useEffect, useMemo, useDeferredValue } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useConsultivos, Consultivo } from "@/hooks/useConsultivos";
import { useOpenItemFromSearch } from "@/hooks/useOpenItemFromSearch";
import { useOfficeUsers } from "@/hooks/useOfficeUsers";
import { useConsultivoCategorias, ConsultivoCategoria } from "@/hooks/useConsultivoCategorias";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ClientSelect } from "@/components/Clientes/ClientSelect";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  MessageSquareText, Plus, Search, Filter, X, ArrowLeft,
  FileText, Scale, Briefcase, Users, Tag, Calendar,
  TrendingUp, Clock, CheckCircle2, AlertTriangle, Trash2,
  ChevronRight, User, Settings, Pencil, GripVertical,
  BookOpen, Star, Landmark, Shield, Gavel,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── icon map ────────────────────────────────────────────────────────────────

const ICON_OPTIONS: { value: string; Icon: React.ElementType; label: string }[] = [
  { value: "FileText",      Icon: FileText,      label: "Documento" },
  { value: "Scale",         Icon: Scale,         label: "Balança" },
  { value: "Briefcase",     Icon: Briefcase,     label: "Maleta" },
  { value: "Users",         Icon: Users,         label: "Pessoas" },
  { value: "TrendingUp",    Icon: TrendingUp,    label: "Gráfico" },
  { value: "AlertTriangle", Icon: AlertTriangle, label: "Alerta" },
  { value: "Clock",         Icon: Clock,         label: "Relógio" },
  { value: "BookOpen",      Icon: BookOpen,      label: "Livro" },
  { value: "Star",          Icon: Star,          label: "Estrela" },
  { value: "Landmark",      Icon: Landmark,      label: "Tribunal" },
  { value: "Shield",        Icon: Shield,        label: "Escudo" },
  { value: "Gavel",         Icon: Gavel,         label: "Martelo" },
];

const COLOR_OPTIONS: { value: string; label: string; color: string; bg: string; border: string }[] = [
  { value: "blue",    label: "Azul",     color: "text-blue-500",    bg: "bg-blue-500/10",    border: "border-l-blue-500" },
  { value: "violet",  label: "Violeta",  color: "text-violet-500",  bg: "bg-violet-500/10",  border: "border-l-violet-500" },
  { value: "emerald", label: "Verde",    color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-l-emerald-500" },
  { value: "amber",   label: "Âmbar",   color: "text-amber-500",   bg: "bg-amber-500/10",   border: "border-l-amber-500" },
  { value: "rose",    label: "Rosa",     color: "text-rose-500",    bg: "bg-rose-500/10",    border: "border-l-rose-500" },
  { value: "indigo",  label: "Índigo",   color: "text-indigo-500",  bg: "bg-indigo-500/10",  border: "border-l-indigo-500" },
  { value: "red",     label: "Vermelho", color: "text-red-500",     bg: "bg-red-500/10",     border: "border-l-red-500" },
  { value: "teal",    label: "Teal",     color: "text-teal-500",    bg: "bg-teal-500/10",    border: "border-l-teal-500" },
  { value: "orange",  label: "Laranja",  color: "text-orange-500",  bg: "bg-orange-500/10",  border: "border-l-orange-500" },
  { value: "pink",    label: "Rosa",     color: "text-pink-500",    bg: "bg-pink-500/10",    border: "border-l-pink-500" },
];

function getColorCfg(cor: string) {
  return COLOR_OPTIONS.find(c => c.value === cor) ?? COLOR_OPTIONS[0];
}
function getIconEl(icone: string): React.ElementType {
  return ICON_OPTIONS.find(i => i.value === icone)?.Icon ?? FileText;
}

// ─── default categories (used when office has none yet) ───────────────────

const DEFAULT_CATS = [
  { valor: "contratos",      label: "Contratos",      cor: "blue",    icone: "FileText" },
  { valor: "trabalhista",    label: "Trabalhista",    cor: "amber",   icone: "Users" },
  { valor: "tributario",     label: "Tributário",     cor: "violet",  icone: "TrendingUp" },
  { valor: "civil",          label: "Civil",          cor: "emerald", icone: "Scale" },
  { valor: "empresarial",    label: "Empresarial",    cor: "indigo",  icone: "Briefcase" },
  { valor: "familiar",       label: "Familiar",       cor: "rose",    icone: "Users" },
  { valor: "criminal",       label: "Criminal",       cor: "red",     icone: "AlertTriangle" },
  { valor: "previdenciario", label: "Previdenciário", cor: "teal",    icone: "Clock" },
];

// ─── prioridade / status ──────────────────────────────────────────────────

const PRIORIDADES = [
  { value: "alta",  label: "Alta",  cls: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" },
  { value: "media", label: "Média", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  { value: "baixa", label: "Baixa", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
];

const STATUS_MAP = [
  { value: "pendente",     label: "Pendente",     cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",        Icon: Clock },
  { value: "em_andamento", label: "Em Andamento", cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",            Icon: TrendingUp },
  { value: "concluido",    label: "Concluído",    cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", Icon: CheckCircle2 },
  { value: "cancelado",    label: "Cancelado",    cls: "bg-slate-500/10 text-slate-500 border-slate-500/20",                            Icon: X },
];

function getPriCls(p: string | null) {
  return PRIORIDADES.find(x => x.value === p)?.cls ?? "bg-muted text-muted-foreground border-border";
}
function getStatusCfg(s: string | null) {
  return STATUS_MAP.find(x => x.value === s) ?? STATUS_MAP[0];
}
function fmtDate(d: string) {
  try { return format(new Date(d), "dd/MM/yyyy", { locale: ptBR }); }
  catch { return d; }
}

// ─── StatCard ─────────────────────────────────────────────────────────────

function StatCard({ label, value, Icon, color, bg }: {
  label: string; value: number | string;
  Icon: React.ElementType; color: string; bg: string;
}) {
  return (
    <div className="rounded-2xl bg-card border border-black/5 dark:border-border shadow-premium p-4 flex items-center gap-4">
      <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", bg)}>
        <Icon className={cn("h-5 w-5", color)} />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">{label}</p>
        <p className="text-2xl font-black tracking-tight leading-none">{value}</p>
      </div>
    </div>
  );
}

// ─── CategoryManager dialog ───────────────────────────────────────────────

type CatForm = { label: string; cor: string; icone: string };
const BLANK_CAT: CatForm = { label: "", cor: "blue", icone: "FileText" };

function CategoryManagerDialog({
  open, onOpenChange, categorias, onCreate, onUpdate, onRemove,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categorias: ConsultivoCategoria[];
  onCreate: (label: string, cor: string, icone: string) => Promise<boolean>;
  onUpdate: (id: string, label: string, cor: string, icone: string) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CatForm>({ ...BLANK_CAT });
  const [saving, setSaving] = useState(false);

  const startEdit = (cat: ConsultivoCategoria) => {
    setEditId(cat.id);
    setForm({ label: cat.label, cor: cat.cor, icone: cat.icone });
  };
  const startCreate = () => {
    setEditId(null);
    setForm({ ...BLANK_CAT });
  };

  const handleSave = async () => {
    if (!form.label.trim()) return;
    setSaving(true);
    const ok = editId
      ? await onUpdate(editId, form.label.trim(), form.cor, form.icone)
      : await onCreate(form.label.trim(), form.cor, form.icone);
    setSaving(false);
    if (ok) { setEditId(null); setForm({ ...BLANK_CAT }); }
  };

  const CatIcon = getIconEl(form.icone);
  const catColor = getColorCfg(form.cor);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border shrink-0">
          <DialogTitle className="font-black text-lg flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Gerenciar Categorias
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 divide-y divide-border">
          {/* lista de categorias existentes */}
          {categorias.map(cat => {
            const cc = getColorCfg(cat.cor);
            const CIcon = getIconEl(cat.icone);
            const isEditing = editId === cat.id;
            return (
              <div key={cat.id} className="px-5 py-3">
                {isEditing ? (
                  <CatFormInline
                    form={form} setForm={setForm} saving={saving}
                    onSave={handleSave} onCancel={() => { setEditId(null); setForm({ ...BLANK_CAT }); }}
                  />
                ) : (
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-xl shrink-0", cc.bg)}>
                      <CIcon className={cn("h-4 w-4", cc.color)} />
                    </div>
                    <span className="font-bold text-sm flex-1">{cat.label}</span>
                    <button onClick={() => startEdit(cat)}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors text-muted-foreground hover:text-rose-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir categoria "{cat.label}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Consultivos com esta categoria não serão excluídos, mas perderão a classificação.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onRemove(cat.id)}
                            className="rounded-xl bg-destructive hover:bg-destructive/90">
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            );
          })}

          {/* form nova categoria */}
          <div className="px-5 py-4 bg-muted/20">
            {editId === null ? (
              <>
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-3">
                  {categorias.length === 0 ? "Criar primeira categoria" : "Nova categoria"}
                </p>
                <CatFormInline
                  form={form} setForm={setForm} saving={saving}
                  onSave={handleSave} onCancel={() => setForm({ ...BLANK_CAT })}
                  isNew
                />
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={startCreate}
                className="w-full rounded-xl text-xs font-black gap-2 border border-dashed border-border hover:border-primary/40">
                <Plus className="h-3.5 w-3.5" />Nova categoria
              </Button>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border shrink-0">
          <Button onClick={() => onOpenChange(false)} className="rounded-xl font-black w-full">
            Concluído
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CatFormInline({ form, setForm, saving, onSave, onCancel, isNew }: {
  form: CatForm;
  setForm: React.Dispatch<React.SetStateAction<CatForm>>;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  isNew?: boolean;
}) {
  const CatIcon = getIconEl(form.icone);
  const catColor = getColorCfg(form.cor);

  return (
    <div className="space-y-3">
      {/* preview */}
      <div className="flex items-center gap-2">
        <div className={cn("p-2 rounded-xl shrink-0", catColor.bg)}>
          <CatIcon className={cn("h-4 w-4", catColor.color)} />
        </div>
        <Input
          placeholder="Nome da categoria"
          value={form.label}
          onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
          className="rounded-xl border-black/8 dark:border-border h-9 text-sm font-bold"
          autoFocus
        />
      </div>

      {/* cores */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Cor</p>
        <div className="flex flex-wrap gap-1.5">
          {COLOR_OPTIONS.map(c => (
            <button key={c.value} type="button"
              onClick={() => setForm(f => ({ ...f, cor: c.value }))}
              title={c.label}
              className={cn(
                "h-7 w-7 rounded-lg border-2 transition-all",
                c.bg,
                form.cor === c.value ? "border-foreground scale-110 shadow" : "border-transparent hover:scale-105"
              )}>
              <span className={cn("block h-3 w-3 rounded-full mx-auto", c.bg.replace("/10", ""))} />
            </button>
          ))}
        </div>
      </div>

      {/* ícones */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Ícone</p>
        <div className="grid grid-cols-6 gap-1.5">
          {ICON_OPTIONS.map(ic => {
            const Ic = ic.Icon;
            return (
              <button key={ic.value} type="button"
                onClick={() => setForm(f => ({ ...f, icone: ic.value }))}
                title={ic.label}
                className={cn(
                  "p-2 rounded-xl border flex items-center justify-center transition-all",
                  form.icone === ic.value
                    ? cn("border-current shadow-sm", catColor.color, catColor.bg)
                    : "border-black/8 dark:border-border hover:bg-muted/40"
                )}>
                <Ic className={cn("h-4 w-4", form.icone === ic.value ? catColor.color : "text-muted-foreground")} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={onSave} disabled={saving || !form.label.trim()}
          className="rounded-xl font-black flex-1">
          {saving ? "..." : isNew ? "Criar" : "Salvar"}
        </Button>
        {!isNew && (
          <Button size="sm" variant="outline" onClick={onCancel} className="rounded-xl font-black">
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────

const BLANK_FORM = {
  titulo: "", descricao: "", categoria: "", prioridade: "media",
  status: "pendente", tags: "", observacoes: "", cliente_id: "", responsavel_id: "",
};

export default function ConsultivoPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading, create, update, remove } = useConsultivos();
  const { users: officeUsers } = useOfficeUsers();
  const membros = useMemo(() => officeUsers.map(u => ({
    id: u.user_id,
    label: u.profile?.full_name || u.profile?.email || "Membro",
  })), [officeUsers]);
  const {
    data: categorias, loading: catLoading,
    create: createCat, update: updateCat, remove: removeCat,
  } = useConsultivoCategorias();

  const [filtroClienteNome, setFiltroClienteNome] = useState<string | null>(null);
  const [filtroClienteId, setFiltroClienteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const dSearch = useDeferredValue(search);
  const [filterCat, setFilterCat] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPri, setFilterPri] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [catMgrOpen, setCatMgrOpen] = useState(false);
  const [editItem, setEditItem] = useState<Consultivo | null>(null);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [saving, setSaving] = useState(false);
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);

  useEffect(() => {
    const s = location.state;
    if (s?.clientFilter) setFiltroClienteNome(s.clientFilter);
    if (s?.clientId) setFiltroClienteId(s.clientId);
  }, [location]);

  useEffect(() => {
    if (!user?.office_id) return;
    supabase.from("clientes").select("id, nome")
      .eq("office_id", user.office_id).eq("deletado", false).order("nome")
      .then(({ data: rows }) => setClientes(rows || []));
  }, [user?.office_id]);

  // effective categories: DB ones if exist, otherwise defaults for UI
  const effectiveCats = categorias.length > 0 ? categorias : DEFAULT_CATS.map((d, i) => ({
    ...d, id: d.valor, office_id: null, ordem: i, created_at: "",
  }));

  function getCatCfg(valor: string) {
    const cat = effectiveCats.find(c => c.valor === valor);
    if (!cat) return { label: valor, cor: "blue", icone: "FileText", valor };
    return cat;
  }

  const total      = data.length;
  const pendentes  = data.filter(c => c.status === "pendente").length;
  const andamento  = data.filter(c => c.status === "em_andamento").length;
  const concluidos = data.filter(c => c.status === "concluido").length;

  const filtered = useMemo(() => data.filter(c => {
    const matchSearch  = !dSearch || c.titulo.toLowerCase().includes(dSearch.toLowerCase()) || (c.descricao || "").toLowerCase().includes(dSearch.toLowerCase());
    const matchCat     = filterCat === "all" || c.categoria === filterCat;
    const matchStatus  = filterStatus === "all" || c.status === filterStatus;
    const matchPri     = filterPri === "all" || c.prioridade === filterPri;
    const matchClient  = !filtroClienteId || c.cliente_id === filtroClienteId;
    return matchSearch && matchCat && matchStatus && matchPri && matchClient;
  }), [data, dSearch, filterCat, filterStatus, filterPri, filtroClienteId]);

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
      responsavel_id: (item as any).responsavel_id || user?.id || "",
    });
    setDialogOpen(true);
  };

  // Abre o consultivo específico vindo de ?openId= (ex.: painel da equipe)
  useOpenItemFromSearch("/consultivo", !loading && data.length > 0, (openId) => {
    const it = data.find(x => String(x.id) === openId);
    if (it) openEdit(it);
  });

  const handleSave = async () => {
    if (!form.titulo.trim()) return;
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
    };
    const ok = editItem ? await update(editItem.id, payload as any) : await create(payload as any);
    setSaving(false);
    if (ok) setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    await remove(id);
    setDialogOpen(false);
    setEditItem(null);
  };

  const handleQuickStatus = async (item: Consultivo, status: string) => {
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
                className="rounded-xl hover:bg-primary/10 hover:text-primary">
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
            <Button variant="outline" size="sm" onClick={() => setCatMgrOpen(true)}
              className="rounded-xl font-bold gap-1.5">
              <Settings className="h-4 w-4" />Categorias
            </Button>
            <Button onClick={openCreate} className="rounded-xl font-black gap-2">
              <Plus className="h-4 w-4" />Novo Consultivo
            </Button>
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
          <StatCard label="Total"        value={total}      Icon={FileText}     color="text-primary"     bg="bg-primary/10" />
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

        {/* list */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
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
            <Button onClick={openCreate} className="rounded-xl font-black gap-2 mt-2">
              <Plus className="h-4 w-4" />Novo Consultivo
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(item => {
              const cat    = getCatCfg(item.categoria);
              const cc     = getColorCfg(cat.cor);
              const CIcon  = getIconEl(cat.icone);
              const priCls = getPriCls(item.prioridade);
              const stCfg  = getStatusCfg(item.status);
              const StIcon = stCfg.Icon;
              return (
                <div key={item.id} className={cn(
                  "group relative bg-card border border-black/5 dark:border-border rounded-2xl shadow-premium hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 overflow-hidden border-l-4",
                  cc.border
                )}>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={cn("mt-0.5 p-2 rounded-xl shrink-0", cc.bg)}>
                          <CIcon className={cn("h-4 w-4", cc.color)} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-base tracking-tight truncate group-hover:text-primary transition-colors">
                            {item.titulo}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-[11px] text-muted-foreground font-medium">{cat.label}</span>
                            {(item as any).clientes?.nome && (
                              <>
                                <span className="text-muted-foreground/30 text-xs">·</span>
                                <button
                                  onClick={() => navigate("/clientes", { state: { clientFilter: (item as any).clientes.nome, clientId: item.cliente_id } })}
                                  className="text-[11px] text-primary font-semibold flex items-center gap-1 hover:underline">
                                  <User className="h-3 w-3" />{(item as any).clientes.nome}
                                </button>
                              </>
                            )}
                            <span className="text-muted-foreground/30 text-xs">·</span>
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />{fmtDate(item.created_at)}
                            </span>
                          </div>
                          {item.descricao && (
                            <p className="text-xs text-muted-foreground/70 mt-1.5 line-clamp-2">{item.descricao}</p>
                          )}
                          {item.tags && item.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {item.tags.slice(0, 4).map(t => (
                                <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0 rounded-md font-semibold">
                                  <Tag className="h-2.5 w-2.5 mr-0.5" />{t}
                                </Badge>
                              ))}
                              {item.tags.length > 4 && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-md font-semibold text-muted-foreground">
                                  +{item.tags.length - 4}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="flex gap-1.5">
                          <Badge variant="outline" className={cn("text-[10px] font-black px-2 py-0.5 rounded-lg border", priCls)}>
                            {PRIORIDADES.find(p => p.value === item.prioridade)?.label ?? item.prioridade}
                          </Badge>
                          <Badge variant="outline" className={cn("text-[10px] font-black px-2 py-0.5 rounded-lg border flex items-center gap-1", stCfg.cls)}>
                            <StIcon className="h-3 w-3" />{stCfg.label}
                          </Badge>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {item.status !== "concluido" && (
                            <Button size="sm" variant="ghost"
                              className="h-7 px-2 text-[10px] font-black rounded-lg text-emerald-600 hover:bg-emerald-500/10"
                              onClick={() => handleQuickStatus(item, "concluido")}>
                              <CheckCircle2 className="h-3 w-3 mr-1" />Concluir
                            </Button>
                          )}
                          <Button size="sm" variant="ghost"
                            className="h-7 px-2 text-[10px] font-black rounded-lg hover:bg-primary/10 hover:text-primary"
                            onClick={() => openEdit(item)}>
                            Editar<ChevronRight className="h-3 w-3 ml-0.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── consultivo dialog ─────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-border shrink-0">
            <DialogTitle className="font-black text-lg">
              {editItem ? "Editar Consultivo" : "Novo Consultivo"}
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Título *</Label>
              <Input placeholder="Ex: Análise de Contrato de Prestação de Serviços"
                value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                className="rounded-xl border-black/8 dark:border-border" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Cliente</Label>
                <ClientSelect value={form.cliente_id || ""} onValueChange={(id) => setForm(f => ({ ...f, cliente_id: id }))} placeholder="Selecionar cliente..." />
              </div>
              {membros.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Responsável</Label>
                  <Select value={form.responsavel_id} onValueChange={v => setForm(f => ({ ...f, responsavel_id: v }))}>
                    <SelectTrigger className="rounded-xl border-black/8 dark:border-border">
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {membros.map(m => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Categoria *</Label>
                <button onClick={() => { setDialogOpen(false); setCatMgrOpen(true); }}
                  className="text-[10px] text-primary font-bold flex items-center gap-1 hover:underline">
                  <Settings className="h-3 w-3" />Gerenciar
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {effectiveCats.map(cat => {
                  const cc   = getColorCfg(cat.cor);
                  const CIcon = getIconEl(cat.icone);
                  return (
                    <button key={cat.valor} type="button"
                      onClick={() => setForm(f => ({ ...f, categoria: cat.valor }))}
                      className={cn(
                        "flex flex-col items-center gap-1 p-2 rounded-xl border text-center transition-all",
                        form.categoria === cat.valor
                          ? cn("border-current shadow-sm", cc.color, cc.bg)
                          : "border-black/8 dark:border-border hover:bg-muted/40"
                      )}>
                      <CIcon className={cn("h-4 w-4", form.categoria === cat.valor ? cc.color : "text-muted-foreground")} />
                      <span className={cn("text-[9px] font-black leading-tight line-clamp-1", form.categoria === cat.valor ? cc.color : "text-muted-foreground")}>
                        {cat.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Prioridade</Label>
                <Select value={form.prioridade} onValueChange={v => setForm(f => ({ ...f, prioridade: v }))}>
                  <SelectTrigger className="rounded-xl border-black/8 dark:border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORIDADES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="rounded-xl border-black/8 dark:border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_MAP.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Descrição</Label>
              <Textarea placeholder="Descreva os detalhes da consulta jurídica..."
                value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                rows={3} className="rounded-xl border-black/8 dark:border-border resize-none" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Observações</Label>
              <Textarea placeholder="Notas internas, conclusões, próximos passos..."
                value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                rows={2} className="rounded-xl border-black/8 dark:border-border resize-none" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Tags <span className="text-muted-foreground/50 normal-case font-medium">(separadas por vírgula)</span>
              </Label>
              <Input placeholder="contrato, revisão, urgente"
                value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                className="rounded-xl border-black/8 dark:border-border" />
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border shrink-0 flex gap-2">
            {editItem && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-rose-500 hover:bg-rose-500/10 rounded-xl mr-auto">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir consultivo?</AlertDialogTitle>
                    <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(editItem.id)}
                      className="rounded-xl bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl font-black" disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} className="rounded-xl font-black" disabled={saving || !form.titulo.trim()}>
              {saving ? "Salvando..." : editItem ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── category manager ──────────────────────────────────────── */}
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

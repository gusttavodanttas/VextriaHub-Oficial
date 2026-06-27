import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useConsultivos, Consultivo } from "@/hooks/useConsultivos";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
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
  ChevronRight, User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const CATEGORIAS = [
  { value: "contratos",      label: "Contratos",      Icon: FileText,       color: "text-blue-500",    bg: "bg-blue-500/10",    border: "border-l-blue-500" },
  { value: "trabalhista",    label: "Trabalhista",    Icon: Users,          color: "text-amber-500",   bg: "bg-amber-500/10",   border: "border-l-amber-500" },
  { value: "tributario",     label: "Tributário",     Icon: TrendingUp,     color: "text-violet-500",  bg: "bg-violet-500/10",  border: "border-l-violet-500" },
  { value: "civil",          label: "Civil",          Icon: Scale,          color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-l-emerald-500" },
  { value: "empresarial",    label: "Empresarial",    Icon: Briefcase,      color: "text-indigo-500",  bg: "bg-indigo-500/10",  border: "border-l-indigo-500" },
  { value: "familiar",       label: "Familiar",       Icon: Users,          color: "text-rose-500",    bg: "bg-rose-500/10",    border: "border-l-rose-500" },
  { value: "criminal",       label: "Criminal",       Icon: AlertTriangle,  color: "text-red-500",     bg: "bg-red-500/10",     border: "border-l-red-500" },
  { value: "previdenciario", label: "Previdenc.",     Icon: Clock,          color: "text-teal-500",    bg: "bg-teal-500/10",    border: "border-l-teal-500" },
];

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

function getCatCfg(value: string) {
  return CATEGORIAS.find(c => c.value === value) ?? CATEGORIAS[3];
}
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

const BLANK_FORM = {
  titulo: "", descricao: "", categoria: "civil", prioridade: "media",
  status: "pendente", tags: "", observacoes: "", cliente_id: "",
};

export default function Consultivo() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading, create, update, remove } = useConsultivos();

  const [filtroClienteNome, setFiltroClienteNome] = useState<string | null>(null);
  const [filtroClienteId, setFiltroClienteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPri, setFilterPri] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
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

  const total      = data.length;
  const pendentes  = data.filter(c => c.status === "pendente").length;
  const andamento  = data.filter(c => c.status === "em_andamento").length;
  const concluidos = data.filter(c => c.status === "concluido").length;

  const filtered = data.filter(c => {
    const matchSearch  = !search || c.titulo.toLowerCase().includes(search.toLowerCase()) || (c.descricao || "").toLowerCase().includes(search.toLowerCase());
    const matchCat     = filterCat === "all" || c.categoria === filterCat;
    const matchStatus  = filterStatus === "all" || c.status === filterStatus;
    const matchPri     = filterPri === "all" || c.prioridade === filterPri;
    const matchClient  = !filtroClienteId || c.cliente_id === filtroClienteId;
    return matchSearch && matchCat && matchStatus && matchPri && matchClient;
  });

  const openCreate = () => {
    setEditItem(null);
    setForm({ ...BLANK_FORM, cliente_id: filtroClienteId || "" });
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
    });
    setDialogOpen(true);
  };

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
    };
    const ok = editItem ? await update(editItem.id, payload) : await create(payload);
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
          <StatCard label="Total"        value={total}      Icon={FileText}     color="text-primary"       bg="bg-primary/10" />
          <StatCard label="Pendentes"    value={pendentes}  Icon={Clock}        color="text-amber-500"     bg="bg-amber-500/10" />
          <StatCard label="Em Andamento" value={andamento}  Icon={TrendingUp}   color="text-blue-500"      bg="bg-blue-500/10" />
          <StatCard label="Concluídos"   value={concluidos} Icon={CheckCircle2} color="text-emerald-500"   bg="bg-emerald-500/10" />
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
              {CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
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
              const priCls = getPriCls(item.prioridade);
              const stCfg  = getStatusCfg(item.status);
              const StIcon = stCfg.Icon;
              return (
                <div key={item.id} className={cn(
                  "group relative bg-card border border-black/5 dark:border-border rounded-2xl shadow-premium hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 overflow-hidden border-l-4",
                  cat.border
                )}>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={cn("mt-0.5 p-2 rounded-xl shrink-0", cat.bg)}>
                          <cat.Icon className={cn("h-4 w-4", cat.color)} />
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
                                  className="text-[11px] text-primary font-semibold flex items-center gap-1 hover:underline"
                                >
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

      {/* dialog */}
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

            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Cliente</Label>
              <Select value={form.cliente_id || "__none__"} onValueChange={v => setForm(f => ({ ...f, cliente_id: v === "__none__" ? "" : v }))}>
                <SelectTrigger className="rounded-xl border-black/8 dark:border-border">
                  <SelectValue placeholder="Selecionar cliente..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem cliente</SelectItem>
                  {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Categoria *</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {CATEGORIAS.map(cat => (
                  <button key={cat.value} type="button"
                    onClick={() => setForm(f => ({ ...f, categoria: cat.value }))}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 rounded-xl border text-center transition-all",
                      form.categoria === cat.value
                        ? cn("border-current shadow-sm", cat.color, cat.bg)
                        : "border-black/8 dark:border-border hover:bg-muted/40"
                    )}>
                    <cat.Icon className={cn("h-4 w-4", form.categoria === cat.value ? cat.color : "text-muted-foreground")} />
                    <span className={cn("text-[9px] font-black leading-tight", form.categoria === cat.value ? cat.color : "text-muted-foreground")}>
                      {cat.label}
                    </span>
                  </button>
                ))}
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
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(editItem.id)}
                      className="rounded-xl bg-destructive hover:bg-destructive/90">
                      Excluir
                    </AlertDialogAction>
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
    </div>
  );
}

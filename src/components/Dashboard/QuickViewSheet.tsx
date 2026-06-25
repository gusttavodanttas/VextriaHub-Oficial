import { useState, useEffect } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle, CalendarCheck, FileText, CheckSquare, Users,
  ArrowRight, Flag, MapPin, Clock, CheckCircle2, ExternalLink,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export type SheetView = "prazos" | "audiencias" | "processos" | "tarefas" | "clientes" | null;

interface Props {
  view: SheetView;
  onClose: () => void;
}

/* ─── helpers ─────────────────────────────────────────── */

function EmptyItem({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
      <CheckCircle2 className="h-8 w-8 text-emerald-500/40" />
      <p className="text-sm text-muted-foreground font-semibold">{label}</p>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-14 rounded-xl bg-muted/30 animate-pulse" />
      ))}
    </div>
  );
}

/* ─── Prazos ───────────────────────────────────────────── */

function PrazosView({ officeId }: { officeId: string }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("prazos")
        .select("id, titulo, data_vencimento, prioridade, status")
        .eq("office_id", officeId)
        .eq("deletado", false)
        .gte("data_vencimento", today)
        .order("data_vencimento", { ascending: true })
        .limit(20);
      setItems(data || []);
      setLoading(false);
    };
    fetch();
  }, [officeId]);

  const prioColor: Record<string, string> = {
    alta: "text-rose-500 bg-rose-500/10",
    media: "text-amber-500 bg-amber-500/10",
    baixa: "text-emerald-600 bg-emerald-500/10",
  };

  const getDaysLabel = (dateStr: string) => {
    const diff = differenceInDays(parseISO(dateStr), new Date());
    if (diff === 0) return { label: "Hoje", cls: "text-red-500 font-black" };
    if (diff === 1) return { label: "Amanhã", cls: "text-orange-500 font-bold" };
    return { label: `em ${diff}d`, cls: "text-muted-foreground" };
  };

  if (loading) return <LoadingRows />;
  if (!items.length) return <EmptyItem label="Nenhum prazo pendente nos próximos dias" />;

  return (
    <div className="space-y-2">
      {items.map((p) => {
        const day = getDaysLabel(p.data_vencimento);
        const pc = prioColor[p.prioridade] || prioColor.media;
        return (
          <div key={p.id}
            className="flex items-center gap-3 p-3 rounded-xl border border-black/5 dark:border-border bg-card/50 hover:bg-muted/20 transition-all"
          >
            <div className={cn("p-1.5 rounded-lg shrink-0", pc.split(" ")[1])}>
              <Flag className={cn("h-3.5 w-3.5", pc.split(" ")[0])} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{p.titulo}</p>
              <p className={cn("text-[11px] mt-0.5", pc.split(" ")[0])}>{p.prioridade}</p>
            </div>
            <div className="text-right shrink-0 space-y-0.5">
              <p className={cn("text-xs", day.cls)}>{day.label}</p>
              <p className="text-[10px] text-muted-foreground/50">
                {format(parseISO(p.data_vencimento), "dd/MM", { locale: ptBR })}
              </p>
            </div>
          </div>
        );
      })}
      <Button variant="outline" className="w-full mt-2 rounded-xl gap-2 font-bold" onClick={() => navigate("/prazos")}>
        Ver todos os prazos <ExternalLink className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

/* ─── Audiências ───────────────────────────────────────── */

function AudienciasView({ officeId }: { officeId: string }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("audiencias")
        .select("id, titulo, data_audiencia, local, processo_id")
        .eq("office_id", officeId)
        .eq("deletado", false)
        .gte("data_audiencia", new Date().toISOString())
        .order("data_audiencia", { ascending: true })
        .limit(20);
      setItems(data || []);
      setLoading(false);
    };
    fetch();
  }, [officeId]);

  if (loading) return <LoadingRows />;
  if (!items.length) return <EmptyItem label="Nenhuma audiência agendada" />;

  return (
    <div className="space-y-2">
      {items.map((a) => {
        const dt = parseISO(a.data_audiencia);
        return (
          <div key={a.id}
            className="flex items-center gap-3 p-3 rounded-xl border border-black/5 dark:border-border bg-card/50 hover:bg-muted/20 transition-all"
          >
            <div className="text-center bg-orange-500/10 rounded-xl px-2.5 py-1.5 shrink-0 min-w-[44px]">
              <p className="text-[9px] font-black text-orange-500 uppercase leading-none">
                {format(dt, "MMM", { locale: ptBR })}
              </p>
              <p className="text-lg font-black text-orange-600 leading-tight">
                {format(dt, "dd")}
              </p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{a.titulo || "Audiência"}</p>
              {a.local && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                  <MapPin className="h-3 w-3 shrink-0" /> {a.local}
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-bold text-muted-foreground">{format(dt, "HH:mm")}</p>
              <p className="text-[10px] text-muted-foreground/50">{format(dt, "EEE", { locale: ptBR })}</p>
            </div>
          </div>
        );
      })}
      <Button variant="outline" className="w-full mt-2 rounded-xl gap-2 font-bold" onClick={() => navigate("/agenda")}>
        Ver agenda completa <ExternalLink className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

/* ─── Processos ────────────────────────────────────────── */

function ProcessosView({ officeId }: { officeId: string }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("processos")
        .select("id, titulo, numero_processo, cliente, status, area")
        .eq("office_id", officeId)
        .eq("deletado", false)
        .eq("status", "Em andamento")
        .order("created_at", { ascending: false })
        .limit(20);
      setItems(data || []);
      setLoading(false);
    };
    fetch();
  }, [officeId]);

  if (loading) return <LoadingRows />;
  if (!items.length) return <EmptyItem label="Nenhum processo em andamento" />;

  return (
    <div className="space-y-2">
      {items.map((p) => (
        <div key={p.id}
          onClick={() => navigate("/processos")}
          className="flex items-start gap-3 p-3 rounded-xl border border-black/5 dark:border-border bg-card/50 hover:bg-muted/20 transition-all cursor-pointer"
        >
          <div className="p-1.5 rounded-lg bg-blue-500/10 shrink-0 mt-0.5">
            <FileText className="h-3.5 w-3.5 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{p.titulo}</p>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{p.cliente}</p>
            {p.numero_processo && (
              <p className="text-[10px] text-muted-foreground/40 font-mono mt-0.5 truncate">{p.numero_processo}</p>
            )}
          </div>
          {p.area && (
            <Badge variant="outline" className="text-[9px] shrink-0 rounded-lg">{p.area}</Badge>
          )}
        </div>
      ))}
      <Button variant="outline" className="w-full mt-2 rounded-xl gap-2 font-bold" onClick={() => navigate("/processos")}>
        Ver todos os processos <ExternalLink className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

/* ─── Tarefas ───────────────────────────────────────────── */

function TarefasView({ officeId }: { officeId: string }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [concluindo, setConcluindo] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("tarefas")
        .select("id, titulo, prioridade, data_vencimento, concluida")
        .eq("office_id", officeId)
        .eq("deletado", false)
        .eq("concluida", false)
        .order("data_vencimento", { ascending: true, nullsFirst: false })
        .limit(20);
      setItems((data || []) as any[]);
      setLoading(false);
    };
    fetch();
  }, [officeId]);

  const concluir = async (id: string) => {
    setConcluindo(id);
    await supabase.from("tarefas").update({ concluida: true }).eq("id", id);
    setItems(prev => prev.filter(t => t.id !== id));
    setConcluindo(null);
  };

  const prioColor: Record<string, string> = {
    alta: "text-rose-500 border-rose-500/20 bg-rose-500/5",
    media: "text-amber-500 border-amber-500/20 bg-amber-500/5",
    baixa: "text-emerald-600 border-emerald-500/20 bg-emerald-500/5",
  };

  if (loading) return <LoadingRows />;
  if (!items.length) return <EmptyItem label="Nenhuma tarefa pendente" />;

  return (
    <div className="space-y-2">
      {items.map((t) => {
        const pc = prioColor[t.prioridade] || prioColor.media;
        return (
          <div key={t.id}
            className="flex items-center gap-3 p-3 rounded-xl border border-black/5 dark:border-border bg-card/50 hover:bg-muted/20 transition-all"
          >
            <button
              onClick={() => concluir(t.id)}
              disabled={concluindo === t.id}
              className="shrink-0 h-5 w-5 rounded border border-muted-foreground/30 hover:border-emerald-500 hover:bg-emerald-500/10 transition-all flex items-center justify-center"
            >
              {concluindo === t.id && (
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{t.titulo}</p>
              {t.data_vencimento && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="h-3 w-3" />
                  {format(new Date(t.data_vencimento + "T12:00:00"), "dd/MM/yyyy")}
                </p>
              )}
            </div>
            <span className={cn("text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border shrink-0", pc)}>
              {t.prioridade || "média"}
            </span>
          </div>
        );
      })}
      <Button variant="outline" className="w-full mt-2 rounded-xl gap-2 font-bold" onClick={() => navigate("/tarefas")}>
        Ver todas as tarefas <ExternalLink className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

/* ─── Clientes ─────────────────────────────────────────── */

function ClientesView({ officeId }: { officeId: string }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("clientes")
        .select("id, nome, email, telefone, tipo_cliente")
        .eq("office_id", officeId)
        .eq("deletado", false)
        .eq("ativo", true)
        .order("nome", { ascending: true })
        .limit(20);
      setItems(data || []);
      setLoading(false);
    };
    fetch();
  }, [officeId]);

  if (loading) return <LoadingRows />;
  if (!items.length) return <EmptyItem label="Nenhum cliente ativo encontrado" />;

  return (
    <div className="space-y-2">
      {items.map((c) => (
        <div key={c.id}
          onClick={() => navigate("/clientes")}
          className="flex items-center gap-3 p-3 rounded-xl border border-black/5 dark:border-border bg-card/50 hover:bg-muted/20 transition-all cursor-pointer"
        >
          <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <span className="text-sm font-black text-emerald-600">
              {c.nome?.charAt(0)?.toUpperCase() || "?"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{c.nome}</p>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{c.email || c.telefone || "—"}</p>
          </div>
          {c.tipo_cliente && (
            <Badge variant="outline" className="text-[9px] shrink-0 rounded-lg capitalize">{c.tipo_cliente}</Badge>
          )}
        </div>
      ))}
      <Button variant="outline" className="w-full mt-2 rounded-xl gap-2 font-bold" onClick={() => navigate("/clientes")}>
        Ver todos os clientes <ExternalLink className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

/* ─── Config por view ──────────────────────────────────── */

const viewConfig: Record<NonNullable<SheetView>, {
  title: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
}> = {
  prazos: {
    title: "Prazos Pendentes",
    description: "Prazos próximos do vencimento",
    icon: AlertCircle,
    iconColor: "text-rose-500",
    iconBg: "bg-rose-500/10",
  },
  audiencias: {
    title: "Audiências",
    description: "Próximas audiências agendadas",
    icon: CalendarCheck,
    iconColor: "text-orange-500",
    iconBg: "bg-orange-500/10",
  },
  processos: {
    title: "Processos Ativos",
    description: "Processos em andamento",
    icon: FileText,
    iconColor: "text-blue-500",
    iconBg: "bg-blue-500/10",
  },
  tarefas: {
    title: "Tarefas Abertas",
    description: "Tarefas pendentes de conclusão",
    icon: CheckSquare,
    iconColor: "text-purple-500",
    iconBg: "bg-purple-500/10",
  },
  clientes: {
    title: "Clientes Ativos",
    description: "Clientes cadastrados no escritório",
    icon: Users,
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-500/10",
  },
};

/* ─── QuickViewSheet ───────────────────────────────────── */

export function QuickViewSheet({ view, onClose }: Props) {
  const { user } = useAuth();
  const officeId = user?.office_id;
  const cfg = view ? viewConfig[view] : null;

  return (
    <Sheet open={!!view} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col p-0 gap-0"
      >
        {cfg && (
          <>
            {/* Header */}
            <SheetHeader className="px-5 pt-6 pb-4 border-b border-black/5 dark:border-border shrink-0">
              <div className="flex items-center gap-3">
                <div className={cn("p-2.5 rounded-xl", cfg.iconBg)}>
                  <cfg.icon className={cn("h-5 w-5", cfg.iconColor)} />
                </div>
                <div>
                  <SheetTitle className="text-base font-black">{cfg.title}</SheetTitle>
                  <SheetDescription className="text-xs mt-0.5">{cfg.description}</SheetDescription>
                </div>
              </div>
            </SheetHeader>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {officeId && (
                <>
                  {view === "prazos"     && <PrazosView officeId={officeId} />}
                  {view === "audiencias" && <AudienciasView officeId={officeId} />}
                  {view === "processos"  && <ProcessosView officeId={officeId} />}
                  {view === "tarefas"    && <TarefasView officeId={officeId} />}
                  {view === "clientes"   && <ClientesView officeId={officeId} />}
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

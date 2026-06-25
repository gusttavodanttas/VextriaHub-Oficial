import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  FileText, Users, AlertCircle, Calendar, CheckSquare,
  Search, Clock, ArrowRight, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

/* ─── Tipos ────────────────────────────────────────────── */

type Group = "processos" | "clientes" | "prazos" | "audiencias" | "tarefas";

interface Result {
  id: string;
  group: Group;
  label: string;
  sub?: string;
  meta?: string;
  badge?: string;
  badgeColor?: string;
  url: string;
}

interface RecentItem {
  id: string;
  label: string;
  group: Group;
  url: string;
}

const RECENT_KEY = "vextria_search_recent";
const MAX_RECENT = 6;

/* ─── Config visual por grupo ──────────────────────────── */

const GROUP: Record<Group, {
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}> = {
  processos:  { label: "Processos",  icon: FileText,    color: "text-blue-500",    bg: "bg-blue-500/10"    },
  clientes:   { label: "Clientes",   icon: Users,       color: "text-emerald-500", bg: "bg-emerald-500/10" },
  prazos:     { label: "Prazos",     icon: AlertCircle, color: "text-rose-500",    bg: "bg-rose-500/10"    },
  audiencias: { label: "Audiências", icon: Calendar,    color: "text-orange-500",  bg: "bg-orange-500/10"  },
  tarefas:    { label: "Tarefas",    icon: CheckSquare, color: "text-purple-500",  bg: "bg-purple-500/10"  },
};

const ORDER: Group[] = ["processos", "clientes", "prazos", "audiencias", "tarefas"];

/* ─── Recentes ──────────────────────────────────────────── */

function getRecents(): RecentItem[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); }
  catch { return []; }
}

function saveRecent(item: RecentItem) {
  const prev = getRecents().filter(r => r.id !== item.id).slice(0, MAX_RECENT - 1);
  localStorage.setItem(RECENT_KEY, JSON.stringify([item, ...prev]));
}

function clearRecents() {
  localStorage.removeItem(RECENT_KEY);
}

/* ─── Highlight ─────────────────────────────────────────── */

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/20 text-primary rounded-sm px-0.5 not-italic font-black">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

/* ─── Row ───────────────────────────────────────────────── */

function ResultRow({ result, query, selected, onSelect }: {
  result: Result; query: string; selected: boolean; onSelect: () => void;
}) {
  const g = GROUP[result.group];
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left group",
        selected ? "bg-primary/8 dark:bg-primary/15" : "hover:bg-muted/40"
      )}
    >
      <div className={cn("p-1.5 rounded-lg shrink-0", g.bg)}>
        <g.icon className={cn("h-3.5 w-3.5", g.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate leading-snug">
          <Highlight text={result.label} query={query} />
        </p>
        {result.sub && (
          <p className="text-[11px] text-muted-foreground/50 truncate mt-0.5">{result.sub}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {result.meta && (
          <span className="text-[10px] text-muted-foreground/35 hidden sm:block">{result.meta}</span>
        )}
        {result.badge && (
          <span className={cn("text-[9px] font-black uppercase px-1.5 py-0.5 rounded-lg capitalize", result.badgeColor)}>
            {result.badge}
          </span>
        )}
        <ArrowRight className={cn(
          "h-3 w-3 transition-colors",
          selected ? "text-primary" : "text-muted-foreground/15 group-hover:text-muted-foreground/40"
        )} />
      </div>
    </button>
  );
}

/* ─── GlobalSearch ──────────────────────────────────────── */

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [recents, setRecents] = useState<RecentItem[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setRecents(getRecents());
      setQuery("");
      setResults([]);
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2 || !user?.office_id) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const oid = user.office_id;
    const t = `%${q.trim()}%`;

    try {
      const [
        { data: proc }, { data: cli }, { data: praz }, { data: aud }, { data: tar },
      ] = await Promise.all([
        supabase.from("processos").select("id, titulo, numero_processo, cliente, area")
          .eq("office_id", oid).eq("deletado", false)
          .or(`titulo.ilike.${t},numero_processo.ilike.${t},cliente.ilike.${t}`).limit(4),
        supabase.from("clientes").select("id, nome, email, tipo_cliente")
          .eq("office_id", oid).eq("deletado", false)
          .or(`nome.ilike.${t},email.ilike.${t}`).limit(4),
        supabase.from("prazos").select("id, titulo, prioridade, data_fim_prazo")
          .eq("office_id", oid).eq("status", "pendente")
          .ilike("titulo", t).limit(4),
        supabase.from("audiencias").select("id, tipo_audiencia, local, data_audiencia")
          .eq("office_id", oid).eq("deletado", false)
          .or(`tipo_audiencia.ilike.${t},local.ilike.${t}`).limit(4),
        supabase.from("tarefas").select("id, titulo, prioridade, data_vencimento")
          .eq("office_id", oid).eq("deletado", false).eq("concluida", false)
          .ilike("titulo", t).limit(4),
      ]);

      const pc = (p?: string | null) =>
        p === "alta" ? "text-rose-500 bg-rose-500/10" :
        p === "media" ? "text-amber-500 bg-amber-500/10" :
        "text-emerald-600 bg-emerald-500/10";

      setResults([
        ...(proc || []).map(p => ({
          id: p.id, group: "processos" as Group, label: p.titulo,
          sub: p.cliente, meta: p.numero_processo || undefined,
          url: "/processos", badge: p.area || undefined,
          badgeColor: "text-blue-500 bg-blue-500/10",
        })),
        ...(cli || []).map(c => ({
          id: c.id, group: "clientes" as Group, label: c.nome,
          sub: c.email || undefined, url: `/clientes?id=${c.id}`,
          badge: c.tipo_cliente || undefined, badgeColor: "text-emerald-600 bg-emerald-500/10",
        })),
        ...(praz || []).map(p => ({
          id: p.id, group: "prazos" as Group, label: p.titulo,
          sub: p.data_fim_prazo
            ? `Vence ${format(parseISO(p.data_fim_prazo), "dd 'de' MMM", { locale: ptBR })}`
            : undefined,
          url: "/prazos", badge: p.prioridade || undefined, badgeColor: pc(p.prioridade),
        })),
        ...(aud || []).map(a => ({
          id: a.id, group: "audiencias" as Group, label: a.tipo_audiencia || "Audiência",
          sub: a.local || undefined,
          meta: a.data_audiencia
            ? format(parseISO(a.data_audiencia), "dd/MM · HH:mm", { locale: ptBR })
            : undefined,
          url: "/agenda",
        })),
        ...(tar || []).map(t => ({
          id: t.id, group: "tarefas" as Group, label: t.titulo,
          sub: t.data_vencimento
            ? `Vence ${format(new Date(t.data_vencimento + "T12:00:00"), "dd 'de' MMM", { locale: ptBR })}`
            : undefined,
          url: "/tarefas", badge: t.prioridade || undefined, badgeColor: pc(t.prioridade),
        })),
      ]);
      setSelectedIdx(0);
    } finally {
      setLoading(false);
    }
  }, [user?.office_id]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  /* Teclado */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
      if (e.key === "Enter" && results.length > 0) { e.preventDefault(); handleSelect(results[selectedIdx]); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, selectedIdx, results]);

  useEffect(() => {
    const el = listRef.current?.querySelectorAll("[data-result]")[selectedIdx] as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  const handleSelect = (r: Result | RecentItem) => {
    saveRecent({ id: r.id, label: r.label, group: r.group, url: r.url });
    onOpenChange(false);
    navigate(r.url);
  };

  const grouped = ORDER.reduce<Record<Group, Result[]>>((acc, g) => {
    acc[g] = results.filter(r => r.group === g);
    return acc;
  }, {} as any);
  const activeGroups = ORDER.filter(g => grouped[g].length > 0);

  const isEmpty = query.trim().length >= 2 && !loading && results.length === 0;
  const showRecents = !query.trim() && recents.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-lg w-[calc(100vw-2rem)] sm:w-full rounded-2xl overflow-hidden border border-black/8 dark:border-border shadow-2xl">

        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-black/5 dark:border-border">
          {loading
            ? <div className="h-4 w-4 rounded-full border-2 border-primary/40 border-t-primary animate-spin shrink-0" />
            : <Search className="h-4 w-4 shrink-0 text-muted-foreground/35" />
          }
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIdx(0); }}
            placeholder="Buscar processos, clientes, prazos..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/30 font-medium py-1"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              onClick={() => { setQuery(""); inputRef.current?.focus(); }}
              className="shrink-0 h-5 w-5 rounded-full bg-muted/60 flex items-center justify-center hover:bg-muted transition-colors"
            >
              <X className="h-3 w-3 text-muted-foreground/50" />
            </button>
          )}
        </div>

        {/* Corpo */}
        <div ref={listRef} className="overflow-y-auto max-h-[55vh] p-2">

          {/* Recentes — só quando input vazio */}
          {showRecents && (
            <div>
              <div className="flex items-center justify-between px-2 py-1.5 mb-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/30 flex items-center gap-1.5">
                  <Clock className="h-3 w-3" /> Pesquisas recentes
                </span>
                <button
                  onClick={() => { clearRecents(); setRecents([]); }}
                  className="text-[9px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors font-semibold"
                >
                  Limpar
                </button>
              </div>
              {recents.map(r => {
                const g = GROUP[r.group];
                return (
                  <button key={r.id} onClick={() => handleSelect(r)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/40 transition-all text-left group"
                  >
                    <div className={cn("p-1.5 rounded-lg shrink-0", g.bg)}>
                      <g.icon className={cn("h-3.5 w-3.5", g.color)} />
                    </div>
                    <span className="text-sm font-semibold truncate flex-1">{r.label}</span>
                    <span className="text-[10px] text-muted-foreground/25 shrink-0">{g.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Placeholder quando sem query e sem recentes */}
          {!query.trim() && !showRecents && (
            <div className="py-10 text-center">
              <Search className="h-7 w-7 text-muted-foreground/15 mx-auto mb-2.5" />
              <p className="text-sm text-muted-foreground/35 font-semibold">Digite para buscar</p>
              <p className="text-xs text-muted-foreground/25 mt-1">Processos, clientes, prazos, audiências e tarefas</p>
            </div>
          )}

          {/* Resultados */}
          {results.length > 0 && (
            <div className="space-y-3">
              {activeGroups.map((g, gi) => {
                const meta = GROUP[g];
                const items = grouped[g];
                const offset = activeGroups.slice(0, gi).reduce((acc, prev) => acc + grouped[prev].length, 0);
                return (
                  <div key={g}>
                    <div className="flex items-center gap-2 px-2 py-1">
                      <meta.icon className={cn("h-3 w-3", meta.color)} />
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/30">
                        {meta.label}
                      </span>
                    </div>
                    {items.map((r, i) => (
                      <div key={r.id} data-result="">
                        <ResultRow
                          result={r} query={query}
                          selected={selectedIdx === offset + i}
                          onSelect={() => handleSelect(r)}
                        />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {/* Vazio */}
          {isEmpty && (
            <div className="py-10 text-center">
              <Search className="h-7 w-7 text-muted-foreground/15 mx-auto mb-2.5" />
              <p className="text-sm font-bold text-muted-foreground/50">Nenhum resultado para "{query}"</p>
              <p className="text-xs text-muted-foreground/30 mt-1">Tente palavras diferentes</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-black/5 dark:border-border px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {[{ keys: ["↑", "↓"], label: "navegar" }, { keys: ["↵"], label: "abrir" }].map(item => (
              <span key={item.label} className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground/25">
                {item.keys.map(k => (
                  <kbd key={k} className="rounded border border-black/8 dark:border-border bg-muted/30 px-1 font-mono text-[9px]">{k}</kbd>
                ))}
                {item.label}
              </span>
            ))}
          </div>
          {results.length > 0 && (
            <p className="text-[10px] text-muted-foreground/25 font-semibold">
              {results.length} resultado{results.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
}

/* ─── Hook ──────────────────────────────────────────────── */

export function useGlobalSearch() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(v => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return { open, setOpen };
}

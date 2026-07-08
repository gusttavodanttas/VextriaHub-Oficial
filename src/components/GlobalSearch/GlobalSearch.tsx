import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText, Users, AlertCircle, Calendar, CheckSquare,
  Search, ArrowRight, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

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

const GROUP: Record<Group, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  processos:  { label: "Processos",  icon: FileText,    color: "text-blue-500",    bg: "bg-blue-500/10"    },
  clientes:   { label: "Clientes",   icon: Users,       color: "text-emerald-500", bg: "bg-emerald-500/10" },
  prazos:     { label: "Prazos",     icon: AlertCircle, color: "text-rose-500",    bg: "bg-rose-500/10"    },
  audiencias: { label: "Audiências", icon: Calendar,    color: "text-orange-500",  bg: "bg-orange-500/10"  },
  tarefas:    { label: "Tarefas",    icon: CheckSquare, color: "text-purple-500",  bg: "bg-purple-500/10"  },
};

const ORDER: Group[] = ["processos", "clientes", "prazos", "audiencias", "tarefas"];

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

export function GlobalSearchBar() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Fecha ao clicar fora */
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  /* Ctrl+K / Cmd+K */
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  /* Busca — usa ilike direto (sem .or()) para evitar problema de parsing do Supabase */
  const search = useCallback(async (q: string) => {
    const term = q.trim();
    if (term.length < 2 || !user?.office_id) {
      setResults([]);
      setLoading(false);
      return;
    }

    const oid = user.office_id;
    const wild = `%${term}%`;
    const pc = (p?: string | null) =>
      p === "alta" ? "text-rose-500 bg-rose-500/10" :
      p === "media" ? "text-amber-500 bg-amber-500/10" :
      "text-emerald-600 bg-emerald-500/10";

    try {
      const [
        { data: procTit },
        { data: cli },
        { data: praz },
        { data: aud },
        { data: tar },
      ] = await Promise.all([
        supabase.from("processos").select("id, titulo, numero_processo")
          .eq("office_id", oid).eq("deletado", false).ilike("titulo", wild).limit(5),
        supabase.from("clientes").select("id, nome, email, tipo_pessoa")
          .eq("office_id", oid).eq("deletado", false).ilike("nome", wild).limit(5),
        supabase.from("prazos").select("id, tipo_prazo, numero_processo, data_fim_prazo, publicacoes(titulo)")
          .eq("office_id", oid).ilike("numero_processo", wild).limit(4),
        supabase.from("audiencias").select("id, titulo, local, data_audiencia")
          .eq("office_id", oid).eq("deletado", false).ilike("titulo", wild).limit(4),
        supabase.from("tarefas").select("id, titulo, prioridade, data_vencimento")
          .eq("office_id", oid).eq("deletado", false).eq("concluida", false).ilike("titulo", wild).limit(4),
      ]);

      setResults([
        ...(procTit || []).map(p => ({
          id: p.id, group: "processos" as Group, label: p.titulo,
          meta: p.numero_processo || undefined,
          url: `/processos?openId=${p.id}`, badgeColor: "text-blue-500 bg-blue-500/10",
        })),
        ...(cli || []).map(c => ({
          id: c.id, group: "clientes" as Group, label: c.nome,
          sub: c.email || undefined, url: `/clientes?openId=${c.id}`,
          badge: c.tipo_pessoa || undefined, badgeColor: "text-emerald-600 bg-emerald-500/10",
        })),
        ...(praz || []).map((p: any) => ({
          id: p.id, group: "prazos" as Group,
          label: p.publicacoes?.titulo || p.tipo_prazo || p.numero_processo || "Prazo",
          sub: p.data_fim_prazo
            ? `Vence ${format(parseISO(p.data_fim_prazo), "dd 'de' MMM", { locale: ptBR })}`
            : undefined,
          meta: p.numero_processo || undefined,
          url: `/prazos?openId=${p.id}`,
        })),
        ...(aud || []).map(a => ({
          id: a.id, group: "audiencias" as Group, label: a.titulo || "Audiência",
          sub: a.local || undefined,
          meta: a.data_audiencia
            ? format(parseISO(a.data_audiencia), "dd/MM · HH:mm", { locale: ptBR })
            : undefined,
          url: `/audiencias?openId=${a.id}`,
        })),
        ...(tar || []).map(t => ({
          id: t.id, group: "tarefas" as Group, label: t.titulo,
          sub: t.data_vencimento
            ? `Vence ${format(new Date(t.data_vencimento + "T12:00:00"), "dd 'de' MMM", { locale: ptBR })}`
            : undefined,
          url: `/tarefas?openId=${t.id}`, badge: t.prioridade || undefined, badgeColor: pc(t.prioridade),
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
    debounceRef.current = setTimeout(() => search(query), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  /* Teclado */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); return; }
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter")     { e.preventDefault(); handleSelect(results[selectedIdx]); }
  };

  const handleSelect = (r: Result) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    navigate(r.url);
  };

  const grouped = ORDER.reduce<Record<Group, Result[]>>((acc, g) => {
    acc[g] = results.filter(r => r.group === g);
    return acc;
  }, {} as any);
  const activeGroups = ORDER.filter(g => grouped[g].length > 0);
  const isEmpty = query.trim().length >= 2 && !loading && results.length === 0;
  const showDropdown = open && (results.length > 0 || isEmpty || (loading && query.trim().length >= 2));
  const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);

  return (
    <div ref={containerRef} className="relative hidden lg:flex flex-1 max-w-xl">

      {/* Input */}
      <div className={cn(
        "flex items-center gap-3 w-full h-11 px-4 rounded-2xl border transition-all duration-200",
        open
          ? "border-primary/40 bg-background shadow-lg shadow-black/5 ring-1 ring-primary/10"
          : "border-black/5 dark:border-border bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.04]"
      )}>
        {loading
          ? <div className="h-3.5 w-3.5 rounded-full border-2 border-primary/40 border-t-primary animate-spin shrink-0" />
          : <Search className="h-3.5 w-3.5 text-muted-foreground/35 shrink-0" />
        }
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setSelectedIdx(0); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar casos, clientes, tarefas..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/30 font-medium"
          autoComplete="off"
          spellCheck={false}
        />
        {query ? (
          <button
            onClick={() => { setQuery(""); setResults([]); inputRef.current?.focus(); }}
            className="shrink-0 h-4 w-4 rounded-full bg-muted/60 flex items-center justify-center hover:bg-muted transition-colors"
          >
            <X className="h-2.5 w-2.5 text-muted-foreground/50" />
          </button>
        ) : (
          <kbd className="shrink-0 hidden xl:flex h-5 items-center gap-0.5 rounded border border-black/8 dark:border-border bg-muted/40 px-1.5 font-mono text-[9px] text-muted-foreground/25">
            {isMac ? "⌘K" : "Ctrl K"}
          </kbd>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute top-[calc(100%+6px)] left-0 right-0 z-[200] rounded-2xl border border-black/8 dark:border-border bg-popover shadow-2xl shadow-black/15 dark:shadow-black/40 overflow-hidden">

          {/* Loading skeleton */}
          {loading && results.length === 0 && (
            <div className="p-3 space-y-2">
              {[1,2,3].map(i => (
                <div key={i} className="flex items-center gap-3 px-2 py-1.5">
                  <div className="h-8 w-8 rounded-lg bg-muted/40 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-2/3 rounded bg-muted/40 animate-pulse" />
                    <div className="h-2.5 w-1/2 rounded bg-muted/30 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Resultados */}
          {results.length > 0 && (
            <div className="p-2 max-h-[60vh] overflow-y-auto space-y-2">
              {activeGroups.map((g, gi) => {
                const meta = GROUP[g];
                const items = grouped[g];
                const offset = activeGroups.slice(0, gi).reduce((acc, prev) => acc + grouped[prev].length, 0);
                return (
                  <div key={g}>
                    <div className="flex items-center gap-1.5 px-2 py-1">
                      <meta.icon className={cn("h-3 w-3", meta.color)} />
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/30">
                        {meta.label}
                      </span>
                    </div>
                    {items.map((r, i) => {
                      const sel = selectedIdx === offset + i;
                      return (
                        <button
                          key={r.id}
                          onClick={() => handleSelect(r)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left group",
                            sel ? "bg-primary/8 dark:bg-primary/15" : "hover:bg-muted/40"
                          )}
                        >
                          <div className={cn("p-1.5 rounded-lg shrink-0", meta.bg)}>
                            <meta.icon className={cn("h-3.5 w-3.5", meta.color)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate leading-snug">
                              <Highlight text={r.label} query={query} />
                            </p>
                            {r.sub && (
                              <p className="text-[11px] text-muted-foreground/50 truncate mt-0.5">{r.sub}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {r.meta && (
                              <span className="text-[10px] text-muted-foreground/35">{r.meta}</span>
                            )}
                            {r.badge && (
                              <span className={cn("text-[9px] font-black uppercase px-1.5 py-0.5 rounded-lg capitalize", r.badgeColor)}>
                                {r.badge}
                              </span>
                            )}
                            <ArrowRight className={cn("h-3 w-3 transition-colors", sel ? "text-primary" : "text-muted-foreground/15 group-hover:text-muted-foreground/40")} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* Vazio */}
          {isEmpty && (
            <div className="py-8 text-center">
              <Search className="h-6 w-6 text-muted-foreground/15 mx-auto mb-2" />
              <p className="text-sm font-bold text-muted-foreground/40">Nenhum resultado para "{query}"</p>
              <p className="text-xs text-muted-foreground/25 mt-0.5">Tente outras palavras</p>
            </div>
          )}

          {/* Footer */}
          {results.length > 0 && (
            <div className="border-t border-black/5 dark:border-border px-4 py-2 flex items-center justify-between bg-muted/5">
              <div className="flex items-center gap-3">
                {[{ keys: ["↑","↓"], label: "navegar" }, { keys: ["↵"], label: "abrir" }, { keys: ["Esc"], label: "fechar" }].map(item => (
                  <span key={item.label} className="flex items-center gap-1 text-[10px] text-muted-foreground/25">
                    {item.keys.map(k => (
                      <kbd key={k} className="rounded border border-black/8 dark:border-border bg-muted/30 px-1 font-mono text-[9px]">{k}</kbd>
                    ))}
                    {item.label}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground/25 font-semibold">
                {results.length} resultado{results.length !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function useGlobalSearch() {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}

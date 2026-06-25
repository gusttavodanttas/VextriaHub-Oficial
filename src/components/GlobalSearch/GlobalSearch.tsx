import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  FileText, Users, AlertCircle, Calendar, CheckSquare,
  Clock, ArrowRight, Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface Result {
  id: string;
  label: string;
  sub?: string;
  group: "processos" | "clientes" | "prazos" | "audiencias" | "tarefas";
  url: string;
  badge?: string;
  badgeColor?: string;
}

const groupMeta: Record<Result["group"], { label: string; icon: React.ElementType; color: string }> = {
  processos:  { label: "Processos",  icon: FileText,    color: "text-blue-500"   },
  clientes:   { label: "Clientes",   icon: Users,       color: "text-emerald-500"},
  prazos:     { label: "Prazos",     icon: AlertCircle, color: "text-rose-500"   },
  audiencias: { label: "Audiências", icon: Calendar,    color: "text-orange-500" },
  tarefas:    { label: "Tarefas",    icon: CheckSquare, color: "text-purple-500" },
};

const ORDER: Result["group"][] = ["processos", "clientes", "prazos", "audiencias", "tarefas"];

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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(
    async (q: string) => {
      if (!q.trim() || !user?.office_id) {
        setResults([]);
        return;
      }
      setLoading(true);
      const oid = user.office_id;
      const term = `%${q}%`;

      const [
        { data: processos },
        { data: clientes },
        { data: prazos },
        { data: audiencias },
        { data: tarefas },
      ] = await Promise.all([
        supabase.from("processos").select("id, titulo, numero_processo, cliente, status")
          .eq("office_id", oid).eq("deletado", false)
          .or(`titulo.ilike.${term},numero_processo.ilike.${term},cliente.ilike.${term}`)
          .limit(5),
        supabase.from("clientes").select("id, nome, email, tipo_cliente")
          .eq("office_id", oid).eq("deletado", false)
          .or(`nome.ilike.${term},email.ilike.${term}`)
          .limit(5),
        supabase.from("prazos").select("id, titulo, status, prioridade")
          .eq("office_id", oid)
          .ilike("titulo", term)
          .limit(5),
        supabase.from("audiencias").select("id, tipo_audiencia, local, data_audiencia")
          .eq("office_id", oid).eq("deletado", false)
          .or(`tipo_audiencia.ilike.${term},local.ilike.${term}`)
          .limit(5),
        supabase.from("tarefas").select("id, titulo, prioridade, concluida")
          .eq("office_id", oid).eq("deletado", false).eq("concluida", false)
          .ilike("titulo", term)
          .limit(5),
      ]);

      const all: Result[] = [
        ...(processos || []).map((p) => ({
          id: p.id, group: "processos" as const,
          label: p.titulo,
          sub: p.cliente + (p.numero_processo ? ` · ${p.numero_processo}` : ""),
          url: "/processos",
          badge: p.status,
          badgeColor: p.status === "Em andamento" ? "text-blue-500 bg-blue-500/10" : "text-muted-foreground bg-muted/50",
        })),
        ...(clientes || []).map((c) => ({
          id: c.id, group: "clientes" as const,
          label: c.nome,
          sub: c.email,
          url: `/clientes?id=${c.id}`,
          badge: c.tipo_cliente,
          badgeColor: "text-emerald-600 bg-emerald-500/10",
        })),
        ...(prazos || []).map((p) => ({
          id: p.id, group: "prazos" as const,
          label: p.titulo,
          sub: p.status,
          url: "/prazos",
          badge: p.prioridade,
          badgeColor: p.prioridade === "alta"
            ? "text-rose-500 bg-rose-500/10"
            : p.prioridade === "media"
            ? "text-amber-500 bg-amber-500/10"
            : "text-emerald-600 bg-emerald-500/10",
        })),
        ...(audiencias || []).map((a) => ({
          id: a.id, group: "audiencias" as const,
          label: a.tipo_audiencia || "Audiência",
          sub: a.local || (a.data_audiencia ? new Date(a.data_audiencia).toLocaleDateString("pt-BR") : undefined),
          url: "/agenda",
        })),
        ...(tarefas || []).map((t) => ({
          id: t.id, group: "tarefas" as const,
          label: t.titulo,
          url: "/tarefas",
          badge: t.prioridade,
          badgeColor: t.prioridade === "alta"
            ? "text-rose-500 bg-rose-500/10"
            : "text-amber-500 bg-amber-500/10",
        })),
      ];

      setResults(all);
      setLoading(false);
    },
    [user?.office_id]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 280);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  // reset ao fechar
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  const handleSelect = (url: string) => {
    onOpenChange(false);
    navigate(url);
  };

  const grouped = ORDER.reduce<Record<string, Result[]>>((acc, g) => {
    const items = results.filter((r) => r.group === g);
    if (items.length) acc[g] = items;
    return acc;
  }, {});

  const totalResults = results.length;
  const groups = Object.keys(grouped) as Result["group"][];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <div className="flex items-center border-b border-black/5 dark:border-border px-4">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground/50 mr-2" />
        <CommandInput
          placeholder="Buscar processos, clientes, prazos..."
          value={query}
          onValueChange={setQuery}
          className="h-13 border-0 focus:ring-0 text-sm bg-transparent placeholder:text-muted-foreground/40 flex-1"
        />
        {loading && (
          <div className="h-3.5 w-3.5 rounded-full border-2 border-primary/40 border-t-primary animate-spin shrink-0" />
        )}
        <kbd className="ml-3 hidden sm:flex h-5 select-none items-center gap-1 rounded border border-black/10 dark:border-border bg-muted/50 px-1.5 font-mono text-[10px] font-medium text-muted-foreground/50 shrink-0">
          ESC
        </kbd>
      </div>

      <CommandList className="max-h-[420px] overflow-y-auto p-2">
        {!query.trim() ? (
          /* Estado inicial: atalhos rápidos */
          <div className="py-4 space-y-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/30 px-2 mb-3">
              Acesso rápido
            </p>
            {ORDER.map((g) => {
              const m = groupMeta[g];
              const urls: Record<string, string> = {
                processos: "/processos", clientes: "/clientes",
                prazos: "/prazos", audiencias: "/agenda", tarefas: "/tarefas",
              };
              return (
                <CommandItem
                  key={g}
                  onSelect={() => handleSelect(urls[g])}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-muted/40 data-[selected=true]:bg-muted/40"
                >
                  <div className={cn("p-1.5 rounded-lg bg-muted/50")}>
                    <m.icon className={cn("h-3.5 w-3.5", m.color)} />
                  </div>
                  <span className="text-sm font-semibold">{m.label}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground/30 ml-auto" />
                </CommandItem>
              );
            })}
          </div>
        ) : totalResults === 0 && !loading ? (
          <CommandEmpty className="py-10 text-center">
            <Search className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-sm font-bold text-muted-foreground">Nenhum resultado para "{query}"</p>
            <p className="text-xs text-muted-foreground/50 mt-1">Tente termos diferentes</p>
          </CommandEmpty>
        ) : (
          groups.map((g, gi) => {
            const m = groupMeta[g];
            return (
              <div key={g}>
                {gi > 0 && <CommandSeparator className="my-2 bg-black/5 dark:bg-muted/20" />}
                <CommandGroup
                  heading={
                    <div className="flex items-center gap-1.5 px-1">
                      <m.icon className={cn("h-3 w-3", m.color)} />
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">
                        {m.label}
                      </span>
                    </div>
                  }
                >
                  {grouped[g].map((r) => (
                    <CommandItem
                      key={r.id}
                      value={`${r.group}-${r.id}-${r.label}`}
                      onSelect={() => handleSelect(r.url)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer data-[selected=true]:bg-muted/40"
                    >
                      <div className="p-1.5 rounded-lg bg-muted/30 shrink-0">
                        <m.icon className={cn("h-3.5 w-3.5", m.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate leading-tight">{r.label}</p>
                        {r.sub && (
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{r.sub}</p>
                        )}
                      </div>
                      {r.badge && (
                        <span className={cn("text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md shrink-0 capitalize", r.badgeColor)}>
                          {r.badge}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </div>
            );
          })
        )}
      </CommandList>

      {/* Footer */}
      <div className="border-t border-black/5 dark:border-border px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground/40">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-black/10 dark:border-border bg-muted/50 px-1 font-mono text-[9px]">↑↓</kbd>
            navegar
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-black/10 dark:border-border bg-muted/50 px-1 font-mono text-[9px]">↵</kbd>
            abrir
          </span>
        </div>
        {query.trim() && totalResults > 0 && (
          <p className="text-[10px] text-muted-foreground/40 font-semibold">
            {totalResults} resultado{totalResults !== 1 ? "s" : ""}
          </p>
        )}
      </div>
    </CommandDialog>
  );
}

/* ─── Trigger hook (Ctrl+K / Cmd+K) ───────────────────── */
export function useGlobalSearch() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return { open, setOpen };
}

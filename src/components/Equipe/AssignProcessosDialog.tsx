import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, CheckSquare, Calendar, FolderPlus, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { getErrorMessage, assertRowsAffected } from "@/lib/errors";
import { useToast } from "@/hooks/use-toast";
import { fmtDate, rowsOrThrow } from "./equipeDetalheShared";

// ─── AssignProcessosDialog (atribuir responsável) ───────────────────────────────

interface AssignItem { id: string; titulo: string; sub: string; responsavel_id: string | null; }
type AssignKind = "processos" | "tarefas" | "audiencias";

const ASSIGN_TABS: { kind: AssignKind; label: string; icon: React.ElementType }[] = [
  { kind: "processos", label: "Processos", icon: FileText },
  { kind: "tarefas", label: "Tarefas", icon: CheckSquare },
  { kind: "audiencias", label: "Audiências", icon: Calendar },
];

/** Diálogo "Atribuir trabalho": define o responsável de processos, tarefas e audiências da equipe. */
export function AssignProcessosDialog({
  open, teamId, officeId, members, defaultMemberId, onClose, onChanged,
}: {
  open: boolean;
  teamId: string;
  officeId: string;
  members: { user_id: string; full_name: string | null; email: string | null }[];
  defaultMemberId?: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [kind, setKind] = useState<AssignKind>("processos");
  const [items, setItems] = useState<AssignItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState<string | null>(null);
  const { toast } = useToast();

  const ids = members.length ? members.map(m => m.user_id) : ["00000000-0000-0000-0000-000000000000"];

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
      const dedup = (rows: any[]) => {
        const seen = new Set<string>();
        return rows.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
      };
      let result: AssignItem[] = [];

      if (kind === "processos") {
        const sel = "id, titulo, numero_processo, responsavel_id";
        const [a, b, c] = await Promise.all([
          supabase.from("processos").select(sel).eq("office_id", officeId).eq("deletado", false).neq("status", "encerrado").eq("team_id", teamId),
          supabase.from("processos").select(sel).eq("office_id", officeId).eq("deletado", false).neq("status", "encerrado").in("responsavel_id", ids),
          supabase.from("processos").select(sel).eq("office_id", officeId).eq("deletado", false).neq("status", "encerrado").in("user_id", ids),
        ]);
        result = dedup([...rowsOrThrow(a), ...rowsOrThrow(b), ...rowsOrThrow(c)])
          .map((p: any) => ({ id: p.id, titulo: p.titulo || "Processo", sub: p.numero_processo || "", responsavel_id: p.responsavel_id }));
      } else if (kind === "tarefas") {
        const sel = "id, titulo, data_vencimento, responsavel_id";
        const [a, b] = await Promise.all([
          supabase.from("tarefas").select(sel).eq("office_id", officeId).eq("deletado", false).in("responsavel_id", ids),
          supabase.from("tarefas").select(sel).eq("office_id", officeId).eq("deletado", false).in("user_id", ids),
        ]);
        result = dedup([...rowsOrThrow(a), ...rowsOrThrow(b)])
          .map((t: any) => ({ id: t.id, titulo: t.titulo || "Tarefa", sub: t.data_vencimento ? `Vence ${fmtDate(t.data_vencimento)}` : "", responsavel_id: t.responsavel_id }));
      } else {
        const sel = "id, titulo, data_audiencia, responsavel_id";
        const [a, b] = await Promise.all([
          supabase.from("audiencias").select(sel).eq("office_id", officeId).eq("deletado", false).in("responsavel_id", ids),
          supabase.from("audiencias").select(sel).eq("office_id", officeId).eq("deletado", false).in("user_id", ids),
        ]);
        result = dedup([...rowsOrThrow(a), ...rowsOrThrow(b)])
          .map((a2: any) => ({ id: a2.id, titulo: a2.titulo || "Audiência", sub: a2.data_audiencia ? fmtDate(a2.data_audiencia) : "", responsavel_id: a2.responsavel_id }));
      }

      if (!cancel) { setItems(result); setLoading(false); }
      } catch (e) {
        if (!cancel) { setItems([]); setLoadError(getErrorMessage(e, "Não foi possível carregar os itens.")); setLoading(false); }
      }
    })();
    return () => { cancel = true; };
  }, [open, kind, teamId, officeId, ids.join(",")]);

  const assign = async (itemId: string, userId: string) => {
    setSavingId(itemId);
    try {
      // RLS bloqueada em UPDATE não gera erro, só casa 0 linhas — sem o
      // .select('id'), o diálogo mostrava "salvo" (check verde) mesmo sem
      // gravar (ex.: coordenador atribuindo item fora da própria equipe).
      const { data, error } = await supabase.from(kind).update({ responsavel_id: userId }).eq("id", itemId).select("id");
      assertRowsAffected(data, error, 1);
      setItems(prev => prev.map(p => p.id === itemId ? { ...p, responsavel_id: userId } : p));
      setJustSaved(itemId);
      setTimeout(() => setJustSaved(s => s === itemId ? null : s), 1500);
      onChanged();
    } catch (e) {
      toast({ title: "Não foi possível atribuir", description: getErrorMessage(e), variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const nameOf = (uid: string | null) => {
    const m = members.find(x => x.user_id === uid);
    return m ? (m.full_name || m.email || "Membro") : null;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent aria-describedby={undefined} className="max-w-lg rounded-2xl p-0 overflow-hidden max-h-[82vh] flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2.5 text-base font-black">
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500"><FolderPlus className="h-4 w-4" /></span>
            Atribuir trabalho
            {defaultMemberId && (
              <span className="text-xs font-bold text-muted-foreground">→ {nameOf(defaultMemberId)}</span>
            )}
          </DialogTitle>
          <p className="text-[11px] text-muted-foreground mt-1">Defina o responsável de cada item da equipe.</p>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3">
          {ASSIGN_TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.kind} type="button" onClick={() => setKind(t.kind)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors",
                  kind === t.kind ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"
                )}>
                <Icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {loading ? (
            [...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
          ) : loadError ? (
            <p className="py-12 text-center text-sm font-bold text-destructive">{loadError}</p>
          ) : items.length === 0 ? (
            <div className="py-12 text-center">
              <FolderPlus className="h-10 w-10 mx-auto mb-2 opacity-20 text-blue-500" />
              <p className="text-sm text-muted-foreground">Nenhum item da equipe aqui ainda.</p>
            </div>
          ) : (
            items.map(p => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{p.titulo}</p>
                  {p.sub && <p className="text-xs text-muted-foreground truncate">{p.sub}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {justSaved === p.id && <Check className="h-4 w-4 text-emerald-500" />}
                  {savingId === p.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  <Select
                    value={p.responsavel_id || ""}
                    onValueChange={(v) => assign(p.id, v)}
                  >
                    <SelectTrigger className="h-9 w-40 rounded-lg text-xs">
                      <SelectValue placeholder="Responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map(m => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.full_name || m.email || "Membro"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-5 py-3 border-t border-border flex justify-end">
          <Button size="sm" onClick={onClose} className="rounded-xl text-xs font-black">Concluído</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

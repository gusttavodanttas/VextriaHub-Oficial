import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronRight, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/errors";
import { DETAIL_CONFIG, fmtDate, getPeriodDates, rowsOrThrow, type DetailType, type Period } from "./equipeDetalheShared";

// ─── TeamDetailDialog (drill-down) ──────────────────────────────────────────────

interface DetailItem {
  id: string;
  primary: string;
  secondary?: string;
  badge?: string;
}

/** Lista os itens por trás de um card do resumo da equipe (processos, tarefas, ...) e abre cada um na sua aba. */
export function TeamDetailDialog({
  type, teamId, memberIds, officeId, period, onClose, onNavigate,
}: {
  type: DetailType | null;
  teamId: string;
  memberIds: string[];
  officeId: string;
  period: Period;
  onClose: () => void;
  onNavigate: (route: string, id?: string) => void;
}) {
  const [items, setItems] = useState<DetailItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!type) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
      const { start, end } = getPeriodDates(period);
      const now = new Date();
      const in7days = new Date(Date.now() + 7 * 864e5).toISOString();
      const in3days = new Date(Date.now() + 3 * 864e5).toISOString().split("T")[0];
      const today = now.toISOString().split("T")[0];
      let result: DetailItem[] = [];

      if (type === "processos") {
        const sel = "id, titulo, numero_processo, status";
        const [byTeam, byResp, byCreator] = await Promise.all([
          supabase.from("processos").select(sel)
            .eq("office_id", officeId).eq("deletado", false).neq("status", "encerrado").eq("team_id", teamId),
          supabase.from("processos").select(sel)
            .eq("office_id", officeId).eq("deletado", false).neq("status", "encerrado").in("responsavel_id", memberIds),
          supabase.from("processos").select(sel)
            .eq("office_id", officeId).eq("deletado", false).neq("status", "encerrado").in("user_id", memberIds),
        ]);
        const seen = new Set<string>();
        result = [...rowsOrThrow(byTeam), ...rowsOrThrow(byResp), ...rowsOrThrow(byCreator)]
          .filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; })
          .map(p => ({ id: p.id, primary: p.titulo || "Processo", secondary: p.numero_processo || "", badge: p.status || undefined }));
      } else if (type === "tarefas") {
        const res = await supabase.from("tarefas").select("id, titulo, data_vencimento")
          .eq("office_id", officeId).eq("deletado", false).eq("concluida", false)
          .in("user_id", memberIds).gte("created_at", start).lte("created_at", end);
        result = rowsOrThrow(res).map(t => ({ id: t.id, primary: t.titulo || "Tarefa", secondary: t.data_vencimento ? `Vence ${fmtDate(t.data_vencimento)}` : "" }));
      } else if (type === "audiencias") {
        const res = await supabase.from("audiencias").select("id, titulo, data_audiencia, local")
          .eq("office_id", officeId).eq("deletado", false)
          .gte("data_audiencia", now.toISOString()).lte("data_audiencia", in7days).in("user_id", memberIds);
        result = rowsOrThrow(res).map(a => ({ id: a.id, primary: a.titulo || "Audiência", secondary: `${fmtDate(a.data_audiencia)}${a.local ? ` · ${a.local}` : ""}` }));
      } else if (type === "prazos") {
        const res = await supabase.from("prazos").select("id, titulo, tipo_prazo, data_fim_prazo, status, deletado")
          .eq("office_id", officeId).gte("data_fim_prazo", today).lte("data_fim_prazo", in3days).in("responsavel_id", memberIds);
        // Sem filtrar, prazo na lixeira/concluído entrava como fantasma no painel da equipe. (v11)
        result = rowsOrThrow(res).filter((p: any) => !p.deletado && p.status !== "concluido")
          .map(p => ({ id: p.id, primary: p.titulo || p.tipo_prazo || "Prazo", secondary: p.data_fim_prazo ? `Fatal ${fmtDate(p.data_fim_prazo)}` : "" }));
      } else if (type === "atendimentos") {
        const res = await supabase.from("atendimentos").select("id, tipo_atendimento, data_atendimento")
          .eq("office_id", officeId).eq("deletado", false)
          .gte("created_at", start).lte("created_at", end).in("user_id", memberIds);
        result = rowsOrThrow(res).map(a => ({ id: a.id, primary: a.tipo_atendimento || "Atendimento", secondary: fmtDate(a.data_atendimento) }));
      } else if (type === "consultivos") {
        const res = await supabase.from("consultivos").select("id, titulo, status")
          .eq("office_id", officeId).eq("deletado", false)
          .gte("created_at", start).lte("created_at", end).in("user_id", memberIds);
        result = rowsOrThrow(res).map(c => ({ id: c.id, primary: c.titulo || "Consultivo", badge: c.status || undefined }));
      }

      if (!cancel) { setItems(result); setLoading(false); }
      } catch (e) {
        if (!cancel) { setItems([]); setLoadError(getErrorMessage(e, "Não foi possível carregar os itens.")); setLoading(false); }
      }
    })();
    return () => { cancel = true; };
  }, [type, teamId, officeId, period, memberIds.join(",")]);

  if (!type) return null;
  const cfg = DETAIL_CONFIG[type];
  const Icon = cfg.icon;

  return (
    <Dialog open={!!type} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent aria-describedby={undefined} className="max-w-lg rounded-2xl p-0 overflow-hidden max-h-[80vh] flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2.5 text-base font-black">
            <span className={cn("p-1.5 rounded-lg bg-muted/50", cfg.color)}><Icon className="h-4 w-4" /></span>
            {cfg.title}
            {!loading && <Badge variant="secondary" className="ml-1">{items.length}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {loading ? (
            [...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)
          ) : loadError ? (
            <p className="py-12 text-center text-sm font-bold text-destructive">{loadError}</p>
          ) : items.length === 0 ? (
            <div className="py-12 text-center">
              <Icon className={cn("h-10 w-10 mx-auto mb-2 opacity-20", cfg.color)} />
              <p className="text-sm text-muted-foreground">Nenhum item encontrado neste período.</p>
            </div>
          ) : (
            items.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(cfg.route, item.id)}
                className="group w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20 hover:bg-primary/5 hover:border-primary/40 transition-all text-left"
              >
                <span className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-background border border-border", cfg.color)}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate group-hover:text-primary transition-colors">{item.primary}</p>
                  {item.secondary && <p className="text-xs text-muted-foreground truncate">{item.secondary}</p>}
                </div>
                {item.badge && <Badge variant="outline" className="shrink-0 text-[10px] capitalize">{item.badge}</Badge>}
                <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            ))
          )}
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">Clique num item para abri-lo</p>
          <Button size="sm" variant="outline" onClick={() => onNavigate(cfg.route)} className="rounded-xl gap-2 text-xs font-black">
            <ExternalLink className="h-3.5 w-3.5" /> Ver todos
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

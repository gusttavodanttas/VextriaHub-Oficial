import React from "react";
import { Consultivo } from "@/hooks/useConsultivos";
import { PermissionGuard } from "@/components/Auth/PermissionGuard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tag, Calendar, CheckCircle2, ChevronRight, User, CalendarClock } from "lucide-react";
import { prazoStatus } from "@/lib/prazo";
import { cn } from "@/lib/utils";
import { PRIORIDADES, fmtDate, getColorCfg, getIconEl, getPriCls, getStatusCfg, type CatCfg } from "./consultivoConfig";

export function StatCard({ label, value, Icon, color, bg }: {
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

interface Props {
  item: Consultivo;
  cat: CatCfg;
  onEdit: (item: Consultivo) => void;
  onQuickStatus: (item: Consultivo, status: string) => void;
  onClienteClick: (nome: string, clienteId: string | null) => void;
}

/** Card de um consultivo na lista: categoria, cliente, prazo, tags, prioridade/status e ações rápidas. */
export function ConsultivoCard({ item, cat, onEdit, onQuickStatus, onClienteClick }: Props) {
  const cc     = getColorCfg(cat.cor);
  const CIcon  = getIconEl(cat.icone);
  const priCls = getPriCls(item.prioridade);
  const stCfg  = getStatusCfg(item.status);
  const StIcon = stCfg.Icon;
  const ps = item.prazo && item.status !== "concluido" ? prazoStatus(item.prazo) : null;
  const clienteNome = item.clientes?.nome;

  return (
    <div className={cn(
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
                {clienteNome && (
                  <>
                    <span className="text-muted-foreground/30 text-xs">·</span>
                    <button
                      onClick={() => onClienteClick(clienteNome, item.cliente_id)}
                      className="text-[11px] text-primary font-semibold flex items-center gap-1 hover:underline">
                      <User className="h-3 w-3" />{clienteNome}
                    </button>
                  </>
                )}
                <span className="text-muted-foreground/30 text-xs">·</span>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />{fmtDate(item.created_at)}
                </span>
                {ps && (
                  <>
                    <span className="text-muted-foreground/30 text-xs">·</span>
                    <span className={cn("text-[11px] flex items-center gap-1", ps.cls)}>
                      <CalendarClock className="h-3 w-3" />{ps.label}
                    </span>
                  </>
                )}
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
            <PermissionGuard permission="canManageConsultivo">
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {item.status !== "concluido" && (
                  <Button size="sm" variant="ghost"
                    className="h-7 px-2 text-[10px] font-black rounded-lg text-emerald-600 hover:bg-emerald-500/10"
                    onClick={() => onQuickStatus(item, "concluido")}>
                    <CheckCircle2 className="h-3 w-3 mr-1" />Concluir
                  </Button>
                )}
                <Button size="sm" variant="ghost"
                  className="h-7 px-2 text-[10px] font-black rounded-lg hover:bg-primary/10 hover:text-primary"
                  onClick={() => onEdit(item)}>
                  Editar<ChevronRight className="h-3 w-3 ml-0.5" />
                </Button>
              </div>
            </PermissionGuard>
          </div>
        </div>
      </div>
    </div>
  );
}

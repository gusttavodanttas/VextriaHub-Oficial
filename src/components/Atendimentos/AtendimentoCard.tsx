// Peças de apresentação da página de Atendimentos (card, stat e visão semanal)
// — extraídas de pages/Atendimentos.tsx sem mudança de comportamento.
import React from "react";
import { format, parseISO, formatDistanceToNow, addDays, startOfWeek, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { fmtSafe } from "@/lib/dates";
import { normalizeAtendimentoStatus } from "@/lib/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Clock, User, Pencil, Trash2, CheckCircle2, Loader2, RotateCcw, Repeat,
  Plus, ChevronLeft, ChevronRight,
} from "lucide-react";
import { STATUS_CONFIG, tipoInfo, proximidadeBadge, type Atendimento } from "./shared";

export const AtendimentoCard: React.FC<{
  item: Atendimento;
  onEdit: (item: Atendimento) => void;
  onDelete: (id: string) => void;
  onMarkRealizado: (id: string) => void;
  onRemarcar: (item: Atendimento) => void;
  onClientClick: (clienteId: string) => void;
  loadingId: string | null;
}> = ({ item, onEdit, onDelete, onMarkRealizado, onRemarcar, onClientClick, loadingId }) => {
  const cfg = STATUS_CONFIG[normalizeAtendimentoStatus(item.status)];
  const { Icon: StatusIcon } = cfg;
  const { label: tipoLabel, Icon: TipoIcon } = tipoInfo(item.tipo_atendimento);
  const dataAt = parseISO(item.data_atendimento);
  const prox = proximidadeBadge(item);

  return (
    <div className="glass-card hover-lift rounded-2xl border border-black/5 dark:border-border bg-card/40 shadow-premium p-5 flex flex-col gap-3 group transition-all">
      {/* Topo: tipo + status + ações */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-all duration-300">
            <TipoIcon className="h-4 w-4" />
          </div>
          <div>
            <p className="font-black text-sm tracking-tight group-hover:text-primary transition-colors">{tipoLabel}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
              {format(dataAt, "dd 'de' MMM 'de' yyyy", { locale: ptBR })} · {format(dataAt, "HH:mm")}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge className={cn("px-2.5 py-1 rounded-xl text-[9px] uppercase tracking-widest font-black flex items-center gap-1", cfg.className)}>
            <StatusIcon className="h-3 w-3" />
            {cfg.label}
          </Badge>
          {prox && (
            <Badge className={cn("px-2 py-0.5 rounded-lg text-[9px] uppercase tracking-widest font-black", prox.className)}>
              {prox.label}
            </Badge>
          )}
          {item.recorrencia_regra && (
            <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground/50" title="Atendimento recorrente">
              <Repeat className="h-2.5 w-2.5" /> Recorrente
            </span>
          )}
        </div>
      </div>

      {/* Duração */}
      {item.duracao != null && item.duracao > 0 && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70 font-semibold -mt-1">
          <Clock className="h-3 w-3 text-primary/50" />
          {item.duracao} min
        </div>
      )}

      {/* Cliente */}
      {item.clientes?.nome && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <User className="h-3.5 w-3.5 text-primary/60" />
          {item.cliente_id ? (
            <button onClick={() => onClientClick(item.cliente_id!)}
              className="font-semibold hover:text-primary hover:underline transition-colors text-left" title="Abrir ficha do cliente">
              {item.clientes.nome}
            </button>
          ) : (
            <span className="font-semibold">{item.clientes.nome}</span>
          )}
        </div>
      )}

      {/* Observações */}
      {item.observacoes && (
        <p className="text-xs text-muted-foreground/80 leading-relaxed line-clamp-2 border-l-2 border-primary/20 pl-3">
          {item.observacoes}
        </p>
      )}

      {/* Resultado / desfecho */}
      {item.resultado && (
        <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-3 py-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600/80 mb-0.5">Resultado</p>
          <p className="text-xs text-muted-foreground/90 leading-relaxed line-clamp-2">{item.resultado}</p>
        </div>
      )}

      {/* Rodapé: tempo relativo + ações */}
      <div className="flex items-center justify-between pt-1 border-t border-black/5 dark:border-border/50">
        <span className="text-[10px] text-muted-foreground/50 font-medium">
          {formatDistanceToNow(dataAt, { locale: ptBR, addSuffix: true })}
        </span>
        <div className="flex gap-1">
          {item.status === "agendado" && (
            <Button size="icon" variant="ghost"
              className="h-7 w-7 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-500"
              onClick={() => onMarkRealizado(item.id)} disabled={loadingId === item.id}
              title="Marcar como realizado">
              {loadingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            </Button>
          )}
          {item.status === "cancelado" && (
            <Button size="icon" variant="ghost"
              className="h-7 w-7 rounded-lg hover:bg-blue-500/10 hover:text-blue-500"
              onClick={() => onRemarcar(item)} title="Remarcar">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button size="icon" variant="ghost"
            className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary"
            onClick={() => onEdit(item)} title="Editar">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost"
            className="h-7 w-7 rounded-lg hover:bg-red-500/10 hover:text-red-500"
            onClick={() => onDelete(item.id)} title="Excluir">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

export const StatCard: React.FC<{ label: string; value: number | string; Icon: React.FC<any>; color: string }> = ({ label, value, Icon, color }) => (
  <div className="glass-card rounded-2xl border border-black/5 dark:border-border bg-card/40 shadow-premium p-3.5 sm:p-5 flex items-center gap-3 sm:gap-4">
    <div className={cn("h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center shrink-0", color)}>
      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
    </div>
    <div className="min-w-0">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 truncate">{label}</p>
      <p className="text-lg sm:text-2xl font-black tracking-tight">{value}</p>
    </div>
  </div>
);

// ─── Week View (agenda semanal) ───────────────────────────────────────────────

export const WeekView: React.FC<{
  items: Atendimento[];
  refDate: Date;
  onPrev: () => void;
  onNext: () => void;
  onHoje: () => void;
  onSelect: (item: Atendimento) => void;
  onNovo: (date: Date) => void;
}> = ({ items, refDate, onPrev, onNext, onHoje, onSelect, onNovo }) => {
  const inicio = startOfWeek(refDate, { weekStartsOn: 0 });
  const dias = Array.from({ length: 7 }, (_, i) => addDays(inicio, i));
  const fim = dias[6];
  const hoje = new Date();
  const porDia = (d: Date) =>
    items
      .filter((it) => isSameDay(parseISO(it.data_atendimento), d))
      .sort((a, b) => parseISO(a.data_atendimento).getTime() - parseISO(b.data_atendimento).getTime());

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Button size="icon" variant="outline" className="h-9 w-9 rounded-xl" onClick={onPrev} title="Semana anterior"><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="icon" variant="outline" className="h-9 w-9 rounded-xl" onClick={onNext} title="Próxima semana"><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" className="h-9 rounded-xl px-3 text-[10px] font-black uppercase tracking-widest" onClick={onHoje}>Hoje</Button>
        </div>
        <p className="text-sm font-black tracking-tight capitalize">
          {format(inicio, "dd MMM", { locale: ptBR })} – {format(fim, "dd MMM yyyy", { locale: ptBR })}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
        {dias.map((d) => {
          const list = porDia(d);
          const isHoje = isSameDay(d, hoje);
          return (
            <div key={d.toISOString()}
              className={cn("rounded-2xl border p-2 min-h-[150px] flex flex-col gap-1.5 transition-colors",
                isHoje ? "border-primary/40 bg-primary/5" : "border-black/5 dark:border-border bg-card/40")}>
              <div className="flex items-center justify-between px-1">
                <div>
                  <p className={cn("text-[10px] font-black uppercase tracking-widest", isHoje ? "text-primary" : "text-muted-foreground/60")}>
                    {format(d, "EEE", { locale: ptBR })}
                  </p>
                  <p className={cn("text-lg font-black leading-none", isHoje && "text-primary")}>{format(d, "dd")}</p>
                </div>
                <button onClick={() => onNovo(d)}
                  className="h-6 w-6 rounded-lg hover:bg-primary/10 text-muted-foreground/40 hover:text-primary flex items-center justify-center transition-colors"
                  title="Novo atendimento neste dia">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex flex-col gap-1 overflow-y-auto">
                {list.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground/30 px-1 py-3 text-center">—</p>
                ) : list.map((it) => {
                  const c = STATUS_CONFIG[normalizeAtendimentoStatus(it.status)];
                  return (
                    <button key={it.id} onClick={() => onSelect(it)}
                      className={cn("text-left rounded-lg border px-2 py-1 transition-all hover:shadow-sm", c.className)}>
                      <p className="text-[10px] font-black leading-tight">{fmtSafe(it.data_atendimento, "HH:mm")}</p>
                      <p className="text-[10px] font-semibold truncate leading-tight">
                        {it.clientes?.nome || tipoInfo(it.tipo_atendimento).label}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

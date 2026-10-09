import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Clock, MessageSquare, BookOpen, ChevronDown, ChevronUp, Crown, ChevronRight, FolderPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { avatarColor, getInitials, type MemberStats } from "./equipeDetalheShared";

// ─── StatCard ─────────────────────────────────────────────────────────────────

export function StatCard({ icon: Icon, label, value, color, onClick }: {
  icon: React.ElementType; label: string; value: number; color: string; onClick?: () => void;
}) {
  const clickable = !!onClick && value > 0;
  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      className={cn(
        "flex items-center gap-3 bg-muted/30 border border-border rounded-xl p-4 text-left w-full transition-all",
        clickable ? "hover:border-primary/40 hover:bg-muted/50 cursor-pointer" : "cursor-default"
      )}
    >
      <div className={cn("p-2 rounded-lg shrink-0", color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-black leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{label}</p>
      </div>
      {clickable && <ChevronRight className="h-4 w-4 text-muted-foreground/40 ml-auto shrink-0" />}
    </button>
  );
}

// ─── MemberCard ───────────────────────────────────────────────────────────────

const rankColors = ["text-amber-500", "text-slate-400", "text-orange-700"];

export function MemberCard({ member, rank, onAssign }: { member: MemberStats; rank: number; onAssign?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const name = member.full_name || member.email || "Membro";
  const totalTarefas = member.tarefasPendentes + member.tarefasConcluidas;
  const progressPct = totalTarefas > 0
    ? Math.round((member.tarefasConcluidas / totalTarefas) * 100)
    : 0;

  return (
    <div className="border border-border rounded-2xl overflow-hidden bg-card transition-shadow hover:shadow-md">
      {/* Header */}
      <div className="flex items-center gap-4 p-5">
        <div className="relative shrink-0">
          <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center text-sm font-black text-white", avatarColor(member.user_id))}>
            {getInitials(name)}
          </div>
          {rank <= 3 && (
            <span className={cn("absolute -top-1.5 -right-1.5 text-xs font-black", rankColors[rank - 1])}>
              #{rank}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold truncate">{name}</p>
            {member.role === "coordinator" && (
              <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
        </div>
        {onAssign && (
          <Button
            size="sm" variant="outline"
            onClick={onAssign}
            className="h-8 rounded-lg shrink-0 gap-1.5 text-xs font-bold"
          >
            <FolderPlus className="h-3.5 w-3.5" /> Atribuir
          </Button>
        )}
        <Button
          size="sm" variant="ghost"
          onClick={() => setExpanded(v => !v)}
          className="h-8 w-8 rounded-lg shrink-0"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {/* Mini stats always visible */}
      <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-border sm:divide-x divide-border">
        {[
          { label: "Processos", value: member.processos, color: "text-blue-500" },
          { label: "Tarefas", value: member.tarefasPendentes, color: "text-violet-500" },
          { label: "Audiências", value: member.audiencias, color: "text-emerald-500" },
          { label: "Prazos", value: member.prazos, color: "text-amber-500" },
        ].map(s => (
          <div key={s.label} className="py-3 text-center">
            <p className={cn("text-lg font-black", s.color)}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Progresso de tarefas */}
          {totalTarefas > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Tarefas concluídas</span>
                <span className="font-bold">{member.tarefasConcluidas}/{totalTarefas} ({progressPct}%)</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Outros indicadores */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted/30 rounded-xl p-3 text-center">
              <MessageSquare className="h-4 w-4 text-rose-500 mx-auto mb-1" />
              <p className="text-base font-black">{member.atendimentos}</p>
              <p className="text-[10px] text-muted-foreground">Atendimentos</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-3 text-center">
              <BookOpen className="h-4 w-4 text-cyan-500 mx-auto mb-1" />
              <p className="text-base font-black">{member.consultivos}</p>
              <p className="text-[10px] text-muted-foreground">Consultivos</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-3 text-center">
              <Clock className="h-4 w-4 text-fuchsia-500 mx-auto mb-1" />
              <p className="text-base font-black">{member.horasTimesheet}h</p>
              <p className="text-[10px] text-muted-foreground">Timesheet</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

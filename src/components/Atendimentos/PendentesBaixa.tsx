// Aviso de atendimentos passados ainda agendados/pendentes (extraído de
// pages/Atendimentos.tsx): mostra até 5 com ações Realizado/Cancelar/Remarcar.
import { AlertCircle, CheckCircle2, XCircle, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PermissionGuard } from "@/components/Auth/PermissionGuard";
import { fmtSafe } from "@/lib/dates";
import { tipoInfo, type Atendimento } from "./shared";

interface Props {
  pendentes: Atendimento[];
  extras: string[];
  loadingId: string | null;
  onRealizado: (id: string) => void;
  onCancelado: (id: string) => void;
  onRemarcar: (item: Atendimento) => void;
}

export function PendentesBaixa({ pendentes, extras, loadingId, onRealizado, onCancelado, onRemarcar }: Props) {
  if (pendentes.length === 0) return null;
  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
        <p className="text-sm font-black text-amber-700 dark:text-amber-500">
          {pendentes.length} atendimento{pendentes.length !== 1 ? "s" : ""} aguardando baixa
        </p>
      </div>
      <p className="text-xs text-muted-foreground/70 -mt-1">
        Atendimentos com data passada ainda marcados como agendados ou pendentes. Confirme o que ocorreu.
      </p>
      <div className="space-y-2">
        {pendentes.slice(0, 5).map((item) => {
          const { label: tLabel, Icon: TIcon } = tipoInfo(item.tipo_atendimento, extras);
          return (
            <div key={item.id} className="flex items-center gap-2 rounded-xl bg-card/60 border border-black/5 dark:border-border px-3 py-2">
              <TIcon className="h-3.5 w-3.5 text-primary/60 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold truncate">
                  {tLabel}{item.clientes?.nome ? ` · ${item.clientes.nome}` : ""}
                </p>
                <p className="text-[10px] text-muted-foreground/60 font-semibold uppercase tracking-wide">
                  {fmtSafe(item.data_atendimento, "dd/MM/yyyy 'às' HH:mm")}
                </p>
              </div>
              <PermissionGuard permission="canEditAtendimentos">
                <Button size="sm" variant="ghost" disabled={loadingId === item.id}
                  onClick={() => onRealizado(item.id)}
                  className="h-7 rounded-lg px-2 text-[10px] font-black uppercase tracking-wide text-emerald-600 hover:bg-emerald-500/10">
                  {loadingId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><CheckCircle2 className="h-3 w-3 mr-1" />Realizado</>}
                </Button>
                <Button size="sm" variant="ghost" disabled={loadingId === item.id}
                  onClick={() => onCancelado(item.id)}
                  className="h-7 rounded-lg px-2 text-[10px] font-black uppercase tracking-wide text-red-500 hover:bg-red-500/10">
                  <XCircle className="h-3 w-3 mr-1" />Cancelar
                </Button>
                <Button size="sm" variant="ghost"
                  onClick={() => onRemarcar(item)}
                  className="h-7 rounded-lg px-2 text-[10px] font-black uppercase tracking-wide text-blue-500 hover:bg-blue-500/10">
                  <RotateCcw className="h-3 w-3 mr-1" />Remarcar
                </Button>
              </PermissionGuard>
            </div>
          );
        })}
        {pendentes.length > 5 && (
          <p className="text-[10px] text-muted-foreground/50 font-bold uppercase tracking-widest pt-1">
            + {pendentes.length - 5} mais
          </p>
        )}
      </div>
    </div>
  );
}

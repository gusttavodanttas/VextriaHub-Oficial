// Card de convite (extraído de pages/Equipe.tsx): e-mail, datas, função/status
// e, para pendentes, renovar ou excluir.
import { Mail, RefreshCw, XCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { Invitation } from "@/types/database";
import { fmtDate, ROLE_LABEL, ROLE_CLS, STATUS_CLS, STATUS_LABEL } from "./shared";

interface Props {
  inv: Invitation;
  onRenovar: (inv: Invitation) => void | Promise<void>;
  onExcluir: (inv: Invitation) => void | Promise<void>;
}

export function ConviteCard({ inv, onRenovar, onExcluir }: Props) {
  return (
    <div className="group flex items-center gap-4 bg-card border border-black/5 dark:border-border rounded-2xl shadow-premium hover:shadow-lg transition-all duration-200 p-4">
      <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 bg-muted/40">
        <Mail className="h-5 w-5 text-muted-foreground/50" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-black text-sm tracking-tight truncate">{inv.email}</p>
        <p className="text-[10px] text-muted-foreground/50 mt-0.5">
          Enviado {fmtDate(inv.created_at)} · Expira {fmtDate(inv.expires_at)}
        </p>
      </div>
      <div className="flex gap-1.5 shrink-0">
        <Badge variant="outline" className={cn("text-[10px] font-black px-2 py-0.5 rounded-lg border", ROLE_CLS[inv.role] ?? ROLE_CLS.user)}>
          {ROLE_LABEL[inv.role] ?? inv.role}
        </Badge>
        <Badge variant="outline" className={cn("text-[10px] font-black px-2 py-0.5 rounded-lg border", STATUS_CLS[inv.status] ?? STATUS_CLS.expired)}>
          {STATUS_LABEL[inv.status] ?? inv.status}
        </Badge>
      </div>
      {inv.status === "pending" && (
        <div className="flex gap-1 shrink-0">
          <Button size="sm" variant="ghost"
            className="h-8 px-2.5 text-[10px] font-black rounded-xl hover:bg-primary/10 hover:text-primary"
            onClick={() => onRenovar(inv)}>
            <RefreshCw className="h-3 w-3 mr-1" />Renovar
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" aria-label="Excluir convite" className="h-8 w-8 rounded-xl text-muted-foreground/50 hover:text-rose-500 hover:bg-rose-500/10">
                <XCircle className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir convite?</AlertDialogTitle>
                <AlertDialogDescription>O convite de {inv.email} será removido permanentemente.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => onExcluir(inv)}
                  className="rounded-xl bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
      {inv.status === "accepted" && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
    </div>
  );
}

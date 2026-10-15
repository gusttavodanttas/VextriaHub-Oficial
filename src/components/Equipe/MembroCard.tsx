// Card de membro do escritório (extraído de pages/Equipe.tsx): avatar, função e,
// para quem gerencia, atalhos de permissões/função/remoção.
import { Mail, Crown, User, Settings2, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { getInitials, avatarColor, fmtDate, ROLE_LABEL, ROLE_CLS } from "./shared";
import { nomeDoMembro, type MembroEquipe } from "./membros";

interface Props {
  membro: MembroEquipe;
  isMe: boolean;
  /** Só admin/dono do escritório vê os atalhos (nunca sobre si mesmo). */
  canManage: boolean;
  onPermissoes: (membro: MembroEquipe) => void;
  onFuncao: (membro: MembroEquipe) => void;
  onRemover: (membro: MembroEquipe) => void | Promise<void>;
}

export function MembroCard({ membro: u, isMe, canManage, onPermissoes, onFuncao, onRemover }: Props) {
  const name = nomeDoMembro(u);
  const email = u.profile?.email || "–";
  const initials = getInitials(name);
  const avatarCls = avatarColor(u.user_id);
  return (
    <div className="group flex items-center gap-4 bg-card border border-black/5 dark:border-border rounded-2xl shadow-premium hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 p-4">
      <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center shrink-0 font-black text-sm", avatarCls)}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-black text-sm tracking-tight truncate">{name}</p>
          {isMe && <span className="text-[9px] font-black uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 rounded">Você</span>}
        </div>
        <p className="text-xs text-muted-foreground/70 flex items-center gap-1 mt-0.5">
          <Mail className="h-3 w-3 shrink-0" />{email}
        </p>
        <p className="text-[10px] text-muted-foreground/50 mt-0.5">Desde {fmtDate(u.joined_at)}</p>
      </div>
      <Badge variant="outline" className={cn("text-[10px] font-black px-2 py-0.5 rounded-lg border shrink-0", ROLE_CLS[u.role] ?? ROLE_CLS.user)}>
        {u.role === "admin" ? <Crown className="h-3 w-3 mr-1 inline" /> : <User className="h-3 w-3 mr-1 inline" />}
        {ROLE_LABEL[u.role] ?? u.role}
      </Badge>
      {!isMe && canManage && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button size="sm" variant="ghost"
            className="h-8 px-2.5 text-[10px] font-black rounded-xl hover:bg-primary/10 hover:text-primary"
            onClick={() => onPermissoes(u)}>
            <Settings2 className="h-3.5 w-3.5 mr-1" />Permissões
          </Button>
          <Button size="sm" variant="ghost"
            className="h-8 px-2.5 text-[10px] font-black rounded-xl hover:bg-muted/60"
            onClick={() => onFuncao(u)}>
            <ShieldCheck className="h-3.5 w-3.5 mr-1" />Função
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" aria-label={`Remover ${name}`}
                className="h-8 w-8 rounded-xl text-muted-foreground/50 hover:text-rose-500 hover:bg-rose-500/10">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Remover {name}?</AlertDialogTitle>
                <AlertDialogDescription>O membro perderá acesso ao escritório.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => onRemover(u)}
                  className="rounded-xl bg-destructive hover:bg-destructive/90">Remover</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}

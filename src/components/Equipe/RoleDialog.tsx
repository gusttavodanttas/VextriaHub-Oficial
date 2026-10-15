// Diálogo "Alterar Função" de um membro (extraído de pages/Equipe.tsx).
import { useEffect, useState } from "react";
import { Crown, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ROLE_LABEL } from "./shared";

export type MembroRole = "user" | "admin";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: { name: string; role: string } | null;
  onSave: (role: MembroRole) => void | Promise<void>;
}

export function RoleDialog({ open, onOpenChange, target, onSave }: Props) {
  const [newRole, setNewRole] = useState<MembroRole>("user");
  // Reinicia a escolha com a função atual sempre que outro membro é aberto.
  useEffect(() => { if (open) setNewRole(target?.role as MembroRole ?? "user"); }, [open, target]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border">
          <DialogTitle className="font-black text-lg">Alterar Função</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-4 space-y-3">
          <p className="text-sm text-muted-foreground">Função de <strong className="text-foreground">{target?.name}</strong>:</p>
          <div className="grid grid-cols-2 gap-2">
            {(["user", "admin"] as const).map(role => (
              <button key={role} type="button" onClick={() => setNewRole(role)}
                className={cn("flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                  newRole === role ? "border-primary bg-primary/5 text-primary" : "border-black/8 dark:border-border hover:bg-muted/40")}>
                {role === "admin" ? <Crown className="h-5 w-5" /> : <User className="h-5 w-5" />}
                <span className="text-xs font-black">{ROLE_LABEL[role]}</span>
              </button>
            ))}
          </div>
        </div>
        <DialogFooter className="px-6 py-4 border-t border-border flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl font-black">Cancelar</Button>
          <Button onClick={() => onSave(newRole)} className="rounded-xl font-black flex-1">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

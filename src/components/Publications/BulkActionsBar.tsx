// Barra flutuante de ações em lote — extraída de pages/Publicacoes.tsx sem mudança de comportamento.
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PermissionGuard } from "@/components/Auth/PermissionGuard";
import { CheckSquare, X } from "lucide-react";

interface Props { count: number; onMarkRead: () => void; onArchive: () => void; onClear: () => void }

export function BulkActionsBar({ count, onMarkRead, onArchive, onClear }: Props) {
  if (count === 0) return null;
  return (
<div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 fade-in duration-500">
  <Card className="glass-card border-primary/20 bg-primary/10 px-6 py-4 rounded-[2rem] shadow-2xl flex items-center gap-6 border-2">
    <div className="flex items-center gap-3 pr-6 border-r border-border text-primary">
      <CheckSquare className="h-5 w-5" />
      <span className="text-sm font-black uppercase tracking-widest">{count} Selecionados</span>
    </div>
    <div className="flex items-center gap-3">
      <PermissionGuard permission="canManagePublicacoes">
      <Button
        size="sm"
        onClick={onMarkRead}
        className="rounded-xl font-black text-[10px] uppercase tracking-widest h-10 px-6"
      >
        Marcar como Lida
      </Button>
      </PermissionGuard>
      <PermissionGuard permission="canManagePublicacoes">
      <Button
        size="sm"
        variant="outline"
        onClick={onArchive}
        className="rounded-xl border-border hover:bg-card font-black text-[10px] uppercase tracking-widest h-10 px-6"
      >
        Arquivar
      </Button>
      </PermissionGuard>
      <Button
        size="sm" 
        variant="ghost" 
        className="rounded-xl h-10 w-10 p-0 text-red-500 hover:bg-red-500/10"
        onClick={onClear}
      >
        <X className="h-5 w-5" />
      </Button>
    </div>
  </Card>
</div>
  );
}

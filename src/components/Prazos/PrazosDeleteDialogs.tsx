// Confirmações de exclusão (item único e em lote) — extraídas de pages/Prazos.tsx.
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';
import type { Prazo } from '@/components/Prazos/shared';

interface Props {
  deleteTarget: Prazo | null;
  onCloseDelete: () => void;
  onConfirmDelete: (id: string) => void;
  excluindo: boolean;
  bulkOpen: boolean;
  setBulkOpen: (open: boolean) => void;
  bulkCount: number;
  onConfirmBulk: () => void;
  excluindoLote: boolean;
}

export function PrazosDeleteDialogs({ deleteTarget, onCloseDelete, onConfirmDelete, excluindo, bulkOpen, setBulkOpen, bulkCount, onConfirmBulk, excluindoLote }: Props) {
  return (
    <>
      <AlertDialog open={!!deleteTarget} onOpenChange={onCloseDelete}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" /> Excluir prazo?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O prazo <strong>"{deleteTarget?.titulo}"</strong> será excluído permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && onConfirmDelete(deleteTarget.id)}
              disabled={excluindo}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      
      <AlertDialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" /> Excluir {bulkCount} prazo{bulkCount !== 1 ? 's' : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Os prazos selecionados serão movidos para a lixeira (recuperáveis).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmBulk}
              disabled={excluindoLote}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

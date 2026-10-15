// Confirmações de arquivar (item único e em lote) — extraídas de pages/Publicacoes.tsx
// sem mudança de comportamento. Arquivar sai das listas ativas e só o suporte restaura.
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  confirmArchiveId: string | null;
  onCloseSingle: () => void;
  onConfirmSingle: () => void;
  confirmBulkArchive: boolean;
  setConfirmBulkArchive: (open: boolean) => void;
  bulkCount: number;
  onConfirmBulk: () => void;
}

export function ArchiveConfirmDialogs({ confirmArchiveId, onCloseSingle, onConfirmSingle, confirmBulkArchive, setConfirmBulkArchive, bulkCount, onConfirmBulk }: Props) {
  return (
    <>
    <AlertDialog open={!!confirmArchiveId} onOpenChange={(open) => !open && onCloseSingle()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Arquivar publicação?</AlertDialogTitle>
          <AlertDialogDescription>
            Ela sairá das listagens ativas. Só o suporte pode restaurá-la — não há desfazer automático.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirmSingle}>Arquivar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Confirmação de arquivar em lote */}
    <AlertDialog open={confirmBulkArchive} onOpenChange={setConfirmBulkArchive}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Arquivar {bulkCount} publicações?</AlertDialogTitle>
          <AlertDialogDescription>
            Elas sairão das listagens ativas. Só o suporte pode restaurá-las — não há desfazer automático.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirmBulk}
          >
            Arquivar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

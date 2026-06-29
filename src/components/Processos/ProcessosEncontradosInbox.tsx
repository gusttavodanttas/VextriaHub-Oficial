import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, X, Scale, Search, Sparkles } from "lucide-react";
import { useProcessosEncontrados, ProcessoEncontrado } from "@/hooks/useProcessosEncontrados";
import { useProcessosV2 } from "@/hooks/useProcessosV2";
import { useToast } from "@/hooks/use-toast";
import { formatCNJ } from "@/utils/formatCNJ";

export function ProcessosEncontradosInbox({ onImported, onBuscar }: { onImported?: () => void; onBuscar?: () => void }) {
  const { items, loading, remover, descartar } = useProcessosEncontrados();
  const { create } = useProcessosV2();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const adicionar = async (item: ProcessoEncontrado) => {
    setBusy(item.id);
    try {
      const p = item.payload || {};
      await create({ ...p, titulo: p.titulo || item.titulo || "Processo", numeroProcesso: item.numero_processo });
      await remover(item.id);
      toast({ title: "Processo adicionado", description: "Incluído na sua base." });
      onImported?.();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao adicionar", description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary/40" /></div>;
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
          <Search className="h-7 w-7 text-muted-foreground/40" />
        </div>
        <p className="font-bold">Nenhum processo encontrado aguardando</p>
        <p className="text-sm text-muted-foreground mt-1">Rode a <strong>Sincronização por OAB</strong> para o robô buscar processos novos.</p>
        {onBuscar && (
          <Button onClick={onBuscar} className="rounded-xl font-bold gap-2 mt-4"><Sparkles className="h-4 w-4" /> Buscar agora</Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <p className="text-xs text-muted-foreground font-medium px-1">
        O robô encontrou <strong className="text-foreground">{items.length}</strong> processo(s) ainda não cadastrado(s). Revise antes de adicionar.
      </p>
      {items.map((item) => (
        <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-black/5 dark:border-border bg-black/[0.01] dark:bg-white/[0.01] hover:border-primary/30 transition-all">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Scale className="h-4 w-4 text-primary shrink-0" />
              <p className="font-bold text-sm truncate">{item.titulo || "Processo"}</p>
              {item.tribunal && (
                <span className="shrink-0 px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-[10px] font-black uppercase tracking-wide">
                  {item.tribunal.toUpperCase()}
                </span>
              )}
            </div>
            <p className="text-[11px] font-mono text-muted-foreground">{formatCNJ(item.numero_processo)}</p>
            {(item.autor || item.reu) && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {item.autor || "—"}{item.reu ? ` × ${item.reu}` : ""}
              </p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" onClick={() => adicionar(item)} disabled={busy === item.id} className="rounded-xl font-bold gap-1.5">
              {busy === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Adicionar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => descartar(item)} disabled={busy === item.id} className="rounded-xl font-bold text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1.5">
              <X className="h-4 w-4" /> Descartar
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

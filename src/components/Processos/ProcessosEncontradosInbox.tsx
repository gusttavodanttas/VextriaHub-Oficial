import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, X, Scale, Search, Sparkles } from "lucide-react";
import { useProcessosEncontrados, ProcessoEncontrado } from "@/hooks/useProcessosEncontrados";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errors";
import { formatCNJ } from "@/utils/formatCNJ";
import { tribunalFromCNJ } from "@/utils/tribunalCNJ";
import { NovoProcessoDialog } from "./NovoProcessoDialog";

// Limpa títulos tipo "x", "NOME x" (parte vazia) → usa nome disponível ou o nº do processo
function cleanTitulo(t: string | null, numero: string): string {
  let s = (t || "").replace(/\s+/g, " ").trim();
  s = s.replace(/\s*x\s*$/i, "").replace(/^x\s*/i, "").trim();
  if (!s || s.toLowerCase() === "x") return `Processo ${formatCNJ(numero)}`;
  return s;
}

// Monta os dados iniciais do formulário a partir do processo encontrado
function buildInitialData(item: ProcessoEncontrado) {
  const p = item.payload || {};
  return {
    titulo: cleanTitulo(item.titulo, item.numero_processo),
    numeroProcesso: item.numero_processo,
    tribunal: tribunalFromCNJ(item.numero_processo) || p.tribunal || item.tribunal || "",
    vara: p.vara || p.orgaoJulgador || "",
    comarca: p.comarca || "",
    parteAutora: p.autor || p.parteAutora || item.autor || "",
    requerido: p.reu || p.requerido || item.reu || "",
    valorCausa: typeof p.valorCausa === "number" ? p.valorCausa : Number(p.valorCausa) || 0,
    descricao: p.assuntoPrincipal || p.assunto || p.classeJudicial || "",
  } as any;
}

export function ProcessosEncontradosInbox({ onChange, onBuscar }: { onChange?: () => void; onBuscar?: () => void }) {
  const { items, loading, descartar, remover } = useProcessosEncontrados();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [addItem, setAddItem] = useState<ProcessoEncontrado | null>(null);

  const handleDescartar = async (item: ProcessoEncontrado) => {
    setBusy(item.id);
    try {
      await descartar(item);
      onChange?.();
      toast({ title: "Processo descartado", description: "Não vai mais aparecer nas próximas buscas." });
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Erro ao descartar", description: getErrorMessage(e) });
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
      {items.map((item) => {
        const sigla = tribunalFromCNJ(item.numero_processo) || (item.tribunal || "").toUpperCase();
        return (
          <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-black/5 dark:border-border bg-black/[0.01] dark:bg-white/[0.01] hover:border-primary/30 transition-all">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Scale className="h-4 w-4 text-primary shrink-0" />
                <p className="font-bold text-sm truncate">{cleanTitulo(item.titulo, item.numero_processo)}</p>
                {sigla && (
                  <span className="shrink-0 px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-[10px] font-black uppercase tracking-wide">
                    {sigla}
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
              <Button size="sm" onClick={() => setAddItem(item)} disabled={busy === item.id} className="rounded-xl font-bold gap-1.5">
                <Plus className="h-4 w-4" /> Adicionar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleDescartar(item)} disabled={busy === item.id} className="rounded-xl font-bold text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1.5">
                {busy === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Descartar
              </Button>
            </div>
          </div>
        );
      })}

      {/* Ao "Adicionar": abre o modal do processo pré-preenchido para completar o que falta antes de salvar */}
      {addItem && (
        <NovoProcessoDialog
          key={addItem.id}
          open
          onOpenChange={(o) => { if (!o) setAddItem(null); }}
          initialStep="form"
          initialData={buildInitialData(addItem)}
          onSuccess={async () => {
            const current = addItem;
            // Remove da caixa (já foi salvo na base) e atualiza contagem
            if (current) await remover(current.id);
            onChange?.();
            setAddItem(null);
          }}
        />
      )}
    </div>
  );
}

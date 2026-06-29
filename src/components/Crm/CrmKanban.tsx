import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Mail, Phone, MessageCircle, GripVertical } from "lucide-react";
import { formatPhone } from "@/lib/phone";
import { onlyDigits } from "@/lib/document";
import { cn } from "@/lib/utils";
import type { ClienteComProcessos } from "@/types/database";

const COLUNAS = [
  { key: "lead", label: "Novos", accent: "border-slate-400/40", dot: "bg-slate-400" },
  { key: "frio", label: "Frios", accent: "border-blue-500/40", dot: "bg-blue-500" },
  { key: "morno", label: "Mornos", accent: "border-amber-500/40", dot: "bg-amber-500" },
  { key: "quente", label: "Quentes", accent: "border-orange-500/40", dot: "bg-orange-500" },
  { key: "convertido", label: "Convertidos", accent: "border-emerald-500/40", dot: "bg-emerald-500" },
];

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

interface Props {
  data: ClienteComProcessos[];
  refresh?: () => void;
  onCardClick?: (lead: any) => void;
}

export function CrmKanban({ data, refresh, onCardClick }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>(data);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  // Mantém o estado local em sincronia com os dados reais
  useEffect(() => { setItems(data); }, [data]);

  const move = async (id: string, novoStatus: string) => {
    const atual = items.find(i => i.id === id);
    if (!atual || (atual.status || "") === novoStatus) return;
    if (!user?.office_id) return;
    // Otimista: move na hora
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: novoStatus } : i));
    const { error } = await supabase.from("clientes").update({ status: novoStatus }).eq("id", id).eq("office_id", user.office_id);
    if (error) {
      setItems(prev => prev.map(i => i.id === id ? { ...i, status: atual.status } : i)); // desfaz
      toast({ title: "Erro ao mover", description: error.message, variant: "destructive" });
      return;
    }
    refresh?.();
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUNAS.map(col => {
        const cards = items.filter(i => (i.status || "").toLowerCase() === col.key);
        const total = cards.reduce((s, c) => s + (Number(c.valor_estimado) || 0), 0);
        return (
          <div
            key={col.key}
            onDragOver={(e) => { e.preventDefault(); setOverCol(col.key); }}
            onDragLeave={() => setOverCol(prev => prev === col.key ? null : prev)}
            onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (id) move(id, col.key); setOverCol(null); setDragId(null); }}
            className={cn(
              "shrink-0 w-72 rounded-2xl border bg-muted/20 p-3 transition-colors",
              overCol === col.key ? "border-primary/40 bg-primary/5" : "border-black/5 dark:border-border"
            )}
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className={cn("h-2.5 w-2.5 rounded-full", col.dot)} />
                <p className="text-[11px] font-black uppercase tracking-widest">{col.label}</p>
                <span className="text-[11px] font-bold text-muted-foreground/50">{cards.length}</span>
              </div>
              {total > 0 && <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">{brl(total)}</span>}
            </div>

            <div className="space-y-2 min-h-[80px]">
              {cards.map(card => (
                <div
                  key={card.id}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData("text/plain", card.id); setDragId(card.id); }}
                  onDragEnd={() => { setDragId(null); setOverCol(null); }}
                  onClick={() => onCardClick?.(card)}
                  className={cn(
                    "group rounded-xl border bg-card p-3 cursor-grab active:cursor-grabbing hover:border-primary/30 transition-all",
                    col.accent,
                    dragId === card.id && "opacity-40"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm truncate group-hover:text-primary transition-colors">{card.nome}</p>
                      {card.email && <p className="flex items-center gap-1 text-[10px] text-muted-foreground/60 truncate mt-0.5"><Mail className="h-2.5 w-2.5 shrink-0" />{card.email}</p>}
                      {card.telefone && (
                        <p className="flex items-center gap-1 text-[10px] text-muted-foreground/60 mt-0.5 font-mono">
                          <Phone className="h-2.5 w-2.5 shrink-0" />{formatPhone(card.telefone)}
                          <a href={`https://wa.me/55${onlyDigits(card.telefone)}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="ml-auto text-emerald-600 dark:text-emerald-400" title="WhatsApp">
                            <MessageCircle className="h-3 w-3" />
                          </a>
                        </p>
                      )}
                      {Number(card.valor_estimado) > 0 && (
                        <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 mt-1">{brl(Number(card.valor_estimado))}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {cards.length === 0 && (
                <div className="text-center py-6 text-[10px] text-muted-foreground/30 font-bold uppercase tracking-widest border border-dashed border-border rounded-xl">
                  Arraste aqui
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

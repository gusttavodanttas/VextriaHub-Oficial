import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Loader2, Plus, Megaphone } from "lucide-react";
import { useOfficeSettingList } from "@/hooks/useOfficeSettingList";

const ORIGENS_DEFAULT = [
  "Indicação",
  "Marketing Digital",
  "Redes Sociais",
  "Site",
  "Telefone",
  "Presencial",
  "Outros",
];

export const ClientOriginConfig = () => {
  const { items: origensCliente, loading, saving, persist } = useOfficeSettingList<string>("origens_cliente", ORIGENS_DEFAULT);
  const [novaOrigem, setNovaOrigem] = useState("");

  const jaExiste = origensCliente.some((o) => o.toLowerCase() === novaOrigem.trim().toLowerCase());

  const adicionarNovaOrigem = () => {
    const v = novaOrigem.trim();
    if (v && !jaExiste) {
      persist([...origensCliente, v]);
      setNovaOrigem("");
    }
  };
  const removerOrigem = (origem: string) => persist(origensCliente.filter((o) => o !== origem));

  return (
    <Card className="glass-card rounded-[2rem] border-black/5 dark:border-border overflow-hidden shadow-premium">
      <CardHeader className="border-b border-black/5 dark:border-border pb-4 flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-black flex items-center gap-2">
              Origens de Cliente
              {(loading || saving) && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </CardTitle>
            <CardDescription className="text-xs font-medium">Canais de captação disponíveis no cadastro</CardDescription>
          </div>
        </div>
        <Badge variant="secondary" className="rounded-full font-black shrink-0">{origensCliente.length}</Badge>
      </CardHeader>

      <CardContent className="p-5 md:p-6 space-y-5">
        <div className="flex flex-wrap gap-2">
          {!loading && origensCliente.length === 0 && (
            <p className="text-sm text-muted-foreground font-medium py-4">Nenhuma origem cadastrada.</p>
          )}
          {origensCliente.map((origem) => (
            <span
              key={origem}
              className="group inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full border border-black/5 dark:border-border bg-black/[0.02] dark:bg-white/[0.03] text-sm font-bold hover:border-primary/30 transition-all"
            >
              {origem}
              <button
                onClick={() => removerOrigem(origem)}
                disabled={saving}
                aria-label={`Remover ${origem}`}
                className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>

        <div className="rounded-2xl border border-dashed border-black/10 dark:border-border bg-black/[0.01] dark:bg-white/[0.01] p-4 space-y-2">
          <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/60">Adicionar origem</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Ex: Google Ads, Parceria…"
              value={novaOrigem}
              onChange={(e) => setNovaOrigem(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && adicionarNovaOrigem()}
              className="h-11 rounded-xl flex-1"
            />
            <Button
              type="button"
              onClick={adicionarNovaOrigem}
              disabled={saving || !novaOrigem.trim() || jaExiste}
              className="h-11 rounded-xl font-bold px-5"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Adicionar
            </Button>
          </div>
          {jaExiste && novaOrigem.trim() && (
            <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">Essa origem já existe.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

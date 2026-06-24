
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

const origensClienteBase = [
  "Indicação",
  "Marketing Digital",
  "Redes Sociais",
  "Site",
  "Telefone",
  "Presencial",
  "Outros"
];

export const ClientOriginConfig = () => {
  const [origensCliente, setOrigensCliente] = useState<string[]>(origensClienteBase);
  const [novaOrigem, setNovaOrigem] = useState("");

  const adicionarNovaOrigem = () => {
    if (novaOrigem.trim() && !origensCliente.includes(novaOrigem.trim())) {
      const novasOrigens = [...origensCliente, novaOrigem.trim()];
      setOrigensCliente(novasOrigens);
      setNovaOrigem("");
    }
  };

  const removerOrigem = (origem: string) => {
    if (!origensClienteBase.includes(origem)) {
      setOrigensCliente(prev => prev.filter(o => o !== origem));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Origens de Cliente</CardTitle>
        <CardDescription>
          Gerencie as opções de origem disponíveis para os clientes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Origens Disponíveis</Label>
          <div className="flex flex-wrap gap-2">
            {origensCliente.map((origem) => (
              <Badge key={origem} variant="secondary" className="flex items-center gap-1">
                {origem}
                {!origensClienteBase.includes(origem) && (
                  <button
                    onClick={() => removerOrigem(origem)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
        </div>
        
        <div className="flex gap-2">
          <Input
            placeholder="Nova origem..."
            value={novaOrigem}
            onChange={(e) => setNovaOrigem(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && adicionarNovaOrigem()}
            className="flex-1"
          />
          <Button
            type="button"
            onClick={adicionarNovaOrigem}
            disabled={!novaOrigem.trim() || origensCliente.includes(novaOrigem.trim())}
          >
            Adicionar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

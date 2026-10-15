// Passo "Buscar por CNJ" do "Novo Processo" — extraído de NovoProcessoDialog.tsx.
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Loader2 } from 'lucide-react';
import { maskCNJ } from '@/utils/formatCNJ';

interface Props { cnjInput: string; setCnjInput: (v: string) => void; isLoading: boolean; onBuscar: () => void }

export function BuscaCnj({ cnjInput, setCnjInput, isLoading, onBuscar }: Props) {
  return (
  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
    <div className="text-center space-y-2">
       <h3 className="text-xl font-bold text-foreground">Busca Automática CNJ</h3>
       <p className="text-sm text-muted-foreground">Informe o número do processo para preenchimento inteligente</p>
    </div>

    <div className="max-w-md mx-auto space-y-4">
      <div className="space-y-2">
        <Label>Número do Processo (CNJ)</Label>
        <Input
          placeholder="0000000-00.0000.0.00.0000"
          value={cnjInput}
          onChange={(e) => setCnjInput(maskCNJ(e.target.value))}
          className="h-12 rounded-xl font-mono text-center tracking-widest text-lg"
        />
      </div>
      <Button
        className="w-full h-12 rounded-xl font-bold"
        onClick={onBuscar}
        disabled={isLoading || cnjInput.length < 15}
      >
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Search className="h-5 w-5 mr-2" />}
        {isLoading ? "Buscando dados..." : "Buscar e Avançar"}
      </Button>
    </div>
  </div>
  );
}

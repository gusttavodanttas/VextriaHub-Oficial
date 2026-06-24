
import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  cases: number;
  status: string;
  lastContact: string;
  cpfCnpj: string;
  tipoPessoa: "fisica" | "juridica";
  origem: string;
  endereco: string;
  dataAniversario: string;
  processosAtivos?: number;
  processosEncerrados?: number;
}

interface EditClientDialogProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (client: Client) => void;
  onDelete?: (clientId: string) => void;
}

const origensCliente = [
  "Indicação",
  "Marketing Digital",
  "Redes Sociais",
  "Site",
  "Telefone",
  "Presencial",
  "Outros"
];

// Função mock para calcular processos - em um sistema real, isso viria do backend
const calcularProcessos = (clienteId: number) => {
  // Simulação de cálculo baseado no ID do cliente
  const processosAtivos = clienteId === 1 ? 2 : clienteId === 2 ? 1 : clienteId === 3 ? 0 : 0;
  const processosEncerrados = clienteId === 1 ? 1 : clienteId === 2 ? 0 : clienteId === 3 ? 2 : 0;
  
  return { processosAtivos, processosEncerrados };
};

export const EditClientDialog = ({ client, open, onOpenChange, onSave, onDelete }: EditClientDialogProps) => {
  const [formData, setFormData] = useState<Client | null>(client);

  useEffect(() => {
    if (client) {
      const { processosAtivos, processosEncerrados } = calcularProcessos(client.id);
      setFormData({
        ...client,
        processosAtivos,
        processosEncerrados,
        cases: processosAtivos + processosEncerrados
      });
    } else {
      setFormData(client);
    }
  }, [client]);

  if (!formData) return null;

  const handleSave = () => {
    onSave(formData);
    onOpenChange(false);
  };

  const toggleStatus = () => {
    setFormData(prev => prev ? {
      ...prev,
      status: prev.status === "ativo" ? "inativo" : "ativo"
    } : null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Cliente</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Nome *
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => prev ? { ...prev, name: e.target.value } : null)}
              className="col-span-3"
              required
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">
              Tipo de Pessoa *
            </Label>
            <div className="col-span-3">
              <RadioGroup
                value={formData.tipoPessoa}
                onValueChange={(value: "fisica" | "juridica") => 
                  setFormData(prev => prev ? { ...prev, tipoPessoa: value } : null)
                }
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="fisica" id="fisica" />
                  <Label htmlFor="fisica">Pessoa Física</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="juridica" id="juridica" />
                  <Label htmlFor="juridica">Pessoa Jurídica</Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="cpfCnpj" className="text-right">
              {formData.tipoPessoa === "fisica" ? "CPF *" : "CNPJ *"}
            </Label>
            <Input
              id="cpfCnpj"
              value={formData.cpfCnpj}
              onChange={(e) => setFormData(prev => prev ? { ...prev, cpfCnpj: e.target.value } : null)}
              className="col-span-3"
              placeholder={formData.tipoPessoa === "fisica" ? "000.000.000-00" : "00.000.000/0000-00"}
              required
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="email" className="text-right">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => prev ? { ...prev, email: e.target.value } : null)}
              className="col-span-3"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="phone" className="text-right">
              Telefone
            </Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData(prev => prev ? { ...prev, phone: e.target.value } : null)}
              className="col-span-3"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="endereco" className="text-right">
              Endereço
            </Label>
            <Input
              id="endereco"
              value={formData.endereco}
              onChange={(e) => setFormData(prev => prev ? { ...prev, endereco: e.target.value } : null)}
              className="col-span-3"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="dataAniversario" className="text-right">
              Data de Aniversário
            </Label>
            <Input
              id="dataAniversario"
              type="date"
              value={formData.dataAniversario}
              onChange={(e) => setFormData(prev => prev ? { ...prev, dataAniversario: e.target.value } : null)}
              className="col-span-3"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">
              Origem
            </Label>
            <div className="col-span-3">
              <Select
                value={formData.origem}
                onValueChange={(value) => setFormData(prev => prev ? { ...prev, origem: value } : null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a origem" />
                </SelectTrigger>
                <SelectContent>
                  {origensCliente.map((origem) => (
                    <SelectItem key={origem} value={origem}>
                      {origem}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">
              Processos Ativos
            </Label>
            <div className="col-span-3">
              <div className="flex items-center h-9 px-3 py-1 text-sm border border-input bg-background rounded-md">
                {formData.processosAtivos || 0}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">
              Processos Encerrados
            </Label>
            <div className="col-span-3">
              <div className="flex items-center h-9 px-3 py-1 text-sm border border-input bg-background rounded-md">
                {formData.processosEncerrados || 0}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">
              Total de Processos
            </Label>
            <div className="col-span-3">
              <div className="flex items-center h-9 px-3 py-1 text-sm border border-input bg-background rounded-md font-medium">
                {formData.cases}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">
              Status
            </Label>
            <div className="col-span-3 flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleStatus}
              >
                <Badge variant={formData.status === "ativo" ? "default" : "secondary"}>
                  {formData.status}
                </Badge>
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter className="flex sm:justify-between items-center w-full mt-4">
          {onDelete && client ? (
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onDelete(client.id);
              }}
              className="flex gap-2 bg-red-500/20 text-red-500 hover:bg-red-500/30 hover:text-red-400 border border-red-500/20"
            >
              <Trash2 className="h-4 w-4" />
              Excluir
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              Salvar Alterações
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

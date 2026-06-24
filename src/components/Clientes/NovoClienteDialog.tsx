
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface Client {
  id: number;
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
}

interface NovoClienteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (client: Client) => void;
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

export const NovoClienteDialog = ({ open, onOpenChange, onSave }: NovoClienteDialogProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    cpfCnpj: "",
    tipoPessoa: "fisica" as "fisica" | "juridica",
    origem: "",
    endereco: "",
    dataAniversario: ""
  });

  const handleSave = () => {
    // Validação básica
    if (!formData.name.trim()) {
      toast({
        title: "Erro",
        description: "Nome é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.cpfCnpj.trim()) {
      toast({
        title: "Erro",
        description: `${formData.tipoPessoa === "fisica" ? "CPF" : "CNPJ"} é obrigatório.`,
        variant: "destructive",
      });
      return;
    }

    // Gerar novo ID (em um sistema real seria gerado pelo backend)
    const newId = Date.now();

    const newClient: Client = {
      id: newId,
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      cases: 0,
      status: "ativo",
      lastContact: "Agora",
      cpfCnpj: formData.cpfCnpj,
      tipoPessoa: formData.tipoPessoa,
      origem: formData.origem || "Não informado",
      endereco: formData.endereco,
      dataAniversario: formData.dataAniversario
    };

    onSave(newClient);
    
    // Limpar formulário
    setFormData({
      name: "",
      email: "",
      phone: "",
      cpfCnpj: "",
      tipoPessoa: "fisica",
      origem: "",
      endereco: "",
      dataAniversario: ""
    });
    
    onOpenChange(false);
  };

  const handleCancel = () => {
    // Limpar formulário ao cancelar
    setFormData({
      name: "",
      email: "",
      phone: "",
      cpfCnpj: "",
      tipoPessoa: "fisica",
      origem: "",
      endereco: "",
      dataAniversario: ""
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Cliente</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Nome *
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
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
                  setFormData(prev => ({ ...prev, tipoPessoa: value }))
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
              onChange={(e) => setFormData(prev => ({ ...prev, cpfCnpj: e.target.value }))}
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
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
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
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
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
              onChange={(e) => setFormData(prev => ({ ...prev, endereco: e.target.value }))}
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
              onChange={(e) => setFormData(prev => ({ ...prev, dataAniversario: e.target.value }))}
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
                onValueChange={(value) => setFormData(prev => ({ ...prev, origem: value }))}
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            Cadastrar Cliente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

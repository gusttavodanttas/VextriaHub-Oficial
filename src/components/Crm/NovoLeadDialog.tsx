import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { UserCheck, Building2, Phone, Mail, MapPin, Target, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Lead {
  id?: string;
  nome: string;
  email: string;
  telefone: string;
  cpf_cnpj?: string;
  tipo_pessoa: "fisica" | "juridica";
  origem: string;
  endereco?: string;
  observacoes?: string;
  status: "lead" | "quente" | "morno" | "frio";
  interesse?: string;
}

interface NovoLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (lead: Lead) => void;
}

const origensLead = [
  "Site",
  "Redes Sociais", 
  "Google Ads",
  "Facebook Ads",
  "Indicação",
  "Networking",
  "WhatsApp",
  "Telefone",
  "Email Marketing",
  "Evento/Palestra",
  "Marketing de Conteúdo",
  "Outros"
];

const interessesLead = [
  "Direito Trabalhista",
  "Direito Civil",
  "Direito Criminal",
  "Direito de Família",
  "Direito Empresarial",
  "Direito Imobiliário",
  "Direito Previdenciário",
  "Direito Tributário",
  "Direito do Consumidor",
  "Outros"
];

const statusLead = [
  { value: "lead", label: "Lead", color: "gray" },
  { value: "frio", label: "Frio", color: "blue" },
  { value: "morno", label: "Morno", color: "yellow" },
  { value: "quente", label: "Quente", color: "red" }
];

export const NovoLeadDialog = ({ open, onOpenChange, onSave }: NovoLeadDialogProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<Lead>({
    nome: "",
    email: "",
    telefone: "",
    cpf_cnpj: "",
    tipo_pessoa: "fisica",
    origem: "",
    endereco: "",
    observacoes: "",
    status: "lead",
    interesse: ""
  });

  const resetForm = () => {
    setFormData({
      nome: "",
      email: "",
      telefone: "",
      cpf_cnpj: "",
      tipo_pessoa: "fisica",
      origem: "",
      endereco: "",
      observacoes: "",
      status: "lead",
      interesse: ""
    });
  };

  const handleInputChange = (field: keyof Lead, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateForm = () => {
    if (!formData.nome.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, informe o nome do lead.",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.telefone.trim() && !formData.email.trim()) {
      toast({
        title: "Contato obrigatório", 
        description: "Por favor, informe pelo menos um telefone ou email.",
        variant: "destructive",
      });
      return false;
    }

    if (formData.email && !formData.email.includes("@")) {
      toast({
        title: "Email inválido",
        description: "Por favor, informe um email válido.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    if (!user?.id) {
      toast({
        title: "Erro de autenticação",
        description: "Usuário não autenticado.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .insert([{
          user_id: user.id,
          office_id: user.office_id,
          nome: formData.nome.trim(),
          email: formData.email.trim() || null,
          telefone: formData.telefone.trim() || null,
          cpf_cnpj: formData.cpf_cnpj?.trim() || null,
          tipo_pessoa: formData.tipo_pessoa,
          origem: formData.origem || null,
          endereco: formData.endereco?.trim() || null,
          status: formData.status
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Lead criado com sucesso!",
        description: `O lead ${formData.nome} foi adicionado ao CRM.`,
      });

      // Criar objeto Lead compatível para o callback
      const leadData: Lead = {
        id: data.id,
        nome: data.nome,
        email: data.email || "",
        telefone: data.telefone || "",
        cpf_cnpj: data.cpf_cnpj,
        tipo_pessoa: data.tipo_pessoa as "fisica" | "juridica",
        origem: data.origem || "",
        endereco: data.endereco,
        status: data.status as "lead" | "quente" | "morno" | "frio",
        interesse: formData.interesse,
        observacoes: formData.observacoes
      };

      onSave?.(leadData);
      resetForm();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao criar lead:', error);
      toast({
        title: "Erro ao criar lead",
        description: "Ocorreu um erro ao salvar o lead. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] bg-background/40 backdrop-blur-3xl border-white/5 shadow-2xl p-0 overflow-hidden rounded-[2.5rem]">
        <DialogHeader className="p-8 pb-4 border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
              <Target className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                Novo Lead
              </DialogTitle>
              <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-1">Captação Estratégica</p>
            </div>
          </div>
        </DialogHeader>

        <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* Seção 1: Identificação */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-primary/60 text-[10px] font-black uppercase tracking-widest">
              <UserCheck className="h-4 w-4" /> 01. Identificação do Lead
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-3xl bg-white/5 border border-white/5">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="nome" className="text-white/60 ml-1">Nome completo / Razão Social *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => handleInputChange("nome", e.target.value)}
                  placeholder="Ex: João Silva"
                  className="h-12 bg-white/5 border-white/10 rounded-xl focus:ring-primary/20 font-bold"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-white/60 ml-1">Tipo de Perfil</Label>
                <RadioGroup
                  value={formData.tipo_pessoa}
                  onValueChange={(value) => handleInputChange("tipo_pessoa", value as any)}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                    <RadioGroupItem value="fisica" id="fisica" className="border-primary" />
                    <Label htmlFor="fisica" className="text-xs font-bold cursor-pointer">Pessoa Física</Label>
                  </div>
                  <div className="flex items-center space-x-2 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                    <RadioGroupItem value="juridica" id="juridica" className="border-primary" />
                    <Label htmlFor="juridica" className="text-xs font-bold cursor-pointer">Pessoa Jurídica</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cpf_cnpj" className="text-white/60 ml-1">
                  {formData.tipo_pessoa === "fisica" ? "Documento (CPF)" : "Documento (CNPJ)"}
                </Label>
                <Input
                  id="cpf_cnpj"
                  value={formData.cpf_cnpj}
                  onChange={(e) => handleInputChange("cpf_cnpj", e.target.value)}
                  placeholder={formData.tipo_pessoa === "fisica" ? "000.000.000-00" : "00.000.000/0001-00"}
                  className="h-12 bg-white/5 border-white/10 rounded-xl font-mono"
                />
              </div>
            </div>
          </div>

          {/* Seção 2: Contato e Localização */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-blue-400/60 text-[10px] font-black uppercase tracking-widest">
              <Phone className="h-4 w-4" /> 02. Canais de Contato
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-3xl bg-white/5 border border-white/5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/60 ml-1">E-mail Corporativo/Pessoal</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="joao@email.com"
                  className="h-12 bg-white/5 border-white/10 rounded-xl font-bold"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefone" className="text-white/60 ml-1">WhatsApp / Telefone *</Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={(e) => handleInputChange("telefone", e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="h-12 bg-white/5 border-white/10 rounded-xl font-bold"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="endereco" className="text-white/60 ml-1">Endereço de Correspondência</Label>
                <Input
                  id="endereco"
                  value={formData.endereco}
                  onChange={(e) => handleInputChange("endereco", e.target.value)}
                  placeholder="Rua, número, bairro, cidade - UF"
                  className="h-12 bg-white/5 border-white/10 rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* Seção 3: Inteligência Comercial */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-emerald-400/60 text-[10px] font-black uppercase tracking-widest">
              <Target className="h-4 w-4" /> 03. Inteligência Comercial
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-3xl bg-white/5 border border-white/5">
              <div className="space-y-2">
                <Label htmlFor="origem" className="text-white/60 ml-1">Origem do Lead</Label>
                <Select value={formData.origem} onValueChange={(value) => handleInputChange("origem", value)}>
                  <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl font-bold">
                    <SelectValue placeholder="Fonte de aquisição" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10">
                    {origensLead.map((origem) => (
                      <SelectItem key={origem} value={origem} className="font-bold text-xs uppercase tracking-wider">{origem}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status" className="text-white/60 ml-1">Classificação (Temperatura)</Label>
                <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value as any)}>
                  <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl font-bold">
                    <SelectValue placeholder="Nível de interesse" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10">
                    {statusLead.map((status) => (
                      <SelectItem key={status.value} value={status.value} className="font-bold text-xs uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <div className={cn("w-2 h-2 rounded-full", 
                            status.value === 'quente' ? 'bg-red-500' : 
                            status.value === 'morno' ? 'bg-yellow-500' : 
                            status.value === 'frio' ? 'bg-blue-500' : 'bg-gray-500'
                          )} />
                          {status.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="interesse" className="text-white/60 ml-1">Área Jurídica de Interesse</Label>
                <Select value={formData.interesse} onValueChange={(value) => handleInputChange("interesse", value)}>
                  <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl font-bold text-primary">
                    <SelectValue placeholder="Selecione a especialidade" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10">
                    {interessesLead.map((interesse) => (
                      <SelectItem key={interesse} value={interesse} className="font-bold text-xs uppercase tracking-wider">{interesse}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="observacoes" className="text-white/60 ml-1">Observações Estratégicas</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => handleInputChange("observacoes", e.target.value)}
                  placeholder="Informações relevantes para o fechamento..."
                  rows={3}
                  className="bg-white/5 border-white/10 rounded-xl font-medium"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="p-8 pt-4 bg-white/5 border-t border-white/5 flex gap-4">
          <Button variant="ghost" onClick={handleCancel} disabled={isLoading} className="flex-1 h-12 rounded-xl font-bold text-white/40 hover:text-white">
            Descartar
          </Button>
          <Button onClick={handleSave} disabled={isLoading} className="flex-1 h-12 rounded-xl font-bold bg-primary shadow-lg shadow-primary/20">
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Registrar Lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 
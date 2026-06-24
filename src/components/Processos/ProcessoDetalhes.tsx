import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { MultiSelect } from "@/components/ui/multi-select";
import { NovoAndamentoDialog } from "./NovoAndamentoDialog";
import { NovoPrazoDialog } from "./NovoPrazoDialog";
import { NovaAudienciaDialog } from "./NovaAudienciaDialog";
import { FileText, User, Calendar, Clock, Scale, Users, AlertCircle, Gavel, DollarSign, Building, Landmark, MapPin, Edit, Save, X, UserCheck, Tag, FileType } from "lucide-react";
import { useState } from "react";
// Removida importação de dados mockados

// Interface local para compatibilidade com dados de exemplo
interface ProcessoLocal {
  id: string;
  titulo: string;
  cliente: string;  
  status: string;
  ultimaAtualizacao: string;
  proximoPrazo: string;
}

interface ProcessoDetalhesProps {
  processo: ProcessoLocal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateProcesso?: (processoAtualizado: ProcessoLocal) => Promise<void>;
}

// Dados padrão limpos
const defaultProcessoInfoAdicional = {
  parteContraria: "",
  tribunal: "",
  sistemaTribunal: "",
  vara: "",
  comarca: ""
};

// Listas vazias para novos usuários
const advogados: string[] = [];

// Tipos de processo básicos
const tiposProcesso = [
  "Ação de Cobrança",
  "Ação Trabalhista",
  "Divórcio",
  "Inventário",
  "Ação de Despejo",
  "Ação de Indenização",
  "Mandado de Segurança",
  "Habeas Corpus"
];

// Etiquetas padrão disponíveis
const etiquetasDisponiveis = [
  { value: "urgente", label: "Urgente", color: "bg-red-100 text-red-800 border-red-200" },
  { value: "recurso", label: "Recurso", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "acordao", label: "Acórdão", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { value: "pericia", label: "Perícia", color: "bg-orange-100 text-orange-800 border-orange-200" },
  { value: "audiencia", label: "Audiência", color: "bg-green-100 text-green-800 border-green-200" },
  { value: "sentenca", label: "Sentença", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  { value: "execucao", label: "Execução", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { value: "cautelar", label: "Cautelar", color: "bg-pink-100 text-pink-800 border-pink-200" },
  { value: "trabalhista", label: "Trabalhista", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { value: "civel", label: "Cível", color: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  { value: "criminal", label: "Criminal", color: "bg-slate-100 text-slate-800 border-slate-200" },
  { value: "familia", label: "Família", color: "bg-rose-100 text-rose-800 border-rose-200" },
  { value: "empresarial", label: "Empresarial", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { value: "tributario", label: "Tributário", color: "bg-lime-100 text-lime-800 border-lime-200" },
  { value: "previdenciario", label: "Previdenciário", color: "bg-teal-100 text-teal-800 border-teal-200" },
  { value: "consumidor", label: "Consumidor", color: "bg-sky-100 text-sky-800 border-sky-200" },
  { value: "ambiental", label: "Ambiental", color: "bg-violet-100 text-violet-800 border-violet-200" },
  { value: "administrativo", label: "Administrativo", color: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200" },
  { value: "constitucional", label: "Constitucional", color: "bg-stone-100 text-stone-800 border-stone-200" },
  { value: "internacional", label: "Internacional", color: "bg-zinc-100 text-zinc-800 border-zinc-200" }
];

// Dados iniciais vazios para novos usuários
const andamentosIniciais: any[] = [];

const prazosIniciais: any[] = [];

const audienciasIniciais: any[] = [];

// Dados padrão limpos
const defaultProcessoInfo = {
  valorCausa: "",
  resultado: "Em andamento"
};

// Opções de resultado do processo
const resultadoOptions = [
  { value: "pendente", label: "Pendente" },
  { value: "procedente", label: "Procedente" },
  { value: "procedente-parte", label: "Procedente em Parte" },
  { value: "improcedente", label: "Improcedente" },
  { value: "extinto", label: "Extinto" }
];

export function ProcessoDetalhes({ processo, open, onOpenChange }: ProcessoDetalhesProps) {
  const [resultado, setResultado] = useState("pendente");
  const [isEditing, setIsEditing] = useState(false);
  
  // Estados para listas dinâmicas
  const [andamentos, setAndamentos] = useState(andamentosIniciais);
  const [prazos, setPrazos] = useState(prazosIniciais);
  const [audiencias, setAudiencias] = useState(audienciasIniciais);
  
  // Estados para campos editáveis
  const [editedInfo, setEditedInfo] = useState({
    titulo: processo?.titulo || "",
    cliente: processo?.cliente || "",
    parteContraria: defaultProcessoInfoAdicional.parteContraria,
    tribunal: defaultProcessoInfoAdicional.tribunal,
    sistemaTribunal: defaultProcessoInfoAdicional.sistemaTribunal,
    vara: defaultProcessoInfoAdicional.vara,
    comarca: defaultProcessoInfoAdicional.comarca,
    valorCausa: "",
    advogadoResponsavel: "",
    tipoProcesso: "",
    etiquetas: [],
    anotacoes: ""
  });

  if (!processo) return null;

  // Opções vazias para novos usuários
  const clienteOptions: { value: string; label: string }[] = [];
  const parteContrariaOptions: { value: string; label: string }[] = [];
  const tribunalOptions: { value: string; label: string }[] = [];
  const sistemaOptions: { value: string; label: string }[] = [];
  const varaOptions: { value: string; label: string }[] = [];
  const comarcaOptions: { value: string; label: string }[] = [];
  const advogadoOptions: { value: string; label: string }[] = [];
  
  const tipoProcessoOptions = tiposProcesso.map(tipo => ({
    value: tipo,
    label: tipo
  }));

  // Handlers para adicionar novos itens
  const handleAddAndamento = (novoAndamento: any) => {
    const andamentoComId = {
      ...novoAndamento,
      id: Math.max(...andamentos.map(a => a.id)) + 1
    };
    setAndamentos(prev => [andamentoComId, ...prev]);
  };

  const handleAddPrazo = (novoPrazo: any) => {
    const prazoComId = {
      ...novoPrazo,
      id: Math.max(...prazos.map(p => p.id)) + 1,
      status: "pendente"
    };
    setPrazos(prev => [prazoComId, ...prev]);
  };

  const handleAddAudiencia = (novaAudiencia: any) => {
    const audienciaComId = {
      ...novaAudiencia,
      id: Math.max(...audiencias.map(a => a.id)) + 1,
      status: "agendada"
    };
    setAudiencias(prev => [audienciaComId, ...prev]);
  };

  const handleSave = () => {
    console.log("Salvando informações:", editedInfo);
    setIsEditing(false);
    // Aqui você implementaria a lógica para salvar os dados
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Resetar os valores editados
    setEditedInfo({
      titulo: processo?.titulo || "",
      cliente: processo?.cliente || "",
      parteContraria: defaultProcessoInfoAdicional.parteContraria,
      tribunal: defaultProcessoInfoAdicional.tribunal,
      sistemaTribunal: defaultProcessoInfoAdicional.sistemaTribunal,
      vara: defaultProcessoInfoAdicional.vara,
      comarca: defaultProcessoInfoAdicional.comarca,
      valorCausa: "",
      advogadoResponsavel: "",
      tipoProcesso: "",
      etiquetas: [],
      anotacoes: ""
    });
  };

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case "alta": return "text-red-600 bg-red-50 border-red-200";
      case "media": return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "baixa": return "text-green-600 bg-green-50 border-green-200";
      default: return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pendente": return "text-yellow-600 bg-yellow-50";
      case "agendado": return "text-blue-600 bg-blue-50";
      case "agendada": return "text-blue-600 bg-blue-50";
      case "concluido": return "text-green-600 bg-green-50";
      case "procedente": return "text-green-600 bg-green-50";
      case "procedente-parte": return "text-blue-600 bg-blue-50";
      case "improcedente": return "text-red-600 bg-red-50";
      case "extinto": return "text-gray-600 bg-gray-50";
      default: return "text-gray-600 bg-gray-50";
    }
  };

  const getResultadoTexto = (resultado: string) => {
    const option = resultadoOptions.find(opt => opt.value === resultado);
    return option ? option.label : "Pendente";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Detalhes do Processo
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Cabeçalho do Processo */}
          <div className="space-y-2">
            {isEditing ? (
              <Input
                value={editedInfo.titulo}
                onChange={(e) => setEditedInfo(prev => ({ ...prev, titulo: e.target.value }))}
                placeholder="Título do processo"
                className="text-lg font-semibold"
              />
            ) : (
              <h3 className="text-lg font-semibold">{editedInfo.titulo}</h3>
            )}
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>#{processo.id}</span>
              <Badge variant="secondary">{processo.status}</Badge>
            </div>
          </div>

          <Separator />

          {/* Informações Básicas do Processo */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-lg">Informações do Processo</h4>
              <div className="flex gap-2">
                {!isEditing ? (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                ) : (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleCancel}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                    <Button 
                      size="sm"
                      onClick={handleSave}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Salvar
                    </Button>
                  </>
                )}
              </div>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <h5 className="font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Cliente
                </h5>
                {isEditing ? (
                  <Combobox
                    options={clienteOptions}
                    value={editedInfo.cliente}
                    onValueChange={(value) => setEditedInfo(prev => ({ ...prev, cliente: value }))}
                    placeholder="Selecionar cliente"
                    searchPlaceholder="Buscar cliente..."
                  />
                ) : (
                  <p className="text-sm">{editedInfo.cliente}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <h5 className="font-medium flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Parte Contrária
                </h5>
                {isEditing ? (
                  <Combobox
                    options={parteContrariaOptions}
                    value={editedInfo.parteContraria}
                    onValueChange={(value) => setEditedInfo(prev => ({ ...prev, parteContraria: value }))}
                    placeholder="Selecionar parte contrária"
                    searchPlaceholder="Buscar parte contrária..."
                  />
                ) : (
                  <p className="text-sm">{editedInfo.parteContraria}</p>
                )}
              </div>

              <div className="space-y-2">
                <h5 className="font-medium flex items-center gap-2">
                  <UserCheck className="h-4 w-4" />
                  Advogado Responsável
                </h5>
                {isEditing ? (
                  <Combobox
                    options={advogadoOptions}
                    value={editedInfo.advogadoResponsavel}
                    onValueChange={(value) => setEditedInfo(prev => ({ ...prev, advogadoResponsavel: value }))}
                    placeholder="Selecionar advogado"
                    searchPlaceholder="Buscar advogado..."
                  />
                ) : (
                  <p className="text-sm">{editedInfo.advogadoResponsavel}</p>
                )}
              </div>

              <div className="space-y-2">
                <h5 className="font-medium flex items-center gap-2">
                  <FileType className="h-4 w-4" />
                  Tipo do Processo
                </h5>
                {isEditing ? (
                  <Combobox
                    options={tipoProcessoOptions}
                    value={editedInfo.tipoProcesso}
                    onValueChange={(value) => setEditedInfo(prev => ({ ...prev, tipoProcesso: value }))}
                    placeholder="Selecionar tipo"
                    searchPlaceholder="Buscar tipo..."
                  />
                ) : (
                  <p className="text-sm">{editedInfo.tipoProcesso}</p>
                )}
              </div>

              <div className="space-y-2">
                <h5 className="font-medium flex items-center gap-2">
                  <Landmark className="h-4 w-4" />
                  Tribunal
                </h5>
                {isEditing ? (
                  <Combobox
                    options={tribunalOptions}
                    value={editedInfo.tribunal}
                    onValueChange={(value) => setEditedInfo(prev => ({ ...prev, tribunal: value }))}
                    placeholder="Selecionar tribunal"
                    searchPlaceholder="Buscar tribunal..."
                  />
                ) : (
                  <p className="text-sm">{editedInfo.tribunal}</p>
                )}
              </div>

              <div className="space-y-2">
                <h5 className="font-medium flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  Sistema do Tribunal
                </h5>
                {isEditing ? (
                  <Combobox
                    options={sistemaOptions}
                    value={editedInfo.sistemaTribunal}
                    onValueChange={(value) => setEditedInfo(prev => ({ ...prev, sistemaTribunal: value }))}
                    placeholder="Selecionar sistema"
                    searchPlaceholder="Buscar sistema..."
                  />
                ) : (
                  <p className="text-sm">{editedInfo.sistemaTribunal}</p>
                )}
              </div>

              <div className="space-y-2">
                <h5 className="font-medium flex items-center gap-2">
                  <Gavel className="h-4 w-4" />
                  Vara
                </h5>
                {isEditing ? (
                  <Combobox
                    options={varaOptions}
                    value={editedInfo.vara}
                    onValueChange={(value) => setEditedInfo(prev => ({ ...prev, vara: value }))}
                    placeholder="Selecionar vara"
                    searchPlaceholder="Buscar vara..."
                  />
                ) : (
                  <p className="text-sm">{editedInfo.vara}</p>
                )}
              </div>

              <div className="space-y-2">
                <h5 className="font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Comarca
                </h5>
                {isEditing ? (
                  <Combobox
                    options={comarcaOptions}
                    value={editedInfo.comarca}
                    onValueChange={(value) => setEditedInfo(prev => ({ ...prev, comarca: value }))}
                    placeholder="Selecionar comarca"
                    searchPlaceholder="Buscar comarca..."
                  />
                ) : (
                  <p className="text-sm">{editedInfo.comarca}</p>
                )}
              </div>

              <div className="space-y-2">
                <h5 className="font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  Valor da Causa
                </h5>
                {isEditing ? (
                  <Input
                    value={editedInfo.valorCausa}
                    onChange={(e) => setEditedInfo(prev => ({ ...prev, valorCausa: e.target.value }))}
                    placeholder="Valor da causa"
                  />
                ) : (
                  <p className="text-sm font-medium text-green-600">
                    {editedInfo.valorCausa}
                  </p>
                )}
              </div>
            </div>

            {/* Etiquetas - Removidas da visualização */}
            {isEditing && (
              <div className="space-y-2">
                <h5 className="font-medium flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Etiquetas
                </h5>
                <MultiSelect
                  options={etiquetasDisponiveis}
                  selected={editedInfo.etiquetas}
                  onChange={(values) => setEditedInfo(prev => ({ ...prev, etiquetas: values }))}
                  placeholder="Selecionar etiquetas..."
                />
              </div>
            )}

            {/* Anotações */}
            <div className="space-y-2">
              <h5 className="font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Anotações
              </h5>
              {isEditing ? (
                <Textarea
                  value={editedInfo.anotacoes}
                  onChange={(e) => setEditedInfo(prev => ({ ...prev, anotacoes: e.target.value }))}
                  placeholder="Adicionar anotações sobre o processo..."
                  className="min-h-[100px]"
                />
              ) : (
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                  {editedInfo.anotacoes || "Nenhuma anotação adicionada."}
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Informações de Controle */}
          <div className="space-y-4">
            <h4 className="font-semibold text-lg">Controle do Processo</h4>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <h5 className="font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Última Atualização
                </h5>
                <p className="text-sm">
                  {new Date(processo.ultimaAtualizacao).toLocaleDateString('pt-BR')}
                </p>
              </div>
              
              <div className="space-y-2">
                <h5 className="font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-accent" />
                  Próximo Prazo
                </h5>
                <p className="text-sm text-accent font-medium">
                  {new Date(processo.proximoPrazo).toLocaleDateString('pt-BR')}
                </p>
              </div>

              <div className="space-y-2">
                <h5 className="font-medium flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  Resultado
                </h5>
                <Select value={resultado} onValueChange={setResultado}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecionar resultado" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    {resultadoOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Tabs com detalhes */}
          <Tabs defaultValue="andamentos" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="andamentos">Andamentos</TabsTrigger>
              <TabsTrigger value="prazos">Prazos</TabsTrigger>
              <TabsTrigger value="audiencias">Audiências</TabsTrigger>
              <TabsTrigger value="partes">Partes</TabsTrigger>
            </TabsList>

            <TabsContent value="andamentos" className="space-y-4">
              <div className="flex justify-between items-center">
                <h5 className="font-medium">Andamentos do Processo</h5>
                <NovoAndamentoDialog onAddAndamento={handleAddAndamento} />
              </div>
              <div className="space-y-3">
                {andamentos.map((andamento) => (
                  <Card key={andamento.id}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{andamento.tipo}</Badge>
                            <span className="text-sm text-muted-foreground">
                              {new Date(andamento.data).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          <p className="text-sm">{andamento.descricao}</p>
                          <p className="text-xs text-muted-foreground">
                            Responsável: {andamento.responsavel}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="prazos" className="space-y-4">
              <div className="flex justify-between items-center">
                <h5 className="font-medium">Prazos do Processo</h5>
                <NovoPrazoDialog onAddPrazo={handleAddPrazo} />
              </div>
              <div className="space-y-3">
                {prazos.map((prazo) => (
                  <Card key={prazo.id}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            <span className="font-medium">{prazo.descricao}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              Vencimento: {new Date(prazo.dataVencimento).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 items-end">
                          <Badge className={getStatusColor(prazo.status)}>
                            {prazo.status}
                          </Badge>
                          <Badge 
                            variant="outline" 
                            className={getPrioridadeColor(prazo.prioridade)}
                          >
                            {prazo.prioridade}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="audiencias" className="space-y-4">
              <div className="flex justify-between items-center">
                <h5 className="font-medium">Audiências do Processo</h5>
                <NovaAudienciaDialog onAddAudiencia={handleAddAudiencia} />
              </div>
              <div className="space-y-3">
                {audiencias.map((audiencia) => (
                  <Card key={audiencia.id}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Gavel className="h-4 w-4" />
                            <span className="font-medium">{audiencia.tipo}</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span>{new Date(audiencia.data).toLocaleDateString('pt-BR')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span>{audiencia.hora}</span>
                            </div>
                          </div>
                          {audiencia.local && (
                            <p className="text-sm text-muted-foreground">{audiencia.local}</p>
                          )}
                        </div>
                        <Badge className={getStatusColor(audiencia.status)}>
                          {audiencia.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="partes" className="space-y-4">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Parte Requerente
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="font-medium">{processo.cliente}</p>
                      <p className="text-sm text-muted-foreground">CPF: 123.456.789-00</p>
                      <p className="text-sm text-muted-foreground">
                        Endereço: Rua das Flores, 123 - Centro
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Scale className="h-4 w-4" />
                      Parte Contrária
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="font-medium">Empresa XYZ Ltda.</p>
                      <p className="text-sm text-muted-foreground">CNPJ: 12.345.678/0001-00</p>
                      <p className="text-sm text-muted-foreground">
                        Endereço: Av. Principal, 456 - Empresarial
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Advogado: Dr. Pedro Oliveira - OAB/SP 123456
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

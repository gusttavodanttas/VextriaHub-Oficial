import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/config/api';

interface ProcessoAPIResult {
  numeroProcesso: string;
  titulo: string;
  tribunal: string;
  status: string;
  dataDistribuicao: string;
  partes: {
    requerente: string;
    requerido: string;
  };
  ultimaMovimentacao: {
    data: string;
    descricao: string;
  };
}

interface BuscaProcessoAPIProps {
  onProcessoEncontrado: (processo: ProcessoAPIResult) => void;
  processosAtivos: number;
}

export const BuscaProcessoAPI: React.FC<BuscaProcessoAPIProps> = ({
  onProcessoEncontrado,
  processosAtivos
}) => {
  const { toast } = useToast();
  const features = usePlanFeatures();
  const { office } = useAuth();
  
  const [searchType, setSearchType] = useState<'oab' | 'cnj'>('cnj');
  const [searchValue, setSearchValue] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<ProcessoAPIResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Verificar limite de processos
  const canAddMoreProcesses = () => {
    if (!features) return true; // Fallback se features não estiver carregado
    if (features.maxProcesses === -1) return true; // Ilimitado
    return processosAtivos < features.maxProcesses;
  };

  const getRemainingProcesses = () => {
    if (!features) return 'Carregando...';
    if (features.maxProcesses === -1) return 'Ilimitado';
    return features.maxProcesses - processosAtivos;
  };

  const handleSearch = async () => {
    if (!searchValue.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "Digite um número de processo CNJ ou OAB para buscar.",
        variant: "destructive"
      });
      return;
    }

    if (!canAddMoreProcesses()) {
      const maxProcesses = features ? (features.maxProcesses === -1 ? 'Ilimitado' : features.maxProcesses) : 'N/A';
      toast({
        title: "Limite de processos atingido",
        description: `Seu plano permite até ${maxProcesses} processos. Faça upgrade para adicionar mais.`,
        variant: "destructive"
      });
      return;
    }

    setIsSearching(true);
    setError(null);
    setSearchResult(null);

    try {
      let endpoint = '';
      let searchParam = '';
      
      if (searchType === 'cnj') {
        // Remove formatação do CNJ para enviar apenas números
        const cleanCNJ = searchValue.replace(/\D/g, '');
        endpoint = `/processos/cnj/${cleanCNJ}`;
        searchParam = cleanCNJ;
      } else {
        endpoint = `/processos/oab/${searchValue}`;
        searchParam = searchValue;
      }

      console.log('Buscando processo:', { searchType, searchParam, endpoint });
      
      // Fazer chamada real para a API
      const apiResult = await apiRequest(endpoint);
      
      // Mapear resultado da API para o formato esperado
      const processResult: ProcessoAPIResult = {
        numeroProcesso: apiResult.numeroProcesso || searchValue,
        titulo: apiResult.titulo || `Processo ${searchType.toUpperCase()} ${searchValue}`,
        tribunal: apiResult.tribunal || "Tribunal não informado",
        status: apiResult.status || "Status não informado",
        dataDistribuicao: apiResult.dataDistribuicao || new Date().toISOString().split('T')[0],
        partes: {
          requerente: apiResult.partes?.requerente || "Requerente não informado",
          requerido: apiResult.partes?.requerido || "Requerido não informado"
        },
        ultimaMovimentacao: {
          data: apiResult.ultimaMovimentacao?.data || new Date().toISOString().split('T')[0],
          descricao: apiResult.ultimaMovimentacao?.descricao || "Nenhuma movimentação recente"
        }
      };

      setSearchResult(processResult);
      
      toast({
        title: "Processo encontrado",
        description: "Processo localizado com sucesso na base de dados."
      });
    } catch (error: unknown) {
      console.error('Erro na busca de processo:', error);
      
      let errorMessage = "Erro ao buscar processo. Verifique o número e tente novamente.";
      
      if (error instanceof Error && error.message?.includes('404')) {
        errorMessage = "Processo não encontrado. Verifique o número informado.";
      } else if (error instanceof Error && (error.message?.includes('401') || error.message?.includes('403'))) {
        errorMessage = "Erro de autenticação. Verifique as credenciais da API.";
      } else if (error instanceof Error && error.message?.includes('429')) {
        errorMessage = "Muitas requisições. Tente novamente em alguns minutos.";
      }
      
      setError(errorMessage);
      toast({
        title: "Erro na busca",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleImportProcess = () => {
    if (searchResult) {
      onProcessoEncontrado(searchResult);
      setSearchResult(null);
      setSearchValue('');
      toast({
        title: "Processo importado",
        description: "Processo adicionado à sua lista com sucesso."
      });
    }
  };

  const formatCNJ = (value: string) => {
    // Remove caracteres não numéricos
    const numbers = value.replace(/\D/g, '');
    
    // Aplica máscara CNJ: 0000000-00.0000.0.00.0000
    if (numbers.length <= 20) {
      return numbers
        .replace(/(\d{7})(\d)/, '$1-$2')
        .replace(/(\d{7}-\d{2})(\d)/, '$1.$2')
        .replace(/(\d{7}-\d{2}\.\d{4})(\d)/, '$1.$2')
        .replace(/(\d{7}-\d{2}\.\d{4}\.\d)(\d)/, '$1.$2')
        .replace(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2})(\d)/, '$1.$2');
    }
    return value;
  };

  const handleInputChange = (value: string) => {
    if (searchType === 'cnj') {
      setSearchValue(formatCNJ(value));
    } else {
      setSearchValue(value);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Buscar Processo por API
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Informações do plano */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Plano atual: <strong>{office?.plan || 'free'}</strong> | 
            Processos restantes: <strong>{getRemainingProcesses()}</strong>
          </AlertDescription>
        </Alert>

        {/* Tipo de busca */}
        <div className="space-y-2">
          <Label>Tipo de busca</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={searchType === 'cnj' ? 'default' : 'outline'}
              onClick={() => setSearchType('cnj')}
              className="flex-1"
            >
              Número CNJ
            </Button>
            <Button
              type="button"
              variant={searchType === 'oab' ? 'default' : 'outline'}
              onClick={() => setSearchType('oab')}
              className="flex-1"
            >
              Número OAB
            </Button>
          </div>
        </div>

        {/* Campo de busca */}
        <div className="space-y-2">
          <Label htmlFor="search-input">
            {searchType === 'cnj' ? 'Número do Processo (CNJ)' : 'Número OAB'}
          </Label>
          <div className="flex gap-2">
            <Input
              id="search-input"
              value={searchValue}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={
                searchType === 'cnj' 
                  ? '0000000-00.0000.0.00.0000' 
                  : 'Digite o número OAB'
              }
              disabled={isSearching || !canAddMoreProcesses()}
            />
            <Button 
              onClick={handleSearch} 
              disabled={isSearching || !canAddMoreProcesses()}
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Limite atingido */}
        {!canAddMoreProcesses() && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Limite de processos atingido. Faça upgrade do seu plano para adicionar mais processos.
            </AlertDescription>
          </Alert>
        )}

        {/* Erro */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Resultado da busca */}
        {searchResult && (
          <Card className="border-green-200 bg-green-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Processo Encontrado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <strong>Número:</strong> {searchResult.numeroProcesso}
                </div>
                <div>
                  <strong>Status:</strong> {searchResult.status}
                </div>
                <div>
                  <strong>Tribunal:</strong> {searchResult.tribunal}
                </div>
                <div>
                  <strong>Data Distribuição:</strong> {new Date(searchResult.dataDistribuicao).toLocaleDateString('pt-BR')}
                </div>
                <div>
                  <strong>Requerente:</strong> {searchResult.partes.requerente}
                </div>
                <div>
                  <strong>Requerido:</strong> {searchResult.partes.requerido}
                </div>
              </div>
              
              <div className="pt-2 border-t">
                <strong>Última Movimentação:</strong>
                <p className="text-sm text-muted-foreground mt-1">
                  {new Date(searchResult.ultimaMovimentacao.data).toLocaleDateString('pt-BR')} - {searchResult.ultimaMovimentacao.descricao}
                </p>
              </div>

              <Button onClick={handleImportProcess} className="w-full mt-4">
                Importar Processo
              </Button>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
};
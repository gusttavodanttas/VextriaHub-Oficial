
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
// Removed duplicate sidebar imports as they're already provided by AppLayout
import { ConsultiveTab } from "@/components/Publications/ConsultiveTab";
import { MessageSquareText, Filter, X, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Consultivo() {
  const location = useLocation();
  const navigate = useNavigate();
  const [filtroCliente, setFiltroCliente] = useState<string | null>(null);

  useEffect(() => {
    // Verifica se veio um filtro de cliente da navegação
    const clientFilter = location.state?.clientFilter;
    if (clientFilter) {
      setFiltroCliente(clientFilter);
    }
  }, [location]);

  const limparFiltro = () => {
    setFiltroCliente(null);
  };

  const voltarParaClientes = () => {
    navigate('/clientes');
  };

  return (
    <div className="flex-1 p-4 md:p-8 space-y-8 md:space-y-10 overflow-x-hidden entry-animate">
      <div className="max-w-7xl mx-auto w-full space-y-8 md:space-y-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-4">
            {filtroCliente && (
              <Button
                variant="ghost"
                size="icon"
                onClick={voltarParaClientes}
                className="rounded-xl hover:bg-primary/10 hover:text-primary transition-all"
              >
                <ArrowLeft className="h-6 w-6" />
              </Button>
            )}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  <MessageSquareText className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                </div>
                <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                  Consultivo Inteligente
                </h1>
              </div>
              <p className="text-sm md:text-lg text-muted-foreground font-medium">
                Respostas rápidas e orientações estratégicas baseadas em dados.
              </p>
            </div>
          </div>
          {filtroCliente && (
            <Button
              variant="outline"
              onClick={voltarParaClientes}
              className="hidden md:flex rounded-xl font-bold border-primary/20 text-primary hover:bg-primary/5"
            >
              Voltar para Clientes
            </Button>
          )}
        </div>

        {/* Filtro de Cliente Ativo */}
        {filtroCliente && (
          <div className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-2xl entry-animate slide-in-from-top-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Filter className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm md:text-base text-primary font-medium">
              Consultivo filtrado para: <strong className="font-extrabold tracking-tight drop-shadow-sm">{filtroCliente}</strong>
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={limparFiltro}
              className="ml-auto h-8 w-8 rounded-full hover:bg-primary/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Informações específicas do cliente no consultivo */}
        {filtroCliente && (
          <Card className="border-white/5 bg-card/40 backdrop-blur-sm overflow-hidden shadow-premium">
            <CardContent className="p-8">
              <h3 className="text-xl font-bold mb-8 flex items-center gap-2">
                Insight Estratégico - {filtroCliente}
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              </h3>
              <div className="grid gap-8 md:grid-cols-2">
                <div className="space-y-4">
                  <h4 className="font-bold text-xs uppercase tracking-widest text-muted-foreground opacity-70">Áreas de Interesse</h4>
                  <div className="space-y-3">
                    {filtroCliente === "Maria Silva" && (
                      <>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-white/5">
                          <div className="h-2 w-2 rounded-full bg-primary" />
                          <p className="text-sm font-semibold">Direito de Família</p>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-white/5">
                          <div className="h-2 w-2 rounded-full bg-primary" />
                          <p className="text-sm font-semibold">Direito Civil - Cobrança</p>
                        </div>
                      </>
                    )}
                    {/* Add other clients if needed, or keep generic */}
                    {filtroCliente !== "Maria Silva" && (
                      <p className="text-sm italic text-muted-foreground">Analise as áreas de interesse detalhadas no CRM.</p>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="font-bold text-xs uppercase tracking-widest text-muted-foreground opacity-70">Últimas Interações</h4>
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-background/50 border border-white/5 space-y-2">
                      <p className="text-xs text-primary font-bold">JAN 2024</p>
                      <p className="text-sm font-medium text-muted-foreground">Análise de riscos contratuais e alinhamento de prazos.</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
              
        <ConsultiveTab clienteFilter={filtroCliente} />
      </div>
    </div>
  );
}

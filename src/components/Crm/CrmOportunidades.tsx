import { ArrowLeft, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Props {
  onBack: () => void;
  onOpportunityClick: (opportunity: any) => void;
}

export function CrmOportunidades({ onBack, onOpportunityClick }: Props) {
  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Button variant="outline" onClick={onBack} className="w-full sm:w-auto">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar ao CRM
        </Button>
        <div className="w-full sm:w-auto">
          <h2 className="text-xl md:text-2xl font-bold">Oportunidades</h2>
          <p className="text-sm md:text-base text-muted-foreground">Gerencie oportunidades ativas</p>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">Oportunidades em Andamento</CardTitle>
          <CardDescription className="text-sm">Lista de oportunidades com maior potencial</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[].map((opportunity: any) => (
              <div 
                key={opportunity.id} 
                className="flex flex-col lg:flex-row lg:items-center justify-between p-4 border rounded-lg hover:bg-gray-50 gap-4 cursor-pointer transition-colors"
                onClick={() => onOpportunityClick(opportunity)}
              >
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium text-sm md:text-base">{opportunity.lead} - {opportunity.company}</div>
                    <div className="text-xs md:text-sm text-muted-foreground">
                      Próxima ação: {opportunity.nextAction} • Prazo: {opportunity.dueDate}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="text-right">
                    <div className="font-medium text-green-600 text-sm md:text-base">{opportunity.value}</div>
                    <div className="text-xs md:text-sm text-muted-foreground">Valor estimado</div>
                  </div>
                  <Badge className={
                    opportunity.probability >= 80 ? "bg-green-100 text-green-800" :
                    opportunity.probability >= 60 ? "bg-yellow-100 text-yellow-800" :
                    "bg-red-100 text-red-800"
                  }>
                    {opportunity.probability}% probabilidade
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

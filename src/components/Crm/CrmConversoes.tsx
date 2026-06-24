import { ArrowLeft, UserCheck, Mail, Phone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  onBack: () => void;
}

export function CrmConversoes({ onBack }: Props) {
  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Button variant="outline" onClick={onBack} className="w-full sm:w-auto">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar ao CRM
        </Button>
        <div className="w-full sm:w-auto">
          <h2 className="text-xl md:text-2xl font-bold">Conversões</h2>
          <p className="text-sm md:text-base text-muted-foreground">Leads convertidos em clientes</p>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">Clientes Convertidos (0)</CardTitle>
          <CardDescription className="text-sm">Leads que se tornaram clientes pagantes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[].map((cliente: any) => (
              <div key={cliente.id} className="flex flex-col lg:flex-row lg:items-center justify-between p-4 border rounded-lg hover:bg-gray-50 gap-4">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <UserCheck className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <div className="font-medium text-sm md:text-base">{cliente.name}</div>
                    <div className="text-xs md:text-sm text-gray-500">{cliente.company}</div>
                    <div className="text-xs text-gray-400">{cliente.cases} casos ativos</div>
                  </div>
                </div>
                <div className="flex flex-col lg:flex-row lg:items-center space-y-2 lg:space-y-0 lg:space-x-6">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 lg:text-right">
                    <div className="flex items-center text-xs md:text-sm text-gray-500">
                      <Mail className="h-4 w-4 mr-1" />
                      <span className="truncate">{cliente.email}</span>
                    </div>
                    <div className="flex items-center text-xs md:text-sm text-gray-500">
                      <Phone className="h-4 w-4 mr-1" />
                      {cliente.phone}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-green-600 text-sm md:text-base">{cliente.value}</div>
                    <div className="text-xs md:text-sm text-gray-500">Valor total</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

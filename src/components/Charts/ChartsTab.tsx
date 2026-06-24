
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from "recharts";

const processosData = [
  { mes: "Jan", processos: 45, concluidos: 32 },
  { mes: "Fev", processos: 52, concluidos: 38 },
  { mes: "Mar", processos: 48, concluidos: 42 },
  { mes: "Abr", processos: 61, concluidos: 45 },
  { mes: "Mai", processos: 55, concluidos: 48 },
  { mes: "Jun", processos: 67, concluidos: 52 },
];

const clientesData = [
  { nome: "Pessoa Física", valor: 65, cor: "#8884d8" },
  { nome: "Pessoa Jurídica", valor: 35, cor: "#82ca9d" },
];

const atendimentosData = [
  { dia: "Seg", atendimentos: 12 },
  { dia: "Ter", atendimentos: 15 },
  { dia: "Qua", atendimentos: 18 },
  { dia: "Qui", atendimentos: 22 },
  { dia: "Sex", atendimentos: 16 },
  { dia: "Sáb", atendimentos: 8 },
  { dia: "Dom", atendimentos: 4 },
];

export function ChartsTab() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="processos" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="processos">Processos</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="atendimentos">Atendimentos</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
        </TabsList>

        <TabsContent value="processos" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Processos por Mês</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={processosData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="processos" fill="#8884d8" name="Total" />
                    <Bar dataKey="concluidos" fill="#82ca9d" name="Concluídos" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status dos Processos</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Em Andamento", value: 45, fill: "#8884d8" },
                        { name: "Concluídos", value: 32, fill: "#82ca9d" },
                        { name: "Pendentes", value: 18, fill: "#ffc658" },
                        { name: "Arquivados", value: 12, fill: "#ff7300" },
                      ]}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label
                    />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="clientes" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Tipos de Cliente</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={clientesData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="valor"
                      label
                    >
                      {clientesData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.cor} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Novos Clientes por Mês</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={processosData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="processos" stroke="#8884d8" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="atendimentos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Atendimentos por Dia da Semana</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={atendimentosData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dia" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="atendimentos" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financeiro" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Receita Mensal</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={[
                    { mes: "Jan", receita: 15000 },
                    { mes: "Fev", receita: 18000 },
                    { mes: "Mar", receita: 22000 },
                    { mes: "Abr", receita: 19000 },
                    { mes: "Mai", receita: 25000 },
                    { mes: "Jun", receita: 28000 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="receita" stroke="#82ca9d" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Honorários por Área</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Trabalhista", value: 35, fill: "#8884d8" },
                        { name: "Civil", value: 28, fill: "#82ca9d" },
                        { name: "Criminal", value: 20, fill: "#ffc658" },
                        { name: "Família", value: 17, fill: "#ff7300" },
                      ]}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label
                    />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

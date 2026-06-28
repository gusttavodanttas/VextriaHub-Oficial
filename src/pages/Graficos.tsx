
import { ChartsTab } from "@/components/Charts/ChartsTab";
import { BarChart3 } from "lucide-react";

export default function Graficos() {
  return (
    <div className="p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-2 mb-4 md:mb-6">
          <BarChart3 className="h-6 w-6 md:h-8 md:w-8 text-primary" />
          <h1 className="text-2xl md:text-3xl font-bold">Gráficos</h1>
        </div>

        <ChartsTab />
      </div>
    </div>
  );
}

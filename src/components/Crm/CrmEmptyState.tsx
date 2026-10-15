// Estado vazio das abas Lista/Convertidos do CRM (extraído de pages/Crm.tsx).
import { UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  tom: "primary" | "emerald";
  titulo: string;
  descricao: string;
  children?: React.ReactNode;
}

export function CrmEmptyState({ tom, titulo, descricao, children }: Props) {
  const emerald = tom === "emerald";
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
      <div className={cn("p-4 rounded-full border", emerald ? "bg-emerald-500/5 border-emerald-500/10" : "bg-primary/5 border-primary/10")}>
        <UserCheck className={cn("h-10 w-10", emerald ? "text-emerald-500/30" : "text-primary/30")} />
      </div>
      <div className="space-y-1">
        <p className="font-bold text-foreground">{titulo}</p>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">{descricao}</p>
      </div>
      {children}
    </div>
  );
}

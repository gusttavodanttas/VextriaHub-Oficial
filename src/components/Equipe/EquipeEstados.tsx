// StatCard e estados de erro/vazio da página de Equipe (extraídos de pages/Equipe.tsx).
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function StatCard({ label, value, Icon, color, bg }: {
  label: string; value: number | string; Icon: React.ElementType; color: string; bg: string;
}) {
  return (
    <div className="rounded-2xl bg-card border border-black/5 dark:border-border shadow-premium p-4 flex items-center gap-4">
      <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", bg)}>
        <Icon className={cn("h-5 w-5", color)} />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">{label}</p>
        <p className="text-2xl font-black tracking-tight leading-none">{value}</p>
      </div>
    </div>
  );
}

export function EquipeErro({ titulo, mensagem, onRetry }: { titulo: string; mensagem: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <div className="p-4 rounded-2xl bg-destructive/10"><AlertTriangle className="h-8 w-8 text-destructive/60" /></div>
      <p className="font-bold">{titulo}</p>
      <p className="text-sm text-muted-foreground">{mensagem}</p>
      <Button variant="outline" onClick={onRetry} className="rounded-xl font-bold mt-1">Tentar novamente</Button>
    </div>
  );
}

export function EquipeSkeleton() {
  return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}</div>;
}

export function EquipeVazio({ Icon, titulo, children }: { Icon: React.ElementType; titulo: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <div className="p-4 rounded-2xl bg-muted/40"><Icon className="h-8 w-8 text-muted-foreground/40" /></div>
      <p className="font-bold">{titulo}</p>
      {children}
    </div>
  );
}

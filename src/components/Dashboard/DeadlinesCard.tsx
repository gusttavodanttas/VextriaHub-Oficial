
import { AlertCircle, FileText, Clock, Plus, ArrowRight, Flag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useStats } from "@/hooks/useStats";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const getWeekRange = () => {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return `${fmt(now)} – ${fmt(end)}`;
};

export function DeadlinesCard() {
  const navigate = useNavigate();
  const { stats } = useStats();
  const { toast } = useToast();
  const prazos: any[] = []; // Conectar ao hook real futuramente
  const weekRange = getWeekRange();
  const hasUrgent = stats.prazosVencendo > 0;

  const [quickPrazoOpen, setQuickPrazoOpen] = useState(false);
  const [prazoTitle, setPrazoTitle] = useState("");
  const [prazoDate, setPrazoDate] = useState("");
  const [prazoPriority, setPrazoPriority] = useState("alta");

  const handleSaveQuickPrazo = () => {
    if (!prazoTitle.trim() || !prazoDate) return;
    toast({
      title: "Prazo criado",
      description: `"${prazoTitle}" foi adicionado aos seus prazos.`,
    });
    setPrazoTitle("");
    setPrazoDate("");
    setPrazoPriority("alta");
    setQuickPrazoOpen(false);
  };

  return (
    <Card className={`h-full flex flex-col border-black/5 dark:border-white/5 bg-card/40 backdrop-blur-xl rounded-[2rem] overflow-hidden group hover:shadow-xl transition-all duration-500 ${hasUrgent ? "border-rose-500/20" : ""}`}>
      {/* Urgent pulse indicator */}
      {hasUrgent && (
        <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-rose-500 to-transparent" />
      )}

      <CardHeader className="pb-3 pt-5 px-6">
        <CardTitle className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl group-hover:scale-110 transition-transform duration-300 ${hasUrgent ? "bg-rose-500/15 text-rose-500" : "bg-rose-500/10 text-rose-500"}`}>
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <span className="text-lg font-black tracking-tight block">Prazos</span>
              <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                <Clock className="h-3 w-3" /> {weekRange}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasUrgent && (
              <Badge className="text-[10px] font-bold px-2 py-0.5 rounded-xl bg-rose-500/10 text-rose-500 border-rose-500/30">
                {stats.prazosVencendo} urgente{stats.prazosVencendo > 1 ? "s" : ""}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-xs font-bold text-primary hover:bg-primary/10 rounded-xl h-8 px-3 gap-1"
              onClick={() => navigate("/prazos")}
            >
              Ver <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-center items-center p-6 text-center space-y-4">
        {prazos.length === 0 ? (
          <div className="entry-animate fade-in zoom-in duration-700 delay-100 w-full">
            <div className="relative mb-5 mx-auto w-fit">
              <div className="absolute inset-0 bg-rose-500/20 blur-3xl rounded-full" />
              <div className="relative p-5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500">
                <FileText className="h-10 w-10 opacity-80" />
              </div>
            </div>

            {/* Stats estilo eLaw */}
            <div className="bg-black/[0.03] dark:bg-background/40 rounded-2xl p-4 border border-black/5 dark:border-white/5 mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground font-medium">Prazos Urgentes</span>
                <span className={`text-2xl font-black ${hasUrgent ? "text-rose-500" : "text-muted-foreground"}`}>
                  {stats.prazosVencendo}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Alta", color: "text-rose-500", bg: "bg-rose-500/10" },
                  { label: "Média", color: "text-amber-500", bg: "bg-amber-500/10" },
                  { label: "Baixa", color: "text-emerald-500", bg: "bg-emerald-500/10" },
                ].map((p) => (
                  <div key={p.label} className={`${p.bg} rounded-xl p-2 text-center`}>
                    <Flag className={`h-3 w-3 mx-auto mb-1 ${p.color}`} />
                    <span className="text-[10px] font-bold text-muted-foreground">{p.label}</span>
                    <div className={`text-sm font-black ${p.color}`}>0</div>
                  </div>
                ))}
              </div>
            </div>

            {hasUrgent ? (
              <>
                <h4 className="text-sm font-bold text-rose-500">
                  {stats.prazosVencendo} prazo{stats.prazosVencendo > 1 ? "s" : ""} vencendo!
                </h4>
                <p className="text-xs text-muted-foreground max-w-[200px] mx-auto mt-1 mb-4">
                  Acesse a lista de prazos para gerenciá-los.
                </p>
              </>
            ) : (
              <>
                <h4 className="text-sm font-bold text-muted-foreground">Nenhum prazo urgente</h4>
                <p className="text-xs text-muted-foreground max-w-[200px] mx-auto mt-1 mb-4 leading-relaxed">
                  Prazos de processos e tarefas aparecerão aqui.
                </p>
              </>
            )}

            <Button
              variant={hasUrgent ? "default" : "outline"}
              size="sm"
              className={cn(
                "rounded-xl font-black uppercase text-[10px] tracking-widest h-11 px-8 gap-2 shadow-lg",
                hasUrgent ? "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20" : "border-black/5 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
              )}
              onClick={() => hasUrgent ? navigate("/prazos") : setQuickPrazoOpen(true)}
            >
              <Plus className="h-4 w-4" /> {hasUrgent ? "Ver Prazos Urgentes" : "Novo Prazo"}
            </Button>
          </div>
        ) : (
          <div className="w-full space-y-2">
            {prazos.map((p, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-black/[0.02] dark:bg-background/40 border border-black/5 dark:border-white/5 cursor-pointer hover:border-rose-500/20 transition-colors">
                <Flag className="h-4 w-4 text-rose-500 shrink-0" />
                <div className="flex-1 text-left">
                  <p className="text-sm font-bold truncate">{p.titulo}</p>
                  <p className="text-xs text-muted-foreground">{p.processo}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-rose-500">{p.data}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Quick Prazo Dialog */}
      <Dialog open={quickPrazoOpen} onOpenChange={setQuickPrazoOpen}>
        <DialogContent className="rounded-[2rem] border-black/5 dark:border-white/10 bg-card/90 backdrop-blur-2xl sm:max-w-md p-8 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Novo Prazo Rápido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="prazo-title" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Título do Prazo
              </Label>
              <Input
                id="prazo-title"
                placeholder="Ex: Protocolar contestação"
                value={prazoTitle}
                onChange={(e) => setPrazoTitle(e.target.value)}
                className="rounded-xl border-white/10 bg-white/5"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prazo-date" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Data de Vencimento
              </Label>
              <Input
                id="prazo-date"
                type="date"
                value={prazoDate}
                onChange={(e) => setPrazoDate(e.target.value)}
                className="rounded-xl border-white/10 bg-white/5"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Prioridade
              </Label>
              <Select value={prazoPriority} onValueChange={setPrazoPriority}>
                <SelectTrigger className="rounded-xl border-black/5 dark:border-white/10 bg-black/[0.03] dark:bg-white/5 h-12 font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-black/5 dark:border-white/10 shadow-2xl">
                  <SelectItem value="alta">🔴 Alta</SelectItem>
                  <SelectItem value="media">🟡 Média</SelectItem>
                  <SelectItem value="baixa">🟢 Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" className="rounded-xl" onClick={() => setQuickPrazoOpen(false)}>Cancelar</Button>
            <Button
              className="rounded-xl font-bold"
              onClick={handleSaveQuickPrazo}
              disabled={!prazoTitle.trim() || !prazoDate}
            >
              <Plus className="h-4 w-4 mr-2" />
              Criar Prazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

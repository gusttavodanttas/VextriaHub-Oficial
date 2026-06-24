
import { useState } from "react";
import { Calendar, AlertTriangle, User, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

const sampleTasks: any[] = [];

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "alta":
      return "bg-destructive text-destructive-foreground";
    case "media":
      return "bg-accent text-accent-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export function PriorityTasks() {
  const [completedTasks, setCompletedTasks] = useState<number[]>([]);
  const tasks = sampleTasks;

  const toggleTask = (taskId: number) => {
    setCompletedTasks(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  return (
    <Card className="h-full flex flex-col animate-fade-in glass-card border-black/5 dark:border-white/5 rounded-[2rem] overflow-hidden">
      <CardHeader className="p-6 pb-2">
        <CardTitle className="flex items-center gap-3 text-lg font-black tracking-tight">
          <div className="p-2 rounded-xl bg-amber-500/10">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </div>
          Prioridades do Dia (IA)
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-6 space-y-4">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <div className="p-4 rounded-full bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
              <AlertTriangle className="h-10 w-10 text-muted-foreground/20" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-foreground">Tudo em dia</p>
              <p className="text-sm text-muted-foreground max-w-[200px] mx-auto">
                A IA não identificou tarefas críticas para este momento.
              </p>
            </div>
          </div>
        ) : (
          tasks.map((task) => (
          <div
            key={task.id}
            className={cn(
              "p-5 rounded-[1.5rem] border transition-all duration-300 group",
              completedTasks.includes(task.id)
                ? "bg-black/[0.05] dark:bg-white/[0.05] border-transparent opacity-60"
                : "bg-black/[0.01] dark:bg-white/[0.01] border-black/5 dark:border-white/5 hover:border-primary/20 hover:shadow-lg"
            )}
          >
            <div className="flex items-start gap-4">
              <Checkbox
                checked={completedTasks.includes(task.id)}
                onCheckedChange={() => toggleTask(task.id)}
                className="mt-1 rounded-md border-black/10 dark:border-white/20"
              />
              <div className="flex-1 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <h4 className={cn(
                    "font-black text-sm text-foreground transition-all",
                    completedTasks.includes(task.id) ? "line-through text-muted-foreground" : "group-hover:text-primary"
                  )}>
                    {task.title}
                  </h4>
                  <Badge className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md shadow-sm", getPriorityColor(task.priority))}>
                    {task.priority}
                  </Badge>
                </div>
                
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3 text-primary/40" />
                    {task.dueDate}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <User className="h-3 w-3 text-primary/40" />
                    {task.client}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <FileText className="h-3 w-3 text-primary/40" />
                    {task.case}
                  </div>
                </div>
                
                <div className="bg-primary/5 dark:bg-primary/10 border border-primary/10 dark:border-primary/20 rounded-xl p-3">
                  <p className="text-[11px] text-primary font-black leading-tight flex items-center gap-2">
                    <Sparkles className="h-3 w-3 shrink-0" />
                    {task.aiSuggestion}
                  </p>
                </div>
              </div>
            </div>
          </div>
          ))
        )}
        
        {tasks.length > 0 && (
          <Button className="w-full rounded-2xl h-12 font-black uppercase text-xs tracking-widest border-black/5 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5" variant="outline">
            Ver Todas as Tarefas
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

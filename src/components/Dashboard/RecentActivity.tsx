
import { Clock, FileText, Upload, User, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";

const sampleActivities: any[] = [];

export function RecentActivity() {
  const activities = sampleActivities;

  return (
    <Card className="h-full flex flex-col animate-fade-in glass-card border-black/5 dark:border-white/5 rounded-[2rem] overflow-hidden">
      <CardHeader className="p-6 pb-2">
        <CardTitle className="flex items-center gap-3 text-lg font-black tracking-tight">
          <div className="p-2 rounded-xl bg-primary/10">
            <Clock className="h-5 w-5 text-primary" />
          </div>
          Atividades Recentes
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-6 space-y-4">
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <div className="p-4 rounded-full bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
              <Clock className="h-10 w-10 text-muted-foreground/20" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-foreground">Sem registros recentes</p>
              <p className="text-sm text-muted-foreground max-w-[200px] mx-auto">
                Suas ações no Hub aparecerão cronologicamente aqui.
              </p>
            </div>
          </div>
        ) : (
          activities.map((activity, index) => (
            <div
              key={activity.id}
              className="flex items-start gap-4 p-4 rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] hover:bg-primary/[0.03] transition-all duration-300 animate-slide-in group"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="mt-1 p-2.5 rounded-xl bg-primary/5 group-hover:bg-primary/10 transition-colors">
                <activity.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-sm text-foreground group-hover:text-primary transition-colors">{activity.title}</h4>
                  <Badge className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md shadow-sm", activity.badgeColor)}>
                    {activity.badge}
                  </Badge>
                </div>
                <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                  {activity.description}
                </p>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/30 pt-1">
                  {activity.time}
                </p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

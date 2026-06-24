
import { Trophy, TrendingUp, Target, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useUserRole } from "@/hooks/useUserRole";

interface ScoreCardProps {
  userName: string;
  totalScore: number;
  monthlyScore: number;
  weeklyScore: number;
  rank: number;
  completedTasks: number;
  totalTasks: number;
}

export function ScoreCard({ 
  userName, 
  totalScore, 
  monthlyScore, 
  weeklyScore, 
  rank, 
  completedTasks, 
  totalTasks 
}: ScoreCardProps) {
  const { shouldShowEmptyState } = useUserRole();
  
  // Para usuários normais, mostrar dados zerados
  const displayTotalScore = shouldShowEmptyState ? 0 : totalScore;
  const displayMonthlyScore = shouldShowEmptyState ? 0 : monthlyScore;
  const displayWeeklyScore = shouldShowEmptyState ? 0 : weeklyScore;
  const displayRank = shouldShowEmptyState ? 0 : rank;
  const displayCompletedTasks = shouldShowEmptyState ? 0 : completedTasks;
  const displayTotalTasks = shouldShowEmptyState ? 0 : totalTasks;
  
  const completionRate = displayTotalTasks > 0 ? (displayCompletedTasks / displayTotalTasks) * 100 : 0;

  return (
    <Card className="h-full flex flex-col bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Produtividade - {userName}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-center space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-primary/10 rounded-lg">
            <div className="text-2xl font-bold text-primary">{displayTotalScore}</div>
            <div className="text-xs text-muted-foreground">Pontos Totais</div>
          </div>
          <div className="text-center p-3 bg-accent/10 rounded-lg">
            <div className="text-2xl font-bold text-accent">{displayRank > 0 ? `#${displayRank}` : "-"}</div>
            <div className="text-xs text-muted-foreground">Ranking</div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Taxa de Conclusão</span>
            <span className="text-sm text-muted-foreground">{displayCompletedTasks}/{displayTotalTasks}</span>
          </div>
          <Progress value={completionRate} className="h-2" />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <div>
              <div className="font-medium">{displayMonthlyScore} pts</div>
              <div className="text-xs text-muted-foreground">Este mês</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-blue-500" />
            <div>
              <div className="font-medium">{displayWeeklyScore} pts</div>
              <div className="text-xs text-muted-foreground">Esta semana</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

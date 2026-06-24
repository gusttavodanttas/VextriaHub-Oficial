
import { Trophy, Medal, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const rankingData = [
  { id: 1, name: "Ana Silva", score: 1250, tasksCompleted: 25, rank: 1 },
  { id: 2, name: "Carlos Santos", score: 980, tasksCompleted: 20, rank: 2 },
  { id: 3, name: "Maria Oliveira", score: 875, tasksCompleted: 18, rank: 3 },
  { id: 4, name: "João Pedro", score: 720, tasksCompleted: 15, rank: 4 },
  { id: 5, name: "Lucia Costa", score: 650, tasksCompleted: 13, rank: 5 },
];

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <Trophy className="h-5 w-5 text-yellow-500" />;
    case 2:
      return <Medal className="h-5 w-5 text-gray-400" />;
    case 3:
      return <Award className="h-5 w-5 text-amber-600" />;
    default:
      return <span className="text-sm font-bold text-muted-foreground">#{rank}</span>;
  }
};

export function RankingTable() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Ranking de Produtividade
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {rankingData.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8">
                  {getRankIcon(user.rank)}
                </div>
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {user.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium text-sm">{user.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {user.tasksCompleted} tarefas concluídas
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-primary">{user.score}</div>
                <div className="text-xs text-muted-foreground">pontos</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

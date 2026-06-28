import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Users, Plus, Trash2, Settings2, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useOfficeTeams } from "@/hooks/useOfficeTeams";
import { useToast } from "@/hooks/use-toast";

const CORES = ["#3b82f6", "#10b981", "#a855f7", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6", "#6366f1"];

export function TeamManagement() {
  const { teams, loading, create, remove } = useOfficeTeams();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nova, setNova] = useState({ nome: "", descricao: "", cor: CORES[0] });

  const criar = async () => {
    if (!nova.nome.trim()) return;
    setSaving(true);
    const res = await create(nova.nome.trim(), nova.cor, nova.descricao.trim() || undefined);
    setSaving(false);
    if (res) {
      toast({ title: "Equipe criada", description: `"${nova.nome}" foi adicionada.` });
      setNova({ nome: "", descricao: "", cor: CORES[0] });
      setIsDialogOpen(false);
    } else {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível criar a equipe." });
    }
  };

  const excluir = async (id: string, nome: string) => {
    if (!confirm(`Excluir a equipe "${nome}"? Os membros serão desvinculados.`)) return;
    const ok = await remove(id);
    toast(ok ? { title: "Equipe excluída" } : { variant: "destructive", title: "Erro ao excluir" });
  };

  return (
    <Card className="glass-card rounded-[2rem] border-black/5 dark:border-border overflow-hidden shadow-premium">
      <CardHeader className="border-b border-black/5 dark:border-border pb-4 flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-black flex items-center gap-2">
              Equipes
              {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </CardTitle>
            <CardDescription className="text-xs font-medium">Times do escritório e seus coordenadores</CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary" className="rounded-full font-black hidden sm:inline-flex">{teams.length}</Badge>
          <Button onClick={() => setIsDialogOpen(true)} className="rounded-xl font-bold gap-1.5">
            <Plus className="h-4 w-4" /> Nova
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-5 md:p-6">
        {!loading && teams.length === 0 && (
          <div className="text-center py-12">
            <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
              <Users className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <p className="font-bold">Nenhuma equipe ainda</p>
            <p className="text-sm text-muted-foreground mt-1">Crie a primeira equipe para organizar seu time.</p>
          </div>
        )}

        <div className="grid gap-2.5">
          {teams.map((t) => (
            <div
              key={t.id}
              className="group flex items-center justify-between gap-3 p-4 rounded-2xl border border-black/5 dark:border-border bg-black/[0.01] dark:bg-white/[0.01] hover:border-primary/30 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-white font-black text-sm" style={{ backgroundColor: t.color || "#3b82f6" }}>
                  {t.name?.[0]?.toUpperCase() || "E"}
                </span>
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">{t.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {t.description || "Sem descrição"} · {t.member_count} {t.member_count === 1 ? "membro" : "membros"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="outline" size="sm" className="rounded-xl font-bold gap-1.5" onClick={() => navigate(`/equipe/${t.id}`)}>
                  <Settings2 className="h-4 w-4" /> <span className="hidden sm:inline">Gerenciar</span>
                </Button>
                <Button
                  variant="ghost" size="icon"
                  onClick={() => excluir(t.id, t.name)}
                  aria-label={`Excluir ${t.name}`}
                  className="h-9 w-9 rounded-xl text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      {/* Criar equipe */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-background border border-border p-6 rounded-[2rem] shadow-2xl">
          <DialogHeader className="pb-3 border-b border-border">
            <DialogTitle className="text-xl font-black">Criar Nova Equipe</DialogTitle>
            <DialogDescription className="text-muted-foreground mt-1">Adicione uma equipe ao seu escritório</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Nome da Equipe</Label>
              <Input placeholder="Ex: Equipe Trabalhista" value={nova.nome} onChange={(e) => setNova({ ...nova, nome: e.target.value })} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Descrição (opcional)</Label>
              <Textarea placeholder="Área de atuação ou foco da equipe…" value={nova.descricao} onChange={(e) => setNova({ ...nova, descricao: e.target.value })} rows={2} className="rounded-xl resize-none" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Cor</Label>
              <div className="flex flex-wrap gap-2">
                {CORES.map((c) => (
                  <button
                    key={c} type="button" onClick={() => setNova({ ...nova, cor: c })}
                    className={cn("h-8 w-8 rounded-full transition-all", nova.cor === c ? "ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110" : "hover:scale-105")}
                    style={{ backgroundColor: c }}
                    aria-label={`Cor ${c}`}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={criar} disabled={saving || !nova.nome.trim()} className="flex-1 rounded-xl font-bold">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />} Criar Equipe
              </Button>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl">Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

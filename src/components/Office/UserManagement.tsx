import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOfficeUsers } from '@/hooks/useOfficeUsers';
import { useInvitations } from '@/hooks/useInvitations';
import { useToast } from '@/hooks/use-toast';
import { Users, UserPlus, Mail, MoreHorizontal, Loader2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PermissionGuard } from '@/components/Auth/PermissionGuard';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const roleLabel = (role: string) => role === 'super_admin' ? 'Super Admin' : role === 'admin' ? 'Administrador' : role === 'coordinator' ? 'Coordenador' : 'Usuário';
const roleClass = (role: string) => {
  switch (role) {
    case 'super_admin': return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
    case 'admin': return 'bg-primary/10 text-primary border-primary/20';
    case 'coordinator': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    default: return 'bg-muted text-muted-foreground border-border';
  }
};

export const UserManagement: React.FC = () => {
  const { users, loading: usersLoading, updateUser, removeUser } = useOfficeUsers();
  const { createInvitation, resendInvitation, cancelInvitation, pendingInvitations } = useInvitations();
  const { toast } = useToast();

  const [isInviting, setIsInviting] = useState(false);
  const [inviteData, setInviteData] = useState({ email: '', role: 'user' as 'user' | 'admin' });

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteData.email.trim());

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailValido) return;
    setIsInviting(true);
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      const result = await createInvitation({ ...inviteData, expires_at: expiresAt.toISOString() });
      if (result) {
        toast({ title: "Convite enviado", description: `Convite enviado para ${inviteData.email}` });
        setInviteData({ email: '', role: 'user' });
      }
    } catch {
      toast({ title: "Erro ao enviar convite", description: "Não foi possível enviar o convite.", variant: "destructive" });
    } finally {
      setIsInviting(false);
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: 'user' | 'admin') => {
    const result = await updateUser(userId, { role: newRole });
    toast(result
      ? { title: "Usuário atualizado", description: "O papel do usuário foi alterado." }
      : { title: "Erro ao atualizar", variant: "destructive" });
  };

  const handleRemoveUser = async (userId: string) => {
    if (!confirm('Tem certeza que deseja remover este usuário do escritório?')) return;
    const result = await removeUser(userId);
    toast(result
      ? { title: "Usuário removido", description: "Usuário removido do escritório." }
      : { title: "Erro ao remover", variant: "destructive" });
  };

  return (
    <PermissionGuard permission="canManageOfficeUsers">
      <div className="space-y-6">
        {/* Convidar */}
        <Card className="glass-card rounded-[2rem] border-black/5 dark:border-border overflow-hidden shadow-premium">
          <CardHeader className="border-b border-black/5 dark:border-border pb-4 flex flex-row items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-black">Convidar Usuário</CardTitle>
              <CardDescription className="text-xs font-medium">Envie um convite por e-mail para a equipe</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-5 md:p-6">
            <form onSubmit={handleInviteUser} className="flex flex-col sm:flex-row gap-2">
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={inviteData.email}
                onChange={(e) => setInviteData((p) => ({ ...p, email: e.target.value }))}
                required
                className="h-11 rounded-xl flex-1"
              />
              <Select value={inviteData.role} onValueChange={(v: 'user' | 'admin') => setInviteData((p) => ({ ...p, role: v }))}>
                <SelectTrigger className="h-11 rounded-xl w-full sm:w-40 font-medium"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" disabled={isInviting || !emailValido} className="h-11 rounded-xl font-bold px-6 gap-2">
                {isInviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {isInviting ? 'Enviando…' : 'Convidar'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Usuários */}
        <Card className="glass-card rounded-[2rem] border-black/5 dark:border-border overflow-hidden shadow-premium">
          <CardHeader className="border-b border-black/5 dark:border-border pb-4 flex flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-black">Usuários do Escritório</CardTitle>
                <CardDescription className="text-xs font-medium">Membros e suas permissões</CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="rounded-full font-black shrink-0">{users.length}</Badge>
          </CardHeader>
          <CardContent className="p-5 md:p-6">
            {usersLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary/40" /></div>
            ) : (
              <div className="grid gap-2.5">
                {users.map((user) => {
                  const p = (user as any).profile;
                  const nome = p?.full_name || 'Sem nome';
                  return (
                    <div key={user.id} className="group flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-black/5 dark:border-border bg-black/[0.01] dark:bg-white/[0.01] hover:border-primary/30 transition-all">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-10 w-10 rounded-xl shrink-0">
                          <AvatarImage src={p?.avatar_url || undefined} className="object-cover" />
                          <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-black text-xs">
                            {nome.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate">{nome}</p>
                          <p className="text-xs text-muted-foreground truncate">{p?.email || '—'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border hidden sm:inline-block", roleClass(user.role))}>
                          {roleLabel(user.role)}
                        </span>
                        <span className="text-[11px] text-muted-foreground/60 font-medium hidden md:inline">
                          {new Date(user.joined_at).toLocaleDateString('pt-BR')}
                        </span>
                        {user.role !== 'super_admin' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl">
                              <DropdownMenuItem onClick={() => handleUpdateUserRole(user.id, user.role === 'admin' ? 'user' : 'admin')}>
                                {user.role === 'admin' ? 'Tornar Usuário' : 'Tornar Administrador'}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleRemoveUser(user.id)} className="text-destructive">
                                Remover do Escritório
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Convites pendentes */}
        {pendingInvitations.length > 0 && (
          <Card className="glass-card rounded-[2rem] border-black/5 dark:border-border overflow-hidden shadow-premium">
            <CardHeader className="border-b border-black/5 dark:border-border pb-4 flex flex-row items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-black">Convites Pendentes</CardTitle>
                <CardDescription className="text-xs font-medium">Aguardando aceite</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-5 md:p-6">
              <div className="grid gap-2.5">
                {pendingInvitations.map((inv) => (
                  <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-black/5 dark:border-border bg-black/[0.01] dark:bg-white/[0.01]">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm truncate">{inv.email}</p>
                        <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-black uppercase border", roleClass(inv.role))}>{roleLabel(inv.role)}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Expira em {new Date(inv.expires_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" className="rounded-xl font-bold" onClick={() => resendInvitation(inv.id)}>Reenviar</Button>
                      <Button size="sm" variant="ghost" className="rounded-xl font-bold text-destructive hover:bg-destructive/10" onClick={() => cancelInvitation(inv.id)}>Cancelar</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PermissionGuard>
  );
};

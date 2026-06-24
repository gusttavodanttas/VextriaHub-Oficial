import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useOfficeUsers } from '@/hooks/useOfficeUsers';
import { useInvitations } from '@/hooks/useInvitations';
import { useToast } from '@/hooks/use-toast';
import { Users, UserPlus, Mail, MoreHorizontal } from 'lucide-react';
import { PermissionGuard } from '@/components/Auth/PermissionGuard';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

export const UserManagement: React.FC = () => {
  const { users, loading: usersLoading, updateUser, removeUser } = useOfficeUsers();
  const { 
    invitations, 
    createInvitation, 
    resendInvitation, 
    cancelInvitation,
    pendingInvitations 
  } = useInvitations();
  const { toast } = useToast();
  
  const [isInviting, setIsInviting] = useState(false);
  const [inviteData, setInviteData] = useState({
    email: '',
    role: 'user' as 'user' | 'admin'
  });

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInviting(true);
    
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 dias
      
      const result = await createInvitation({
        ...inviteData,
        expires_at: expiresAt.toISOString()
      });
      if (result) {
        toast({
          title: "Convite enviado",
          description: `Convite enviado para ${inviteData.email}`,
        });
        setInviteData({ email: '', role: 'user' });
      }
    } catch (error) {
      toast({
        title: "Erro ao enviar convite",
        description: "Não foi possível enviar o convite.",
        variant: "destructive",
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: 'user' | 'admin') => {
    try {
      const result = await updateUser(userId, { role: newRole });
      if (result) {
        toast({
          title: "Usuário atualizado",
          description: "O papel do usuário foi alterado com sucesso.",
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível alterar o papel do usuário.",
        variant: "destructive",
      });
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (confirm('Tem certeza que deseja remover este usuário do escritório?')) {
      try {
        const result = await removeUser(userId);
        if (result) {
          toast({
            title: "Usuário removido",
            description: "Usuário removido do escritório com sucesso.",
          });
        }
      } catch (error) {
        toast({
          title: "Erro ao remover",
          description: "Não foi possível remover o usuário.",
          variant: "destructive",
        });
      }
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'super_admin': return 'destructive';
      case 'admin': return 'default';
      default: return 'secondary';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin': return 'Super Admin';
      case 'admin': return 'Admin';
      default: return 'Usuário';
    }
  };

  return (
    <PermissionGuard permission="canManageOfficeUsers">
      <div className="space-y-6">
        {/* Formulário de Convite */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Convidar Usuário
            </CardTitle>
            <CardDescription>
              Envie um convite para adicionar um novo usuário ao escritório
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInviteUser} className="flex gap-4">
              <div className="flex-1">
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={inviteData.email}
                  onChange={(e) => setInviteData(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>
              <Select
                value={inviteData.role}
                onValueChange={(value: 'user' | 'admin') => 
                  setInviteData(prev => ({ ...prev, role: value }))
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" disabled={isInviting}>
                {isInviting ? 'Enviando...' : 'Convidar'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Lista de Usuários */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Usuários do Escritório
            </CardTitle>
            <CardDescription>
              Gerencie os usuários e suas permissões
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead>Data de Ingresso</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {(user as any).profile?.full_name || 'Nome não disponível'}
                      </TableCell>
                      <TableCell>{(user as any).profile?.email}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(user.role)}>
                          {getRoleLabel(user.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(user.joined_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {user.role !== 'super_admin' && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => handleUpdateUserRole(
                                    user.id, 
                                    user.role === 'admin' ? 'user' : 'admin'
                                  )}
                                >
                                  {user.role === 'admin' ? 'Tornar Usuário' : 'Tornar Admin'}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleRemoveUser(user.id)}
                                  className="text-destructive"
                                >
                                  Remover do Escritório
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Convites Pendentes */}
        {pendingInvitations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Convites Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead>Enviado em</TableHead>
                    <TableHead>Expira em</TableHead>
                    <TableHead className="w-32">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingInvitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell>{invitation.email}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(invitation.role)}>
                          {getRoleLabel(invitation.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(invitation.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        {new Date(invitation.expires_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => resendInvitation(invitation.id)}
                          >
                            Reenviar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => cancelInvitation(invitation.id)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </PermissionGuard>
  );
};
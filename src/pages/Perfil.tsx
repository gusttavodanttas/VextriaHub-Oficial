

import { getErrorMessage, assertRowsAffected } from "@/lib/errors";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UserCircle, Mail, Award, Edit, Save, Scale, Loader2, CalendarDays, X, Clock } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useMyStats } from "@/hooks/useMyStats";
import { ActivityCard } from "@/components/Perfil/ActivityCard";
import { SecurityCard } from "@/components/Perfil/SecurityCard";
import { PerformanceHub } from "@/components/Perfil/PerformanceHub";
import { PerfilCamposForm, type PerfilInfo } from "@/components/Perfil/PerfilCamposForm";
import { formatPhone, isValidPhone } from "@/lib/phone";
import { uploadPublicImage, validateImage } from "@/lib/uploadImage";
import { Camera } from "lucide-react";
import { cn } from "@/lib/utils";

const Perfil = () => {
  const { user, profile, office, session, isLoading, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [userInfo, setUserInfo] = useState<PerfilInfo>({
    nome: "Carregando...",
    email: "Carregando...",
    telefone: "",
    endereco: "",
    oab: "",
    oab_uf: "DF",
    cpf_cnpj: "",
  });

  // "coordinator" só existe em office_team_members.role — uma tabela e coluna
  // totalmente diferente de office_users.role (de onde user.office_role vem, com
  // valores user/admin/owner). `office_role === "coordinator"` nunca é verdadeiro;
  // um coordenador de time real sempre caía em "Membro" aqui. Busca à parte.
  const [isTeamCoordinator, setIsTeamCoordinator] = useState(false);
  useEffect(() => {
    if (!user?.id) return;
    supabase.from('office_team_members').select('id').eq('user_id', user.id).eq('role', 'coordinator').limit(1).maybeSingle()
      .then(({ data }) => setIsTeamCoordinator(!!data));
  }, [user?.id]);

  // Preenche dados reais da Sessão Pessoal logada assim que carregar
  useEffect(() => {
    if (user || profile) {
      setUserInfo(prev => ({
        ...prev,
        nome: profile?.full_name || user?.name || "Usuário",
        email: profile?.email || user?.email || "email@exemplo.com",
        telefone: profile?.phone ? formatPhone(profile.phone) : prev.telefone,
        endereco: profile?.address || prev.endereco,
        oab: profile?.oab || prev.oab,
        oab_uf: profile?.oab_uf || prev.oab_uf,
        cpf_cnpj: profile?.cpf_cnpj || prev.cpf_cnpj,
      }));
    }
  }, [user, profile]);

  const myStats = useMyStats();

  // O usuário do AuthContext não carrega created_at — a data vem do perfil.
  const createdAt = profile?.created_at;
  const memberSince = createdAt
    ? new Date(createdAt).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
    : null;

  const [lastAccess, setLastAccess] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const t = data.user?.last_sign_in_at;
      if (t) setLastAccess(new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }));
    });
  }, []);

  // Papel real: prioriza o papel no escritório (owner/admin) sobre o profiles.role
  const officeRole = user?.office_role ?? undefined;
  const roleLabel =
    officeRole === "owner" ? "Proprietário" :
    (officeRole === "super_admin" || profile?.role === "super_admin") ? "Super Admin" :
    (officeRole === "admin" || profile?.role === "admin") ? "Administrador" :
    isTeamCoordinator ? "Coordenador" : "Membro";

  useEffect(() => {
    if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);
  }, [profile?.avatar_url]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const err = validateImage(file);
      if (err) { toast({ variant: "destructive", title: "Imagem inválida", description: err }); return; }
      const targetId = profile?.id || user?.id;
      const targetCol = profile?.id ? "id" : "user_id";
      if (!targetId) return;
      try {
        setUploadingAvatar(true);
        const url = await uploadPublicImage("avatars", file, user?.id || "user");
        const { data, error } = await supabase.from("profiles").update({ avatar_url: url }).eq(targetCol, targetId).select("id");
        assertRowsAffected(data, error, 1);
        setAvatarUrl(url);
        if (refreshProfile) await refreshProfile();
        toast({ title: "Foto atualizada", description: "Sua foto de perfil foi alterada." });
      } catch (err: unknown) {
        toast({ variant: "destructive", title: "Erro ao enviar foto", description: getErrorMessage(err, "Verifique se o bucket de imagens existe.") });
      } finally {
        setUploadingAvatar(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    }
  };

  // O "x" da foto ficava colado no botão de trocar — 1 clique errado apagava a foto.
  const [confirmRemoveAvatar, setConfirmRemoveAvatar] = useState(false);
  const handleRemoveAvatar = async () => {
    if (!avatarUrl) return;
    const targetId = profile?.id || user?.id;
    const targetCol = profile?.id ? "id" : "user_id";
    if (!targetId) return;
    try {
      setUploadingAvatar(true);
      const { data, error } = await supabase.from("profiles").update({ avatar_url: null }).eq(targetCol, targetId).select("id");
      assertRowsAffected(data, error, 1);
      setAvatarUrl("");
      if (refreshProfile) await refreshProfile();
      toast({ title: "Foto removida" });
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "Erro", description: getErrorMessage(err) });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    try {
      if (!user?.id && !profile?.id) {
        toast({ title: "Aviso", description: "Dados da sessão ainda carregando. Tente novamente." });
        return;
      }

      if (!isValidPhone(userInfo.telefone)) {
        toast({ variant: "destructive", title: "Telefone inválido", description: "Use o formato (XX) XXXXX-XXXX." });
        return;
      }

      setIsSaving(true);

      const updatePayload = {
        full_name: userInfo.nome,
        phone: userInfo.telefone,
        address: userInfo.endereco,
        oab: userInfo.oab,
        oab_uf: userInfo.oab_uf,
      };
      
      // Update explícito via chave primária (fallback pra .eq('user_id')) se a PK id falhar
      const targetId = profile?.id || user?.id;
      const targetColumn = profile?.id ? 'id' : 'user_id';
      if (!targetId) { setIsSaving(false); return; }

      const { data, error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq(targetColumn, targetId)
        .select()
        .single();

      if (error) throw error;

      // Atualizar o estado global imediatamente para mudar o menu lateral
      if (refreshProfile) await refreshProfile();

      toast({
        title: "Sucesso",
        description: "Perfil atualizado com sucesso!",
      });
      setEditMode(false);
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar",
        description: getErrorMessage(err, "Houve uma falha oculta ao se comunicar com o banco de dados."),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 p-4 md:p-8 space-y-8 md:space-y-12 overflow-x-hidden entry-animate">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <UserCircle className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-foreground">
              Meu Perfil
            </h1>
          </div>
          <p className="text-sm md:text-lg text-muted-foreground font-medium max-w-2xl px-1">
            Gestão automatizada de identidade e credenciais profissionais.
          </p>
        </div>
        
        <div className="flex items-center gap-3 glass-morphism p-2 rounded-2xl shadow-premium">
          <Button 
            variant={editMode ? "default" : "outline"}
            size="lg"
            className={cn(
              "rounded-xl h-12 font-black px-8 transition-all uppercase text-xs tracking-widest",
              editMode ? "bg-primary text-foreground shadow-premium" : "bg-card/50 border-border hover:bg-card"
            )}
            onClick={() => editMode ? handleSave() : setEditMode(true)}
            disabled={isSaving}
          >
            {editMode ? <Save className="h-5 w-5 mr-2" /> : <Edit className="h-5 w-5 mr-2" />}
            {editMode ? (isSaving ? "Gravando..." : "Salvar") : "Editar Perfil"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:gap-10 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          <div className="glass-card rounded-[2.5rem] border-border bg-card/40 shadow-premium relative overflow-hidden">
            {/* Cover */}
            <div className="h-28 md:h-36 relative overflow-hidden bg-gradient-to-br from-primary via-primary/70 to-primary/30">
              {office?.logo_url ? (
                <>
                  <img src={office.logo_url} alt="Logo do escritório" className="absolute inset-0 h-full w-full object-cover" />
                  {/* escurece a base para manter avatar/nome legíveis */}
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />
                </>
              ) : (
                <>
                  <div
                    className="absolute inset-0 opacity-20 mix-blend-overlay"
                    style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "22px 22px" }}
                  />
                  <Scale className="absolute right-6 bottom-3 h-16 w-16 text-white/20 pointer-events-none" />
                </>
              )}
            </div>

            {/* Identidade */}
            <div className="px-6 md:px-10 -mt-14 md:-mt-16 relative z-10">
              <div className="flex flex-col md:flex-row md:items-end gap-5">
                <div className="relative w-fit mx-auto md:mx-0">
                  <Avatar className="h-24 w-24 md:h-28 md:w-28 rounded-[1.6rem] ring-4 ring-background shadow-2xl overflow-hidden">
                    <AvatarImage src={avatarUrl || undefined} className="object-cover w-full h-full" />
                    <AvatarFallback className="text-3xl font-black bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
                      {userInfo.nome?.substring(0, 2).toUpperCase() || "US"}
                    </AvatarFallback>
                  </Avatar>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploadingAvatar}
                    aria-label="Alterar foto de perfil"
                    className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg border-2 border-background hover:scale-105 transition-transform disabled:opacity-60"
                  >
                    {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  </button>
                  {avatarUrl && !uploadingAvatar && (
                    <button
                      type="button"
                      onClick={() => setConfirmRemoveAvatar(true)}
                      aria-label="Remover foto"
                      className="absolute -top-1 -right-1 h-7 w-7 rounded-full bg-destructive text-white flex items-center justify-center shadow-lg border-2 border-background hover:scale-105 transition-transform"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <DeleteConfirmDialog
                    open={confirmRemoveAvatar}
                    onOpenChange={setConfirmRemoveAvatar}
                    title="Remover foto de perfil"
                    description="Sua foto será removida e as iniciais do seu nome voltam a aparecer no lugar."
                    confirmText="Remover"
                    onConfirm={() => { setConfirmRemoveAvatar(false); handleRemoveAvatar(); }}
                  />
                </div>

                <div className="flex-1 text-center md:text-left space-y-2 md:pb-2">
                  {editMode ? (
                    <Input
                      className="text-2xl font-black bg-background/50 border-border rounded-xl px-4 h-12 md:w-[360px]"
                      value={userInfo.nome}
                      onChange={(e) => setUserInfo({ ...userInfo, nome: e.target.value })}
                      placeholder="Nome Completo"
                    />
                  ) : (
                    <h2
                      className="text-2xl md:text-3xl font-black tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]"
                      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.9), 0 2px 12px rgba(0,0,0,0.7)" }}
                    >
                      {userInfo.nome}
                    </h2>
                  )}
                  <div className="flex flex-wrap justify-center md:justify-start items-center gap-2">
                    <Badge className="bg-primary/10 text-primary border-primary/20 font-black px-3 py-1 rounded-lg uppercase text-[10px] tracking-widest">
                      {roleLabel}
                    </Badge>
                    {userInfo.oab && (
                      <Badge variant="outline" className="bg-background text-muted-foreground/70 border-border font-black px-3 py-1 rounded-lg uppercase text-[10px] tracking-widest">
                        OAB {userInfo.oab}/{userInfo.oab_uf}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Linha de informações rápidas */}
              <div className="mt-5 flex flex-wrap justify-center md:justify-start gap-x-6 gap-y-2 text-xs">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 text-primary/70" /><span className="font-bold text-foreground/70 truncate max-w-[220px]">{userInfo.email}</span>
                </span>
                {memberSince && (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5 text-primary/70" /> Membro desde <span className="font-bold text-foreground/70 capitalize">{memberSince}</span>
                  </span>
                )}
                {lastAccess && (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 text-primary/70" /> Último acesso <span className="font-bold text-foreground/70">{lastAccess}</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Award className="h-3.5 w-3.5 text-primary/70" /><span className="font-bold text-foreground/70">{myStats.loading ? "…" : myStats.isError ? "—" : `${myStats.pontos} pts`}</span>
                </span>
              </div>
            </div>

            <PerfilCamposForm editMode={editMode} setEditMode={setEditMode} userInfo={userInfo} setUserInfo={setUserInfo} />
          </div>

          <ActivityCard />
        </div>

        <div className="space-y-6">
          <PerformanceHub myStats={myStats} />

          <SecurityCard />
        </div>
      </div>

    </div>
  );
};

export default Perfil;

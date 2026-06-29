

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UserCircle,
  Mail,
  Phone,
  MapPin,
  Award,
  Edit,
  Save,
  Scale,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  CalendarDays,
  X
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useMyStats } from "@/hooks/useMyStats";
import { formatPhone, isValidPhone } from "@/lib/phone";
import { uploadPublicImage, validateImage } from "@/lib/uploadImage";
import { CityCombobox } from "@/components/ui/CityCombobox";
import { Camera } from "lucide-react";
import { cn } from "@/lib/utils";

const ESTADOS_BRASIL = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

const Perfil = () => {
  const { user, profile, office, session, isLoading, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [userInfo, setUserInfo] = useState({
    nome: "Carregando...",
    email: "Carregando...",
    telefone: "",
    endereco: "",
    cargo: "Não informado",
    oab: "",
    oab_uf: "DF",
  });

  // Preenche dados reais da Sessão Pessoal logada assim que carregar
  useEffect(() => {
    if (user || profile) {
      setUserInfo(prev => ({
        ...prev,
        nome: profile?.full_name || user?.name || "Usuário",
        email: profile?.email || user?.email || "email@exemplo.com",
        telefone: profile?.phone ? formatPhone(profile.phone) : prev.telefone,
        endereco: profile?.address || prev.endereco,
        cargo: (user as any)?.office_role === 'owner' ? 'Proprietário'
               : ((user as any)?.office_role === 'admin' || profile?.role === 'admin') ? 'Administrador'
               : ((user as any)?.office_role === 'super_admin' || profile?.role === 'super_admin') ? 'Super Admin'
               : (user as any)?.office_role === 'coordinator' ? 'Coordenador' : 'Membro',
        oab: profile?.oab || prev.oab,
        oab_uf: profile?.oab_uf || prev.oab_uf,
      }));
    }
  }, [user, profile]);

  const myStats = useMyStats();

  const createdAt = (profile as any)?.created_at || (user as any)?.created_at;
  const memberSince = createdAt
    ? new Date(createdAt).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
    : null;

  // Papel real: prioriza o papel no escritório (owner/admin) sobre o profiles.role
  const officeRole = (user as any)?.office_role as string | undefined;
  const roleLabel =
    officeRole === "owner" ? "Proprietário" :
    (officeRole === "super_admin" || profile?.role === "super_admin") ? "Super Admin" :
    (officeRole === "admin" || profile?.role === "admin") ? "Administrador" :
    officeRole === "coordinator" ? "Coordenador" : "Membro";

  useEffect(() => {
    if ((profile as any)?.avatar_url) setAvatarUrl((profile as any).avatar_url);
  }, [(profile as any)?.avatar_url]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const err = validateImage(file);
      if (err) { toast({ variant: "destructive", title: "Imagem inválida", description: err }); return; }
      const targetId = profile?.id || user?.id;
      const targetCol = profile?.id ? "id" : "user_id";
      try {
        setUploadingAvatar(true);
        const url = await uploadPublicImage("avatars", file, user?.id || "user");
        const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq(targetCol, targetId);
        if (error) throw error;
        setAvatarUrl(url);
        if (refreshProfile) await refreshProfile();
        toast({ title: "Foto atualizada", description: "Sua foto de perfil foi alterada." });
      } catch (err: any) {
        toast({ variant: "destructive", title: "Erro ao enviar foto", description: err?.message || "Verifique se o bucket de imagens existe." });
      } finally {
        setUploadingAvatar(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    }
  };

  const handleRemoveAvatar = async () => {
    if (!avatarUrl) return;
    const targetId = profile?.id || user?.id;
    const targetCol = profile?.id ? "id" : "user_id";
    try {
      setUploadingAvatar(true);
      const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq(targetCol, targetId);
      if (error) throw error;
      setAvatarUrl("");
      if (refreshProfile) await refreshProfile();
      toast({ title: "Foto removida" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro", description: err?.message });
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
    } catch (err: any) {
      console.error("Erro no catch do update:", err);
      toast({
        variant: "destructive",
        title: "Erro ao atualizar",
        description: err?.message || "Houve uma falha oculta ao se comunicar com o banco de dados.",
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
            <div className="h-28 md:h-32 bg-gradient-to-br from-primary via-primary/70 to-primary/30 relative">
              <div
                className="absolute inset-0 opacity-20 mix-blend-overlay"
                style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "22px 22px" }}
              />
              {(office as any)?.logo_url ? (
                <div className="absolute top-3 right-3 md:top-4 md:right-5 h-11 md:h-12 px-2.5 rounded-xl bg-white/95 shadow-lg flex items-center">
                  <img src={(office as any).logo_url} alt="Logo do escritório" className="h-7 md:h-8 max-w-[140px] object-contain" />
                </div>
              ) : (
                <Scale className="absolute right-6 bottom-3 h-16 w-16 text-white/20 pointer-events-none" />
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
                      onClick={handleRemoveAvatar}
                      aria-label="Remover foto"
                      className="absolute -top-1 -right-1 h-7 w-7 rounded-full bg-destructive text-white flex items-center justify-center shadow-lg border-2 border-background hover:scale-105 transition-transform"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
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
                    <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">{userInfo.nome}</h2>
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
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Award className="h-3.5 w-3.5 text-primary/70" /><span className="font-bold text-foreground/70">{myStats.loading ? "…" : `${myStats.pontos} pts`}</span>
                </span>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 px-6 md:px-10 py-8 mt-6 border-t border-border/50 relative z-10">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50 px-1">Endereço de E-mail</Label>
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-background/50 border border-border group hover:border-primary/20 transition-all shadow-sm">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-foreground transition-all shadow-inner">
                    <Mail className="h-5 w-5" />
                  </div>
                  {editMode ? (
                    <Input
                      className="bg-transparent border-none p-0 h-auto font-black shadow-none focus-visible:ring-0 text-foreground"
                      value={userInfo.email}
                      readOnly
                    />
                  ) : (
                    <span className="font-bold truncate text-foreground/80">{userInfo.email}</span>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50 px-1">Telefone / WhatsApp</Label>
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-background/50 border border-border group hover:border-primary/20 transition-all shadow-sm">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-foreground transition-all shadow-inner">
                    <Phone className="h-5 w-5" />
                  </div>
                  {editMode ? (
                    <Input
                      className="bg-transparent border-none p-0 h-auto font-black shadow-none focus-visible:ring-0 text-foreground"
                      value={userInfo.telefone}
                      onChange={(e) => setUserInfo({...userInfo, telefone: formatPhone(e.target.value)})}
                      inputMode="numeric"
                      placeholder="(11) 91234-5678"
                    />
                  ) : (
                    <span className="font-bold text-foreground/80">{userInfo.telefone || "Não informado"}</span>
                  )}
                </div>
                {editMode && userInfo.telefone && !isValidPhone(userInfo.telefone) && (
                  <p className="text-[11px] font-bold text-destructive px-1">Telefone incompleto ou inválido.</p>
                )}
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50 px-1">Registro OAB (Número e Estado)</Label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 flex items-center gap-4 p-4 rounded-2xl bg-background/50 border border-border group hover:border-primary/20 transition-all shadow-sm">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-foreground transition-all shadow-inner">
                      <Scale className="h-5 w-5" />
                    </div>
                    {editMode ? (
                      <Input
                        className="bg-transparent border-none p-0 h-auto font-black shadow-none focus-visible:ring-0 text-foreground"
                        value={userInfo.oab}
                        onChange={(e) => setUserInfo({...userInfo, oab: e.target.value})}
                        placeholder="Número da OAB"
                      />
                    ) : (
                      <span className="font-bold text-foreground/80">{userInfo.oab || "Não informado"}</span>
                    )}
                  </div>
                  {editMode && (
                    <div className="w-32">
                      <Select 
                        value={userInfo.oab_uf} 
                        onValueChange={(val) => setUserInfo({...userInfo, oab_uf: val})}
                      >
                        <SelectTrigger className="h-14 rounded-2xl border-border bg-background/50 font-black">
                          <SelectValue placeholder="UF" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-border bg-card shadow-2xl max-h-[300px]">
                          {ESTADOS_BRASIL.map(uf => (
                            <SelectItem key={uf} value={uf} className="rounded-xl font-bold">{uf}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50 px-1">Localização (Cidade)</Label>
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-background/50 border border-border group hover:border-primary/20 transition-all shadow-sm">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-foreground transition-all shadow-inner">
                    <MapPin className="h-5 w-5" />
                  </div>
                  {editMode ? (
                    <div className="flex-1 min-w-0">
                      <CityCombobox value={userInfo.endereco} onChange={(val) => setUserInfo({ ...userInfo, endereco: val })} />
                    </div>
                  ) : (
                    <span className="font-bold truncate text-foreground/80">{userInfo.endereco || "Não informado"}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card p-8 rounded-[2.5rem] border-border bg-card/40 shadow-premium space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black flex items-center gap-3 text-foreground">
                <Award className="h-6 w-6 text-primary" />
                Performance Hub
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="p-6 rounded-3xl bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-all text-center shadow-inner">
                <p className="text-4xl font-black text-primary mb-1">{myStats.loading ? "…" : myStats.pontos}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">Pontuação Meritocrática</p>
              </div>

              <div className="p-6 rounded-3xl bg-background/50 border border-border hover:bg-card transition-all text-center shadow-inner">
                <p className="text-4xl font-black mb-1 text-foreground">{myStats.loading ? "…" : myStats.tarefasConcluidas}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Tarefas Concluídas</p>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-border/50">
              <div className="flex justify-between items-center px-2">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Processos Ativos</span>
                <span className="text-lg font-black text-foreground">{myStats.processosAtivos}</span>
              </div>
              <div className="flex justify-between items-center px-2">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Processos Finalizados</span>
                <span className="text-lg font-black text-foreground">{myStats.processosFinalizados}</span>
              </div>
              <div className="flex justify-between items-center px-2">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Clientes Cadastrados</span>
                <span className="text-lg font-black text-foreground">{myStats.clientesAtendidos}</span>
              </div>
            </div>
          </div>

          <SecurityCard />
        </div>
      </div>

    </div>
  );
};

/* ---------- Segurança (alterar senha) ---------- */
function SecurityCard() {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const emailAtual = profile?.email || user?.email || "";

  const [novoEmail, setNovoEmail] = useState("");
  const [salvandoEmail, setSalvandoEmail] = useState(false);

  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(novoEmail.trim());
  const emailDiferente = novoEmail.trim() && novoEmail.trim().toLowerCase() !== emailAtual.toLowerCase();
  const podeTrocarEmail = emailValido && emailDiferente && !salvandoEmail;

  const curta = novaSenha.length > 0 && novaSenha.length < 6;
  const diverge = confirmar.length > 0 && confirmar !== novaSenha;
  const podeSalvar = novaSenha.length >= 6 && confirmar === novaSenha && !salvando;

  const alterarEmail = async () => {
    if (!podeTrocarEmail) return;
    setSalvandoEmail(true);
    const { error } = await supabase.auth.updateUser({ email: novoEmail.trim() });
    setSalvandoEmail(false);
    if (error) {
      toast({ variant: "destructive", title: "Erro ao alterar e-mail", description: error.message });
      return;
    }
    toast({ title: "Confirme no seu e-mail", description: "Enviamos um link de confirmação para o novo endereço." });
    setNovoEmail("");
  };

  const alterar = async () => {
    if (!podeSalvar) return;
    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    setSalvando(false);
    if (error) {
      toast({ variant: "destructive", title: "Erro ao alterar senha", description: error.message });
      return;
    }
    toast({ title: "Senha alterada", description: "Sua nova senha já está ativa." });
    setNovaSenha(""); setConfirmar("");
  };

  return (
    <div className="glass-card p-8 rounded-[2.5rem] border-border bg-card/40 shadow-premium space-y-6">
      <h3 className="text-xl font-black flex items-center gap-3 text-foreground">
        <Lock className="h-6 w-6 text-primary" />
        Segurança
      </h3>

      {/* Trocar e-mail */}
      <div className="space-y-1.5 pb-6 border-b border-border/50">
        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">Alterar e-mail de acesso</Label>
        <p className="text-[11px] text-muted-foreground -mt-0.5 mb-1">Atual: <span className="font-bold text-foreground/70">{emailAtual}</span></p>
        <Input
          type="email"
          value={novoEmail}
          onChange={(e) => setNovoEmail(e.target.value)}
          placeholder="novo@email.com"
          className={cn("h-12 rounded-2xl bg-background/50", novoEmail && !emailValido && "border-destructive focus-visible:ring-destructive")}
        />
        {novoEmail && !emailValido && <p className="text-[11px] font-bold text-destructive px-1">E-mail inválido.</p>}
        <Button onClick={alterarEmail} disabled={!podeTrocarEmail} variant="outline" className="w-full h-11 rounded-2xl font-black uppercase text-xs tracking-widest gap-2 mt-1">
          {salvandoEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          {salvandoEmail ? "Enviando…" : "Alterar e-mail"}
        </Button>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">Nova senha</Label>
          <div className="relative">
            <Input
              type={mostrar ? "text" : "password"}
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className={cn("h-12 rounded-2xl pr-11 bg-background/50", curta && "border-destructive focus-visible:ring-destructive")}
            />
            <button
              type="button"
              onClick={() => setMostrar((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
              aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
            >
              {mostrar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {curta && <p className="text-[11px] font-bold text-destructive px-1">Use ao menos 6 caracteres.</p>}
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">Confirmar nova senha</Label>
          <Input
            type={mostrar ? "text" : "password"}
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            placeholder="Repita a nova senha"
            className={cn("h-12 rounded-2xl bg-background/50", diverge && "border-destructive focus-visible:ring-destructive")}
          />
          {diverge && <p className="text-[11px] font-bold text-destructive px-1">As senhas não coincidem.</p>}
        </div>

        <Button onClick={alterar} disabled={!podeSalvar} className="w-full h-12 rounded-2xl font-black uppercase text-xs tracking-widest gap-2">
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          {salvando ? "Alterando…" : "Alterar Senha"}
        </Button>
      </div>
    </div>
  );
}

export default Perfil;



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
  Briefcase,
  Edit,
  Save,
  Scale
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const ESTADOS_BRASIL = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", 
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

const Perfil = () => {
  const { user, profile, session, isLoading, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [userInfo, setUserInfo] = useState({
    nome: "Carregando...",
    email: "Carregando...",
    telefone: "(xx) xxxxx-xxxx",
    endereco: "Não informado",
    cargo: "Não informado",
    oab: "Não informado",
    oab_uf: "DF",
    especializacao: "Não informado",
  });

  // Preenche dados reais da Sessão Pessoal logada assim que carregar
  useEffect(() => {
    if (user || profile) {
      setUserInfo(prev => ({
        ...prev,
        nome: profile?.full_name || user?.name || "Usuário",
        email: profile?.email || user?.email || "email@exemplo.com",
        telefone: profile?.phone || prev.telefone,
        endereco: profile?.address || prev.endereco,
        cargo: profile?.position || (profile?.role === 'super_admin' ? 'CEO / Super Admin' : 
               profile?.role === 'admin' ? 'Administrador' : 'Membro Comum'),
        oab: profile?.oab || prev.oab,
        oab_uf: profile?.oab_uf || prev.oab_uf,
        especializacao: profile?.specialization || prev.especializacao
      }));
    }
  }, [user, profile]);

  const estatisticas = {
    processosAtivos: 0,
    processosFinalizados: 0,
    clientesAtendidos: 0,
    pontuacaoTotal: 0,
    ranking: "--"
  };

  const handleSave = async () => {
    try {
      if (!user?.id && !profile?.id) {
        toast({ title: "Aviso", description: "Dados da sessão ainda carregando. Tente novamente." });
        return;
      }
      
      setIsSaving(true);
      console.log('Tentando atualizar perfil do usuário:', user?.id || profile?.id);

      const updatePayload = { 
        full_name: userInfo.nome,
        phone: userInfo.telefone,
        address: userInfo.endereco,
        specialization: userInfo.especializacao,
        oab: userInfo.oab,
        oab_uf: userInfo.oab_uf,
        position: userInfo.cargo
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

      if (error) {
        console.error("Erro do supabase:", error);
        throw error;
      }

      console.log("Sucesso ao atualizar:", data);
      
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
              editMode ? "bg-primary text-white shadow-premium" : "bg-card/50 border-border hover:bg-card"
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
          <div className="glass-card p-8 md:p-10 rounded-[2.5rem] border-border bg-card/40 shadow-premium space-y-10 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
              <UserCircle className="h-40 w-40" />
            </div>

            <div className="flex flex-col md:flex-row items-center md:items-start gap-8 relative z-10">
              <div className="avatar-premium-wrapper p-1.5 rounded-[2rem] bg-gradient-to-br from-primary to-primary/30 shadow-premium">
                <Avatar className="h-24 w-24 md:h-32 md:w-32 rounded-[1.8rem] border-4 border-background">
                  <AvatarImage src="/placeholder.svg" className="object-cover" />
                  <AvatarFallback className="text-3xl font-black bg-muted text-primary">
                    {userInfo.nome?.substring(0, 2).toUpperCase() || "US"}
                  </AvatarFallback>
                </Avatar>
              </div>
              
              <div className="text-center md:text-left space-y-4">
                <div className="space-y-1">
                  {editMode ? (
                    <Input
                      className="text-2xl md:text-3xl font-black bg-background/50 border-border rounded-xl px-4 py-6 h-auto md:w-[400px]"
                      value={userInfo.nome}
                      onChange={(e) => setUserInfo({...userInfo, nome: e.target.value})}
                      placeholder="Nome Completo"
                    />
                  ) : (
                    <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-foreground">{userInfo.nome}</h2>
                  )}
                  <p className="text-primary font-black tracking-[0.2em] uppercase text-[10px] opacity-80">{userInfo.cargo}</p>
                </div>
                
                <div className="flex flex-wrap justify-center md:justify-start gap-3">
                  <Badge variant="outline" className="bg-background text-muted-foreground/60 border-border font-black px-4 py-1.5 rounded-xl uppercase text-[10px] tracking-widest shadow-sm">
                    OAB {userInfo.oab} / {userInfo.oab_uf}
                  </Badge>
                  <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-black px-4 py-1.5 rounded-xl uppercase text-[10px] tracking-widest">
                    Verificado
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid gap-8 md:grid-cols-2 relative z-10">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50 px-1">Endereço de E-mail</Label>
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-background/50 border border-border group hover:border-primary/20 transition-all shadow-sm">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
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
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
                    <Phone className="h-5 w-5" />
                  </div>
                  {editMode ? (
                    <Input
                      className="bg-transparent border-none p-0 h-auto font-black shadow-none focus-visible:ring-0 text-foreground"
                      value={userInfo.telefone}
                      onChange={(e) => setUserInfo({...userInfo, telefone: e.target.value})}
                    />
                  ) : (
                    <span className="font-bold text-foreground/80">{userInfo.telefone}</span>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50 px-1">Registro OAB (Número e Estado)</Label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 flex items-center gap-4 p-4 rounded-2xl bg-background/50 border border-border group hover:border-primary/20 transition-all shadow-sm">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
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
                      <span className="font-bold text-foreground/80">{userInfo.oab}</span>
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
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50 px-1">Localização</Label>
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-background/50 border border-border group hover:border-primary/20 transition-all shadow-sm">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
                    <MapPin className="h-5 w-5" />
                  </div>
                  {editMode ? (
                    <Input
                      className="bg-transparent border-none p-0 h-auto font-black shadow-none focus-visible:ring-0 text-foreground"
                      value={userInfo.endereco}
                      onChange={(e) => setUserInfo({...userInfo, endereco: e.target.value})}
                    />
                  ) : (
                    <span className="font-bold truncate text-foreground/80">{userInfo.endereco}</span>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50 px-1">Área de Atuação / Especialidade</Label>
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-background/50 border border-border group hover:border-primary/20 transition-all shadow-sm">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  {editMode ? (
                    <Input
                      className="bg-transparent border-none p-0 h-auto font-black shadow-none focus-visible:ring-0 text-foreground"
                      value={userInfo.especializacao}
                      onChange={(e) => setUserInfo({...userInfo, especializacao: e.target.value})}
                    />
                  ) : (
                    <span className="font-bold truncate text-foreground/80">{userInfo.especializacao}</span>
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
                <p className="text-4xl font-black text-primary mb-1">{estatisticas.pontuacaoTotal}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">Pontuação Meritocrática</p>
              </div>

              <div className="p-6 rounded-3xl bg-background/50 border border-border hover:bg-card transition-all text-center shadow-inner">
                <p className="text-4xl font-black mb-1 text-foreground">#{estatisticas.ranking}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Ranking Global Hub</p>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-border/50">
              <div className="flex justify-between items-center px-2">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Processos Ativos</span>
                <span className="text-lg font-black text-foreground">{estatisticas.processosAtivos}</span>
              </div>
              <div className="flex justify-between items-center px-2">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Concluídos (MTD)</span>
                <span className="text-lg font-black text-foreground">{estatisticas.processosFinalizados}</span>
              </div>
              <div className="flex justify-between items-center px-2">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Clientes Geridos</span>
                <span className="text-lg font-black text-foreground">{estatisticas.clientesAtendidos}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Perfil;

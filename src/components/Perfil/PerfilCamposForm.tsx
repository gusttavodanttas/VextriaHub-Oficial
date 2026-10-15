// Campos do perfil (e-mail, telefone, OAB/UF, CPF/CNPJ, cidade) em modo leitura/edição —
// extraídos de pages/Perfil.tsx sem mudança de comportamento.
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CityCombobox } from "@/components/ui/CityCombobox";
import { Mail, Phone, Scale, Fingerprint, MapPin } from "lucide-react";
import { formatPhone, isValidPhone } from "@/lib/phone";
import { formatCpfCnpj } from "@/lib/document";

const ESTADOS_BRASIL = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export interface PerfilInfo {
  nome: string;
  email: string;
  telefone: string;
  endereco: string;
  oab: string;
  oab_uf: string;
  cpf_cnpj: string;
}

interface Props {
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  userInfo: PerfilInfo;
  setUserInfo: (info: PerfilInfo) => void;
}

export function PerfilCamposForm({ editMode, setEditMode, userInfo, setUserInfo }: Props) {
  return (
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
          ) : userInfo.telefone ? (
            <span className="font-bold text-foreground/80">{userInfo.telefone}</span>
          ) : (
            <button onClick={() => setEditMode(true)} className="font-bold text-sm text-primary/70 hover:text-primary transition-colors">+ Adicionar</button>
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
            ) : userInfo.oab ? (
              <span className="font-bold text-foreground/80">{userInfo.oab}</span>
            ) : (
              <button onClick={() => setEditMode(true)} className="font-bold text-sm text-primary/70 hover:text-primary transition-colors">+ Adicionar</button>
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
        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50 px-1">CPF / CNPJ</Label>
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-background/50 border border-border shadow-sm">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
            <Fingerprint className="h-5 w-5" />
          </div>
          {userInfo.cpf_cnpj ? (
            <span className="font-bold text-foreground/80">{formatCpfCnpj(userInfo.cpf_cnpj)}</span>
          ) : (
            <span className="font-bold text-sm text-muted-foreground/60">Não informado</span>
          )}
          <span className="ml-auto text-[10px] font-black uppercase tracking-wider text-muted-foreground/40">Não editável</span>
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
          ) : userInfo.endereco ? (
            <span className="font-bold truncate text-foreground/80">{userInfo.endereco}</span>
          ) : (
            <button onClick={() => setEditMode(true)} className="font-bold text-sm text-primary/70 hover:text-primary transition-colors">+ Adicionar</button>
          )}
        </div>
      </div>
    </div>
  );
}

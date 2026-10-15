import React from 'react';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, Clock, Database, Gavel, Loader2, ShieldCheck, User, Users } from 'lucide-react';
import { formatCNJ } from '@/utils/formatCNJ';
import type { JudicialProcessResult, PoloCliente } from './types';

interface Props {
  proc: JudicialProcessResult | null;
  onClose: () => void;
  polo: PoloCliente | undefined;
  onSetPolo: (polo: PoloCliente) => void;
  onChange: (updates: Partial<JudicialProcessResult>) => void;
  loadingAndamentos: boolean;
  importing: boolean;
  onIgnorar: () => void;
  onImportar: () => void;
}

const PoloBox = ({ icon: Icon, titulo, placeholder, valor, ativo, onChange, onMarcar }: {
  icon: React.ElementType; titulo: string; placeholder: string; valor: string; ativo: boolean;
  onChange: (v: string) => void; onMarcar: () => void;
}) => (
  <div className="space-y-4">
    <div className="flex items-center gap-2 text-muted-foreground/60 text-[10px] font-black uppercase tracking-widest">
      <Icon className="h-4 w-4 text-primary" /> {titulo}
    </div>
    <div className="space-y-3">
      <Input
        className="bg-background border-border text-foreground text-xs h-10 rounded-xl focus:ring-4 focus:ring-primary/10 font-bold"
        placeholder={placeholder}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
      />
      <Button
        variant={ativo ? 'default' : 'outline'}
        size="sm"
        className="w-full rounded-xl gap-2 font-black text-[10px] h-9 uppercase tracking-widest shadow-premium"
        onClick={onMarcar}
      >
        {ativo && <ShieldCheck className="h-3 w-3" />}
        Este é meu cliente
      </Button>
    </div>
  </div>
);

/** Pasta do processo encontrado: partes editáveis, "meu cliente", vara/comarca, andamentos e importação individual. */
export function PreviewProcessoDialog({ proc, onClose, polo, onSetPolo, onChange, loadingAndamentos, importing, onIgnorar, onImportar }: Props) {
  return (
    <Dialog open={!!proc} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-background border border-border p-8 shadow-2xl rounded-2xl max-h-[90vh] flex flex-col gap-0">
        <DialogTitle className="sr-only">
          {proc ? `Processo ${proc.numeroProcesso}` : 'Detalhes do processo'}
        </DialogTitle>
        {proc && (
          <div className="flex flex-col flex-1 min-h-0 h-full gap-0">
            {/* Header Fixo */}
            <div className="flex items-center gap-4 border-b border-border pb-6 shrink-0">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
                <Gavel className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-black font-mono text-primary tracking-tight">
                  {formatCNJ(proc.numeroProcesso)}
                </h3>
                <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest mt-1">
                  {proc.tribunal} • {proc.faseProcessual}
                </p>
              </div>
            </div>

            {/* Corpo Rolável */}
            <div className="flex-1 overflow-y-auto py-6 pr-2 space-y-6 custom-scrollbar max-h-[calc(90vh-220px)]">
              <div className="grid grid-cols-2 gap-8">
                <PoloBox icon={User} titulo="Autor / Requerente" placeholder="Nome do Autor" valor={proc.autor}
                  ativo={polo === 'autor'} onChange={(v) => onChange({ autor: v })} onMarcar={() => onSetPolo('autor')} />
                <PoloBox icon={Users} titulo="Réu / Requerido" placeholder="Nome do Réu" valor={proc.reu}
                  ativo={polo === 'reu'} onChange={(v) => onChange({ reu: v })} onMarcar={() => onSetPolo('reu')} />
              </div>

              {/* Vara e Comarca Premium */}
              <div className="grid grid-cols-2 gap-4 bg-muted/30 p-5 rounded-[1.5rem] border border-border shadow-inner">
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground/40 uppercase font-black tracking-widest ml-1">Vara / Órgão</Label>
                  <Input
                    className="bg-background border-border text-foreground text-xs h-9 font-bold"
                    value={proc.vara}
                    onChange={(e) => onChange({ vara: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground/40 uppercase font-black tracking-widest ml-1">Comarca / UF</Label>
                  <Input
                    className="bg-background border-border text-foreground text-xs h-9 font-bold"
                    value={proc.comarca}
                    onChange={(e) => onChange({ comarca: e.target.value })}
                  />
                </div>
              </div>

              <Separator className="bg-border" />

              <div className="space-y-4">
                <div className="text-muted-foreground/60 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                    <Clock className="h-3 w-3" />
                  </div>
                  <span>Linha do Tempo de Movimentações</span>
                </div>

                <div className="bg-muted/30 rounded-[1.5rem] p-6 border border-border max-h-[250px] overflow-y-auto custom-scrollbar space-y-6 relative pl-8 shadow-inner">
                  {/* Linha vertical da timeline */}
                  <div className="absolute left-[31px] top-6 bottom-6 w-0.5 bg-primary/20" />

                  {loadingAndamentos ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-3">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Buscando andamentos...</p>
                    </div>
                  ) : proc.andamentos && proc.andamentos.length > 0 ? (
                    proc.andamentos.map((and, idx) => (
                      <div key={idx} className="relative">
                        <div className="absolute -left-[37px] top-1.5 h-3 w-3 rounded-full bg-primary ring-4 ring-card" />
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-black text-primary uppercase">
                            {and.data ? new Date(and.data).toLocaleDateString('pt-BR') : 'Sem data'}
                          </span>
                          <p className="text-xs font-bold text-foreground/80 leading-relaxed">
                            {and.resumo || and.descricao}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 gap-3 opacity-70">
                      <AlertCircle className="h-8 w-8 text-yellow-500" />
                      <p className="text-[10px] uppercase font-black tracking-widest text-center text-yellow-500">Nenhum andamento extraído</p>
                      <p className="text-xs text-muted-foreground text-center max-w-xs">
                        Movimentos não disponíveis publicamente. Adicione manualmente após importar.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Fixo */}
            <DialogFooter className="pt-4 border-t border-border mt-4 shrink-0 flex flex-row items-center justify-between w-full">
              <Button
                variant="ghost"
                onClick={onClose}
                className="text-muted-foreground text-[10px] font-black uppercase tracking-widest hover:bg-muted h-11 rounded-xl transition-all"
              >
                Sair
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="border-red-500/30 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20 font-black uppercase tracking-widest text-[10px] px-6 h-11 rounded-xl transition-all"
                  onClick={onIgnorar}
                >
                  Ignorar Processo
                </Button>
                <Button
                  className="font-black uppercase tracking-widest text-[10px] px-8 h-11 rounded-xl shadow-premium transition-all bg-primary hover:bg-primary/90 text-primary-foreground"
                  disabled={importing}
                  onClick={onImportar}
                >
                  {importing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Database className="h-4 w-4 mr-1" />}
                  Importar Este Processo
                </Button>
              </div>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarClock, Check, CheckCircle2, FileText, Megaphone, Plus, RotateCw, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmptySub, SectionHeader } from './shared';
import { fmtDate, type SubData } from './helpers';

interface Props {
  sub: SubData;
  isMine: boolean;
}

const urgenciaClass = (u: string) =>
  u === 'alta' ? 'border-rose-500/30 text-rose-600 bg-rose-500/10'
    : u === 'media' ? 'border-amber-500/30 text-amber-600 bg-amber-500/10'
      : 'border-slate-500/30 text-slate-500';
const urgenciaLabel = (u: string) => (u === 'alta' ? '● Alta' : u === 'media' ? '● Média' : '● Baixa');
const proximaUrgencia = (u: string) => (u === 'alta' ? 'media' : u === 'media' ? 'baixa' : 'alta');

// Conteúdo das publicações vem em HTML do tribunal — limpa para exibir como texto.
const limparHtml = (html: string) => (html || '')
  .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>|<\/div>/gi, '\n')
  .replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"').replace(/\n{3,}/g, '\n\n').trim();

/** Aba "Publicações": lista com leitura, status, urgência e tratamento (vira prazo/tarefa/audiência). */
export function PublicacoesTab({ sub, isMine }: Props) {
  const {
    publicacoes, loadingSub, addLoading, expandedPubId, setExpandedPubId, tratandoPubId, setTratandoPubId,
    pubStatus, copyPub, pubUrgencia, tratarPub,
  } = sub;
  return (
    <div className="space-y-4">
      <SectionHeader label="publicação(ões)" count={publicacoes.length} loading={loadingSub} />
      {publicacoes.length > 0 ? publicacoes.map(pub => {
        const isExpanded = expandedPubId === pub.id;
        const cleanContent = limparHtml(pub.conteudo);
        return (
          <div key={pub.id} className={cn("rounded-2xl border transition-all", pub.status === 'nova' ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/10')}>
            {/* Header */}
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black text-primary/80 bg-primary/5 px-2.5 py-0.5 rounded-lg">{fmtDate(pub.data_publicacao)}</span>
                  {pub.tipo_documento && <Badge variant="outline" className="text-[9px] font-bold uppercase">{pub.tipo_documento}</Badge>}
                  {/* Urgência — clicável só no processo próprio */}
                  {isMine ? (
                    <button onClick={() => pubUrgencia(pub.id, proximaUrgencia(pub.urgencia))}>
                      <Badge variant="outline" className={cn("text-[9px] font-bold uppercase cursor-pointer hover:opacity-80", urgenciaClass(pub.urgencia))}>
                        {urgenciaLabel(pub.urgencia)}
                      </Badge>
                    </button>
                  ) : (
                    <Badge variant="outline" className={cn("text-[9px] font-bold uppercase", urgenciaClass(pub.urgencia))}>
                      {urgenciaLabel(pub.urgencia)}
                    </Badge>
                  )}
                </div>
                <Badge variant="outline" className={cn("text-[9px] font-bold uppercase", pub.status === 'nova' ? 'border-blue-500/30 text-blue-600 bg-blue-500/10' : pub.status === 'lida' ? 'border-emerald-500/30 text-emerald-600' : 'border-slate-500/30 text-slate-500')}>
                  {pub.status}
                </Badge>
              </div>
              <h4 className="font-bold text-sm cursor-pointer hover:text-primary transition-colors" onClick={() => setExpandedPubId(isExpanded ? null : pub.id)}>
                {pub.titulo}
              </h4>
              {pub.tribunal && <p className="text-[10px] text-muted-foreground/50">{pub.tribunal}{pub.vara ? ` · ${pub.vara}` : ''}{pub.comarca ? ` · ${pub.comarca}` : ''}</p>}

              {/* Conteúdo resumido ou expandido */}
              {isExpanded ? (
                <div className="bg-muted/20 p-5 rounded-xl border border-border mt-2">
                  <p className="text-sm leading-[1.8] whitespace-pre-wrap text-foreground/90">{cleanContent || 'Conteúdo não disponível.'}</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 cursor-pointer" onClick={() => setExpandedPubId(pub.id)}>
                  {cleanContent.slice(0, 200)}{cleanContent.length > 200 ? '...' : ''}
                </p>
              )}
            </div>

            {/* Ações */}
            <div className="px-5 pb-4 flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" className="h-7 rounded-xl text-[10px] gap-1 font-bold uppercase tracking-widest" onClick={() => setExpandedPubId(isExpanded ? null : pub.id)}>
                <FileText className="h-3 w-3" /> {isExpanded ? 'Recolher' : 'Ler Completo'}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 rounded-xl text-[10px] gap-1 font-bold uppercase tracking-widest" onClick={() => copyPub(pub.conteudo)}>
                <Check className="h-3 w-3" /> Copiar
              </Button>
              {isMine && (
                <>
                  {pub.status === 'nova' && (
                    <Button variant="ghost" size="sm" className="h-7 rounded-xl text-[10px] gap-1 font-bold uppercase tracking-widest text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10" onClick={() => pubStatus(pub.id, 'lida')}>
                      <CheckCircle2 className="h-3 w-3" /> Marcar como Lida
                    </Button>
                  )}
                  {pub.status === 'lida' && (
                    <Button variant="ghost" size="sm" className="h-7 rounded-xl text-[10px] gap-1 font-bold uppercase tracking-widest text-blue-600 hover:text-blue-700 hover:bg-blue-500/10" onClick={() => pubStatus(pub.id, 'processada')}>
                      <CheckCircle2 className="h-3 w-3" /> Marcar como Processada
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-7 rounded-xl text-[10px] gap-1 font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground" onClick={() => pubStatus(pub.id, 'arquivada')}>
                    <X className="h-3 w-3" /> Arquivar
                  </Button>
                  {pub.status !== 'processada' && (
                    <Button variant="ghost" size="sm" className="h-7 rounded-xl text-[10px] gap-1 font-bold uppercase tracking-widest text-violet-600 hover:text-violet-700 hover:bg-violet-500/10" onClick={() => setTratandoPubId(tratandoPubId === pub.id ? null : pub.id)}>
                      <CalendarClock className="h-3 w-3" /> Tratar
                    </Button>
                  )}
                </>
              )}
            </div>

            {/* Formulário de tratamento */}
            {tratandoPubId === pub.id && (
              <div className="px-5 pb-5">
                <form onSubmit={(e) => tratarPub(e, pub)} className="p-5 rounded-2xl border border-violet-500/20 bg-violet-500/5 space-y-4 animate-in fade-in duration-300">
                  <p className="text-[10px] font-black uppercase tracking-widest text-violet-600">Criar a partir desta publicação</p>
                  <select name="tipo_tratamento" required className="h-9 w-full rounded-xl text-sm border border-border bg-background px-3">
                    <option value="prazo">Prazo</option>
                    <option value="tarefa">Tarefa</option>
                    <option value="audiencia">Audiência</option>
                  </select>
                  <Input name="titulo" placeholder="Título" required defaultValue={pub.titulo?.slice(0, 80)} className="h-9 rounded-xl text-sm" />
                  <div className="grid grid-cols-3 gap-3">
                    <Input name="data_vencimento" type="date" required className="h-9 rounded-xl text-sm" />
                    <Input name="horario" type="time" placeholder="Horário" className="h-9 rounded-xl text-sm" />
                    <select name="prioridade" className="h-9 rounded-xl text-sm border border-border bg-background px-3">
                      <option value="baixa">Baixa</option>
                      <option value="media">Média</option>
                      <option value="alta" selected>Alta</option>
                      <option value="urgente">Urgente</option>
                    </select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setTratandoPubId(null)} className="rounded-xl text-xs h-8">Cancelar</Button>
                    <Button type="submit" size="sm" disabled={addLoading} className="rounded-xl text-xs h-8 gap-1.5 bg-violet-600 hover:bg-violet-700 text-white">
                      {addLoading ? <RotateCw className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Criar e Processar
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </div>
        );
      }) : <EmptySub icon={Megaphone} label="publicação" loading={loadingSub} />}
    </div>
  );
}

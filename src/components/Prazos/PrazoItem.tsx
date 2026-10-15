// Linha de um prazo na lista (badges, teor, datas, processo, ações e menu) —
// extraída de pages/Prazos.tsx sem mudança de comportamento. Tudo que depende de
// dados externos (título, teor, cliente, processo) chega resolvido por props.
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Clock, CheckCircle2, ChevronRight, MoreHorizontal, Pencil, Trash2, CheckCheck,
  Newspaper, Shield, AlertOctagon, RotateCcw, User, FileText, Gavel,
} from 'lucide-react';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { fmtDate } from '@/lib/dates';
import { formatCNJ } from '@/utils/formatCNJ';
import type { AcaoTipo } from '@/components/Processos/AgendarPublicacaoDialog';
import {
  type Prazo, type Urgency, type ProcInfo,
  getDataPrazo, getDaysLabel, ehSugestaoRobo, pareceAudiencia, URGENCY_CONFIG, PRIORITY_CONFIG,
} from '@/components/Prazos/shared';

interface Props {
  prazo: Prazo;
  urgency: Urgency;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  canManagePrazos: boolean;
  titulo: string;
  teor?: string;
  clienteNome?: string | null;
  processo?: ProcInfo | null;
  membroMap: Record<string, string>;
  navigate: (path: string) => void;
  teorAberto: boolean;
  onToggleTeor: () => void;
  onAgendar: (prazo: Prazo, tipo: AcaoTipo) => void;
  onConcluir: (id: string) => void; concluindo: boolean;
  onReabrir: (id: string) => void; reabrindo: boolean;
  onAceitar: (id: string) => void; aceitando: boolean;
  onEditar: (prazo: Prazo) => void;
  onExcluir: (prazo: Prazo) => void;
}

export function PrazoItem({
  prazo, urgency, selected, onToggleSelect, canManagePrazos, titulo, teor, clienteNome, processo, membroMap, navigate,
  teorAberto, onToggleTeor, onAgendar, onConcluir, concluindo, onReabrir, reabrindo, onAceitar, aceitando, onEditar, onExcluir,
}: Props) {
  const cfg = URGENCY_CONFIG[urgency];
    const priCfg = PRIORITY_CONFIG[prazo.prioridade] || PRIORITY_CONFIG.media;
    const isConcluido = prazo.status === 'concluido';

    return (
      <div
          id={`item-${prazo.id}`}
        className={cn(
          'group relative flex items-center gap-3 sm:gap-4 bg-background border border-border/60 rounded-2xl px-4 sm:px-5 py-4 border-l-4 transition-all hover:border-border hover:shadow-sm',
          cfg.border,
          selected && 'ring-2 ring-primary/20 border-primary/40',
          isConcluido && 'opacity-60'
        )}
      >
        <Checkbox checked={selected} onCheckedChange={() => onToggleSelect(prazo.id)} className="rounded-md shrink-0" />
        <div className={cn('w-2 h-2 rounded-full shrink-0 hidden sm:block', cfg.dot)} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={cn('font-black text-sm', isConcluido && 'line-through text-muted-foreground')}>
              {titulo}
            </span>
            <Badge variant="outline" className={cn('text-[9px] font-black uppercase tracking-widest border px-2 py-0.5', priCfg.color)}>
              {priCfg.label}
            </Badge>
            {!prazo.responsavel_id && (
              <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border px-2 py-0.5 bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/20">
                Sem responsável
              </Badge>
            )}
            {prazo.titular === 'contraria' && (
              <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20">
                Parte contrária
              </Badge>
            )}
            {ehSugestaoRobo(prazo) && (
              <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border px-2 py-0.5 bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20" title="Prazo calculado automaticamente a partir de uma publicação — revise antes de confirmar">
                Sugestão do robô
              </Badge>
            )}
            {ehSugestaoRobo(prazo) && (prazo.possivel_audiencia || pareceAudiencia(teor ?? '')) && (
              <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border px-2 py-0.5 bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20" title="O teor menciona audiência — use 'Agendar audiência' no menu">
                Possível audiência
              </Badge>
            )}
          </div>
          {/* Teor do prazo (descrição própria ou conteúdo da publicação de origem) */}
          {teor && (() => {
                      const aberto = teorAberto;
            const longo = teor.length > 180;
            return (
              <div className="mb-1.5">
                <p className={cn(
                  'text-xs text-muted-foreground whitespace-pre-wrap',
                  aberto ? 'max-h-64 overflow-y-auto pr-1' : 'line-clamp-2'
                )}>
                  {teor}
                </p>
                {longo && (
                  <button
                    type="button"
                    onClick={onToggleTeor}
                    className="mt-0.5 text-[11px] font-bold text-primary hover:underline"
                  >
                    {aberto ? 'Recolher teor' : 'Ver teor completo'}
                  </button>
                )}
              </div>
            );
          })()}
          {/* 3 datas */}
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            {clienteNome && (
              <span className="flex items-center gap-1 text-muted-foreground font-semibold">
                <User className="h-3 w-3" />{clienteNome}
              </span>
            )}
            {prazo.data_publicacao && (
              <span className="flex items-center gap-1 text-sky-600">
                <Newspaper className="h-3 w-3" />
                <span className="text-muted-foreground">Publicação:</span>
                {fmtDate(prazo.data_publicacao, 'dd/MM/yy', { locale: ptBR })}
              </span>
            )}
            {prazo.data_disponibilizacao && (
              <span className="flex items-center gap-1 text-cyan-600">
                <Newspaper className="h-3 w-3" />
                <span className="text-muted-foreground">Disponibilização:</span>
                {fmtDate(prazo.data_disponibilizacao, 'dd/MM/yy', { locale: ptBR })}
              </span>
            )}
            {prazo.data_intimacao && (
              <span className="flex items-center gap-1 text-violet-600">
                <Clock className="h-3 w-3" />
                <span className="text-muted-foreground">Intimação:</span>
                {fmtDate(prazo.data_intimacao, 'dd/MM/yy', { locale: ptBR })}
              </span>
            )}
            {prazo.data_prazo_interno && (
              <span className="flex items-center gap-1 text-amber-600">
                <Shield className="h-3 w-3" />
                <span className="text-muted-foreground">Interno:</span>
                {fmtDate(prazo.data_prazo_interno, 'dd/MM/yy', { locale: ptBR })}
              </span>
            )}
            {getDataPrazo(prazo) && (
              <span className="flex items-center gap-1 text-red-600 font-bold">
                <AlertOctagon className="h-3 w-3" />
                <span className="text-muted-foreground font-normal">Fatal:</span>
                {fmtDate(getDataPrazo(prazo), 'dd/MM/yy', { locale: ptBR })}
              </span>
            )}
            {prazo.dias_uteis != null && (
              <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 text-[9px] font-black uppercase tracking-widest">
                {prazo.dias_uteis} {prazo.dias_corridos ? 'dias corridos' : 'dias úteis'}
              </span>
            )}
            {prazo.eh_juizado && (
              <span className="px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-600 text-[9px] font-black uppercase tracking-widest">Juizado</span>
            )}
            {prazo.base_legal && (
              <span className="text-muted-foreground/50 text-[10px]">{prazo.base_legal}</span>
            )}
            {/* De qual processo é — nº CNJ, clicável quando o processo está cadastrado */}
            {(() => {
              const proc = processo;
              const numero = prazo.numero_processo || proc?.numero;
              if (!numero && !proc) return null;
              const label = numero ? formatCNJ(numero) : 'Ver processo';
              return proc ? (
                <button
                  onClick={() => navigate(`/processos?openId=${proc.id}`)}
                  className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors ml-1"
                  title="Abrir processo"
                >
                  <FileText className="h-3 w-3 shrink-0" />
                  <span className="underline underline-offset-2 text-[11px] font-mono">{label}</span>
                </button>
              ) : (
                <span className="flex items-center gap-1 text-muted-foreground/70 ml-1" title="Processo ainda não cadastrado">
                  <FileText className="h-3 w-3 shrink-0" />
                  <span className="text-[11px] font-mono">{label}</span>
                </span>
              );
            })()}
            {isConcluido && prazo.concluido_em && (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Concluído por {membroMap[prazo.concluido_por || ""] || "—"} · {fmtDate(prazo.concluido_em, "dd/MM/yy", { locale: ptBR })}
              </span>
            )}
          </div>
        </div>

        {/* Right: days pill + actions */}
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn(
            'text-[11px] font-black px-3 py-1 rounded-full border whitespace-nowrap',
            cfg.badge
          )}>
            {getDaysLabel(prazo)}
          </span>

          {ehSugestaoRobo(prazo) && (prazo.possivel_audiencia || pareceAudiencia(teor ?? '')) && !isConcluido && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAgendar(prazo, 'audiencia')}
              className="h-8 rounded-xl gap-1.5 font-bold text-violet-600 hover:bg-violet-500/10 hover:text-violet-700 max-sm:opacity-100 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Agendar audiência a partir deste prazo"
            >
              <Gavel className="h-4 w-4" /> <span className="hidden lg:inline">Agendar audiência</span>
            </Button>
          )}
          {/* Atalho inline: mesmo gate do menu (antes ficava aberto a quem só visualiza). */}
          {canManagePrazos && (!isConcluido ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onConcluir(prazo.id)}
              disabled={concluindo}
              className="h-8 w-8 p-0 rounded-xl max-sm:opacity-100 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
              title="Marcar como concluído"
            >
              <CheckCheck className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onReabrir(prazo.id)}
              disabled={reabrindo}
              className="h-8 w-8 p-0 rounded-xl max-sm:opacity-100 opacity-0 group-hover:opacity-100 transition-opacity text-sky-600 hover:bg-sky-500/10 hover:text-sky-700"
              title="Reabrir prazo"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 rounded-xl max-sm:opacity-100 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl w-52">
              {canManagePrazos && ehSugestaoRobo(prazo) && (
                <>
                  <DropdownMenuItem
                    onClick={() => onAceitar(prazo.id)}
                    disabled={aceitando}
                    className="rounded-lg cursor-pointer gap-2 text-emerald-600 focus:text-emerald-600 font-bold"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Aceitar sugestão
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {canManagePrazos && (!isConcluido ? (
                <DropdownMenuItem
                  onClick={() => onConcluir(prazo.id)}
                  className="rounded-lg cursor-pointer gap-2 text-emerald-600 focus:text-emerald-600"
                >
                  <CheckCircle2 className="h-4 w-4" /> Concluir
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() => onReabrir(prazo.id)}
                  className="rounded-lg cursor-pointer gap-2 text-sky-600 focus:text-sky-600"
                >
                  <RotateCcw className="h-4 w-4" /> Reabrir
                </DropdownMenuItem>
              ))}
              {canManagePrazos && (
                <DropdownMenuItem
                  onClick={() => onEditar(prazo)}
                  className="rounded-lg cursor-pointer gap-2"
                >
                  <Pencil className="h-4 w-4" /> {ehSugestaoRobo(prazo) ? 'Revisar / alterar' : 'Editar'}
                </DropdownMenuItem>
              )}
              {canManagePrazos && ehSugestaoRobo(prazo) && (
                <>
                  <DropdownMenuItem
                    onClick={() => onAgendar(prazo, 'audiencia')}
                    className="rounded-lg cursor-pointer gap-2 text-violet-600 focus:text-violet-600"
                  >
                    <Gavel className="h-4 w-4" /> Agendar audiência
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onAgendar(prazo, 'tarefa')}
                    className="rounded-lg cursor-pointer gap-2 text-sky-600 focus:text-sky-600"
                  >
                    <CheckCheck className="h-4 w-4" /> Criar tarefa
                  </DropdownMenuItem>
                </>
              )}
              {prazo.processo_id && (
                <DropdownMenuItem
                  onClick={() => navigate(`/processos?openId=${prazo.processo_id}`)}
                  className="rounded-lg cursor-pointer gap-2"
                >
                  <ChevronRight className="h-4 w-4" /> Ver processo
                </DropdownMenuItem>
              )}
              {canManagePrazos && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onExcluir(prazo)}
                    className="rounded-lg cursor-pointer gap-2 text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" /> {ehSugestaoRobo(prazo) ? 'Descartar sugestão' : 'Excluir'}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
}

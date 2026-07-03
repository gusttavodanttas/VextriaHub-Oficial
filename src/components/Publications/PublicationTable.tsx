import React, { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  MoreHorizontal,
  Eye,
  Trash2,
  Calendar,
  ExternalLink,
  Scale,
  Building2,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  PlusCircle,
  CalendarClock,
  Gavel,
  Link2,
  Link2Off,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatCNJ } from "@/utils/formatCNJ";
import { useToast } from "@/hooks/use-toast";

interface Publication {
  id: string;
  titulo: string;
  numero_processo: string;
  conteudo?: string;
  data_publicacao: string;
  status: string;
  urgencia: string;
  tribunal?: string;
  vara?: string;
  comarca?: string;
  processo_id?: string;
}

interface PublicationTableProps {
  publications: Publication[];
  onViewDetails: (pub: Publication) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onRegister?: (pub: Publication) => void;
  onSchedule?: (pub: Publication, tipo?: 'prazo' | 'tarefa' | 'audiencia') => void;
  selectedIds: string[];
  onToggleSelection: (id: string) => void;
  onToggleAll: () => void;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const deepCleanHTML = (html: string): string => {
  if (!html) return "";
  let tmp = html;
  tmp = tmp.replace(/<br\s*\/?>/gi, "\n");
  tmp = tmp.replace(/<\/p>|<\/div>|<\/tr>/gi, "\n");
  tmp = tmp.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "");
  tmp = tmp.replace(/<[^>]*>/g, "");
  const entities: Record<string, string> = {
    '&nbsp;': ' ', '&quot;': '"', '&amp;': '&', '&lt;': '<', '&gt;': '>',
    '&ordm;': 'º', '&ordf;': 'ª', '&agrave;': 'à', '&aacute;': 'á',
    '&acirc;': 'â', '&atilde;': 'ã', '&eacute;': 'é', '&ecirc;': 'ê',
    '&iacute;': 'í', '&oacute;': 'ó', '&ocirc;': 'ô', '&otilde;': 'õ',
    '&uacute;': 'ú', '&ccedil;': 'ç'
  };
  Object.entries(entities).forEach(([key, val]) => {
    tmp = tmp.replace(new RegExp(key, 'gi'), val);
  });
  return tmp.split('\n').map(l => l.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

export const PublicationTable = ({
  publications,
  onViewDetails,
  onDelete,
  onUpdateStatus,
  onRegister,
  onSchedule,
  selectedIds,
  onToggleSelection,
  onToggleAll
}: PublicationTableProps) => {
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const totalPages = Math.ceil(publications.length / pageSize);
  const paginated = useMemo(() => publications.slice(page * pageSize, (page + 1) * pageSize), [publications, page, pageSize]);

  const handlePageSizeChange = (val: string) => {
    setPageSize(Number(val));
    setPage(0);
  };

  const handleCopy = (text: string, id: string) => {
    const clean = deepCleanHTML(text);
    navigator.clipboard.writeText(clean);
    setCopiedId(id);
    toast({ title: "Copiado", description: "Conteúdo copiado." });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'processada': return { label: 'Tratada', style: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' };
      case 'lida': return { label: 'Tratada', style: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' };
      case 'pendente': return { label: 'Pendente', style: 'bg-sky-500/10 text-sky-600 border-sky-500/20' };
      case 'arquivada': return { label: 'Arquivada', style: 'bg-slate-500/10 text-slate-500 border-slate-500/20' };
      default: return { label: 'Nova', style: 'bg-amber-500/10 text-amber-600 border-amber-500/20' };
    }
  };

  const getUrgencyConfig = (urgency: string) => {
    switch (urgency) {
      case 'alta': return { label: 'Alta', style: 'bg-red-500/10 text-red-600 border-red-500/20' };
      case 'media': return { label: 'Média', style: 'bg-amber-500/10 text-amber-600 border-amber-500/20' };
      default: return { label: 'Baixa', style: 'bg-blue-500/10 text-blue-600 border-blue-500/20' };
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="rounded-[2.5rem] border border-border bg-card/30 backdrop-blur-md overflow-hidden shadow-premium">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-12 py-5 pl-8">
                    <Checkbox
                      checked={paginated.length > 0 && selectedIds.length === publications.length}
                      onCheckedChange={onToggleAll}
                      className="rounded-lg border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                  </TableHead>
                  <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60 py-5">
                    Expediente / Processo
                  </TableHead>
                  <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60 py-5">
                    Tribunal
                  </TableHead>
                  <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60 py-5">
                    Data
                  </TableHead>
                  <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60 py-5">
                    Vínculo
                  </TableHead>
                  <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60 py-5">
                    Urgência
                  </TableHead>
                  <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60 py-5">
                    Status
                  </TableHead>
                  <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60 py-5 text-right pr-8 sticky right-0 z-20 bg-card border-l border-border/50">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((pub) => {
                  const statusCfg = getStatusConfig(pub.status);
                  const urgCfg = getUrgencyConfig(pub.urgencia);
                  const isExpanded = expandedId === pub.id;
                  const cleanContent = pub.conteudo ? deepCleanHTML(pub.conteudo) : '';
                  const previewText = cleanContent.length > 160 ? cleanContent.substring(0, 160) + '…' : cleanContent;

                  return (
                    <React.Fragment key={pub.id}>
                      <TableRow
                        className={cn(
                          "group border-border cursor-pointer transition-all duration-200 hover:bg-muted/30",
                          selectedIds.includes(pub.id) && "bg-primary/5 hover:bg-primary/10",
                          isExpanded && "bg-muted/20"
                        )}
                        onClick={() => onViewDetails(pub)}
                      >
                        <TableCell className="py-4 pl-8" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.includes(pub.id)}
                            onCheckedChange={() => onToggleSelection(pub.id)}
                            className="rounded-lg border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                          />
                        </TableCell>

                        <TableCell className="py-4">
                          <div className="flex flex-col gap-1.5 max-w-[350px]">
                            <span className="font-bold text-sm truncate group-hover:text-primary transition-colors">
                              {pub.titulo === pub.numero_processo ? `Expediente no ${pub.tribunal || 'Tribunal'}` : pub.titulo}
                            </span>
                            <div className="flex items-center gap-2">
                              <Scale className="h-3 w-3 text-muted-foreground/40" />
                              <span className="font-mono text-[10px] font-bold text-muted-foreground/70 uppercase">
                                {formatCNJ(pub.numero_processo)}
                              </span>
                            </div>
                            {previewText && (
                              <p className="text-[11px] text-muted-foreground/50 line-clamp-1 leading-relaxed mt-0.5">
                                {previewText}
                              </p>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="py-4">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="h-3 w-3 text-primary/50" />
                              <span className="text-[11px] font-bold">{pub.tribunal || 'TRIBUNAL'}</span>
                            </div>
                            {pub.comarca && (
                              <span className="text-[10px] text-muted-foreground/60 font-medium pl-4">
                                {pub.comarca}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="py-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3 text-muted-foreground/40" />
                            <span className="text-xs font-bold text-muted-foreground/80">
                              {pub.data_publicacao ? new Date(String(pub.data_publicacao).length <= 10 ? `${pub.data_publicacao}T12:00:00` : pub.data_publicacao).toLocaleDateString('pt-BR') : ''}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="py-4">
                          {pub.processo_id ? (
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="outline" className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1">
                                  <Link2 className="h-3 w-3" />
                                  Vinculada
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent className="rounded-xl">
                                <p className="text-xs">Vinculada a processo cadastrado</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="outline" className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border bg-orange-500/10 text-orange-500 border-orange-500/20 gap-1">
                                  <Link2Off className="h-3 w-3" />
                                  Avulsa
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent className="rounded-xl">
                                <p className="text-xs">Sem processo vinculado</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>

                        <TableCell className="py-4">
                          <Badge variant="outline" className={cn("px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border", urgCfg.style)}>
                            {urgCfg.label}
                          </Badge>
                        </TableCell>

                        <TableCell className="py-4">
                          <Badge variant="outline" className={cn("px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border", statusCfg.style)}>
                            {statusCfg.label}
                          </Badge>
                        </TableCell>

                        <TableCell
                          className={cn(
                            "py-4 pr-6 text-right sticky right-0 z-10 border-l border-border/50 bg-card",
                            "group-hover:bg-muted/30",
                            selectedIds.includes(pub.id) && "bg-primary/5 group-hover:bg-primary/10",
                            isExpanded && "bg-muted/20"
                          )}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-1 justify-end">
                            {/* Expand content */}
                            {pub.conteudo && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 rounded-xl hover:bg-primary/10"
                                    onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : pub.id); }}
                                  >
                                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent className="rounded-xl"><p className="text-xs">{isExpanded ? 'Recolher' : 'Expandir conteúdo'}</p></TooltipContent>
                              </Tooltip>
                            )}

                            {/* Inline quick actions */}
                            {pub.status !== 'lida' && pub.status !== 'processada' && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 rounded-xl hover:bg-emerald-500/10 text-emerald-600"
                                    onClick={(e) => { e.stopPropagation(); onUpdateStatus(pub.id, 'lida'); }}
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent className="rounded-xl"><p className="text-xs">Marcar como Tratada</p></TooltipContent>
                              </Tooltip>
                            )}

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0 rounded-xl hover:bg-primary/10 hover:text-primary transition-all">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="border-border rounded-2xl w-60 p-2 bg-background shadow-2xl">
                                <DropdownMenuItem onClick={() => onViewDetails(pub)} className="rounded-xl cursor-pointer py-3 gap-3 focus:bg-primary/10">
                                  <Eye className="h-4 w-4 text-primary/60" />
                                  <span className="font-bold text-xs uppercase tracking-wider">Ver Detalhes</span>
                                </DropdownMenuItem>

                                {onRegister && !pub.processo_id && (
                                  <DropdownMenuItem onClick={() => onRegister(pub)} className="rounded-xl cursor-pointer py-3 gap-3 focus:bg-primary/10">
                                    <PlusCircle className="h-4 w-4 text-violet-500" />
                                    <span className="font-bold text-xs uppercase tracking-wider">Cadastrar Processo</span>
                                  </DropdownMenuItem>
                                )}

                                {onSchedule && (
                                  <>
                                    <DropdownMenuItem onClick={() => onSchedule(pub, 'prazo')} className="rounded-xl cursor-pointer py-3 gap-3 focus:bg-primary/10">
                                      <CalendarClock className="h-4 w-4 text-amber-500" />
                                      <span className="font-bold text-xs uppercase tracking-wider">Agendar Prazo</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onSchedule(pub, 'tarefa')} className="rounded-xl cursor-pointer py-3 gap-3 focus:bg-primary/10">
                                      <CalendarClock className="h-4 w-4 text-sky-500" />
                                      <span className="font-bold text-xs uppercase tracking-wider">Criar Tarefa</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onSchedule(pub, 'audiencia')} className="rounded-xl cursor-pointer py-3 gap-3 focus:bg-primary/10">
                                      <CalendarClock className="h-4 w-4 text-violet-500" />
                                      <span className="font-bold text-xs uppercase tracking-wider">Marcar Audiência</span>
                                    </DropdownMenuItem>
                                  </>
                                )}

                                <DropdownMenuItem
                                  onClick={() => onUpdateStatus(pub.id, pub.status === 'lida' || pub.status === 'processada' ? 'nova' : 'lida')}
                                  className="rounded-xl cursor-pointer py-3 gap-3 focus:bg-primary/10"
                                >
                                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                                  <span className="font-bold text-xs uppercase tracking-wider">
                                    {pub.status === 'lida' || pub.status === 'processada' ? 'Marcar como Nova' : 'Marcar como Tratada'}
                                  </span>
                                </DropdownMenuItem>

                                {pub.conteudo && (
                                  <DropdownMenuItem onClick={() => handleCopy(pub.conteudo || '', pub.id)} className="rounded-xl cursor-pointer py-3 gap-3 focus:bg-primary/10">
                                    {copiedId === pub.id ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                                    <span className="font-bold text-xs uppercase tracking-wider">
                                      {copiedId === pub.id ? 'Copiado!' : 'Copiar Conteúdo'}
                                    </span>
                                  </DropdownMenuItem>
                                )}

                                <DropdownMenuSeparator className="bg-border/50 my-1" />
                                <DropdownMenuItem
                                  onClick={() => onDelete(pub.id)}
                                  className="rounded-xl cursor-pointer py-3 gap-3 text-destructive focus:text-destructive focus:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="font-bold text-xs uppercase tracking-wider">Arquivar</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Expanded content row */}
                      {isExpanded && (
                        <TableRow className="border-border bg-muted/10 hover:bg-muted/10">
                          <TableCell colSpan={8} className="p-0">
                            <div className="px-8 py-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/50">Teor da publicação</span>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-3 rounded-xl text-[10px] font-bold uppercase tracking-wider gap-1.5 hover:bg-primary/10"
                                    onClick={() => handleCopy(pub.conteudo || '', pub.id)}
                                  >
                                    {copiedId === pub.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                                    {copiedId === pub.id ? 'Copiado!' : 'Copiar'}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-3 rounded-xl text-[10px] font-bold uppercase tracking-wider gap-1.5 hover:bg-primary/10"
                                    onClick={() => onViewDetails(pub)}
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    Detalhes completos
                                  </Button>
                                </div>
                              </div>
                              <div className="bg-background/80 border border-border rounded-2xl p-6 max-h-[300px] overflow-y-auto">
                                <p className="text-sm leading-[1.8] whitespace-pre-wrap text-foreground/80 selection:bg-primary/30">
                                  {cleanContent || 'Conteúdo não disponível.'}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 pt-1">
                                {pub.status !== 'lida' && pub.status !== 'processada' && (
                                  <Button
                                    size="sm"
                                    className="h-9 rounded-xl text-[10px] font-black uppercase tracking-widest gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20"
                                    onClick={() => onUpdateStatus(pub.id, 'lida')}
                                  >
                                    <CheckCircle className="h-3.5 w-3.5" />
                                    Marcar como Tratada
                                  </Button>
                                )}
                                {onRegister && !pub.processo_id && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-9 rounded-xl text-[10px] font-black uppercase tracking-widest gap-1.5 border-violet-500/30 text-violet-600 hover:bg-violet-500/10"
                                    onClick={() => onRegister(pub)}
                                  >
                                    <PlusCircle className="h-3.5 w-3.5" />
                                    Cadastrar Processo
                                  </Button>
                                )}
                                {onSchedule && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-9 rounded-xl text-[10px] font-black uppercase tracking-widest gap-1.5 border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
                                      >
                                        <CalendarClock className="h-3.5 w-3.5" />
                                        Agendar
                                        <ChevronDown className="h-3 w-3 opacity-50" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="rounded-xl">
                                      <DropdownMenuItem onClick={() => onSchedule(pub, 'prazo')} className="rounded-lg cursor-pointer gap-2">
                                        <CalendarClock className="h-4 w-4 text-amber-500" /> Prazo
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => onSchedule(pub, 'tarefa')} className="rounded-lg cursor-pointer gap-2">
                                        <CalendarClock className="h-4 w-4 text-sky-500" /> Tarefa
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => onSchedule(pub, 'audiencia')} className="rounded-lg cursor-pointer gap-2">
                                        <CalendarClock className="h-4 w-4 text-violet-500" /> Audiência
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Pagination */}
        {publications.length > PAGE_SIZE_OPTIONS[0] && (
          <div className="flex items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/50">Exibindo</span>
              <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                <SelectTrigger className="w-[72px] h-8 rounded-xl text-xs font-bold border-border bg-card/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl bg-background border-border">
                  {PAGE_SIZE_OPTIONS.map(n => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/50">
                de {publications.length}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 rounded-xl border-border"
                disabled={page === 0}
                onClick={() => setPage(0)}
              >
                <ChevronsLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 rounded-xl border-border"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs font-black text-muted-foreground px-3">
                {page + 1} / {totalPages || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 rounded-xl border-border"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 rounded-xl border-border"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(totalPages - 1)}
              >
                <ChevronsRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

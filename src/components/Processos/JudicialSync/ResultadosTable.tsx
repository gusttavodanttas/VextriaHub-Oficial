import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle, Database, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { JudicialProcessResult } from './types';

interface Props {
  results: JudicialProcessResult[];
  paginatedResults: JudicialProcessResult[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onOpenPreview: (proc: JudicialProcessResult) => void;
  loading: boolean;
  searched: boolean;
  oab: string;
  uf: string;
}

const formatNumero = (numero: string) => {
  const digits = numero.replace(/[.-]/g, '');
  return digits.length === 20
    ? digits.replace(/^(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})$/, '$1-$2.$3.$4.$5.$6')
    : numero;
};

const ParteCell = ({ nome, vazio, className }: { nome: string; vazio: string; className: string }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn("cursor-default max-w-[200px]", className)}>
          {nome || vazio}
        </div>
      </TooltipTrigger>
      <TooltipContent className="bg-background border-border text-foreground max-w-sm">
        {nome || vazio}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

/** Tabela de processos encontrados na OAB, com os estados vazio/carregando/sem resultado. */
export function ResultadosTable({
  results, paginatedResults, selectedIds, onToggleSelect, onToggleSelectAll, onOpenPreview, loading, searched, oab, uf,
}: Props) {
  return (
    <div className="flex-1 min-h-[300px] border border-border rounded-[2rem] bg-muted/10 overflow-hidden flex flex-col mb-4 shadow-inner">
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {results.length > 0 ? (
          <Table>
            <TableHeader className="bg-muted sticky top-0 z-20 backdrop-blur-md">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-[40px] px-6">
                  <Checkbox
                    checked={selectedIds.size === results.length && results.length > 0}
                    onCheckedChange={onToggleSelectAll}
                    className="border-border data-[state=checked]:bg-primary"
                  />
                </TableHead>
                <TableHead className="text-muted-foreground/60 text-[10px] uppercase tracking-widest font-black py-5">Processo</TableHead>
                <TableHead className="text-muted-foreground/60 text-[10px] uppercase tracking-widest font-black py-5">Autor</TableHead>
                <TableHead className="text-muted-foreground/60 text-[10px] uppercase tracking-widest font-black py-5">Réu</TableHead>
                <TableHead className="text-muted-foreground/60 text-[10px] uppercase tracking-widest font-black py-5">Fase</TableHead>
                <TableHead className="text-muted-foreground/60 text-[10px] uppercase tracking-widest font-black py-5">Tribunal</TableHead>
                <TableHead className="text-muted-foreground/60 text-[10px] uppercase tracking-widest font-black py-5">Último Andamento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedResults.map((proc) => (
                <TableRow
                  key={proc.id}
                  className={cn(
                    "group border-border transition-colors cursor-pointer",
                    selectedIds.has(proc.id) ? "bg-primary/[0.04] dark:bg-primary/[0.08]" : "hover:bg-muted/30"
                  )}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('.checkbox-cell')) return;
                    onOpenPreview(proc);
                  }}
                >
                  <TableCell className="px-4 checkbox-cell">
                    <Checkbox
                      checked={selectedIds.has(proc.id)}
                      onCheckedChange={() => onToggleSelect(proc.id)}
                      className="border-border data-[state=checked]:bg-primary"
                    />
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-[10px] font-bold text-primary whitespace-nowrap">
                      {formatNumero(proc.numeroProcesso)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <ParteCell nome={proc.autor} vazio="Não identificado" className="text-[10px] font-black line-clamp-1 text-foreground" />
                  </TableCell>
                  <TableCell>
                    <ParteCell nome={proc.reu} vazio="Não identificada" className="text-[10px] font-medium line-clamp-2 text-foreground/80" />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[8px] h-5 uppercase font-black bg-muted border-border text-muted-foreground/60 whitespace-nowrap rounded-md">
                      {proc.faseProcessual}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-[10px] text-muted-foreground/60 truncate max-w-[120px] inline-block font-bold">
                      {proc.tribunal} {proc.vara && `• ${proc.vara}`}
                    </span>
                  </TableCell>
                  <TableCell>
                    {proc.ultimoAndamento ? (
                      <div className="flex flex-col gap-0.5 max-w-[200px]">
                        <span className="text-[9px] text-primary/70 font-black uppercase">
                          {proc.ultimoAndamento.data ? new Date(proc.ultimoAndamento.data).toLocaleDateString() : ''}
                        </span>
                        <span className="text-[10px] line-clamp-1 italic text-muted-foreground/40 font-medium">{proc.ultimoAndamento.descricao}</span>
                      </div>
                    ) : <span className="text-muted-foreground/20 italic text-[10px] font-medium">Sem andamento</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground/30 h-full">
            {loading ? (
              <>
                <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
                <p className="text-muted-foreground animate-pulse">Sincronizando com tribunais...</p>
                <p className="text-[10px] text-muted-foreground/60 mt-2">Isso pode levar alguns segundos.</p>
              </>
            ) : searched ? (
              <>
                <AlertCircle className="h-12 w-12 mb-4 text-orange-500 opacity-60" />
                <p className="text-lg font-medium text-foreground">Nenhum processo encontrado</p>
                <p className="text-xs mt-2 max-w-[300px] mx-auto text-muted-foreground italic">
                  Não encontramos processos vinculados à OAB {oab}/{uf} nos tribunais integrados.
                  Confira se o número está correto ou tente buscar por outros critérios.
                </p>
              </>
            ) : (
              <>
                <Database className="h-12 w-12 mb-4 opacity-10" />
                <p className="text-lg font-medium text-muted-foreground">Busca pronta</p>
                <p className="text-xs mt-2 max-w-[240px] mx-auto text-muted-foreground">
                  Informe sua OAB e Estado para sincronizar processos diretamente dos tribunais.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

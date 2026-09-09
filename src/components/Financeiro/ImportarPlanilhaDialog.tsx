// Importação de lançamentos financeiros a partir de planilha (Excel/CSV),
// com a IA sugerindo tipo/categoria/escopo/valor pra cada linha — o usuário
// sempre revisa e confirma antes de qualquer INSERT (a IA só sugere).
import { useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FileSpreadsheet, Sparkles, Loader2, Upload, Trash2, Building2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { parseSpreadsheetFile, stripEmptyRows } from "@/lib/spreadsheetParser";
import { useAiAdvisor, AdvisorError, type ItemImportadoFinanceiro } from "@/hooks/useAiAdvisor";
import { fmt, type EscopoType, type TipoType } from "./shared";
import type { TablesInsert } from "@/integrations/supabase/rows";

// Teto no client — espelha o teto do edge function (uma única chamada de IA).
const MAX_LINHAS = 150;

interface EditableItem extends ItemImportadoFinanceiro {
  key: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  officeId: string;
  userId: string;
  categoriasReceita: string[];
  categoriasDespesa: string[];
  onImport: (rows: TablesInsert<"financeiro">[]) => void;
  importing: boolean;
}

export function ImportarPlanilhaDialog({
  open, onClose, officeId, userId, categoriasReceita, categoriasDespesa, onImport, importing,
}: Props) {
  const { toast } = useToast();
  const { importarFinanceiro } = useAiAdvisor();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState("");
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [parsing, setParsing] = useState(false);
  const [classificando, setClassificando] = useState(false);
  const [items, setItems] = useState<EditableItem[] | null>(null);
  const [error, setError] = useState("");

  const reset = () => {
    setFileName("");
    setRawRows([]);
    setItems(null);
    setError("");
  };

  const handleFile = async (file: File) => {
    setError("");
    setParsing(true);
    try {
      const parsed = stripEmptyRows(await parseSpreadsheetFile(file));
      if (parsed.length === 0) {
        setError("Não encontramos nenhuma linha com dados nessa planilha.");
        return;
      }
      setFileName(file.name);
      setRawRows(parsed.slice(0, MAX_LINHAS));
      setItems(null);
    } catch (e) {
      setError("Não foi possível ler esse arquivo. Confirme que é um .xlsx, .xls ou .csv válido.");
      console.error("parseSpreadsheetFile:", e);
    } finally {
      setParsing(false);
    }
  };

  const handleClassificar = async () => {
    setError("");
    setClassificando(true);
    try {
      const { itens } = await importarFinanceiro(rawRows, categoriasReceita, categoriasDespesa);
      const editable: EditableItem[] = itens.map((it, i) => ({
        ...it,
        key: `item-${i}`,
        descricao: it.descricao || "Lançamento importado",
        valor: Number(it.valor) || 0,
        data_vencimento: it.data_vencimento || new Date().toISOString().slice(0, 10),
        escopo: it.escopo === "pf" ? "pf" : "pj",
        tipo: it.tipo === "receita" ? "receita" : "despesa",
      }));
      setItems(editable);
      const incluidos = editable.filter((i) => i.incluir).length;
      if (incluidos === 0) {
        toast({ title: "Nada pra importar", description: "A IA não identificou nenhum lançamento válido nessa planilha." });
      }
    } catch (e) {
      if (e instanceof AdvisorError && e.code === "premium-required") {
        setError("A classificação por IA é um recurso do plano Premium. Você ainda pode conferir a planilha e lançar manualmente pela tela normal.");
      } else if (e instanceof AdvisorError && e.code === "limite-ia-atingido") {
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : "Erro ao classificar a planilha com IA.");
      }
    } finally {
      setClassificando(false);
    }
  };

  const updateItem = <K extends keyof EditableItem>(key: string, field: K, value: EditableItem[K]) => {
    setItems((prev) => prev?.map((it) => (it.key === key ? { ...it, [field]: value } : it)) ?? null);
  };

  const incluidos = items?.filter((i) => i.incluir) ?? [];
  const totalIncluido = incluidos.reduce((acc, i) => acc + (i.valor || 0), 0);

  const handleImportar = () => {
    const rows: TablesInsert<"financeiro">[] = incluidos.map((i) => ({
      office_id: officeId,
      user_id: userId,
      tipo: i.tipo,
      descricao: i.descricao.trim() || "Lançamento importado",
      valor: i.valor,
      data_vencimento: i.data_vencimento || new Date().toISOString().slice(0, 10),
      status: "pendente",
      categoria: i.categoria?.trim() || null,
      escopo: i.escopo,
    }));
    onImport(rows);
  };

  const handleClose = () => {
    if (importing || classificando) return;
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-3xl rounded-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <span className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <FileSpreadsheet className="h-5 w-5" />
            </span>
            Importar planilha (Excel / CSV)
          </DialogTitle>
          <DialogDescription className="text-xs">
            Suba um .xlsx, .xls ou .csv (inclusive exportado do Google Planilhas) — a IA sugere tipo, categoria e
            valor de cada linha, e você revisa antes de importar.
          </DialogDescription>
        </DialogHeader>

        {!items && (
          <div className="space-y-4 py-2">
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={parsing}
              className="w-full border-2 border-dashed border-black/10 dark:border-border rounded-2xl p-8 flex flex-col items-center gap-2 text-center hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-60">
              {parsing ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <Upload className="h-8 w-8 text-muted-foreground" />}
              <p className="text-sm font-bold">{fileName || "Clique para escolher o arquivo"}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">.xlsx · .xls · .csv</p>
            </button>

            {rawRows.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  <span className="font-bold text-foreground">{rawRows.length}</span> linha(s) encontrada(s)
                  {rawRows.length >= MAX_LINHAS && ` (limite de ${MAX_LINHAS} por importação)`}.
                </p>
                <div className="rounded-2xl border border-black/5 dark:border-border overflow-x-auto max-h-40">
                  <table className="w-full text-[11px]">
                    <tbody>
                      {rawRows.slice(0, 6).map((row, i) => (
                        <tr key={i} className="border-b border-black/5 dark:border-border last:border-0">
                          {row.slice(0, 6).map((cell, j) => (
                            <td key={j} className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">{cell || "—"}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rawRows.length > 6 && (
                    <p className="text-[10px] text-muted-foreground/60 px-2 py-1.5">
                      + {rawRows.length - 6} linha(s) — prévia mostra só as 6 primeiras.
                    </p>
                  )}
                </div>
                <Button onClick={handleClassificar} disabled={classificando}
                  className="w-full rounded-xl font-black uppercase text-xs tracking-widest gap-2">
                  {classificando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {classificando ? "Classificando com IA…" : "Classificar com IA"}
                </Button>
              </div>
            )}

            {error && (
              <p className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl p-3">{error}</p>
            )}
          </div>
        )}

        {items && (
          <div className="space-y-4 py-2">
            {error && (
              <p className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl p-3">{error}</p>
            )}
            <div className="flex items-center justify-between flex-wrap gap-2 bg-muted/20 rounded-2xl p-3">
              <p className="text-xs font-bold">
                {incluidos.length} de {items.length} selecionado(s) para importar
              </p>
              <p className="text-sm font-black tabular-nums">{fmt(totalIncluido)}</p>
            </div>

            <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
              {items.map((item) => (
                <div key={item.key}
                  className={cn(
                    "rounded-2xl border p-3 space-y-2 transition-opacity",
                    item.incluir ? "border-black/5 dark:border-border bg-card/40" : "border-black/5 dark:border-border opacity-40",
                  )}>
                  <div className="flex items-start gap-3">
                    <Checkbox checked={item.incluir} className="mt-1"
                      onCheckedChange={(v) => updateItem(item.key, "incluir", !!v)} />
                    <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input value={item.descricao} onChange={(e) => updateItem(item.key, "descricao", e.target.value)}
                        placeholder="Descrição" className="rounded-lg h-9 text-xs sm:col-span-2" />
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">R$</span>
                        <Input type="number" min="0" step="0.01" value={item.valor}
                          onChange={(e) => updateItem(item.key, "valor", parseFloat(e.target.value) || 0)}
                          className="rounded-lg h-9 pl-8 text-xs font-bold" />
                      </div>
                      <Input type="date" value={item.data_vencimento ?? ""}
                        onChange={(e) => updateItem(item.key, "data_vencimento", e.target.value)}
                        className="rounded-lg h-9 text-xs" />
                      <Select value={item.tipo} onValueChange={(v) => updateItem(item.key, "tipo", v as TipoType)}>
                        <SelectTrigger className="rounded-lg h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="receita">Receita</SelectItem>
                          <SelectItem value="despesa">Despesa</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input value={item.categoria ?? ""} onChange={(e) => updateItem(item.key, "categoria", e.target.value)}
                        placeholder="Categoria" className="rounded-lg h-9 text-xs" />
                      <div className="flex bg-muted/30 p-1 rounded-lg border border-black/8 dark:border-border sm:col-span-2 w-fit">
                        <button type="button" onClick={() => updateItem(item.key, "escopo", "pj" as EscopoType)}
                          className={cn("flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black uppercase transition-all",
                            item.escopo === "pj" ? "bg-blue-500 text-white" : "text-muted-foreground")}>
                          <Building2 className="h-3 w-3" />PJ
                        </button>
                        <button type="button" onClick={() => updateItem(item.key, "escopo", "pf" as EscopoType)}
                          className={cn("flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black uppercase transition-all",
                            item.escopo === "pf" ? "bg-violet-500 text-white" : "text-muted-foreground")}>
                          <User className="h-3 w-3" />PF
                        </button>
                      </div>
                    </div>
                    {item.confidence < 60 && (
                      <Badge className="shrink-0 px-2 py-0.5 rounded-lg text-[9px] uppercase tracking-widest border-amber-500/40 text-amber-600 bg-amber-500/10 font-bold">
                        Confira
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" onClick={reset} className="flex-1 rounded-xl h-10 font-black uppercase text-[10px] tracking-widest gap-1">
                <Trash2 className="h-3.5 w-3.5" />Recomeçar
              </Button>
              <Button onClick={handleImportar} disabled={importing || incluidos.length === 0}
                className="flex-1 rounded-xl h-10 font-black uppercase text-[10px] tracking-widest">
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : `Importar ${incluidos.length} lançamento(s)`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Loader2, RefreshCw, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { captureError } from "@/lib/monitoring";

type Row = {
  office_id: string;
  escritorio: string;
  plano: string | null;
  status_assinatura: string | null;
  excecao: string;
  permitido: boolean;
  ligado: boolean;
  conexao: string;
  workspace: string | null;
  ultima_sync: string | null;
};

const EXCECAO_LABEL: Record<string, string> = {
  plano: "Seguir o plano",
  liberado: "Liberado (exceção)",
  bloqueado: "Bloqueado",
};

// Super admin: controle do Notion por escritório. A regra padrão vem do plano
// (plan_configs.allow_notion, editado em Assinaturas → Planos); aqui dá pra abrir
// exceção (liberar ou bloquear) para um escritório específico.
export function NotionAccessPanel() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_notion_overview");
    setLoading(false);
    if (error) { captureError(error, { context: "NotionAccessPanel.load" }); setError(error.message); return; }
    setError(null);
    setRows((data as Row[]) || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const setAccess = useCallback(async (office: string, access: string) => {
    setSaving(office);
    const { error } = await supabase.rpc("admin_set_office_notion_access", { p_office: office, p_access: access });
    setSaving(null);
    if (error) {
      captureError(error, { context: "NotionAccessPanel.setAccess" });
      toast({ title: "Não foi possível alterar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Acesso ao Notion atualizado", description: EXCECAO_LABEL[access] });
    load();
  }, [toast, load]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? rows.filter((r) => `${r.escritorio} ${r.plano ?? ""} ${r.workspace ?? ""}`.toLowerCase().includes(t)) : rows;
  }, [rows, q]);

  const conectados = rows.filter((r) => r.conexao === "conectado" && r.ligado).length;
  const permitidos = rows.filter((r) => r.permitido).length;

  return (
    <Card className="glass-card rounded-[2rem] border-black/5 dark:border-border overflow-hidden shadow-premium mt-6">
      <CardHeader className="border-b border-black/5 dark:border-border pb-4 flex flex-row items-center gap-3 flex-wrap">
        <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <BookOpen className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-[12rem]">
          <CardTitle className="text-lg font-black">Integração com o Notion</CardTitle>
          <CardDescription className="text-xs font-medium">
            {permitidos} escritório(s) com acesso · {conectados} sincronizando agora. A regra padrão vem do plano; aqui você abre exceções.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar escritório" className="pl-9 rounded-xl h-9" />
          </div>
          <Button variant="outline" size="icon" onClick={load} disabled={loading} aria-label="Atualizar" className="rounded-xl h-9 w-9">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {error ? (
          <div className="p-6 text-sm text-destructive flex items-center justify-between gap-3">
            <span>Não foi possível carregar: {error}</span>
            <Button variant="outline" size="sm" onClick={load} className="rounded-xl">Tentar de novo</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Escritório</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Acesso</TableHead>
                  <TableHead>Conexão</TableHead>
                  <TableHead>Última sync</TableHead>
                  <TableHead className="w-[12rem]">Regra</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!loading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Nenhum escritório encontrado.</TableCell></TableRow>
                )}
                {filtered.map((r) => (
                  <TableRow key={r.office_id}>
                    <TableCell className="font-semibold text-sm">{r.escritorio}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.plano || "—"}{r.status_assinatura ? ` · ${r.status_assinatura}` : ""}
                    </TableCell>
                    <TableCell>
                      {r.permitido
                        ? <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15 text-[10px]">Permitido</Badge>
                        : <Badge variant="secondary" className="text-[10px]">Sem acesso</Badge>}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.conexao === "conectado"
                        ? <span>{r.ligado ? "Ligado" : "Desligado"}{r.workspace ? ` · ${r.workspace}` : ""}</span>
                        : r.conexao === "erro"
                        ? <span className="text-amber-600">Com erro</span>
                        : <span className="text-muted-foreground">Não conectado</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.ultima_sync ? new Date(r.ultima_sync).toLocaleString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell>
                      <Select value={r.excecao} onValueChange={(v) => setAccess(r.office_id, v)} disabled={saving === r.office_id}>
                        <SelectTrigger className="h-8 rounded-lg text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(EXCECAO_LABEL).map(([v, label]) => (
                            <SelectItem key={v} value={v} className="text-xs">{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

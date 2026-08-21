import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Settings2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { GerenciarTiposModal } from "@/components/Processos/NovoPrazoStandaloneDialog";

// A aba Config → Prazos agora reflete e edita os MESMOS tipos que o cadastro de prazo usa
// (tabela tipos_ato_prazo), em vez de uma lista paralela em office-settings que ninguém lia.
interface TipoRow { label: string; dias_uteis: number; corridos: boolean; }

export function DeadlineConfig() {
  const { user } = useAuth();
  const officeId = user?.office_id;
  const [open, setOpen] = useState(false);
  const [tipos, setTipos] = useState<TipoRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!officeId) { setLoading(false); return; }
    let cancel = false;
    setLoading(true);
    supabase
      .from("tipos_ato_prazo")
      .select("label, dias_uteis, corridos")
      .eq("office_id", officeId)
      .order("ordem", { ascending: true })
      .then(({ data }) => { if (!cancel) { setTipos((data as TipoRow[]) || []); setLoading(false); } });
    return () => { cancel = true; };
  }, [officeId, open]); // recarrega ao fechar o gerenciador

  return (
    <Card className="glass-card rounded-[2rem] border-black/5 dark:border-border overflow-hidden shadow-premium">
      <CardHeader className="border-b border-black/5 dark:border-border pb-4 flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-black flex items-center gap-2">
              Tipos de Prazo
              {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </CardTitle>
            <CardDescription className="text-xs font-medium">Dias (úteis/corridos), margem interna e feriados — usados ao cadastrar prazos.</CardDescription>
          </div>
        </div>
        <Badge variant="secondary" className="rounded-full font-black shrink-0">{tipos.length}</Badge>
      </CardHeader>

      <CardContent className="p-5 md:p-6 space-y-4">
        {!loading && tipos.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground font-medium">
            Nenhum tipo de prazo cadastrado ainda. Clique abaixo para gerenciar (ou restaurar os padrões do CPC).
          </div>
        ) : (
          <div className="grid gap-2">
            {tipos.map((t, i) => (
              <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-black/5 dark:border-border bg-black/[0.01] dark:bg-white/[0.01]">
                <span className="font-bold text-sm truncate">{t.label}</span>
                <span className="text-[11px] font-black text-muted-foreground shrink-0">
                  {t.dias_uteis} {t.corridos ? "dias corridos" : "dias úteis"}
                </span>
              </div>
            ))}
          </div>
        )}

        <Button onClick={() => setOpen(true)} disabled={!officeId} className="w-full rounded-xl font-bold gap-2">
          <Settings2 className="h-4 w-4" /> Gerenciar tipos de prazo
        </Button>
      </CardContent>

      {officeId && <GerenciarTiposModal open={open} onClose={() => setOpen(false)} officeId={officeId} />}
    </Card>
  );
}

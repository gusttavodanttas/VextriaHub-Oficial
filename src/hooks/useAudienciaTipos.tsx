import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { assertRowsAffected, getErrorMessage, isMissingTableError } from "@/lib/errors";
import { captureError } from "@/lib/monitoring";

const DEFAULT_TIPOS = [
  "Conciliação", "Instrução", "Una", "Julgamento",
  "Trabalhista", "Família", "Previdenciário", "Cível", "Criminal",
];

type Mode = "db" | "local";

/**
 * Gerencia os tipos de audiência por escritório.
 *
 * Usa a tabela `audiencia_tipos` (compartilhada por todo o escritório) quando
 * ela existe. Só quando a tabela genuinamente não existe (migration não rodada)
 * cai pro localStorage. Qualquer outro erro (rede, RLS) vira `error` e bloqueia a
 * edição — antes ele também caía pro modo local, e o que o usuário editava ficava
 * só no navegador dele, sem ninguém do escritório ver. Ao usar a tabela pela
 * primeira vez, semeia a lista a partir do localStorage (ou dos padrões).
 */
export function useAudienciaTipos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const officeId = user?.office_id || null;
  const lsKey = `audiencia_tipos_${officeId || "default"}`;
  const [tipos, setTipos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const modeRef = useRef<Mode>("local");

  const readLocal = useCallback((): string[] => {
    try {
      const raw = localStorage.getItem(lsKey);
      if (raw) { const p = JSON.parse(raw); if (Array.isArray(p) && p.length > 0) return p; }
    } catch { /* localStorage indisponível/corrompido → usa os padrões */ }
    return DEFAULT_TIPOS;
  }, [lsKey]);

  const writeLocal = useCallback((next: string[]) => {
    try { localStorage.setItem(lsKey, JSON.stringify(next)); } catch { /* sem localStorage: a lista vale só nesta sessão */ }
  }, [lsKey]);

  const load = useCallback(async () => {
    if (!officeId) { setTipos(readLocal()); modeRef.current = "local"; setError(null); return; }

    const { data, error: fetchError } = await supabase
      .from("audiencia_tipos")
      .select("nome")
      .eq("office_id", officeId)
      .order("nome", { ascending: true });

    if (fetchError) {
      if (isMissingTableError(fetchError)) {
        modeRef.current = "local";
        setTipos(readLocal());
        setError(null);
        return;
      }
      // Mostra a lista local só como referência para os seletores; a edição fica
      // bloqueada até o load dar certo (ver `blocked`).
      modeRef.current = "db";
      setTipos(readLocal());
      setError(getErrorMessage(fetchError, "Não foi possível carregar os tipos de audiência."));
      return;
    }

    modeRef.current = "db";
    setError(null);
    const nomes = (data || []).map((r: { nome: string }) => r.nome);

    if (nomes.length === 0) {
      // Primeira vez: semeia a partir do localStorage ou dos padrões
      const seed = readLocal();
      const { error: seedErr } = await supabase.from("audiencia_tipos").insert(seed.map(nome => ({ office_id: officeId, nome })));
      if (seedErr) captureError(seedErr, { context: "useAudienciaTipos.seed", officeId });
      setTipos(seed);
      return;
    }

    setTipos(nomes);
  }, [officeId, readLocal]);

  useEffect(() => { load(); }, [load]);

  const blocked = useCallback(() => {
    if (!error) return false;
    toast({ title: "Não foi possível salvar", description: "Os tipos não carregaram — tente de novo antes de editar.", variant: "destructive" });
    return true;
  }, [error, toast]);

  // Persiste no banco; em falha avisa e recarrega (desfaz o otimista).
  const persistDb = useCallback(async (op: () => Promise<void>, erroTitulo: string) => {
    try {
      await op();
    } catch (e) {
      toast({ title: erroTitulo, description: getErrorMessage(e), variant: "destructive" });
      load();
    }
  }, [toast, load]);

  const add = useCallback((nome: string): boolean => {
    const v = nome.trim();
    if (!v || blocked()) return false;
    if (tipos.some(t => t.toLowerCase() === v.toLowerCase())) return false;
    const next = [...tipos, v].sort((a, b) => a.localeCompare(b));
    setTipos(next);
    if (modeRef.current === "db" && officeId) {
      persistDb(async () => {
        const { error: e } = await supabase.from("audiencia_tipos").insert({ office_id: officeId, nome: v });
        if (e) throw e;
      }, "Erro ao adicionar tipo");
    } else {
      writeLocal(next);
    }
    return true;
  }, [tipos, officeId, writeLocal, blocked, persistDb]);

  const rename = useCallback((oldNome: string, novoNome: string): boolean => {
    const v = novoNome.trim();
    if (!v || blocked()) return false;
    if (v.toLowerCase() !== oldNome.toLowerCase() && tipos.some(t => t.toLowerCase() === v.toLowerCase())) return false;
    const next = tipos.map(t => (t === oldNome ? v : t)).sort((a, b) => a.localeCompare(b));
    setTipos(next);
    if (modeRef.current === "db" && officeId) {
      persistDb(async () => {
        const { data, error: e } = await supabase.from("audiencia_tipos").update({ nome: v }).eq("office_id", officeId).eq("nome", oldNome).select("id");
        assertRowsAffected(data, e, 1);
      }, "Erro ao renomear tipo");
    } else {
      writeLocal(next);
    }
    return true;
  }, [tipos, officeId, writeLocal, blocked, persistDb]);

  const remove = useCallback((nome: string) => {
    if (blocked()) return;
    const next = tipos.filter(t => t !== nome);
    setTipos(next);
    if (modeRef.current === "db" && officeId) {
      persistDb(async () => {
        const { data, error: e } = await supabase.from("audiencia_tipos").delete().eq("office_id", officeId).eq("nome", nome).select("id");
        assertRowsAffected(data, e, 1);
      }, "Erro ao remover tipo");
    } else {
      writeLocal(next);
    }
  }, [tipos, officeId, writeLocal, blocked, persistDb]);

  const reset = useCallback(() => {
    if (blocked()) return;
    const next = [...DEFAULT_TIPOS].sort((a, b) => a.localeCompare(b));
    const atuais = tipos;
    setTipos(next);
    if (modeRef.current === "db" && officeId) {
      // Insere os padrões que faltam ANTES de apagar os extras: antes era delete-all
      // seguido de insert, e uma falha no meio deixava o escritório sem nenhum tipo.
      persistDb(async () => {
        const faltando = next.filter(n => !atuais.includes(n));
        if (faltando.length) {
          const { error: insErr } = await supabase.from("audiencia_tipos").insert(faltando.map(nome => ({ office_id: officeId, nome })));
          if (insErr) throw insErr;
        }
        const extras = atuais.filter(n => !next.includes(n));
        if (extras.length) {
          const { data, error: delErr } = await supabase.from("audiencia_tipos").delete().eq("office_id", officeId).in("nome", extras).select("id");
          assertRowsAffected(data, delErr, extras.length);
        }
        load();
      }, "Erro ao restaurar padrão");
    } else {
      writeLocal(next);
    }
  }, [tipos, officeId, writeLocal, blocked, persistDb, load]);

  return { tipos, error, refetch: load, add, rename, remove, reset };
}

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_TIPOS = [
  "Conciliação", "Instrução", "Una", "Julgamento",
  "Trabalhista", "Família", "Previdenciário", "Cível", "Criminal",
];

type Mode = "db" | "local";

/**
 * Gerencia os tipos de audiência por escritório.
 *
 * Usa a tabela `audiencia_tipos` (compartilhada por todo o escritório) quando
 * ela existe. Se a tabela ainda não foi criada (ou der erro de acesso), faz
 * fallback automático para localStorage — assim funciona antes e depois de
 * rodar a migration, sem quebrar. Ao migrar para o modo tabela pela primeira
 * vez, semeia a lista a partir do localStorage (ou dos padrões).
 */
export function useAudienciaTipos() {
  const { user } = useAuth();
  const officeId = user?.office_id || null;
  const lsKey = `audiencia_tipos_${officeId || "default"}`;
  const [tipos, setTipos] = useState<string[]>([]);
  const modeRef = useRef<Mode>("local");

  const readLocal = useCallback((): string[] => {
    try {
      const raw = localStorage.getItem(lsKey);
      if (raw) { const p = JSON.parse(raw); if (Array.isArray(p)) return p; }
    } catch { /* ignore */ }
    return DEFAULT_TIPOS;
  }, [lsKey]);

  const writeLocal = useCallback((next: string[]) => {
    try { localStorage.setItem(lsKey, JSON.stringify(next)); } catch { /* ignore */ }
  }, [lsKey]);

  const load = useCallback(async () => {
    if (!officeId) { setTipos(readLocal()); modeRef.current = "local"; return; }

    const { data, error } = await supabase
      .from("audiencia_tipos")
      .select("nome")
      .eq("office_id", officeId)
      .order("nome", { ascending: true });

    if (error) {
      // Tabela ainda não existe / sem acesso → modo local
      modeRef.current = "local";
      setTipos(readLocal());
      return;
    }

    modeRef.current = "db";
    const nomes = (data || []).map((r: any) => r.nome);

    if (nomes.length === 0) {
      // Primeira vez: semeia a partir do localStorage ou dos padrões
      const seed = readLocal();
      const rows = seed.map(nome => ({ office_id: officeId, nome }));
      const { error: seedErr } = await supabase.from("audiencia_tipos").insert(rows);
      setTipos(seedErr ? seed : seed);
      return;
    }

    setTipos(nomes);
  }, [officeId, readLocal]);

  useEffect(() => { load(); }, [load]);

  const add = useCallback((nome: string): boolean => {
    const v = nome.trim();
    if (!v) return false;
    if (tipos.some(t => t.toLowerCase() === v.toLowerCase())) return false;
    const next = [...tipos, v].sort((a, b) => a.localeCompare(b));
    setTipos(next);
    if (modeRef.current === "db" && officeId) {
      supabase.from("audiencia_tipos").insert({ office_id: officeId, nome: v }).then(({ error }) => { if (error) load(); });
    } else {
      writeLocal(next);
    }
    return true;
  }, [tipos, officeId, writeLocal, load]);

  const rename = useCallback((oldNome: string, novoNome: string): boolean => {
    const v = novoNome.trim();
    if (!v) return false;
    if (v.toLowerCase() !== oldNome.toLowerCase() && tipos.some(t => t.toLowerCase() === v.toLowerCase())) return false;
    const next = tipos.map(t => (t === oldNome ? v : t)).sort((a, b) => a.localeCompare(b));
    setTipos(next);
    if (modeRef.current === "db" && officeId) {
      supabase.from("audiencia_tipos").update({ nome: v }).eq("office_id", officeId).eq("nome", oldNome).then(({ error }) => { if (error) load(); });
    } else {
      writeLocal(next);
    }
    return true;
  }, [tipos, officeId, writeLocal, load]);

  const remove = useCallback((nome: string) => {
    const next = tipos.filter(t => t !== nome);
    setTipos(next);
    if (modeRef.current === "db" && officeId) {
      supabase.from("audiencia_tipos").delete().eq("office_id", officeId).eq("nome", nome).then(({ error }) => { if (error) load(); });
    } else {
      writeLocal(next);
    }
  }, [tipos, officeId, writeLocal, load]);

  const reset = useCallback(() => {
    const next = [...DEFAULT_TIPOS].sort((a, b) => a.localeCompare(b));
    setTipos(next);
    if (modeRef.current === "db" && officeId) {
      (async () => {
        await supabase.from("audiencia_tipos").delete().eq("office_id", officeId);
        await supabase.from("audiencia_tipos").insert(next.map(nome => ({ office_id: officeId, nome })));
        load();
      })();
    } else {
      writeLocal(next);
    }
  }, [officeId, writeLocal, load]);

  return { tipos, add, rename, remove, reset };
}

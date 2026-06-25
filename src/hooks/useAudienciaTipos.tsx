import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const DEFAULT_TIPOS = [
  "Conciliação", "Instrução", "Una", "Julgamento",
  "Trabalhista", "Família", "Previdenciário", "Cível", "Criminal",
];

/**
 * Gerencia a lista de tipos de audiência por escritório.
 * Armazenado em localStorage (por office_id). CRUD completo.
 * Pode ser migrado para uma tabela compartilhada no futuro sem mudar a API.
 */
export function useAudienciaTipos() {
  const { user } = useAuth();
  const key = `audiencia_tipos_${user?.office_id || "default"}`;
  const [tipos, setTipos] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) { setTipos(parsed); return; }
      }
      setTipos(DEFAULT_TIPOS);
    } catch {
      setTipos(DEFAULT_TIPOS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const persist = useCallback((next: string[]) => {
    setTipos(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ }
  }, [key]);

  const add = useCallback((nome: string): boolean => {
    const v = nome.trim();
    if (!v) return false;
    if (tipos.some(t => t.toLowerCase() === v.toLowerCase())) return false;
    persist([...tipos, v]);
    return true;
  }, [tipos, persist]);

  const rename = useCallback((oldNome: string, novoNome: string): boolean => {
    const v = novoNome.trim();
    if (!v) return false;
    if (v.toLowerCase() !== oldNome.toLowerCase() && tipos.some(t => t.toLowerCase() === v.toLowerCase())) return false;
    persist(tipos.map(t => (t === oldNome ? v : t)));
    return true;
  }, [tipos, persist]);

  const remove = useCallback((nome: string) => {
    persist(tipos.filter(t => t !== nome));
  }, [tipos, persist]);

  const reset = useCallback(() => persist(DEFAULT_TIPOS), [persist]);

  return { tipos, add, rename, remove, reset };
}

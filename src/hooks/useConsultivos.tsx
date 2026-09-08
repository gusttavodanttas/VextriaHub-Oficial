import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { getErrorMessage } from "@/lib/errors";

export type Consultivo = Tables<"consultivos"> & {
  clientes?: { nome: string } | null;
};

export function useConsultivos() {
  const [data, setData] = useState<Consultivo[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchData = async () => {
    if (!user?.office_id) { setData([]); setLoading(false); return; }
    setLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from("consultivos")
        .select("*, clientes(nome)")
        .eq("office_id", user.office_id)
        .eq("deletado", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setData((rows as Consultivo[]) || []);
    } catch (err) {
      // `catch {}` sem variável escondia a causa real (RLS, rede, payload
      // inválido) atrás da mesma mensagem genérica sempre — impossível diagnosticar
      // quando alguém reportasse "não consegui salvar/carregar".
      console.error("Erro ao carregar consultivos:", err);
      toast({ title: "Erro ao carregar consultivos", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [user?.office_id]);

  const create = async (payload: Omit<TablesInsert<"consultivos">, "user_id" | "office_id">): Promise<boolean> => {
    if (!user?.office_id) return false;
    try {
      const { error } = await supabase.from("consultivos").insert({
        ...payload,
        user_id: user.id,
        office_id: user.office_id,
      });
      if (error) throw error;
      await fetchData();
      toast({ title: "Consultivo criado", description: `"${payload.titulo}" adicionado.` });
      return true;
    } catch (err) {
      console.error("Erro ao criar consultivo:", err);
      toast({ title: "Erro ao criar consultivo", description: getErrorMessage(err), variant: "destructive" });
      return false;
    }
  };

  const update = async (id: string, payload: TablesUpdate<"consultivos">): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("consultivos").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      await fetchData();
      return true;
    } catch (err) {
      console.error("Erro ao atualizar consultivo:", err);
      toast({ title: "Erro ao atualizar", description: getErrorMessage(err), variant: "destructive" });
      return false;
    }
  };

  const remove = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("consultivos").update({ deletado: true, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      setData(prev => prev.filter(c => c.id !== id));
      toast({ title: "Consultivo removido" });
      return true;
    } catch (err) {
      console.error("Erro ao remover consultivo:", err);
      toast({ title: "Erro ao remover", description: getErrorMessage(err), variant: "destructive" });
      return false;
    }
  };

  return { data, loading, create, update, remove, refetch: fetchData };
}

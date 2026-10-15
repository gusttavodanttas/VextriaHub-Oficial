import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getErrorMessage, assertRowsAffected } from "@/lib/errors";
import { useHistoricoPaginado } from "@/hooks/useHistoricoPaginado";

export interface Audiencia {
  id: string;
  titulo: string;
  tipo: string | null;
  data_audiencia: string; // ISO com data + hora
  local: string | null;
  status: string | null;
  observacoes: string | null;
  cliente_id: string | null;
  processo_id: string | null;
  cliente_nome?: string | null;
  responsavel_id?: string | null;
  avisos_dias?: number[] | null;
}

export interface AudienciaInput {
  titulo: string;
  tipo: string | null;
  data_audiencia: string;
  local: string | null;
  status: string;
  observacoes: string | null;
  cliente_id: string | null;
  processo_id?: string | null;
  responsavel_id?: string | null;
  avisos_dias?: number[] | null;
}

const mapAudiencia = (a: any): Audiencia => ({
  id: a.id,
  titulo: a.titulo,
  tipo: a.tipo,
  data_audiencia: a.data_audiencia,
  local: a.local,
  status: a.status,
  observacoes: a.observacoes,
  cliente_id: a.cliente_id,
  processo_id: a.processo_id,
  cliente_nome: a.clientes?.nome || null,
  // Sem estes dois, editar uma audiência REATRIBUÍa o responsável para quem
  // editava e ZERAVA os avisos personalizados (buildForm lia undefined). (v11)
  responsavel_id: a.responsavel_id ?? null,
  avisos_dias: a.avisos_dias ?? null,
});

export function useAudiencias() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const officeId = user?.office_id;

  // Divisão ativas/histórico (mesmo padrão de useAtendimentos/usePrazosData):
  // "ativas" = de hoje em diante OU ainda sem baixa (passadas sem realizada/
  // cancelada precisam de ação, então ficam no conjunto de trabalho, que é
  // naturalmente limitado). "histórico" = passadas e já baixadas: só cresce, vem
  // paginado com contagem exata (useHistoricoPaginado) em vez do `.limit(1000)`
  // silencioso de antes. O calendário e os agrupamentos trabalham sobre o que
  // está carregado.
  const inicioHoje = new Date(); inicioHoje.setHours(0, 0, 0, 0);
  const diaChave = inicioHoje.toISOString().slice(0, 10);
  const HISTORICO = ["realizada", "cancelada"];

  const ativas = useQuery<Audiencia[]>({
    queryKey: ["audiencias", officeId, "ativas", diaChave],
    queryFn: async () => {
      if (!officeId) return [];
      const { data, error } = await supabase
        .from("audiencias")
        .select("*, clientes!cliente_id(nome)")
        .eq("office_id", officeId)
        .eq("deletado", false)
        // `status.not.in` sozinho nunca casa NULL — por isso o `status.is.null`.
        .or(`data_audiencia.gte.${inicioHoje.toISOString()},status.is.null,status.not.in.(${HISTORICO.join(",")})`)
        .order("data_audiencia", { ascending: true });
      if (error) throw error;
      return (data || []).map(mapAudiencia);
    },
    enabled: !!officeId,
  });

  const historico = useHistoricoPaginado<Audiencia>({
    queryKey: ["audiencias", officeId, "historico", diaChave],
    enabled: !!officeId,
    fetchPage: async (from, to) => {
      const { data, error, count } = await supabase
        .from("audiencias")
        .select("*, clientes!cliente_id(nome)", { count: "exact" })
        .eq("office_id", officeId!)
        .eq("deletado", false)
        .lt("data_audiencia", inicioHoje.toISOString())
        .in("status", HISTORICO)
        .order("data_audiencia", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { rows: (data || []).map(mapAudiencia), total: count ?? 0 };
    },
  });

  // "Realizadas no mês" cruza os dois conjuntos e pode passar da primeira página
  // do histórico — contagem no servidor.
  const inicioMes = new Date(inicioHoje.getFullYear(), inicioHoje.getMonth(), 1);
  const contagens = useQuery({
    queryKey: ["audiencias", officeId, "contagens", diaChave],
    enabled: !!officeId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("audiencias")
        .select("id", { count: "exact", head: true })
        .eq("office_id", officeId!)
        .eq("deletado", false)
        .eq("status", "realizada")
        .gte("data_audiencia", inicioMes.toISOString());
      if (error) throw error;
      return { realizadasMes: count ?? 0 };
    },
  });

  const audiencias = useMemo(() => [...(ativas.data ?? []), ...historico.rows], [ativas.data, historico.rows]);
  const isLoading = ativas.isLoading || historico.isLoading;
  const isError = ativas.isError || historico.isError;
  const error = ativas.error ?? historico.error;
  const refetch = () => { ativas.refetch(); historico.refetch(); contagens.refetch(); };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["audiencias"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  const create = useMutation({
    mutationFn: async (input: AudienciaInput) => {
      if (!officeId || !user?.id) throw new Error("Sem escritório/usuário");
      const { error } = await supabase.from("audiencias").insert([{
        ...input,
        office_id: officeId,
        user_id: user.id,
        deletado: false,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Audiência criada", description: "A audiência foi agendada com sucesso." });
    },
    onError: (e: unknown) => toast({ title: "Erro ao criar", description: getErrorMessage(e), variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<AudienciaInput> }) => {
      const { data, error } = await supabase.from("audiencias").update(input).eq("id", id).select("id");
      assertRowsAffected(data, error, 1);
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Audiência atualizada", description: "As alterações foram salvas." });
    },
    onError: (e: unknown) => toast({ title: "Erro ao atualizar", description: getErrorMessage(e), variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await supabase.from("audiencias").update({ status }).eq("id", id).select("id");
      assertRowsAffected(data, error, 1);
    },
    onSuccess: () => invalidate(),
    onError: (e: unknown) => toast({ title: "Erro", description: getErrorMessage(e), variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, error } = await supabase.from("audiencias").update({ deletado: true }).in("id", ids).select("id");
      assertRowsAffected(data, error, ids.length);
    },
    onSuccess: (_d, ids) => {
      invalidate();
      toast({ title: "Audiência(s) excluída(s)", description: `${ids.length} audiência(s) movida(s) para a lixeira.` });
    },
    onError: (e: unknown) => toast({ title: "Erro ao excluir", description: getErrorMessage(e), variant: "destructive" }),
  });

  return {
    audiencias, isLoading, isError, error, refetch, create, update, updateStatus, remove,
    /** Histórico (passadas e baixadas) ainda não carregado — ver useHistoricoPaginado. */
    historicoRestantes: historico.restantes,
    carregarMaisHistorico: historico.carregarMais,
    carregandoMaisHistorico: historico.carregandoMais,
    contagens: contagens.data ?? null,
  };
}

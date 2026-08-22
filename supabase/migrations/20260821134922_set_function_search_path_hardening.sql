-- Advisor: function_search_path_mutable — fixa o search_path (evita injeção via search_path
-- em SECURITY DEFINER). Usa 'public' (as funções referenciam tabelas do public sem qualificar,
-- então '' quebraria). As demais funções já tinham SET search_path.
alter function public.auto_accept_invitation() set search_path = public;
alter function public.auto_assign_team() set search_path = public;
alter function public.set_data_encerramento() set search_path = public;
alter function public.update_subscribers_updated_at() set search_path = public;

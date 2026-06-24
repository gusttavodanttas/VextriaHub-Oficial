-- BROAD RLS FOR AUTHENTICATED USERS (Temporary Fix to Unblock)
ALTER TABLE public.publicacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Publicacoes Access" ON public.publicacoes;
CREATE POLICY "Publicacoes Access" ON public.publicacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.monitoramento_termos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Monitoramento Access" ON public.monitoramento_termos;
CREATE POLICY "Monitoramento Access" ON public.monitoramento_termos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Ensure authenticated role has grants
GRANT ALL ON TABLE public.publicacoes TO authenticated;
GRANT ALL ON TABLE public.monitoramento_termos TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

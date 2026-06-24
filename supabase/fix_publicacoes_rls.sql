DROP POLICY IF EXISTS "Publicacoes Access" ON public.publicacoes;
CREATE POLICY "Acesso por escritório ou dono" ON public.publicacoes 
FOR ALL USING (
    office_id IN (SELECT office_id FROM profiles WHERE user_id = auth.uid()) 
    OR user_id = auth.uid()
);

-- Habilitar RLS na tabela plan_configs
ALTER TABLE plan_configs ENABLE ROW LEVEL SECURITY;

-- Criar políticas para plan_configs (leitura pública, modificação apenas por super admins)
CREATE POLICY "Anyone can view active plans" 
ON plan_configs 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Only super admins can manage plans" 
ON plan_configs 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'::app_role
));
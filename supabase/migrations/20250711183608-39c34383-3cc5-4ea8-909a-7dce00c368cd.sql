-- Habilitar RLS em todas as tabelas
ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para offices
CREATE POLICY "Super admins podem ver todos os escritórios" 
ON public.offices 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

CREATE POLICY "Office admins podem ver seu próprio escritório" 
ON public.offices 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.office_users 
  WHERE office_users.office_id = offices.id 
  AND office_users.user_id = auth.uid() 
  AND office_users.role IN ('admin', 'super_admin')
));

CREATE POLICY "Super admins podem criar escritórios" 
ON public.offices 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

CREATE POLICY "Super admins podem atualizar escritórios" 
ON public.offices 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

-- Políticas RLS para subscriptions
CREATE POLICY "Super admins podem ver todas as assinaturas" 
ON public.subscriptions 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

CREATE POLICY "Office admins podem ver assinaturas do seu escritório" 
ON public.subscriptions 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.office_users 
  WHERE office_users.office_id = subscriptions.office_id 
  AND office_users.user_id = auth.uid() 
  AND office_users.role IN ('admin', 'super_admin')
));

CREATE POLICY "Super admins podem gerenciar assinaturas" 
ON public.subscriptions 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

-- Políticas RLS para office_users
CREATE POLICY "Usuários podem ver membros do seu escritório" 
ON public.office_users 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.office_users ou 
  WHERE ou.office_id = office_users.office_id 
  AND ou.user_id = auth.uid()
) OR EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

CREATE POLICY "Office admins podem gerenciar usuários do escritório" 
ON public.office_users 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.office_users existing_user
  WHERE existing_user.office_id = office_users.office_id 
  AND existing_user.user_id = auth.uid() 
  AND existing_user.role IN ('admin', 'super_admin')
) OR EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

-- Políticas RLS para invitations
CREATE POLICY "Office admins podem ver convites do escritório" 
ON public.invitations 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.office_users 
  WHERE office_users.office_id = invitations.office_id 
  AND office_users.user_id = auth.uid() 
  AND office_users.role IN ('admin', 'super_admin')
) OR EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

CREATE POLICY "Office admins podem criar convites" 
ON public.invitations 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.office_users 
  WHERE office_users.office_id = invitations.office_id 
  AND office_users.user_id = auth.uid() 
  AND office_users.role IN ('admin', 'super_admin')
) OR EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

CREATE POLICY "Office admins podem atualizar convites do escritório" 
ON public.invitations 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.office_users 
  WHERE office_users.office_id = invitations.office_id 
  AND office_users.user_id = auth.uid() 
  AND office_users.role IN ('admin', 'super_admin')
) OR EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));
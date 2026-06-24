-- Criar enum para tipos de planos de assinatura
CREATE TYPE subscription_plan AS ENUM ('free', 'basic', 'professional', 'enterprise');

-- Criar enum para status de assinatura
CREATE TYPE subscription_status AS ENUM ('active', 'inactive', 'suspended', 'cancelled');

-- Criar enum para status de convites
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'expired');

-- Tabela de escritórios/organizações
CREATE TABLE public.offices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  logo_url TEXT,
  plan subscription_plan NOT NULL DEFAULT 'free',
  max_users INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  active BOOLEAN NOT NULL DEFAULT true
);

-- Tabela de assinaturas
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  plan subscription_plan NOT NULL,
  status subscription_status NOT NULL DEFAULT 'active',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  price NUMERIC(10,2),
  billing_cycle TEXT DEFAULT 'monthly',
  stripe_subscription_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de relação usuário-escritório com roles específicos
CREATE TABLE public.office_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  invited_by UUID REFERENCES auth.users(id),
  active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(office_id, user_id)
);

-- Tabela de convites
CREATE TABLE public.invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  status invitation_status NOT NULL DEFAULT 'pending',
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar office_id à tabela profiles existente
ALTER TABLE public.profiles 
ADD COLUMN office_id UUID REFERENCES public.offices(id);

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
  SELECT 1 FROM public.office_users 
  WHERE office_users.office_id = office_users.office_id 
  AND office_users.user_id = auth.uid() 
  AND office_users.role IN ('admin', 'super_admin')
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

-- Triggers para updated_at
CREATE TRIGGER update_offices_updated_at
BEFORE UPDATE ON public.offices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_offices_created_by ON public.offices(created_by);
CREATE INDEX idx_subscriptions_office_id ON public.subscriptions(office_id);
CREATE INDEX idx_office_users_office_id ON public.office_users(office_id);
CREATE INDEX idx_office_users_user_id ON public.office_users(user_id);
CREATE INDEX idx_invitations_office_id ON public.invitations(office_id);
CREATE INDEX idx_invitations_email ON public.invitations(email);
CREATE INDEX idx_invitations_token ON public.invitations(token);
CREATE INDEX idx_profiles_office_id ON public.profiles(office_id);
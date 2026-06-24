
-- Primeiro, vamos inserir um escritório principal se não existir
INSERT INTO public.offices (name, email, phone, address, plan, max_users, created_by)
SELECT 
  'VextriaHub - Escritório Principal',
  'contato@vextriahub.com.br',
  '(11) 99999-9999',
  'São Paulo, SP',
  'professional'::subscription_plan,
  50,
  (SELECT id FROM auth.users WHERE email = 'contato@vextriahub.com.br' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.offices LIMIT 1);

-- Associar o super admin ao escritório principal
INSERT INTO public.office_users (office_id, user_id, role, invited_by)
SELECT 
  o.id,
  p.user_id,
  'super_admin'::app_role,
  p.user_id
FROM public.offices o
CROSS JOIN public.profiles p
WHERE p.role = 'super_admin'::app_role
AND NOT EXISTS (
  SELECT 1 FROM public.office_users ou 
  WHERE ou.office_id = o.id AND ou.user_id = p.user_id
);

-- Atualizar o office_id no perfil do super admin
UPDATE public.profiles 
SET office_id = (SELECT id FROM public.offices LIMIT 1)
WHERE role = 'super_admin'::app_role AND office_id IS NULL;

-- Criar uma assinatura ativa para o escritório principal
INSERT INTO public.subscriptions (office_id, plan, status, start_date, price)
SELECT 
  o.id,
  'professional'::subscription_plan,
  'active'::subscription_status,
  CURRENT_DATE,
  99.90
FROM public.offices o
WHERE NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE office_id = o.id);

-- Corrigir funções com search_path adequado
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.email,
    CASE 
      WHEN NEW.email = 'contato@vextriahub.com.br' THEN 'super_admin'::app_role
      ELSE 'user'::app_role
    END
  );
  RETURN NEW;
END;
$$;

-- Atualizar função de timestamp com search_path correto
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Adicionar alguns dados de exemplo para demonstração
-- Clientes de exemplo
INSERT INTO public.clientes (user_id, nome, email, telefone, cpf_cnpj, tipo_pessoa, endereco, origem, status)
SELECT 
  p.user_id,
  'João Silva Santos',
  'joao.silva@email.com',
  '(11) 99999-1234',
  '123.456.789-00',
  'fisica',
  'Rua das Flores, 123 - São Paulo, SP',
  'Indicação',
  'ativo'
FROM public.profiles p
WHERE p.role = 'super_admin'::app_role
AND NOT EXISTS (SELECT 1 FROM public.clientes WHERE nome = 'João Silva Santos');

INSERT INTO public.clientes (user_id, nome, email, telefone, cpf_cnpj, tipo_pessoa, endereco, origem, status)
SELECT 
  p.user_id,
  'Maria Oliveira Ltda',
  'contato@mariaoliveira.com.br',
  '(11) 88888-5678',
  '12.345.678/0001-90',
  'juridica',
  'Av. Paulista, 1000 - São Paulo, SP',
  'Site',
  'ativo'
FROM public.profiles p
WHERE p.role = 'super_admin'::app_role
AND NOT EXISTS (SELECT 1 FROM public.clientes WHERE nome = 'Maria Oliveira Ltda');

-- Processos de exemplo
INSERT INTO public.processos (user_id, numero_processo, titulo, cliente_id, status, tipo_processo, valor_causa, tribunal, comarca, vara)
SELECT 
  p.user_id,
  '0001234-56.2025.8.26.0100',
  'Ação de Cobrança - João Silva Santos',
  c.id,
  'ativo',
  'Cível',
  50000.00,
  'TJSP',
  'São Paulo',
  '1ª Vara Cível'
FROM public.profiles p
CROSS JOIN public.clientes c
WHERE p.role = 'super_admin'::app_role
AND c.nome = 'João Silva Santos'
AND NOT EXISTS (SELECT 1 FROM public.processos WHERE numero_processo = '0001234-56.2025.8.26.0100');

-- Tarefas de exemplo
INSERT INTO public.tarefas (user_id, titulo, descricao, status, prioridade, data_vencimento, cliente_id)
SELECT 
  p.user_id,
  'Elaborar petição inicial',
  'Preparar petição inicial para ação de cobrança',
  'pendente',
  'alta',
  CURRENT_DATE + INTERVAL '3 days',
  c.id
FROM public.profiles p
CROSS JOIN public.clientes c
WHERE p.role = 'super_admin'::app_role
AND c.nome = 'João Silva Santos'
AND NOT EXISTS (SELECT 1 FROM public.tarefas WHERE titulo = 'Elaborar petição inicial');

-- Prazos de exemplo
INSERT INTO public.prazos (user_id, titulo, descricao, data_vencimento, prioridade, status)
SELECT 
  p.user_id,
  'Prazo para contestação',
  'Prazo de 15 dias para apresentar contestação',
  CURRENT_DATE + INTERVAL '10 days',
  'alta',
  'pendente'
FROM public.profiles p
WHERE p.role = 'super_admin'::app_role
AND NOT EXISTS (SELECT 1 FROM public.prazos WHERE titulo = 'Prazo para contestação');

-- Audiências de exemplo
INSERT INTO public.audiencias (user_id, titulo, data_audiencia, tipo, local, status, cliente_id)
SELECT 
  p.user_id,
  'Audiência de Conciliação',
  CURRENT_DATE + INTERVAL '20 days' + TIME '14:00',
  'Conciliação',
  'Fórum Central - Sala 15',
  'agendada',
  c.id
FROM public.profiles p
CROSS JOIN public.clientes c
WHERE p.role = 'super_admin'::app_role
AND c.nome = 'João Silva Santos'
AND NOT EXISTS (SELECT 1 FROM public.audiencias WHERE titulo = 'Audiência de Conciliação');

-- Dados financeiros de exemplo
INSERT INTO public.financeiro (user_id, descricao, tipo, valor, data_vencimento, categoria, status, cliente_id)
SELECT 
  p.user_id,
  'Honorários advocatícios - João Silva',
  'receita',
  2500.00,
  CURRENT_DATE + INTERVAL '30 days',
  'Honorários',
  'pendente',
  c.id
FROM public.profiles p
CROSS JOIN public.clientes c
WHERE p.role = 'super_admin'::app_role
AND c.nome = 'João Silva Santos'
AND NOT EXISTS (SELECT 1 FROM public.financeiro WHERE descricao = 'Honorários advocatícios - João Silva');

-- Metas de exemplo
INSERT INTO public.metas (user_id, titulo, tipo, periodo, data_inicio, data_fim, valor_meta, valor_atual, status)
SELECT 
  p.user_id,
  'Meta de Receita Mensal',
  'receita',
  'mensal',
  DATE_TRUNC('month', CURRENT_DATE),
  DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day',
  15000.00,
  2500.00,
  'ativa'
FROM public.profiles p
WHERE p.role = 'super_admin'::app_role
AND NOT EXISTS (SELECT 1 FROM public.metas WHERE titulo = 'Meta de Receita Mensal');

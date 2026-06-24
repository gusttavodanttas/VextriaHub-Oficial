
-- VextriaHub: Migration de Hardening de Segurança (Versão Corrigida)
-- Este script habilita RLS, isolamento por office_id e remove vulnerabilidades de acesso.

BEGIN;

-- 1. Garantir que as tabelas "órfãs" existam antes de aplicar RLS
-- (Algumas tabelas estão no código mas podem não ter sido criadas no DB)

CREATE TABLE IF NOT EXISTS public.timesheets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  processo_id UUID REFERENCES public.processos(id) ON DELETE SET NULL,
  tarefa_descricao TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Geral',
  data_inicio TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_fim TIMESTAMP WITH TIME ZONE,
  duracao_minutos INTEGER,
  status TEXT DEFAULT 'ativo',
  observacoes TEXT,
  deletado BOOLEAN DEFAULT false,
  deletado_pendente BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.plan_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_name TEXT NOT NULL,
  plan_type TEXT NOT NULL, -- 'mensal', 'anual'
  price_cents INTEGER NOT NULL,
  features JSONB,
  trial_days INTEGER DEFAULT 7,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Garantir que a coluna office_id existe nas tabelas principais
DO $$ 
DECLARE
  t text;
  tables_to_check text[] := ARRAY['atendimentos', 'audiencias', 'clientes', 'financeiro', 'metas', 'prazos', 'processos', 'tarefas', 'timesheets', 'notifications'];
BEGIN
  FOREACH t IN ARRAY tables_to_check LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'office_id') THEN
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE', t);
      END IF;
    END IF;
  END LOOP;
END $$;

-- 3. Habilitar RLS em massa
ALTER TABLE public.atendimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audiencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prazos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exclusoes_pendentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_configs ENABLE ROW LEVEL SECURITY;

-- 4. Função Helper para verificar vínculo de usuário com escritório
CREATE OR REPLACE FUNCTION public.user_belongs_to_office(target_office_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.office_users 
    WHERE user_id = auth.uid() 
    AND office_id = target_office_id 
    AND active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Aplicar Políticas de Isolamento (Multi-tenant por office_id)
-- Nota: Super Admins ignoram RLS por padrão no Postgres se forem donos da tabela,
-- mas aqui definimos acesso explícito para garantir.

DO $$ 
DECLARE
  t text;
  tables_to_protect text[] := ARRAY['atendimentos', 'audiencias', 'clientes', 'financeiro', 'metas', 'prazos', 'processos', 'tarefas', 'timesheets', 'notifications'];
BEGIN
  FOREACH t IN ARRAY tables_to_protect LOOP
    -- Dropar políticas antigas se existirem para evitar conflitos
    EXECUTE format('DROP POLICY IF EXISTS "Isolamento por escritório" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admin do escritório gerencia tudo" ON public.%I', t);
    
    -- Política de Seleção/Acesso: Membros do mesmo escritório vêem os dados
    EXECUTE format('CREATE POLICY "Isolamento por escritório" ON public.%I FOR ALL USING (public.user_belongs_to_office(office_id))', t);
    
    -- Política para Super Admin do Sistema
    EXECUTE format('CREATE POLICY "SuperAdmin acesso total" ON public.%I FOR ALL TO authenticated USING (
      EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = ''super_admin'')
    )', t);
  END LOOP;
END $$;

-- 6. Políticas específicas para tabelas auxiliares
DROP POLICY IF EXISTS "Leitura pública plan_configs" ON public.plan_configs;
CREATE POLICY "Leitura pública plan_configs" ON public.plan_configs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins gerenciam exclusoes" ON public.exclusoes_pendentes;
CREATE POLICY "Admins gerenciam exclusoes" ON public.exclusoes_pendentes FOR ALL USING (
  public.user_belongs_to_office((dados_registro->>'office_id')::uuid)
);

COMMIT;

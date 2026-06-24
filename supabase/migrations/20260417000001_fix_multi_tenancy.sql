
-- Migração: Adicionar office_id às tabelas core e corrigir RLS para multi-tenancy

-- 1. Adicionar coluna office_id às tabelas que faltam
DO $$ 
BEGIN 
    -- Tabela: clientes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clientes' AND column_name='office_id') THEN
        ALTER TABLE public.clientes ADD COLUMN office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE;
    END IF;

    -- Tabela: processos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='processos' AND column_name='office_id') THEN
        ALTER TABLE public.processos ADD COLUMN office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE;
    END IF;

    -- Tabela: audiencias
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audiencias' AND column_name='office_id') THEN
        ALTER TABLE public.audiencias ADD COLUMN office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE;
    END IF;

    -- Tabela: prazos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='prazos' AND column_name='office_id') THEN
        ALTER TABLE public.prazos ADD COLUMN office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE;
    END IF;

    -- Tabela: tarefas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tarefas' AND column_name='office_id') THEN
        ALTER TABLE public.tarefas ADD COLUMN office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE;
    END IF;

    -- Tabela: atendimentos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='atendimentos' AND column_name='office_id') THEN
        ALTER TABLE public.atendimentos ADD COLUMN office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE;
    END IF;

    -- Tabela: metas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='metas' AND column_name='office_id') THEN
        ALTER TABLE public.metas ADD COLUMN office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE;
    END IF;

    -- Tabela: financeiro
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='financeiro' AND column_name='office_id') THEN
        ALTER TABLE public.financeiro ADD COLUMN office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 2. Atualizar RLS para usar office_id
-- Removemos as políticas antigas baseadas apenas em user_id (opcional, mas recomendado para clareza)
DROP POLICY IF EXISTS "Usuários podem ver seus próprios clientes" ON public.clientes;
DROP POLICY IF EXISTS "Usuários podem ver seus próprios processos" ON public.processos;
DROP POLICY IF EXISTS "Usuários podem ver suas próprias audiências" ON public.audiencias;
DROP POLICY IF EXISTS "Usuários podem ver seus próprios prazos" ON public.prazos;

-- Novas políticas baseadas em office_id
-- SELECT: Ver dados do escritório se for membro ativo
CREATE POLICY "Membros do escritório podem ver clientes" ON public.clientes
    FOR SELECT USING (EXISTS (SELECT 1 FROM office_users WHERE office_id = public.clientes.office_id AND user_id = auth.uid() AND active = true));

CREATE POLICY "Membros do escritório podem ver processos" ON public.processos
    FOR SELECT USING (EXISTS (SELECT 1 FROM office_users WHERE office_id = public.processos.office_id AND user_id = auth.uid() AND active = true));

CREATE POLICY "Membros do escritório podem ver audiencias" ON public.audiencias
    FOR SELECT USING (EXISTS (SELECT 1 FROM office_users WHERE office_id = public.audiencias.office_id AND user_id = auth.uid() AND active = true));

CREATE POLICY "Membros do escritório podem ver prazos" ON public.prazos
    FOR SELECT USING (EXISTS (SELECT 1 FROM office_users WHERE office_id = public.prazos.office_id AND user_id = auth.uid() AND active = true));

-- INSERT: Garantir que o office_id inserido é o do usuário
CREATE POLICY "Membros do escritório podem inserir clientes" ON public.clientes
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM office_users WHERE office_id = public.clientes.office_id AND user_id = auth.uid() AND active = true));

-- Repetir para as outras tabelas conforme necessário...
-- Nota: Para um MVP, podemos simplificar os UPDATE/DELETE também.

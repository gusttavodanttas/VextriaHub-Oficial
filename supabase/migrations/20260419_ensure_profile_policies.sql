-- VextriaHub: Garantir Políticas de RLS para a tabela Profiles
-- Este script assegura que usuários autenticados possam ler e atualizar seus próprios dados de perfil.

BEGIN;

-- 1. Habilitar RLS se não estiver habilitado
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Política de Leitura (SELECT): Usuário vê seu próprio perfil
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON public.profiles;
CREATE POLICY "Usuários podem ver seu próprio perfil" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- 3. Política de Atualização (UPDATE): Usuário atualiza seu próprio perfil
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON public.profiles;
CREATE POLICY "Usuários podem atualizar seu próprio perfil" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. Política de Inserção (INSERT): Usuário pode criar seu perfil inicial
-- (Caso o gatilho falhe ou precise de criação via código)
DROP POLICY IF EXISTS "Usuários podem criar seu próprio perfil" ON public.profiles;
CREATE POLICY "Usuários podem criar seu próprio perfil" 
ON public.profiles 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- 5. Política para Super Admin (Acesso total via profiles)
DROP POLICY IF EXISTS "SuperAdmin total access profiles" ON public.profiles;
CREATE POLICY "SuperAdmin total access profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'super_admin'
);

COMMIT;

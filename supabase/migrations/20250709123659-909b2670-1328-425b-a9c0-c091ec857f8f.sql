-- Criação das tabelas principais do sistema jurídico com controle de usuário e exclusão pendente

-- Tabela de clientes
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  cpf_cnpj TEXT,
  tipo_pessoa TEXT CHECK (tipo_pessoa IN ('fisica', 'juridica')) DEFAULT 'fisica',
  endereco TEXT,
  origem TEXT,
  data_aniversario DATE,
  status TEXT DEFAULT 'ativo',
  deletado BOOLEAN NOT NULL DEFAULT false,
  deletado_pendente BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de processos
CREATE TABLE public.processos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  numero_processo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  status TEXT DEFAULT 'ativo',
  tipo_processo TEXT,
  tribunal TEXT,
  comarca TEXT,
  sistema_tribunal TEXT,
  vara TEXT,
  valor_causa DECIMAL(15,2),
  data_inicio DATE DEFAULT CURRENT_DATE,
  data_ultima_atualizacao DATE DEFAULT CURRENT_DATE,
  proximo_prazo DATE,
  etiquetas TEXT[],
  observacoes TEXT,
  deletado BOOLEAN NOT NULL DEFAULT false,
  deletado_pendente BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de audiências
CREATE TABLE public.audiencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  processo_id UUID REFERENCES public.processos(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  tipo TEXT,
  data_audiencia TIMESTAMP WITH TIME ZONE NOT NULL,
  local TEXT,
  observacoes TEXT,
  status TEXT DEFAULT 'agendada',
  deletado BOOLEAN NOT NULL DEFAULT false,
  deletado_pendente BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de prazos
CREATE TABLE public.prazos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  processo_id UUID REFERENCES public.processos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_vencimento DATE NOT NULL,
  prioridade TEXT CHECK (prioridade IN ('baixa', 'media', 'alta')) DEFAULT 'media',
  status TEXT DEFAULT 'pendente',
  deletado BOOLEAN NOT NULL DEFAULT false,
  deletado_pendente BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de tarefas
CREATE TABLE public.tarefas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  processo_id UUID REFERENCES public.processos(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  prioridade TEXT CHECK (prioridade IN ('baixa', 'media', 'alta')) DEFAULT 'media',
  status TEXT DEFAULT 'pendente',
  data_vencimento DATE,
  concluida BOOLEAN DEFAULT false,
  deletado BOOLEAN NOT NULL DEFAULT false,
  deletado_pendente BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de atendimentos
CREATE TABLE public.atendimentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo_atendimento TEXT NOT NULL,
  data_atendimento TIMESTAMP WITH TIME ZONE NOT NULL,
  duracao INTEGER, -- em minutos
  observacoes TEXT,
  status TEXT DEFAULT 'agendado',
  deletado BOOLEAN NOT NULL DEFAULT false,
  deletado_pendente BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de metas
CREATE TABLE public.metas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL, -- 'processos', 'clientes', 'receita', etc.
  valor_meta DECIMAL(15,2),
  valor_atual DECIMAL(15,2) DEFAULT 0,
  periodo TEXT NOT NULL, -- 'mensal', 'trimestral', 'anual'
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  status TEXT DEFAULT 'ativa',
  deletado BOOLEAN NOT NULL DEFAULT false,
  deletado_pendente BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de dados financeiros
CREATE TABLE public.financeiro (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  processo_id UUID REFERENCES public.processos(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  tipo TEXT CHECK (tipo IN ('receita', 'despesa')) NOT NULL,
  descricao TEXT NOT NULL,
  valor DECIMAL(15,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status TEXT DEFAULT 'pendente',
  categoria TEXT,
  deletado BOOLEAN NOT NULL DEFAULT false,
  deletado_pendente BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para gerenciar exclusões pendentes (para o painel do administrador)
CREATE TABLE public.exclusoes_pendentes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tabela TEXT NOT NULL,
  registro_id UUID NOT NULL,
  dados_registro JSONB NOT NULL,
  motivo TEXT,
  solicitado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  aprovado_por UUID REFERENCES auth.users(id),
  aprovado_em TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado'))
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audiencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prazos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atendimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exclusoes_pendentes ENABLE ROW LEVEL SECURITY;

-- Políticas para clientes
CREATE POLICY "Usuários podem ver seus próprios clientes" 
ON public.clientes FOR SELECT 
USING (auth.uid() = user_id AND deletado = false);

CREATE POLICY "Usuários podem criar seus próprios clientes" 
ON public.clientes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios clientes" 
ON public.clientes FOR UPDATE 
USING (auth.uid() = user_id);

-- Políticas para processos
CREATE POLICY "Usuários podem ver seus próprios processos" 
ON public.processos FOR SELECT 
USING (auth.uid() = user_id AND deletado = false);

CREATE POLICY "Usuários podem criar seus próprios processos" 
ON public.processos FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios processos" 
ON public.processos FOR UPDATE 
USING (auth.uid() = user_id);

-- Políticas para audiências
CREATE POLICY "Usuários podem ver suas próprias audiências" 
ON public.audiencias FOR SELECT 
USING (auth.uid() = user_id AND deletado = false);

CREATE POLICY "Usuários podem criar suas próprias audiências" 
ON public.audiencias FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias audiências" 
ON public.audiencias FOR UPDATE 
USING (auth.uid() = user_id);

-- Políticas para prazos
CREATE POLICY "Usuários podem ver seus próprios prazos" 
ON public.prazos FOR SELECT 
USING (auth.uid() = user_id AND deletado = false);

CREATE POLICY "Usuários podem criar seus próprios prazos" 
ON public.prazos FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios prazos" 
ON public.prazos FOR UPDATE 
USING (auth.uid() = user_id);

-- Políticas para tarefas
CREATE POLICY "Usuários podem ver suas próprias tarefas" 
ON public.tarefas FOR SELECT 
USING (auth.uid() = user_id AND deletado = false);

CREATE POLICY "Usuários podem criar suas próprias tarefas" 
ON public.tarefas FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias tarefas" 
ON public.tarefas FOR UPDATE 
USING (auth.uid() = user_id);

-- Políticas para atendimentos
CREATE POLICY "Usuários podem ver seus próprios atendimentos" 
ON public.atendimentos FOR SELECT 
USING (auth.uid() = user_id AND deletado = false);

CREATE POLICY "Usuários podem criar seus próprios atendimentos" 
ON public.atendimentos FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios atendimentos" 
ON public.atendimentos FOR UPDATE 
USING (auth.uid() = user_id);

-- Políticas para metas
CREATE POLICY "Usuários podem ver suas próprias metas" 
ON public.metas FOR SELECT 
USING (auth.uid() = user_id AND deletado = false);

CREATE POLICY "Usuários podem criar suas próprias metas" 
ON public.metas FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias metas" 
ON public.metas FOR UPDATE 
USING (auth.uid() = user_id);

-- Políticas para financeiro
CREATE POLICY "Usuários podem ver seus próprios dados financeiros" 
ON public.financeiro FOR SELECT 
USING (auth.uid() = user_id AND deletado = false);

CREATE POLICY "Usuários podem criar seus próprios dados financeiros" 
ON public.financeiro FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios dados financeiros" 
ON public.financeiro FOR UPDATE 
USING (auth.uid() = user_id);

-- Políticas para exclusões pendentes
CREATE POLICY "Usuários podem ver suas próprias solicitações de exclusão" 
ON public.exclusoes_pendentes FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar solicitações de exclusão" 
ON public.exclusoes_pendentes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Super admins podem ver todas as exclusões pendentes" 
ON public.exclusoes_pendentes FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'super_admin'
  )
);

CREATE POLICY "Super admins podem atualizar exclusões pendentes" 
ON public.exclusoes_pendentes FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'super_admin'
  )
);

-- Criar triggers para atualizar timestamps
CREATE TRIGGER update_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_processos_updated_at
  BEFORE UPDATE ON public.processos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_audiencias_updated_at
  BEFORE UPDATE ON public.audiencias
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_prazos_updated_at
  BEFORE UPDATE ON public.prazos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tarefas_updated_at
  BEFORE UPDATE ON public.tarefas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_atendimentos_updated_at
  BEFORE UPDATE ON public.atendimentos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_metas_updated_at
  BEFORE UPDATE ON public.metas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_financeiro_updated_at
  BEFORE UPDATE ON public.financeiro
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para melhor performance
CREATE INDEX idx_clientes_user_id ON public.clientes(user_id);
CREATE INDEX idx_clientes_deletado ON public.clientes(deletado);
CREATE INDEX idx_processos_user_id ON public.processos(user_id);
CREATE INDEX idx_processos_deletado ON public.processos(deletado);
CREATE INDEX idx_audiencias_user_id ON public.audiencias(user_id);
CREATE INDEX idx_audiencias_deletado ON public.audiencias(deletado);
CREATE INDEX idx_prazos_user_id ON public.prazos(user_id);
CREATE INDEX idx_prazos_deletado ON public.prazos(deletado);
CREATE INDEX idx_tarefas_user_id ON public.tarefas(user_id);
CREATE INDEX idx_tarefas_deletado ON public.tarefas(deletado);
CREATE INDEX idx_atendimentos_user_id ON public.atendimentos(user_id);
CREATE INDEX idx_atendimentos_deletado ON public.atendimentos(deletado);
CREATE INDEX idx_metas_user_id ON public.metas(user_id);
CREATE INDEX idx_metas_deletado ON public.metas(deletado);
CREATE INDEX idx_financeiro_user_id ON public.financeiro(user_id);
CREATE INDEX idx_financeiro_deletado ON public.financeiro(deletado);
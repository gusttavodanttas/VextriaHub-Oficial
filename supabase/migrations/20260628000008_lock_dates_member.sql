-- Migration: Membro não pode alterar datas de itens atribuídos sem o coordenador
-- Versão: 20260628000008
--
-- Apenas admin do escritório ou o coordenador da equipe do responsável pode
-- alterar as datas de tarefas, prazos e audiências. O próprio membro (responsável)
-- não pode mover a data sem essa autorização. Operações de sistema (auth.uid()
-- nulo, ex.: service role) não são bloqueadas.

BEGIN;

-- Pode gerenciar (mexer em datas) os itens de um determinado membro?
CREATE OR REPLACE FUNCTION public.can_manage_member(p_office_id uuid, p_member uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT public.is_office_admin(p_office_id)
    OR EXISTS (
      SELECT 1
      FROM public.office_team_members coord
      JOIN public.office_team_members tgt ON tgt.team_id = coord.team_id
      WHERE coord.user_id = auth.uid()
        AND coord.role = 'coordinator'
        AND coord.office_id = p_office_id
        AND tgt.user_id = p_member
    );
$$;

-- TAREFAS
CREATE OR REPLACE FUNCTION public.lock_tarefa_date()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.data_vencimento IS DISTINCT FROM OLD.data_vencimento THEN
    IF NOT public.can_manage_member(NEW.office_id, COALESCE(NEW.responsavel_id, NEW.user_id)) THEN
      RAISE EXCEPTION 'Apenas o coordenador da equipe ou um administrador pode alterar a data desta tarefa.';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_lock_tarefa_date ON public.tarefas;
CREATE TRIGGER trg_lock_tarefa_date BEFORE UPDATE ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.lock_tarefa_date();

-- PRAZOS (várias datas)
CREATE OR REPLACE FUNCTION public.lock_prazo_date()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND (
       NEW.data_fim_prazo IS DISTINCT FROM OLD.data_fim_prazo
    OR NEW.data_intimacao IS DISTINCT FROM OLD.data_intimacao
    OR NEW.data_disponibilizacao IS DISTINCT FROM OLD.data_disponibilizacao
  ) THEN
    IF NOT public.can_manage_member(NEW.office_id, NEW.responsavel_id) THEN
      RAISE EXCEPTION 'Apenas o coordenador da equipe ou um administrador pode alterar a data deste prazo.';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_lock_prazo_date ON public.prazos;
CREATE TRIGGER trg_lock_prazo_date BEFORE UPDATE ON public.prazos
  FOR EACH ROW EXECUTE FUNCTION public.lock_prazo_date();

-- AUDIÊNCIAS
CREATE OR REPLACE FUNCTION public.lock_audiencia_date()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.data_audiencia IS DISTINCT FROM OLD.data_audiencia THEN
    IF NOT public.can_manage_member(NEW.office_id, COALESCE(NEW.responsavel_id, NEW.user_id)) THEN
      RAISE EXCEPTION 'Apenas o coordenador da equipe ou um administrador pode alterar a data desta audiência.';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_lock_audiencia_date ON public.audiencias;
CREATE TRIGGER trg_lock_audiencia_date BEFORE UPDATE ON public.audiencias
  FOR EACH ROW EXECUTE FUNCTION public.lock_audiencia_date();

COMMIT;

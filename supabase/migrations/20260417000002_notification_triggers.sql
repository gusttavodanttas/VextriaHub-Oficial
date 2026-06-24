
-- Trigger para criar notificação quando um novo prazo é inserido
CREATE OR REPLACE FUNCTION public.notify_new_prazo()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.notifications (user_id, office_id, type, title, message, action_url, action_label)
    VALUES (
        NEW.user_id,
        NEW.office_id,
        'warning',
        'Novo Prazo Cadastrado',
        'Um novo prazo "' || NEW.titulo || '" foi cadastrado para o dia ' || to_char(NEW.data_vencimento, 'DD/MM/YYYY') || '.',
        '/agenda',
        'Ver Agenda'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_new_prazo
AFTER INSERT ON public.prazos
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_prazo();

-- Trigger para notificações de Audiências
CREATE OR REPLACE FUNCTION public.notify_new_audiencia()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.notifications (user_id, office_id, type, title, message, action_url, action_label)
    VALUES (
        NEW.user_id,
        NEW.office_id,
        'info',
        'Nova Audiência Agendada',
        'Audiência "' || NEW.titulo || '" marcada para ' || to_char(NEW.data_audiencia AT TIME ZONE 'UTC', 'DD/MM/YYYY HH24:MI') || '.',
        '/agenda',
        'Ver Agenda'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_new_audiencia
AFTER INSERT ON public.audiencias
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_audiencia();

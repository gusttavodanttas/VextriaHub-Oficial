-- Normaliza o gênero dos status acumulados por telas antigas.
-- Padrão do sistema (ver src/lib/status.ts):
--   audiencias   → feminino  (agendada, confirmada, pendente, realizada, cancelada)
--   atendimentos → masculino (agendado, realizado, cancelado, pendente)
-- Idempotente: reexecutar não altera nada.

update public.audiencias set status = 'agendada'   where status = 'agendado';
update public.audiencias set status = 'confirmada' where status = 'confirmado';
update public.audiencias set status = 'realizada'  where status = 'realizado';
update public.audiencias set status = 'cancelada'  where status = 'cancelado';

update public.atendimentos set status = 'agendado'  where status = 'agendada';
update public.atendimentos set status = 'realizado' where status = 'realizada';
update public.atendimentos set status = 'cancelado' where status = 'cancelada';
update public.atendimentos set status = 'agendado'  where status in ('confirmado', 'confirmada');

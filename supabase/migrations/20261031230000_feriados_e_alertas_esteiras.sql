-- ============================================================================
-- FERIADOS (fonte única) + ALERTAS DIÁRIOS DAS ESTEIRAS
-- ============================================================================
-- feriados          : calendário usado pelo VextriaHub e pelo painel da
--                     Controladoria (antes a lista vivia só no HTML do painel).
--                     Carga inicial = calendário do TJDFT 2026–2027 (nacionais,
--                     DF e forenses). Leitura por qualquer usuário logado;
--                     escrita só super admin.
-- esteira_eh_dia_util / esteira_somar_dias_uteis : passam a pular feriados.
-- esteira_alertas   : controle de envio (um alerta por card/tipo/chave).
-- esteira_gerar_alertas() : roda todo dia útil de manhã (pg_cron) e notifica o
--                     responsável do card (sino do VextriaHub, com link):
--                       * prazo do card vencido ou vencendo em até 2 dias úteis
--                         (um aviso por dia);
--                       * card parado além do prazo interno da fase
--                         (um aviso por passagem na fase).
-- ============================================================================

begin;

create table if not exists public.feriados (
  data        date not null,
  nome        text not null,
  abrangencia text not null default 'TJDFT',
  primary key (data, abrangencia)
);
comment on table public.feriados is 'Feriados e dias sem expediente forense. Fonte única para VextriaHub (esteiras) e painel da Controladoria.';

alter table public.feriados enable row level security;
drop policy if exists feriados_select on public.feriados;
create policy feriados_select on public.feriados for select to authenticated using (true);
drop policy if exists feriados_write_super on public.feriados;
create policy feriados_write_super on public.feriados for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
revoke all on public.feriados from anon;

insert into public.feriados (data, nome) values
  ('2026-01-01','Confraternização Universal'), ('2026-02-16','Carnaval'), ('2026-02-17','Carnaval'),
  ('2026-04-03','Sexta-feira Santa'), ('2026-04-21','Tiradentes / Aniversário de Brasília'),
  ('2026-05-01','Dia do Trabalho'), ('2026-06-04','Corpus Christi'), ('2026-09-07','Independência'),
  ('2026-10-12','Nossa Senhora Aparecida'), ('2026-10-28','Dia do Servidor Público'),
  ('2026-11-02','Finados'), ('2026-11-15','Proclamação da República'), ('2026-11-20','Consciência Negra'),
  ('2026-11-30','Dia do Evangélico (DF)'), ('2026-12-08','Dia da Justiça'),
  ('2026-12-24','Véspera de Natal'), ('2026-12-25','Natal'), ('2026-12-31','Véspera de Ano Novo'),
  ('2027-01-01','Confraternização Universal'), ('2027-02-08','Carnaval'), ('2027-02-09','Carnaval'),
  ('2027-03-26','Sexta-feira Santa'), ('2027-04-21','Tiradentes / Aniversário de Brasília'),
  ('2027-05-01','Dia do Trabalho'), ('2027-05-27','Corpus Christi'), ('2027-09-07','Independência'),
  ('2027-10-12','Nossa Senhora Aparecida'), ('2027-10-28','Dia do Servidor Público'),
  ('2027-11-02','Finados'), ('2027-11-15','Proclamação da República'), ('2027-11-20','Consciência Negra'),
  ('2027-11-30','Dia do Evangélico (DF)'), ('2027-12-08','Dia da Justiça'),
  ('2027-12-24','Véspera de Natal'), ('2027-12-25','Natal'), ('2027-12-31','Véspera de Ano Novo')
on conflict do nothing;

-- ── Dias úteis com feriados ────────────────────────────────────────────────
create or replace function public.esteira_eh_dia_util(p_dia date)
returns boolean
language sql
stable
set search_path = public
as $$
  select extract(isodow from p_dia) < 6
     and not exists (select 1 from public.feriados f where f.data = p_dia);
$$;

create or replace function public.esteira_somar_dias_uteis(p_inicio date, p_dias integer)
returns date
language plpgsql
stable
set search_path = public
as $$
declare
  d date := p_inicio;
  n integer := coalesce(p_dias, 0);
begin
  while n > 0 loop
    d := d + 1;
    if public.esteira_eh_dia_util(d) then n := n - 1; end if;
  end loop;
  return d;
end;
$$;

create or replace function public.esteira_dias_uteis_entre(p_inicio date, p_fim date)
returns integer
language sql
stable
set search_path = public
as $$
  select count(*)::int
    from generate_series(p_inicio + 1, p_fim, interval '1 day') g(d)
   where public.esteira_eh_dia_util(g.d::date);
$$;

-- ── Alertas ────────────────────────────────────────────────────────────────
create table if not exists public.esteira_alertas (
  card_id   uuid not null references public.esteira_cards(id) on delete cascade,
  tipo      text not null check (tipo in ('prazo','parado')),
  chave     date not null,
  enviado_em timestamptz not null default now(),
  primary key (card_id, tipo, chave)
);
alter table public.esteira_alertas enable row level security;
-- sem policies: só a função (security definer) e o service role usam
revoke all on public.esteira_alertas from anon, authenticated;

create or replace function public.esteira_gerar_alertas()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r          record;
  v_hoje     date := (now() at time zone 'America/Sao_Paulo')::date;
  v_dest     uuid;
  v_restam   integer;
  v_total    integer := 0;
  v_titulo   text;
  v_msg      text;
begin
  if not public.esteira_eh_dia_util(v_hoje) then
    return 0;
  end if;

  for r in
    select c.id, c.office_id, c.esteira_id, c.titulo, c.prazo, c.responsavel_id, c.created_by,
           c.entrou_fase_em, f.nome as fase_nome, f.sla_dias, e.nome as esteira_nome
      from public.esteira_cards c
      join public.esteira_fases f on f.id = c.fase_id
      join public.esteiras e on e.id = c.esteira_id
     where not c.deletado and not c.arquivado and not e.deletado and not f.finalizacao
  loop
    v_dest := coalesce(r.responsavel_id, r.created_by);
    if v_dest is null or not exists (
      select 1 from public.office_users ou where ou.office_id = r.office_id and ou.user_id = v_dest and ou.active
    ) then
      continue;
    end if;

    -- 1) prazo do card vencido ou em até 2 dias úteis (um aviso por dia)
    if r.prazo is not null then
      v_restam := case when r.prazo < v_hoje then -1
                       else public.esteira_dias_uteis_entre(v_hoje, r.prazo) end;
      if v_restam <= 2 then
        insert into public.esteira_alertas (card_id, tipo, chave) values (r.id, 'prazo', v_hoje)
        on conflict do nothing;
        if found then
          v_titulo := case when r.prazo < v_hoje then 'Prazo vencido: ' || r.titulo
                           when r.prazo = v_hoje then 'Prazo vence hoje: ' || r.titulo
                           else 'Prazo em ' || v_restam || ' dia(s) útil(eis): ' || r.titulo end;
          v_msg := r.esteira_nome || ' · ' || r.fase_nome || ' · prazo ' || to_char(r.prazo, 'DD/MM/YYYY');
          insert into public.notifications (user_id, office_id, title, message, type, read, data)
          values (v_dest, r.office_id, v_titulo, v_msg,
                  case when r.prazo <= v_hoje then 'error' else 'warning' end, false,
                  jsonb_build_object('action_url', '/esteiras?esteira=' || r.esteira_id || '&card=' || r.id,
                                     'action_label', 'Abrir card'));
          v_total := v_total + 1;
        end if;
      end if;
    end if;

    -- 2) parado além do prazo interno da fase (um aviso por passagem na fase)
    if r.sla_dias is not null
       and public.esteira_dias_uteis_entre((r.entrou_fase_em at time zone 'America/Sao_Paulo')::date, v_hoje) > r.sla_dias then
      insert into public.esteira_alertas (card_id, tipo, chave)
      values (r.id, 'parado', (r.entrou_fase_em at time zone 'America/Sao_Paulo')::date)
      on conflict do nothing;
      if found then
        insert into public.notifications (user_id, office_id, title, message, type, read, data)
        values (v_dest, r.office_id, 'Card parado: ' || r.titulo,
                r.esteira_nome || ' · está em "' || r.fase_nome || '" além do prazo interno de ' || r.sla_dias || ' dia(s) útil(eis)',
                'warning', false,
                jsonb_build_object('action_url', '/esteiras?esteira=' || r.esteira_id || '&card=' || r.id,
                                   'action_label', 'Abrir card'));
        v_total := v_total + 1;
      end if;
    end if;
  end loop;

  return v_total;
end;
$$;
revoke execute on function public.esteira_gerar_alertas() from public, anon, authenticated;

-- 07h40 de Brasília (10h40 UTC), todo dia; a função ignora fim de semana e feriado.
select cron.unschedule('esteiras-alertas-diario') where exists (select 1 from cron.job where jobname = 'esteiras-alertas-diario');
select cron.schedule('esteiras-alertas-diario', '40 10 * * *', $$ select public.esteira_gerar_alertas() $$);

commit;

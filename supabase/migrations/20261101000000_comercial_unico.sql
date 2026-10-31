-- ============================================================================
-- COMERCIAL ÚNICO: a esteira "Comercial" do VextriaHub é a única base dos leads.
-- O Comercial do Painel do Escritório (gestão) passa a ler e gravar aqui, e o
-- formulário do site entra aqui. Nada é copiado entre bancos.
-- ============================================================================
-- * esteira_cards.ref_externa: id do lead no painel (os ids do painel não são
--   uuid). Único por escritório.
-- * Fases da esteira Comercial = funil do painel:
--   Novo contato → Triagem → Consulta → Proposta → Fechado | Perdido.
--   "Fechado" cria o card na Ativação do cliente.
-- * comercial_listar(): devolve os leads no formato do painel.
-- * comercial_salvar_lead(): cria/atualiza o card e o cliente (sem duplicar
--   telefone) a partir do formato do painel. Usada pelo painel e pelo site.
-- * comercial_excluir_lead(): manda o card para a Lixeira.
-- * Mudança de fase (em qualquer tela) ajusta o status do cliente:
--   Fechado → ativo; Perdido → inativo (só se ainda era lead).
-- ============================================================================

begin;

alter table public.esteira_cards add column if not exists ref_externa text;
create unique index if not exists esteira_cards_ref_externa_uq on public.esteira_cards(office_id, ref_externa);

-- Esteira Comercial do escritório (a primeira com esse nome)
create or replace function public.comercial_esteira(p_office uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.esteiras
   where office_id = p_office and not deletado and nome = 'Comercial'
   order by ordem, created_at limit 1;
$$;
revoke execute on function public.comercial_esteira(uuid) from public, anon;
grant execute on function public.comercial_esteira(uuid) to authenticated;

-- Escritório de quem chama (primeiro escritório ativo)
create or replace function public.comercial_meu_escritorio()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select office_id from public.office_users where user_id = auth.uid() and active order by joined_at limit 1;
$$;
revoke execute on function public.comercial_meu_escritorio() from public, anon;
grant execute on function public.comercial_meu_escritorio() to authenticated;

-- Fases da Comercial no formato do painel (refaz só se a esteira não tiver cards)
create or replace function public.comercial_preparar_fases(p_office uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e uuid; f_fechado uuid; f_atv uuid;
begin
  e := public.comercial_esteira(p_office);
  if e is null then
    insert into public.esteiras (office_id, nome, descricao, cor, ordem)
    values (p_office, 'Comercial', 'Funil comercial — o mesmo do Painel do Escritório.', '#c2410c', 0)
    returning id into e;
  end if;
  if exists (select 1 from public.esteira_fases where esteira_id = e and nome = 'Novo contato') then
    return; -- já está no formato do painel
  end if;
  if exists (select 1 from public.esteira_cards where esteira_id = e) then
    raise exception 'A esteira Comercial já tem cards; ajuste as fases manualmente.';
  end if;

  delete from public.esteira_automacoes where esteira_id = e;
  delete from public.esteira_fases where esteira_id = e;

  insert into public.esteira_fases (office_id, esteira_id, nome, cor, ordem, sla_dias, checklist, campos) values
    (p_office, e, 'Novo contato', '#ec4899', 0, 1, '["Responder em até 1 hora"]',
     '[{"id":"nicho","label":"Nicho","tipo":"lista","opcoes":["Saúde","Previdenciário","Dentistas","Tributário","Família","Cível e outros"]},
       {"id":"assunto","label":"Assunto","tipo":"texto_longo"},
       {"id":"email","label":"E-mail","tipo":"texto"},
       {"id":"indicadoPor","label":"Indicado por","tipo":"texto"}]'),
    (p_office, e, 'Triagem', '#64748b', 1, 2, '["Entender o caso","Ver se há direito"]', '[]'),
    (p_office, e, 'Consulta', '#3b82f6', 2, null, '["Consulta realizada"]', '[]'),
    (p_office, e, 'Proposta', '#8b5cf6', 3, 3, '["Proposta enviada","Follow-up"]',
     '[{"id":"honorarios","label":"Honorários propostos","tipo":"moeda"}]');
  insert into public.esteira_fases (office_id, esteira_id, nome, cor, ordem, finalizacao)
  values (p_office, e, 'Fechado', '#10b981', 4, true) returning id into f_fechado;
  insert into public.esteira_fases (office_id, esteira_id, nome, cor, ordem, finalizacao, campos)
  values (p_office, e, 'Perdido', '#ef4444', 5, true,
          '[{"id":"motivoPerda","label":"Motivo da perda","tipo":"texto"}]');

  select f.id into f_atv from public.esteira_fases f join public.esteiras x on x.id = f.esteira_id
   where x.office_id = p_office and not x.deletado and x.nome = 'Ativação do cliente' order by f.ordem limit 1;
  if f_atv is not null then
    insert into public.esteira_automacoes (office_id, esteira_id, nome, gatilho, fase_id, acao, config)
    values (p_office, e, 'Fechado → Ativação do cliente', 'entrou_fase', f_fechado, 'criar_card', jsonb_build_object('fase_id', f_atv));
  end if;
end;
$$;
revoke execute on function public.comercial_preparar_fases(uuid) from public, anon, authenticated;

-- Leads no formato do painel
create or replace function public.comercial_listar()
returns setof jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_office uuid := public.comercial_meu_escritorio();
  e uuid;
begin
  if v_office is null then return; end if;
  e := public.comercial_esteira(v_office);
  if e is null then return; end if;
  return query
  select jsonb_build_object(
           'id', coalesce(c.ref_externa, c.id::text),
           'dados', c.dados || jsonb_strip_nulls(jsonb_build_object(
              'nome', c.titulo,
              'telefone', coalesce(cl.telefone, c.dados->>'telefone', ''),
              'email', coalesce(nullif(c.dados->>'email', ''), cl.email, ''),
              'origem', coalesce(c.origem, c.dados->>'origem', ''),
              'valor', coalesce(nullif(c.dados->>'valor', '')::numeric, c.valor, 0),
              'prox', coalesce(c.prazo::text, ''),
              'etapa', f.nome,
              'vxId', c.cliente_id,
              'entrada', coalesce(c.dados->>'entrada', (c.created_at at time zone 'America/Sao_Paulo')::date::text),
              'fechadoEm', case when f.nome = 'Fechado'
                                then coalesce(nullif(c.dados->>'fechadoEm', ''), (c.entrou_fase_em at time zone 'America/Sao_Paulo')::date::text) end,
              'perdidoEm', case when f.nome = 'Perdido'
                                then coalesce(nullif(c.dados->>'perdidoEm', ''), (c.entrou_fase_em at time zone 'America/Sao_Paulo')::date::text) end,
              '_card', c.id)))
    from public.esteira_cards c
    join public.esteira_fases f on f.id = c.fase_id
    left join public.clientes cl on cl.id = c.cliente_id
   where c.esteira_id = e and not c.deletado and not c.arquivado
   order by c.created_at;
end;
$$;
revoke execute on function public.comercial_listar() from public, anon;
grant execute on function public.comercial_listar() to authenticated;

-- Grava um lead (formato do painel) como card + cliente
create or replace function public.comercial_salvar_lead(p_ref text, p_lead jsonb, p_office uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_office  uuid;
  v_owner   uuid;
  e         uuid;
  v_fase    uuid;
  v_etapa   text := coalesce(nullif(p_lead->>'etapa', ''), 'Novo contato');
  v_card    public.esteira_cards%rowtype;
  v_cli     uuid;
  v_tel     text := nullif(trim(coalesce(p_lead->>'telefone', '')), '');
  v_dig     text := regexp_replace(coalesce(p_lead->>'telefone', ''), '\D', '', 'g');
  v_nome    text := coalesce(nullif(trim(p_lead->>'nome'), ''), 'Contato sem nome');
  v_email   text := nullif(trim(coalesce(p_lead->>'email', '')), '');
  v_valor   numeric;
  v_prox    date;
  v_dados   jsonb;
  v_status  text;
begin
  -- quem pode: membro do escritório, ou o servidor (formulário do site)
  if auth.role() = 'service_role' then
    v_office := p_office;
  else
    v_office := coalesce(p_office, public.comercial_meu_escritorio());
    if not public.user_belongs_to_office(v_office) then
      raise exception 'Sem acesso a este escritório';
    end if;
  end if;
  if v_office is null then raise exception 'Escritório não informado'; end if;

  select user_id into v_owner from public.office_users where office_id = v_office and active order by joined_at limit 1;
  perform public.comercial_preparar_fases(v_office);
  e := public.comercial_esteira(v_office);
  select id into v_fase from public.esteira_fases where esteira_id = e and nome = v_etapa;
  if v_fase is null then
    select id into v_fase from public.esteira_fases where esteira_id = e order by ordem limit 1;
  end if;

  -- card existente: pelo uuid (criado no VextriaHub) ou pelo id do painel
  if p_ref ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select * into v_card from public.esteira_cards where id = p_ref::uuid and office_id = v_office;
  else
    select * into v_card from public.esteira_cards where office_id = v_office and ref_externa = p_ref;
  end if;

  -- cliente: o do card, o informado pelo painel, ou o mesmo telefone; senão cria
  v_cli := v_card.cliente_id;
  if v_cli is null and (p_lead->>'vxId') ~ '^[0-9a-f-]{36}$' then
    select id into v_cli from public.clientes where id = (p_lead->>'vxId')::uuid and office_id = v_office and not deletado;
  end if;
  if v_cli is null and length(v_dig) >= 10 then
    select id into v_cli from public.clientes
     where office_id = v_office and not deletado
       and right(regexp_replace(coalesce(telefone, ''), '\D', '', 'g'), 11) = right(v_dig, 11)
     order by (status = 'ativo') desc, created_at limit 1;
  end if;
  if v_cli is null then
    insert into public.clientes (user_id, office_id, nome, telefone, email, origem, status)
    values (coalesce(auth.uid(), v_owner), v_office, v_nome, v_tel, v_email,
            nullif(p_lead->>'origem', ''), 'lead')
    returning id into v_cli;
  else
    update public.clientes
       set telefone = coalesce(telefone, v_tel),
           email = coalesce(email, v_email),
           nome = case when status = 'lead' then v_nome else nome end
     where id = v_cli;
  end if;

  v_valor := nullif(coalesce(nullif(p_lead->>'honorarios', ''), nullif(p_lead->>'valor', '')), '')::numeric;
  v_prox := nullif(p_lead->>'prox', '')::date;
  v_dados := p_lead - array['nome', 'etapa', 'prox', 'vxId', '_card', '_id', 'telefone'];

  if v_card.id is null then
    insert into public.esteira_cards (office_id, esteira_id, fase_id, titulo, cliente_id, responsavel_id, origem,
                                      valor, prazo, dados, ref_externa, created_by)
    values (v_office, e, v_fase, v_nome, v_cli, coalesce(auth.uid(), v_owner), nullif(p_lead->>'origem', ''),
            v_valor, v_prox, v_dados,
            case when p_ref ~ '^[0-9a-f]{8}-' then null else p_ref end,
            coalesce(auth.uid(), v_owner))
    returning * into v_card;
  else
    update public.esteira_cards
       set titulo = v_nome, cliente_id = v_cli, origem = nullif(p_lead->>'origem', ''),
           valor = v_valor, prazo = v_prox, dados = v_dados, fase_id = v_fase
     where id = v_card.id;
  end if;

  return v_card.id;
end;
$$;
revoke execute on function public.comercial_salvar_lead(text, jsonb, uuid) from public, anon;
grant execute on function public.comercial_salvar_lead(text, jsonb, uuid) to authenticated, service_role;

create or replace function public.comercial_excluir_lead(p_ref text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_office uuid := public.comercial_meu_escritorio();
begin
  if v_office is null or not public.user_belongs_to_office(v_office) then raise exception 'Sem acesso'; end if;
  if p_ref ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    update public.esteira_cards set deletado = true where id = p_ref::uuid and office_id = v_office;
  else
    update public.esteira_cards set deletado = true where ref_externa = p_ref and office_id = v_office;
  end if;
end;
$$;
revoke execute on function public.comercial_excluir_lead(text) from public, anon;
grant execute on function public.comercial_excluir_lead(text) to authenticated;

-- Status do cliente acompanha a fase da Comercial (em qualquer tela)
create or replace function public.comercial_status_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_fase text; v_esteira text;
begin
  if new.cliente_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.fase_id is not distinct from old.fase_id and new.cliente_id is not distinct from old.cliente_id then
    return new;
  end if;
  select f.nome, e.nome into v_fase, v_esteira
    from public.esteira_fases f join public.esteiras e on e.id = f.esteira_id where f.id = new.fase_id;
  if v_esteira <> 'Comercial' then return new; end if;
  if v_fase = 'Fechado' then
    update public.clientes set status = 'ativo' where id = new.cliente_id and status is distinct from 'ativo';
  elsif v_fase = 'Perdido' then
    update public.clientes set status = 'inativo' where id = new.cliente_id and status = 'lead';
  end if;
  return new;
end;
$$;
revoke execute on function public.comercial_status_cliente() from public, anon, authenticated;

drop trigger if exists comercial_status_cliente on public.esteira_cards;
create trigger comercial_status_cliente
  after insert or update on public.esteira_cards
  for each row execute function public.comercial_status_cliente();

commit;

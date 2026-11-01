-- ============================================================================
-- COMERCIAL SDR + CLOSER: o funil passa a ter as etapas do setor comercial.
--   SDR:    Novo lead → Tentando contato → Repescagem → Qualificado
--   Closer: Reunião agendada → No-show → Reunião realizada → Proposta enviada →
--           Follow-up assinatura → Aguardando documentos → Documentos entregues
--   Fim:    Fechado (cria o card na Ativação do cliente) | Perdido
-- As fases antigas são renomeadas no lugar (os cards continuam nelas):
--   Novo contato → Novo lead · Triagem → Tentando contato ·
--   Consulta → Reunião agendada · Proposta → Proposta enviada.
-- comercial_salvar_lead aceita os nomes antigos (telas abertas, site).
-- A coluna esteira_fases.descricao guarda o papel (SDR / Closer).
-- Documentos saem da Ativação do cliente (agora ficam no comercial), se a fase
-- estiver vazia.
-- ============================================================================
begin;

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
  if exists (select 1 from public.esteira_fases where esteira_id = e) then
    return; -- já tem fases (formato do painel)
  end if;
  if exists (select 1 from public.esteira_cards where esteira_id = e) then
    raise exception 'A esteira Comercial já tem cards; ajuste as fases manualmente.';
  end if;

  delete from public.esteira_automacoes where esteira_id = e;
  delete from public.esteira_fases where esteira_id = e;

  insert into public.esteira_fases (office_id, esteira_id, nome, descricao, cor, ordem, sla_dias, checklist, campos) values
    (p_office, e, 'Novo lead', 'SDR', '#ec4899', 0, 1, '["Responder em até 1 hora"]',
     '[{"id":"nicho","label":"Nicho","tipo":"lista","opcoes":["Saúde","Previdenciário","Dentistas","Tributário","Família","Cível e outros"]},
       {"id":"assunto","label":"Assunto","tipo":"texto_longo"},
       {"id":"email","label":"E-mail","tipo":"texto"},
       {"id":"indicadoPor","label":"Indicado por","tipo":"texto"}]'),
    (p_office, e, 'Tentando contato', 'SDR', '#f59e0b', 1, 3, '["1ª tentativa","2ª tentativa","3ª tentativa"]', '[]'),
    (p_office, e, 'Repescagem', 'SDR', '#94a3b8', 2, 7, '["Nova tentativa em 7 dias"]', '[]'),
    (p_office, e, 'Qualificado', 'SDR', '#64748b', 3, 1, '["Entendeu o caso","Há direito","Agendar reunião com o Closer"]', '[]'),
    (p_office, e, 'Reunião agendada', 'Closer', '#3b82f6', 4, null, '["Confirmar na véspera"]', '[]'),
    (p_office, e, 'No-show', 'Closer', '#ef4444', 5, 1, '["Remarcar a reunião"]', '[]'),
    (p_office, e, 'Reunião realizada', 'Closer', '#6366f1', 6, 1, '["Enviar proposta"]', '[]'),
    (p_office, e, 'Proposta enviada', 'Closer', '#8b5cf6', 7, 2, '["Proposta enviada"]',
     '[{"id":"honorarios","label":"Honorários propostos","tipo":"moeda"}]'),
    (p_office, e, 'Follow-up assinatura', 'Closer', '#a855f7', 8, 3, '["Contrato e procuração enviados","Assinatura conferida"]', '[]'),
    (p_office, e, 'Aguardando documentos', 'Closer', '#0ea5e9', 9, 5, '["Lista de documentos enviada"]', '[]'),
    (p_office, e, 'Documentos entregues', 'Closer', '#14b8a6', 10, 1, '["Documentos conferidos"]', '[]');
  insert into public.esteira_fases (office_id, esteira_id, nome, cor, ordem, finalizacao)
  values (p_office, e, 'Fechado', '#10b981', 11, true) returning id into f_fechado;
  insert into public.esteira_fases (office_id, esteira_id, nome, cor, ordem, finalizacao, campos)
  values (p_office, e, 'Perdido', '#ef4444', 12, true,
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
  v_etapa   text := coalesce(nullif(p_lead->>'etapa', ''), 'Novo lead');
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
  -- nomes antigos do funil (telas abertas antes da mudança, assistente, site)
  v_etapa := case v_etapa when 'Novo contato' then 'Novo lead' when 'Triagem' then 'Tentando contato'
                          when 'Consulta' then 'Reunião agendada' when 'Proposta' then 'Proposta enviada' else v_etapa end;
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

-- Converte as esteiras Comercial que já existem
do $$
declare
  r record; e uuid;
begin
  for r in select distinct office_id from public.esteiras where not deletado and nome = 'Comercial' loop
    e := public.comercial_esteira(r.office_id);
    continue when e is null or not exists (select 1 from public.esteira_fases where esteira_id = e and nome = 'Novo contato');
    update public.esteira_fases set nome = 'Novo lead', descricao = 'SDR', ordem = 0 where esteira_id = e and nome = 'Novo contato';
    update public.esteira_fases set nome = 'Tentando contato', descricao = 'SDR', ordem = 1, sla_dias = 3, cor = '#f59e0b',
           checklist = '["1ª tentativa","2ª tentativa","3ª tentativa"]' where esteira_id = e and nome = 'Triagem';
    update public.esteira_fases set nome = 'Reunião agendada', descricao = 'Closer', ordem = 4, checklist = '["Confirmar na véspera"]'
     where esteira_id = e and nome = 'Consulta';
    update public.esteira_fases set nome = 'Proposta enviada', descricao = 'Closer', ordem = 7, sla_dias = 2, checklist = '["Proposta enviada"]'
     where esteira_id = e and nome = 'Proposta';
    update public.esteira_fases set ordem = 11 where esteira_id = e and nome = 'Fechado';
    update public.esteira_fases set ordem = 12 where esteira_id = e and nome = 'Perdido';
    insert into public.esteira_fases (office_id, esteira_id, nome, descricao, cor, ordem, sla_dias, checklist, campos) values
      (r.office_id, e, 'Repescagem', 'SDR', '#94a3b8', 2, 7, '["Nova tentativa em 7 dias"]', '[]'),
      (r.office_id, e, 'Qualificado', 'SDR', '#64748b', 3, 1, '["Entendeu o caso","Há direito","Agendar reunião com o Closer"]', '[]'),
      (r.office_id, e, 'No-show', 'Closer', '#ef4444', 5, 1, '["Remarcar a reunião"]', '[]'),
      (r.office_id, e, 'Reunião realizada', 'Closer', '#6366f1', 6, 1, '["Enviar proposta"]', '[]'),
      (r.office_id, e, 'Follow-up assinatura', 'Closer', '#a855f7', 8, 3, '["Contrato e procuração enviados","Assinatura conferida"]', '[]'),
      (r.office_id, e, 'Aguardando documentos', 'Closer', '#0ea5e9', 9, 5, '["Lista de documentos enviada"]', '[]'),
      (r.office_id, e, 'Documentos entregues', 'Closer', '#14b8a6', 10, 1, '["Documentos conferidos"]', '[]');
    -- documentos agora são do comercial: tira a fase da Ativação se estiver vazia
    delete from public.esteira_fases f using public.esteiras x
     where x.id = f.esteira_id and x.office_id = r.office_id and not x.deletado and x.nome = 'Ativação do cliente'
       and f.nome = 'Documentos' and not exists (select 1 from public.esteira_cards c where c.fase_id = f.id);
    update public.esteira_fases f set ordem = s.n - 1
      from (select f2.id, row_number() over (order by f2.ordem) n from public.esteira_fases f2 join public.esteiras x on x.id = f2.esteira_id
             where x.office_id = r.office_id and not x.deletado and x.nome = 'Ativação do cliente') s
     where f.id = s.id;
  end loop;
end $$;

commit;

-- ============================================================================
-- CICLO DO PRAZO: publicação → card de Peticionamento → Protocolo → baixa
-- ============================================================================
-- * esteira_cards ganha o vínculo com o prazo de origem:
--     controladoria_prazo_id (triagem do painel) e prazo_id (prazos do VextriaHub).
-- * esteira_fases.baixa_prazo: ao entrar numa fase marcada, o card dá baixa no
--   prazo vinculado — mesma regra do painel da Controladoria: conclui no
--   VextriaHub os prazos pendentes do processo com vencimento até 7 dias do
--   prazo da triagem, registra em controladoria_baixas (via 'esteira') e marca o
--   prazo como aplicado (o Notion é sincronizado pelo cron de 10 em 10 min).
-- * esteira_card_de_prazo(): cria (ou devolve, se já existir) o card de
--   Peticionamento a partir de um prazo da triagem ou do VextriaHub.
-- * "criar card em outra esteira" leva o vínculo junto (Peticionamento →
--   Protocolo).
-- * Modelos: Peticionamento concluído → Protocolo; "Protocolado" dá a baixa.
-- ============================================================================

begin;

alter table public.esteira_cards
  add column if not exists controladoria_prazo_id text references public.controladoria_prazos(id) on delete set null,
  add column if not exists prazo_id uuid references public.prazos(id) on delete set null;
create index if not exists esteira_cards_ctrl_prazo_idx on public.esteira_cards(controladoria_prazo_id) where controladoria_prazo_id is not null;
create index if not exists esteira_cards_prazo_idx on public.esteira_cards(prazo_id) where prazo_id is not null;

alter table public.esteira_fases
  add column if not exists baixa_prazo boolean not null default false;

-- ── Baixa do prazo vinculado ───────────────────────────────────────────────
create or replace function public.esteira_baixar_prazo_vinculado(p_card_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c        public.esteira_cards%rowtype;
  cp       public.controladoria_prazos%rowtype;
  v_digits text;
  v_data   date;
  v_hoje   date := (now() at time zone 'America/Sao_Paulo')::date;
  v_nota   text;
  v_proto  text;
  v_ids    uuid[] := '{}';
  v_tem_cp boolean := false;
begin
  select * into c from public.esteira_cards where id = p_card_id;
  if not found or (c.controladoria_prazo_id is null and c.prazo_id is null) then
    return;
  end if;

  if c.controladoria_prazo_id is not null then
    select * into cp from public.controladoria_prazos where id = c.controladoria_prazo_id;
    v_tem_cp := found;
  end if;

  v_proto := nullif(trim(coalesce(c.dados->>'numero_protocolo', '')), '');
  v_nota := '[Baixa ' || to_char(v_hoje, 'DD/MM/YYYY') || ' pela esteira: peça protocolada'
            || coalesce(' — protocolo ' || v_proto, '') || ']';

  if c.prazo_id is not null then
    with u as (
      update public.prazos
         set status = 'concluido', concluido_em = now(), concluido_por = auth.uid(),
             base_legal = coalesce(base_legal, '') || ' | ' || v_nota
       where id = c.prazo_id and status = 'pendente' and not deletado
      returning id)
    select coalesce(array_agg(id), '{}') into v_ids from u;
  elsif v_tem_cp then
    v_digits := regexp_replace(coalesce(cp.numero_processo, cp.proc), '\D', '', 'g');
    v_data := cp.prazo;
    with u as (
      update public.prazos
         set status = 'concluido', concluido_em = now(), concluido_por = auth.uid(),
             base_legal = coalesce(base_legal, '') || ' | ' || v_nota
       where office_id = c.office_id and numero_processo = v_digits
         and status = 'pendente' and not deletado
         and (data_fim_prazo is null or abs(data_fim_prazo - v_data) <= 7)
      returning id)
    select coalesce(array_agg(id), '{}') into v_ids from u;
  end if;

  if v_tem_cp and cp.estado <> 'aplicado' then
    insert into public.controladoria_baixas (office_id, prazo_id, proc, prazo, acao, motivo, nota, via, vextria_ids, user_id)
    values (c.office_id, cp.id, cp.proc, cp.prazo, 'marcar', 'Peça protocolada',
            coalesce('Protocolo ' || v_proto, null), 'esteira', v_ids, auth.uid());
    update public.controladoria_prazos
       set estado = 'aplicado', motivo = 'Peça protocolada', aplicado_em = v_hoje, notion_sync = 'pendente'
     where id = cp.id;
  end if;

  insert into public.esteira_eventos (office_id, card_id, tipo, descricao, user_id)
  values (c.office_id, c.id, 'automacao',
          'Baixa automática do prazo: ' ||
          case when cardinality(v_ids) > 0 then cardinality(v_ids) || ' prazo(s) concluído(s) no VextriaHub'
               else 'nenhum prazo pendente correspondente no VextriaHub' end ||
          case when v_tem_cp then ' · Controladoria atualizada' else '' end,
          auth.uid());
exception when others then
  insert into public.esteira_eventos (office_id, card_id, tipo, descricao, user_id)
  values (c.office_id, c.id, 'automacao', 'Baixa automática com erro: ' || sqlerrm, auth.uid());
end;
$$;
revoke execute on function public.esteira_baixar_prazo_vinculado(uuid) from public, anon, authenticated;

-- ── Trigger: histórico, automações e baixa ─────────────────────────────────
create or replace function public.esteira_cards_apos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.esteira_eventos (office_id, card_id, tipo, descricao, fase_para, user_id)
    values (new.office_id, new.id, 'criado', 'Card criado', new.fase_id, auth.uid());
    perform public.esteira_executar_automacoes(new.id, 'card_criado', new.fase_id);
    perform public.esteira_executar_automacoes(new.id, 'entrou_fase', new.fase_id);
    return new;
  end if;

  if new.fase_id is distinct from old.fase_id then
    insert into public.esteira_eventos (office_id, card_id, tipo, descricao, fase_de, fase_para, user_id)
    values (new.office_id, new.id, 'movido',
            'Movido de "' || coalesce((select nome from public.esteira_fases where id = old.fase_id), '?')
            || '" para "' || coalesce((select nome from public.esteira_fases where id = new.fase_id), '?') || '"',
            old.fase_id, new.fase_id, auth.uid());
    if exists (select 1 from public.esteira_fases where id = new.fase_id and baixa_prazo) then
      perform public.esteira_baixar_prazo_vinculado(new.id);
    end if;
    perform public.esteira_executar_automacoes(new.id, 'entrou_fase', new.fase_id);
  end if;

  if new.arquivado is distinct from old.arquivado then
    insert into public.esteira_eventos (office_id, card_id, tipo, descricao, user_id)
    values (new.office_id, new.id, case when new.arquivado then 'arquivado' else 'restaurado' end,
            case when new.arquivado then 'Card arquivado' else 'Card restaurado' end, auth.uid());
  end if;
  return new;
end;
$$;
revoke execute on function public.esteira_cards_apos() from public, anon, authenticated;

-- ── "Criar card em outra esteira" leva o vínculo do prazo ─────────────────
create or replace function public.esteira_executar_automacoes(p_card_id uuid, p_gatilho text, p_fase_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c        public.esteira_cards%rowtype;
  a        public.esteira_automacoes%rowtype;
  v_user   uuid;
  v_titulo text;
  v_fase   uuid;
  v_dest   uuid;
begin
  if pg_trigger_depth() > 4 then
    return;
  end if;

  select * into c from public.esteira_cards where id = p_card_id;
  if not found or c.deletado then
    return;
  end if;

  for a in
    select * from public.esteira_automacoes
     where esteira_id = c.esteira_id
       and ativo
       and gatilho = p_gatilho
       and (p_gatilho <> 'entrou_fase' or fase_id = p_fase_id)
     order by created_at
  loop
    begin
      v_user := coalesce(c.responsavel_id, auth.uid(), c.created_by);

      if a.acao = 'criar_tarefa' and v_user is not null then
        v_titulo := replace(coalesce(nullif(a.config->>'titulo',''), 'Tarefa: {{titulo}}'), '{{titulo}}', c.titulo);
        insert into public.tarefas (user_id, office_id, processo_id, cliente_id, titulo, descricao,
                                    prioridade, status, data_vencimento, concluida, responsavel_id)
        values (v_user, c.office_id, c.processo_id, c.cliente_id, v_titulo,
                'Criada pela automação "' || a.nome || '" da esteira.',
                coalesce(nullif(a.config->>'prioridade',''), 'media'), 'pendente',
                case when (a.config->>'dias_uteis') ~ '^\d+$'
                     then public.esteira_somar_dias_uteis(current_date, (a.config->>'dias_uteis')::int) end,
                false, v_user);

      elsif a.acao = 'mover_card' and (a.config->>'fase_id') is not null then
        v_fase := (a.config->>'fase_id')::uuid;
        if exists (select 1 from public.esteira_fases f where f.id = v_fase and f.esteira_id = c.esteira_id)
           and v_fase <> c.fase_id then
          update public.esteira_cards set fase_id = v_fase where id = c.id;
        end if;

      elsif a.acao = 'criar_card' and (a.config->>'fase_id') is not null then
        v_fase := (a.config->>'fase_id')::uuid;
        select f.esteira_id into v_dest from public.esteira_fases f
         where f.id = v_fase and f.office_id = c.office_id;
        if v_dest is not null then
          insert into public.esteira_cards (office_id, esteira_id, fase_id, titulo, descricao, cliente_id,
                                            processo_id, responsavel_id, prioridade, prazo, origem, valor,
                                            dados, etiquetas, created_by, controladoria_prazo_id, prazo_id)
          values (c.office_id, v_dest, v_fase, c.titulo, c.descricao, c.cliente_id, c.processo_id,
                  c.responsavel_id, c.prioridade, c.prazo, c.origem, c.valor, c.dados, c.etiquetas,
                  coalesce(auth.uid(), c.created_by), c.controladoria_prazo_id, c.prazo_id);
        end if;

      elsif a.acao = 'definir_responsavel' and (a.config->>'user_id') is not null then
        update public.esteira_cards set responsavel_id = (a.config->>'user_id')::uuid where id = c.id;

      elsif a.acao = 'definir_prazo' and (a.config->>'dias_uteis') ~ '^\d+$' then
        update public.esteira_cards
           set prazo = public.esteira_somar_dias_uteis(current_date, (a.config->>'dias_uteis')::int)
         where id = c.id;
      end if;

      insert into public.esteira_eventos (office_id, card_id, tipo, descricao, user_id)
      values (c.office_id, c.id, 'automacao', 'Automação executada: ' || a.nome, auth.uid());
    exception when others then
      insert into public.esteira_eventos (office_id, card_id, tipo, descricao, user_id)
      values (c.office_id, c.id, 'automacao', 'Automação com erro (' || a.nome || '): ' || sqlerrm, auth.uid());
    end;
  end loop;
end;
$$;
revoke execute on function public.esteira_executar_automacoes(uuid, text, uuid) from public, anon, authenticated;

-- ── Criar o card de peça a partir de um prazo ──────────────────────────────
create or replace function public.esteira_card_de_prazo(p_controladoria_prazo_id text default null, p_prazo_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_office   uuid;
  v_digits   text;
  v_data     date;
  v_titulo   text;
  v_desc     text;
  v_esteira  uuid;
  v_fase     uuid;
  v_proc     uuid;
  v_cliente  uuid;
  v_card     uuid;
  cp         public.controladoria_prazos%rowtype;
  pz         public.prazos%rowtype;
begin
  if p_controladoria_prazo_id is null and p_prazo_id is null then
    raise exception 'Informe o prazo';
  end if;

  if p_controladoria_prazo_id is not null then
    select * into cp from public.controladoria_prazos where id = p_controladoria_prazo_id;
    if not found then raise exception 'Prazo da triagem não encontrado'; end if;
    v_office := cp.office_id;
    v_digits := regexp_replace(coalesce(cp.numero_processo, cp.proc), '\D', '', 'g');
    v_data := cp.prazo;
    v_titulo := coalesce(nullif(trim(cp.cliente), ''), cp.proc) || coalesce(' — ' || nullif(trim(cp.peca), 'n/i'), '');
    v_desc := concat_ws(E'\n', nullif(cp.evento, ''), nullif(cp.obs, ''), 'Processo ' || cp.proc,
                        case when cp.prazo_txt is not null then 'Prazo na triagem: ' || cp.prazo_txt end);
    select id into v_card from public.esteira_cards
     where controladoria_prazo_id = cp.id and not deletado order by created_at limit 1;
  else
    select * into pz from public.prazos where id = p_prazo_id;
    if not found then raise exception 'Prazo não encontrado'; end if;
    v_office := pz.office_id;
    v_digits := regexp_replace(coalesce(pz.numero_processo, ''), '\D', '', 'g');
    v_data := coalesce(pz.data_prazo_interno, pz.data_fim_prazo);
    v_titulo := coalesce(nullif(trim(pz.titulo), ''), pz.tipo_prazo);
    v_desc := concat_ws(E'\n', pz.descricao, 'Processo ' || pz.numero_processo);
    v_proc := pz.processo_id;
    select id into v_card from public.esteira_cards
     where prazo_id = pz.id and not deletado order by created_at limit 1;
  end if;

  if not (public.user_belongs_to_office(v_office) or public.is_super_admin()) then
    raise exception 'Sem acesso a este escritório';
  end if;

  if v_card is not null then
    return v_card;  -- já existe: não duplica
  end if;

  select e.id into v_esteira from public.esteiras e
   where e.office_id = v_office and not e.deletado and e.nome ilike 'Peticionamento%'
   order by e.ordem limit 1;
  if v_esteira is null then
    raise exception 'Crie a esteira "Peticionamento" (há um modelo pronto em Esteiras).';
  end if;
  select f.id into v_fase from public.esteira_fases f where f.esteira_id = v_esteira order by f.ordem limit 1;

  if v_proc is null and length(v_digits) = 20 then
    select p.id into v_proc from public.processos p
     where p.office_id = v_office and p.numero_processo = v_digits and not p.deletado limit 1;
  end if;
  if v_proc is not null then
    select p.cliente_id into v_cliente from public.processos p where p.id = v_proc;
  end if;

  insert into public.esteira_cards (office_id, esteira_id, fase_id, titulo, descricao, cliente_id, processo_id,
                                    responsavel_id, prioridade, prazo, origem, controladoria_prazo_id, prazo_id)
  values (v_office, v_esteira, v_fase, left(v_titulo, 200), v_desc, v_cliente, v_proc,
          auth.uid(),
          case when cp.urg = 'Alta' then 'alta' else 'media' end,
          v_data, 'Publicação', p_controladoria_prazo_id, p_prazo_id)
  returning id into v_card;
  return v_card;
end;
$$;
revoke execute on function public.esteira_card_de_prazo(text, uuid) from public, anon;
grant execute on function public.esteira_card_de_prazo(text, uuid) to authenticated;

-- ── Modelos atualizados ────────────────────────────────────────────────────
create or replace function public.esteira_instalar_modelos(p_office uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  e_com uuid; e_atv uuid; e_prd uuid; e_pet uuid; e_pro uuid; f_pet_fim uuid;
  f uuid; f_ganho uuid; f_handoff uuid; f_prd1 uuid; f_prd_final uuid; f_pro1 uuid; f_atv1 uuid;
  base integer;
begin
  if not (public.user_belongs_to_office(p_office) or public.is_super_admin()) then
    raise exception 'Sem acesso a este escritório';
  end if;

  select coalesce(max(ordem), -1) + 1 into base from public.esteiras where office_id = p_office;

  -- 1. Comercial
  insert into public.esteiras (office_id, nome, descricao, cor, ordem)
  values (p_office, 'Comercial', 'Do primeiro contato ao contrato assinado.', '#c2410c', base)
  returning id into e_com;
  insert into public.esteira_fases (office_id, esteira_id, nome, cor, ordem, sla_dias, checklist, campos) values
    (p_office, e_com, 'Novo lead', '#ec4899', 0, 1, '["Responder em até 1 hora","Qualificar a demanda"]',
     '[{"id":"area","label":"Área do direito","tipo":"lista","opcoes":["Previdenciário","Saúde","Família","Cível","Trabalhista","Criminal","Consumidor","Outra"]},{"id":"resumo","label":"Resumo do caso","tipo":"texto_longo"}]'),
    (p_office, e_com, 'Primeiro contato', '#64748b', 1, 1, '["Ligação ou WhatsApp feito"]', '[]'),
    (p_office, e_com, 'Follow-up', '#64748b', 2, 3, '["2º contato","3º contato"]', '[]'),
    (p_office, e_com, 'Reunião agendada', '#3b82f6', 3, null, '["Confirmar na véspera"]', '[{"id":"data_reuniao","label":"Data da reunião","tipo":"data"}]'),
    (p_office, e_com, 'Proposta enviada', '#8b5cf6', 4, 3, '["Enviar proposta","Follow-up da proposta"]', '[{"id":"honorarios","label":"Honorários propostos","tipo":"moeda"}]');
  insert into public.esteira_fases (office_id, esteira_id, nome, cor, ordem, finalizacao)
  values (p_office, e_com, 'Contrato fechado', '#10b981', 5, true) returning id into f_ganho;
  insert into public.esteira_fases (office_id, esteira_id, nome, cor, ordem, finalizacao, campos)
  values (p_office, e_com, 'Perdido', '#ef4444', 6, true,
          '[{"id":"motivo_perda","label":"Motivo da perda","tipo":"lista","opcoes":["Preço","Sem retorno","Fechou com outro","Sem direito","Outro"]}]');

  -- 2. Ativação do cliente
  insert into public.esteiras (office_id, nome, descricao, cor, ordem)
  values (p_office, 'Ativação do cliente', 'Pós-venda: cadastro, cobrança, documentos e boas-vindas.', '#0ea5e9', base + 1)
  returning id into e_atv;
  insert into public.esteira_fases (office_id, esteira_id, nome, cor, ordem, sla_dias, checklist)
  values (p_office, e_atv, 'Contrato recebido', '#3b82f6', 0, 1, '["Conferir contrato assinado","Conferir procuração"]')
  returning id into f_atv1;
  insert into public.esteira_fases (office_id, esteira_id, nome, cor, ordem, sla_dias, checklist, campos) values
    (p_office, e_atv, 'Cadastro e cobrança', '#0f172a', 1, 1, '["Cadastrar cliente","Cadastrar processo/demanda","Gerar cobrança"]',
     '[{"id":"valor_contrato","label":"Valor do contrato","tipo":"moeda"},{"id":"forma_pagamento","label":"Forma de pagamento","tipo":"lista","opcoes":["PIX","Boleto","Cartão","Êxito"]}]'),
    (p_office, e_atv, 'Documentos', '#f59e0b', 2, 5, '["Solicitar documentos","Cobrar pendências","Organizar na pasta"]',
     '[{"id":"link_pasta","label":"Link da pasta","tipo":"url"}]'),
    (p_office, e_atv, 'Boas-vindas', '#8b5cf6', 3, 2, '["Enviar manual do cliente","Reunião de alinhamento"]', '[]');
  insert into public.esteira_fases (office_id, esteira_id, nome, cor, ordem, finalizacao, checklist)
  values (p_office, e_atv, 'Pronto para produção', '#10b981', 4, true, '["Checklist de handoff conferido"]')
  returning id into f_handoff;

  -- 3. Produção inicial
  insert into public.esteiras (office_id, nome, descricao, cor, ordem)
  values (p_office, 'Produção inicial', 'Petição inicial ou requerimento administrativo.', '#16a34a', base + 2)
  returning id into e_prd;
  insert into public.esteira_fases (office_id, esteira_id, nome, cor, ordem, sla_dias, checklist)
  values (p_office, e_prd, 'Recebido da ativação', '#3b82f6', 0, 2, '["Ler o caso e os documentos"]')
  returning id into f_prd1;
  insert into public.esteira_fases (office_id, esteira_id, nome, cor, ordem, sla_dias, checklist) values
    (p_office, e_prd, 'Análise e esqueleto', '#64748b', 1, 3, '["Definir tese","Montar esqueleto"]'),
    (p_office, e_prd, 'Redação', '#8b5cf6', 2, 7, '["Redigir a peça","Conferir pedidos e valor da causa"]'),
    (p_office, e_prd, 'Revisão', '#f59e0b', 3, 2, '["Revisar","Conferir documentos anexos"]');
  insert into public.esteira_fases (office_id, esteira_id, nome, cor, ordem, finalizacao)
  values (p_office, e_prd, 'Pronta para protocolo', '#10b981', 4, true)
  returning id into f_prd_final;

  -- 4. Peticionamento (peças intermediárias)
  insert into public.esteiras (office_id, nome, descricao, cor, ordem)
  values (p_office, 'Peticionamento', 'Manifestações, recursos e peças intermediárias.', '#7c3aed', base + 3)
  returning id into e_pet;
  insert into public.esteira_fases (office_id, esteira_id, nome, cor, ordem, sla_dias, checklist, finalizacao) values
    (p_office, e_pet, 'Caixa de entrada', '#3b82f6', 0, 1, '["Conferir o prazo fatal"]', false),
    (p_office, e_pet, 'Em análise', '#64748b', 1, 2, '[]', false),
    (p_office, e_pet, 'Em produção', '#8b5cf6', 2, 3, '[]', false),
    (p_office, e_pet, 'Revisão', '#f59e0b', 3, 1, '["Revisar a peça"]', false);
  insert into public.esteira_fases (office_id, esteira_id, nome, cor, ordem, finalizacao)
  values (p_office, e_pet, 'Concluído', '#10b981', 4, true)
  returning id into f_pet_fim;

  -- 5. Protocolo
  insert into public.esteiras (office_id, nome, descricao, cor, ordem)
  values (p_office, 'Protocolo', 'Protocolo e conferência da distribuição.', '#0f766e', base + 4)
  returning id into e_pro;
  insert into public.esteira_fases (office_id, esteira_id, nome, cor, ordem, sla_dias, checklist)
  values (p_office, e_pro, 'A protocolar', '#3b82f6', 0, 1, '["Conferir PDF e assinatura","Protocolar no sistema"]')
  returning id into f_pro1;
  insert into public.esteira_fases (office_id, esteira_id, nome, cor, ordem, finalizacao, campos) values
    (p_office, e_pro, 'Protocolado', '#10b981', 1, true,
     '[{"id":"sistema","label":"Sistema","tipo":"lista","opcoes":["PJe","eproc","e-SAJ","Projudi","SEEU","STJ","INSS"]},{"id":"numero_protocolo","label":"Nº do protocolo / processo","tipo":"texto"}]'),
    (p_office, e_pro, 'Não protocolado', '#ef4444', 2, true, '[{"id":"motivo","label":"Motivo","tipo":"texto_longo"}]');

  -- Handoffs automáticos entre as esteiras
  insert into public.esteira_automacoes (office_id, esteira_id, nome, gatilho, fase_id, acao, config) values
    (p_office, e_com, 'Contrato fechado → Ativação', 'entrou_fase', f_ganho, 'criar_card', jsonb_build_object('fase_id', f_atv1)),
    (p_office, e_atv, 'Ativação concluída → Produção inicial', 'entrou_fase', f_handoff, 'criar_card', jsonb_build_object('fase_id', f_prd1)),
    (p_office, e_prd, 'Peça pronta → Protocolo', 'entrou_fase', f_prd_final, 'criar_card', jsonb_build_object('fase_id', f_pro1)),
    (p_office, e_pet, 'Peça concluída → Protocolo', 'entrou_fase', f_pet_fim, 'criar_card', jsonb_build_object('fase_id', f_pro1)),
    (p_office, e_prd, 'Prazo interno da inicial (15 dias úteis)', 'card_criado', null, 'definir_prazo', '{"dias_uteis":15}'),
    (p_office, e_prd, 'Tarefa de redação', 'card_criado', null, 'criar_tarefa',
     '{"titulo":"Redigir inicial: {{titulo}}","dias_uteis":15,"prioridade":"alta"}');

  update public.esteira_fases set baixa_prazo = true where esteira_id = e_pro and nome = 'Protocolado';

  return 5;
end;
$$;
revoke execute on function public.esteira_instalar_modelos(uuid) from public, anon;
grant execute on function public.esteira_instalar_modelos(uuid) to authenticated;

-- ── Ajuste das esteiras já instaladas ──────────────────────────────────────
update public.esteira_fases f
   set baixa_prazo = true
  from public.esteiras e
 where e.id = f.esteira_id and not e.deletado and e.nome = 'Protocolo' and f.nome = 'Protocolado';

insert into public.esteira_automacoes (office_id, esteira_id, nome, gatilho, fase_id, acao, config)
select pet.office_id, pet.id, 'Peça concluída → Protocolo', 'entrou_fase', fim.id, 'criar_card',
       jsonb_build_object('fase_id', pro1.id)
  from public.esteiras pet
  join public.esteira_fases fim on fim.esteira_id = pet.id and fim.nome = 'Concluído'
  join public.esteiras pro on pro.office_id = pet.office_id and pro.nome = 'Protocolo' and not pro.deletado
  join lateral (select id from public.esteira_fases where esteira_id = pro.id order by ordem limit 1) pro1 on true
 where pet.nome = 'Peticionamento' and not pet.deletado
   and not exists (select 1 from public.esteira_automacoes a where a.esteira_id = pet.id and a.fase_id = fim.id and a.acao = 'criar_card');

commit;

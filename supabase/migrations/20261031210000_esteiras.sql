-- ============================================================================
-- ESTEIRAS (procedimentos em kanban) — inspirado no Infinitum, adaptado ao
-- operacional jurídico do VextriaHub.
-- ============================================================================
-- esteiras            : o fluxo (ex.: Comercial, Ativação, Produção inicial)
-- esteira_fases       : colunas do kanban, com campos e checklist próprios
-- esteira_cards       : o item que anda nas fases; liga cliente e processo
-- esteira_eventos     : histórico do card (criado, movido, editado, automação)
-- esteira_automacoes  : "sempre que X, faça Y" — executadas por trigger no
--                       banco, então valem para qualquer tela/integração
--
-- Regras:
--   * tudo é por escritório (office_id) com o mesmo padrão de RLS de
--     correspondentes (gate restritivo office_has_access + membros);
--   * cards usam soft-delete (deletado) e aparecem na Lixeira;
--   * mudança de fase carimba entrou_fase_em (base do "tempo na fase");
--   * automações têm trava de profundidade para não entrar em laço.
-- ============================================================================

begin;

-- ── Tabelas ─────────────────────────────────────────────────────────────────

create table if not exists public.esteiras (
  id          uuid primary key default gen_random_uuid(),
  office_id   uuid not null references public.offices(id) on delete cascade,
  nome        text not null check (length(trim(nome)) > 0),
  descricao   text,
  cor         text not null default '#c2410c',
  ordem       integer not null default 0,
  deletado    boolean not null default false,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.esteira_fases (
  id           uuid primary key default gen_random_uuid(),
  office_id    uuid not null references public.offices(id) on delete cascade,
  esteira_id   uuid not null references public.esteiras(id) on delete cascade,
  nome         text not null check (length(trim(nome)) > 0),
  descricao    text,
  cor          text not null default '#64748b',
  ordem        integer not null default 0,
  finalizacao  boolean not null default false,
  -- prazo interno da fase em dias úteis (alerta de card parado); null = sem SLA
  sla_dias     integer check (sla_dias is null or sla_dias > 0),
  -- [{id, label, tipo: texto|texto_longo|numero|moeda|data|lista|sim_nao|url, obrigatorio, opcoes[]}]
  campos       jsonb not null default '[]'::jsonb check (jsonb_typeof(campos) = 'array'),
  -- ["Conferir documentos", ...]
  checklist    jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array'),
  created_at   timestamptz not null default now()
);

create table if not exists public.esteira_cards (
  id              uuid primary key default gen_random_uuid(),
  office_id       uuid not null references public.offices(id) on delete cascade,
  esteira_id      uuid not null references public.esteiras(id) on delete cascade,
  fase_id         uuid not null references public.esteira_fases(id) on delete restrict,
  titulo          text not null check (length(trim(titulo)) > 0),
  descricao       text,
  cliente_id      uuid references public.clientes(id) on delete set null,
  processo_id     uuid references public.processos(id) on delete set null,
  responsavel_id  uuid,
  prioridade      text not null default 'media' check (prioridade in ('baixa','media','alta','urgente')),
  prazo           date,
  origem          text,
  valor           numeric,
  -- respostas dos campos das fases: { "<campo_id>": valor }
  dados           jsonb not null default '{}'::jsonb check (jsonb_typeof(dados) = 'object'),
  -- itens marcados: { "<fase_id>": [0, 2] }
  checklist_feito jsonb not null default '{}'::jsonb check (jsonb_typeof(checklist_feito) = 'object'),
  etiquetas       text[] not null default '{}',
  entrou_fase_em  timestamptz not null default now(),
  arquivado       boolean not null default false,
  deletado        boolean not null default false,
  created_by      uuid default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.esteira_eventos (
  id          uuid primary key default gen_random_uuid(),
  office_id   uuid not null references public.offices(id) on delete cascade,
  card_id     uuid not null references public.esteira_cards(id) on delete cascade,
  tipo        text not null check (tipo in ('criado','movido','editado','comentario','automacao','arquivado','restaurado')),
  descricao   text,
  fase_de     uuid,
  fase_para   uuid,
  user_id     uuid default auth.uid(),
  created_at  timestamptz not null default now()
);

create table if not exists public.esteira_automacoes (
  id          uuid primary key default gen_random_uuid(),
  office_id   uuid not null references public.offices(id) on delete cascade,
  esteira_id  uuid not null references public.esteiras(id) on delete cascade,
  nome        text not null,
  ativo       boolean not null default true,
  gatilho     text not null check (gatilho in ('card_criado','entrou_fase')),
  fase_id     uuid references public.esteira_fases(id) on delete cascade,
  acao        text not null check (acao in ('criar_tarefa','mover_card','criar_card','definir_responsavel','definir_prazo')),
  -- criar_tarefa: {titulo, dias_uteis, prioridade}
  -- mover_card:   {fase_id}
  -- criar_card:   {esteira_id, fase_id}
  -- definir_responsavel: {user_id}
  -- definir_prazo: {dias_uteis}
  config      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  check (gatilho <> 'entrou_fase' or fase_id is not null)
);

-- ── Índices ────────────────────────────────────────────────────────────────
create index if not exists esteiras_office_idx            on public.esteiras(office_id) where not deletado;
create index if not exists esteira_fases_esteira_idx      on public.esteira_fases(esteira_id, ordem);
create index if not exists esteira_fases_office_idx       on public.esteira_fases(office_id);
create index if not exists esteira_cards_esteira_idx      on public.esteira_cards(esteira_id, fase_id) where not deletado;
create index if not exists esteira_cards_office_idx       on public.esteira_cards(office_id);
create index if not exists esteira_cards_fase_idx         on public.esteira_cards(fase_id);
create index if not exists esteira_cards_cliente_idx      on public.esteira_cards(cliente_id);
create index if not exists esteira_cards_processo_idx     on public.esteira_cards(processo_id);
create index if not exists esteira_eventos_card_idx       on public.esteira_eventos(card_id, created_at desc);
create index if not exists esteira_eventos_office_idx     on public.esteira_eventos(office_id);
create index if not exists esteira_automacoes_esteira_idx on public.esteira_automacoes(esteira_id) where ativo;
create index if not exists esteira_automacoes_office_idx  on public.esteira_automacoes(office_id);
create index if not exists esteira_automacoes_fase_idx    on public.esteira_automacoes(fase_id);

-- ── RLS (mesmo padrão de correspondentes) ──────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['esteiras','esteira_fases','esteira_cards','esteira_eventos','esteira_automacoes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists office_paid_gate on public.%I', t);
    execute format('create policy office_paid_gate on public.%I as restrictive for all
                      using (office_has_access(office_id) or is_super_admin())
                      with check (office_has_access(office_id) or is_super_admin())', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select
                      using ((office_id = any(get_user_office_ids())) or is_super_admin())', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('create policy %I on public.%I for insert
                      with check (user_belongs_to_office(office_id) or is_super_admin())', t || '_insert', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- update: membros editam fluxo e cards; eventos são imutáveis
drop policy if exists esteiras_update on public.esteiras;
create policy esteiras_update on public.esteiras for update
  using ((office_id = any(get_user_office_ids())) or is_super_admin());
drop policy if exists esteira_fases_update on public.esteira_fases;
create policy esteira_fases_update on public.esteira_fases for update
  using ((office_id = any(get_user_office_ids())) or is_super_admin());
drop policy if exists esteira_cards_update on public.esteira_cards;
create policy esteira_cards_update on public.esteira_cards for update
  using ((office_id = any(get_user_office_ids())) or is_super_admin());
drop policy if exists esteira_automacoes_update on public.esteira_automacoes;
create policy esteira_automacoes_update on public.esteira_automacoes for update
  using ((office_id = any(get_user_office_ids())) or is_super_admin());

-- delete físico: fases e automações pelos membros (a fase com card é barrada
-- pela FK restrict); esteiras/cards usam soft-delete, delete físico só admin.
drop policy if exists esteira_fases_delete on public.esteira_fases;
create policy esteira_fases_delete on public.esteira_fases for delete
  using ((office_id = any(get_user_office_ids())) or is_super_admin());
drop policy if exists esteira_automacoes_delete on public.esteira_automacoes;
create policy esteira_automacoes_delete on public.esteira_automacoes for delete
  using ((office_id = any(get_user_office_ids())) or is_super_admin());
drop policy if exists esteiras_delete on public.esteiras;
create policy esteiras_delete on public.esteiras for delete
  using (is_office_admin(office_id) or is_super_admin());
drop policy if exists esteira_cards_delete on public.esteira_cards;
create policy esteira_cards_delete on public.esteira_cards for delete
  using (is_office_admin(office_id) or is_super_admin());

-- ── Dias úteis (seg–sex; feriados não considerados) ────────────────────────
create or replace function public.esteira_somar_dias_uteis(p_inicio date, p_dias integer)
returns date
language plpgsql
immutable
set search_path = public
as $$
declare
  d date := p_inicio;
  n integer := coalesce(p_dias, 0);
begin
  while n > 0 loop
    d := d + 1;
    if extract(isodow from d) < 6 then n := n - 1; end if;
  end loop;
  return d;
end;
$$;

-- ── Carimbos ───────────────────────────────────────────────────────────────
create or replace function public.esteira_cards_carimbar()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and new.fase_id is distinct from old.fase_id then
    new.entrou_fase_em := now();
  end if;
  return new;
end;
$$;

drop trigger if exists esteira_cards_carimbar on public.esteira_cards;
create trigger esteira_cards_carimbar
  before insert or update on public.esteira_cards
  for each row execute function public.esteira_cards_carimbar();

create or replace function public.esteiras_carimbar()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists esteiras_carimbar on public.esteiras;
create trigger esteiras_carimbar
  before update on public.esteiras
  for each row execute function public.esteiras_carimbar();

-- ── Motor de automações ────────────────────────────────────────────────────
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
  -- trava contra laço (card criado → cria card → move → ...)
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
                                            dados, etiquetas, created_by)
          values (c.office_id, v_dest, v_fase, c.titulo, c.descricao, c.cliente_id, c.processo_id,
                  c.responsavel_id, c.prioridade, c.prazo, c.origem, c.valor, c.dados, c.etiquetas,
                  coalesce(auth.uid(), c.created_by));
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
      -- uma automação com erro não pode impedir a criação/movimentação do card
      insert into public.esteira_eventos (office_id, card_id, tipo, descricao, user_id)
      values (c.office_id, c.id, 'automacao', 'Automação com erro (' || a.nome || '): ' || sqlerrm, auth.uid());
    end;
  end loop;
end;
$$;
revoke execute on function public.esteira_executar_automacoes(uuid, text, uuid) from public, anon, authenticated;

-- ── Histórico + disparo das automações ─────────────────────────────────────
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

drop trigger if exists esteira_cards_apos on public.esteira_cards;
create trigger esteira_cards_apos
  after insert or update on public.esteira_cards
  for each row execute function public.esteira_cards_apos();

-- ── Modelos prontos (Comercial → Ativação → Produção → Peticionamento → Protocolo)
create or replace function public.esteira_instalar_modelos(p_office uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  e_com uuid; e_atv uuid; e_prd uuid; e_pet uuid; e_pro uuid;
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
    (p_office, e_pet, 'Revisão', '#f59e0b', 3, 1, '["Revisar a peça"]', false),
    (p_office, e_pet, 'Concluído', '#10b981', 4, null, '[]', true);

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
    (p_office, e_prd, 'Prazo interno da inicial (15 dias úteis)', 'card_criado', null, 'definir_prazo', '{"dias_uteis":15}'),
    (p_office, e_prd, 'Tarefa de redação', 'card_criado', null, 'criar_tarefa',
     '{"titulo":"Redigir inicial: {{titulo}}","dias_uteis":15,"prioridade":"alta"}');

  return 5;
end;
$$;
revoke execute on function public.esteira_instalar_modelos(uuid) from public, anon;
grant execute on function public.esteira_instalar_modelos(uuid) to authenticated;

commit;

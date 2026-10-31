-- Lead vindo do formulário do site: se o telefone já tem card aberto na Comercial,
-- só anota no histórico e põe retorno para hoje; senão cria o lead.
begin;
create or replace function public.comercial_receber_site(p_office uuid, p_lead jsonb, p_nota text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  e uuid; v_card public.esteira_cards%rowtype;
  v_dig text := right(regexp_replace(coalesce(p_lead->>'telefone', ''), '\D', '', 'g'), 11);
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_hist jsonb;
begin
  if auth.role() <> 'service_role' then raise exception 'Somente o servidor'; end if;
  perform public.comercial_preparar_fases(p_office);
  e := public.comercial_esteira(p_office);

  select c.* into v_card
    from public.esteira_cards c
    join public.esteira_fases f on f.id = c.fase_id
    join public.clientes cl on cl.id = c.cliente_id
   where c.esteira_id = e and not c.deletado and not c.arquivado and not f.finalizacao
     and right(regexp_replace(coalesce(cl.telefone, ''), '\D', '', 'g'), 11) = v_dig
   order by c.created_at desc limit 1;

  if v_card.id is not null then
    v_hist := coalesce(v_card.dados->'historico', '[]'::jsonb)
              || jsonb_build_array(jsonb_build_object('d', v_hoje::text, 't', 'Preencheu o formulário de novo — ' || p_nota));
    update public.esteira_cards
       set dados = dados || jsonb_build_object('historico', v_hist), prazo = v_hoje
     where id = v_card.id;
    insert into public.esteira_eventos (office_id, card_id, tipo, descricao)
    values (p_office, v_card.id, 'comentario', 'Preencheu o formulário do site de novo — ' || p_nota);
    return v_card.id;
  end if;

  return public.comercial_salvar_lead(
    'p' || to_hex((extract(epoch from clock_timestamp()) * 1000)::bigint) || substr(md5(random()::text), 1, 4),
    p_lead, p_office);
end;
$$;
revoke execute on function public.comercial_receber_site(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.comercial_receber_site(uuid, jsonb, text) to service_role;

-- Segredo compartilhado com o encaminhador lead-site do projeto Gestão.
-- O valor fica no vault (criado fora do repositório); só o service role lê.
create or replace function public.lead_site_segredo()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'lead_forward_secret' limit 1;
$$;
revoke execute on function public.lead_site_segredo() from public, anon, authenticated;
grant execute on function public.lead_site_segredo() to service_role;
commit;

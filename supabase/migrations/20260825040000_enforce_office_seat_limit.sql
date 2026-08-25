-- MÉDIO (v12): a cota de assentos (offices.max_users) só era checada no edge
-- create-team-member. Pelo CONVITE (ensure_office_for_user) e por INSERT direto em
-- office_users via API, o admin adicionava membros acima do plano. Trigger BEFORE INSERT
-- passa a barrar no banco. Backend confiável passa (service_role, ex.: o próprio
-- create-team-member que já checa a cota e deixa o super exceder p/ cortesia; auth.uid()
-- null = contexto service_role) e super_admin passa. Advisory lock por office_id serializa
-- inserts concorrentes → fecha o TOCTOU também. Testado ao vivo: admin não-super é
-- bloqueado no teto e passa sob o teto.
create or replace function public.enforce_office_seat_limit()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_max int; v_count int;
begin
  if auth.uid() is null
     or coalesce(auth.jwt() ->> 'role','') = 'service_role'
     or public.is_super_admin() then
    return new;
  end if;
  if new.active is distinct from true then return new; end if; -- só assento ativo consome cota
  select max_users into v_max from public.offices where id = new.office_id;
  if v_max is null or v_max <= 0 then return new; end if;      -- sem limite → não bloqueia
  perform pg_advisory_xact_lock(hashtext(new.office_id::text)); -- serializa concorrentes (anti-TOCTOU)
  select count(*) into v_count from public.office_users
    where office_id = new.office_id and active = true;
  if v_count >= v_max then
    raise exception 'Limite de usuários do plano atingido (% assentos). Faça upgrade para adicionar mais membros.', v_max
      using errcode = 'check_violation';
  end if;
  return new;
end; $function$;

drop trigger if exists trg_enforce_office_seat_limit on public.office_users;
create trigger trg_enforce_office_seat_limit
  before insert on public.office_users
  for each row execute function public.enforce_office_seat_limit();

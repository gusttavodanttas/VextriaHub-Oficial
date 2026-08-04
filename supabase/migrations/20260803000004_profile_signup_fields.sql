-- Persiste no profile os campos coletados no cadastro (CPF/CNPJ, telefone, OAB,
-- UF). Antes eram digitados na tela de cadastro e DESCARTADOS — o register() só
-- mandava full_name no metadata e o handle_new_user só gravava full_name/email/
-- role. Agora o register() manda tudo no metadata do signUp e o trigger grava no
-- profiles. Aplicar via SQL Editor.

-- 1) garante as colunas no profiles (idempotente)
alter table public.profiles add column if not exists cpf_cnpj text;
alter table public.profiles add column if not exists phone    text;
alter table public.profiles add column if not exists oab      text;
alter table public.profiles add column if not exists oab_uf   text;
alter table public.profiles add column if not exists address  text;

-- 2) handle_new_user passa a ler os campos do metadata (preserva a lógica de role)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  insert into public.profiles (user_id, full_name, email, role, cpf_cnpj, phone, oab, oab_uf, address)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email,
    case
      when new.email = 'contato@vextriahub.com.br' then 'super_admin'::app_role
      else 'user'::app_role
    end,
    nullif(new.raw_user_meta_data ->> 'cpf_cnpj', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    nullif(new.raw_user_meta_data ->> 'oab', ''),
    nullif(new.raw_user_meta_data ->> 'oab_uf', ''),
    nullif(new.raw_user_meta_data ->> 'address', '')
  );
  return new;
end;
$$;

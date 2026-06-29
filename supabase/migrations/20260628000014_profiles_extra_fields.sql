-- Campos extras do perfil que a tela "Meu Perfil" edita mas não existiam no banco
-- (sem eles, salvar o perfil falhava com "column does not exist").
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS specialization text;

COMMENT ON COLUMN public.profiles.phone IS 'Telefone/WhatsApp do usuário (formato BR)';
COMMENT ON COLUMN public.profiles.address IS 'Localização/endereço do usuário';
COMMENT ON COLUMN public.profiles.specialization IS 'Área de atuação / especialidade';

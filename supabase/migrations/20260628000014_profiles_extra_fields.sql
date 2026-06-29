-- Campos do perfil que a tela "Meu Perfil" edita mas não existiam no banco
-- (sem eles, salvar o perfil falhava com "column does not exist").
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address text;

COMMENT ON COLUMN public.profiles.phone IS 'Telefone/WhatsApp do usuário (formato BR)';
COMMENT ON COLUMN public.profiles.address IS 'Localização (UF) do usuário';

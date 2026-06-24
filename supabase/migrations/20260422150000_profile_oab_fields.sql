-- Add OAB fields to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS oab TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS oab_uf TEXT;

-- Index for performance in lookups
CREATE INDEX IF NOT EXISTS idx_profiles_oab ON profiles(oab, oab_uf);

-- Comment for documentation
COMMENT ON COLUMN profiles.oab IS 'Número da OAB do advogado para busca automática de publicações.';
COMMENT ON COLUMN profiles.oab_uf IS 'Seccional (UF) da OAB do advogado.';

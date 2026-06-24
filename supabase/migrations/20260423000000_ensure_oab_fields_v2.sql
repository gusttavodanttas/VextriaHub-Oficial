-- ENSURE OAB FIELDS EXIST IN PROFILES
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'oab') THEN
        ALTER TABLE profiles ADD COLUMN oab TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'oab_uf') THEN
        ALTER TABLE profiles ADD COLUMN oab_uf TEXT;
    END IF;
END $$;

-- Update comments
COMMENT ON COLUMN profiles.oab IS 'Número da OAB para busca de publicações';
COMMENT ON COLUMN profiles.oab_uf IS 'UF da OAB';

-- Ensure Index
DROP INDEX IF EXISTS idx_profiles_oab;
CREATE INDEX idx_profiles_oab ON profiles(oab, oab_uf);

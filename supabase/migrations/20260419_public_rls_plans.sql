BEGIN;

-- Garante que os preços e capacidades dos planos possam ser lidos ativamente na Landing Page
-- por visitantes (anônimos) e usuários recém-cadastrados

ALTER TABLE "public"."plan_configs" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view plan configs" ON "public"."plan_configs";

CREATE POLICY "Public can view plan configs" 
  ON "public"."plan_configs" 
  FOR SELECT 
  USING (true);

COMMIT;

-- Higiene (Wave 4, v9):
-- 1) apply_signup_plan se auto-protege (raise se auth.uid() null) e só faz sentido autenticado.
--    (A revogação efetiva de anon está na migração seguinte — funções nascem com EXECUTE p/ PUBLIC.)
--    confirm_invited_user NÃO é revogada: o convidado a chama ANTES de logar (anon) e é protegida por token.
revoke execute on function public.apply_signup_plan(text) from anon;

-- 2) bucket público "uploads": só recebe imagens (uploadImage.ts valida image/* + ~3MB no cliente,
--    mas validação de cliente é burlável). Impõe no servidor: tipos de imagem + teto de 5MB.
update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif']
 where id = 'uploads';

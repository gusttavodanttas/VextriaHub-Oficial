-- Acervo do STJ limitado aos últimos 2 anos (plano gratuito do Supabase, 500 MB).
-- Aplicada em produção em 10/10/2026: 118 documentos (358 kB), nenhum com conferência
-- ou fixado de usuário (juris_user_reviews/juris_user_pins têm ON DELETE CASCADE, por
-- isso a checagem antes). A function juris-sync recusa o que chega fora da janela
-- (JANELA_STJ_ANOS), então isto não volta a crescer. Idempotente.
delete from public.juris_documents
where source_id like 'stj%'
  and coalesce(judgment_date, publication_date) < current_date - interval '2 years';

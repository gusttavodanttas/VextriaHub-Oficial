-- Acervo do STJ limitado aos últimos 12 meses (plano gratuito do Supabase, 500 MB).
-- Aperta a janela de 20261010000000_juris_stj_janela_2_anos: o acervo já era 99,9 % dos
-- últimos 2 anos, então aquele corte não liberou espaço. Aplicada em produção em
-- 10/10/2026, trimestre a trimestre (2024-T4 → 2025-T4): 34.269 documentos, nenhum com
-- conferência ou fixado de usuário, seguida de `vacuum (full, analyze)` para devolver o
-- espaço ao sistema de arquivos. A function juris-sync recusa o que chega fora da janela
-- (JANELA_STJ_MESES). Idempotente.
delete from public.juris_documents
where source_id like 'stj%'
  and coalesce(judgment_date, publication_date) < current_date - interval '12 months';

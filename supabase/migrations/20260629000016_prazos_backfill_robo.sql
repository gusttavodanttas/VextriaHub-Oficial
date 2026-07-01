-- Backfill único: unifica os prazos criados pelo robô (OAB/DJEN) com o padrão da tela.
-- Só preenche campos vazios — nunca sobrescreve edições manuais nem status já definido.

-- Publicação canônica = data de disponibilização do robô
update public.prazos
set data_publicacao = data_disponibilizacao
where data_publicacao is null and data_disponibilizacao is not null;

-- Status padrão para prazos sem status (robô não define)
update public.prazos
set status = 'pendente'
where status is null;

-- Título de exibição para prazos sem título (usa o tipo do prazo)
update public.prazos
set titulo = coalesce(nullif(tipo_prazo, ''), 'Prazo processual')
where titulo is null or btrim(titulo) = '';

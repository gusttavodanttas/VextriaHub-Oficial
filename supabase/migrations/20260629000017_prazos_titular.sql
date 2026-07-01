-- Titular do prazo: 'nosso' (escritório) ou 'contraria' (parte contrária, monitoramento).
alter table public.prazos add column if not exists titular text not null default 'nosso';

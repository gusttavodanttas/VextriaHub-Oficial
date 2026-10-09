# Jurisprudência e normas no VextriaHub (integração do JurisKit)

## O que é

Acervo auditável de jurisprudência (STJ, TJDFT, inteiro teor do STJ) e normas (ANS, CFO, CROs, Diário Oficial),
alimentado pelo JurisKit (coleta local em Python) e consultado dentro da plataforma. Regras herdadas do kit:

- Tudo entra **NÃO CONFERIDO**. Só pode ser citado o que o **próprio advogado** marcou como CONFERIDO,
  depois de abrir a fonte oficial e colar a mesma URL registrada (trava no banco: trigger `juris_reviews_check_url`).
- Ato normativo e metadado processual **nunca** são precedente (etiqueta roxa na tela; a IA os trata como norma).
- Pesquisas, histórico, conferências e fixações são **privadas por usuário** (RLS `user_id = auth.uid()`);
  nem o admin do escritório vê. O acervo em si é global (jurisprudência é pública).

## Onde aparece

| Lugar | O que faz |
|---|---|
| Menu → **Jurisprudência** (abaixo de Publicações) | buscador com filtros, conferência, citação pronta, pesquisas salvas e recentes, "Fundamentar com conferidos" |
| Publicações → detalhe → **Precedentes relacionados** | busca sugerida a partir do teor da publicação; fixar/conferir |
| Consultivo → editar → **Fundamentos** | precedentes e normas fixados ao parecer |
| Conselheiro IA | ferramenta `buscar_precedentes_conferidos` no chat e modo `fundamentacao` (só registros conferidos pelo usuário chegam ao modelo) |
| Configurações → **Alertas de normas** | notificação quando a sincronização trouxer norma nova da ANS/CFO/CRO ou com os termos do usuário |
| Notificações | tipo `norma`, com `data.route = /jurisprudencia?doc=<id>` |

## Banco (migração `20261009010000_jurisprudencia.sql`)

`juris_documents` (global, só o service role escreve; FTS português sem acento via `f_unaccent`),
`juris_user_reviews`, `juris_user_searches`, `juris_user_pins`, `juris_user_norma_alertas` (privadas, com
auto-fill de `office_id` e `office_paid_gate`). Funções: `juris_search(...)`, `juris_same_process(doc_id)`,
`juris_notify_normas(doc_ids[])` (security definer, só service role).

## Pôr no ar (uma vez)

Projeto de produção: `pvesofbrctfipdyqyloq` (conta nova). As funções são publicadas pelo workflow
`deploy-functions.yml` a cada push em `main`; o segredo da sincronização pode ficar no env `JURIS_SYNC_SECRET`
ou na tabela `juris_sync_config` (chave `sync_secret`), que só o service role lê.


1. **Migração**: rodar o SQL no SQL Editor do projeto do Hub (conta contato@) ou `supabase db push` logado nessa conta.
2. **Função `juris-sync`**: `supabase functions deploy juris-sync` e definir o segredo
   `supabase secrets set JURIS_SYNC_SECRET=<valor longo e aleatório>`.
3. **Função `ai-advisor`**: `supabase functions deploy ai-advisor` (ganhou a ferramenta e o modo novos).
4. **No kit**: criar `config/vextriahub.sync` (linha 1 = URL do Supabase do Hub, linha 2 = o mesmo segredo) e rodar
   `8-sincronizar-vextriahub-windows.bat`. A primeira carga envia tudo (~34 mil registros, lotes de 200);
   as seguintes só o que mudou.
5. Front: publica pelo fluxo normal (push → GitHub Actions → Oracle/Caddy).

## Cautelas já documentadas

- Termos de uso das fontes (DataJud: uso não comercial; STJ: CC-BY com atribuição) pedem parecer antes de
  oferecer o acervo como funcionalidade paga a terceiros.
- O cadastro no INLABS é pessoal: a coleta do DOU fica centralizada (conta da Vextria), só o resultado é distribuído.
- `types.ts` não foi regenerado (depende da conta contato@); os hooks usam `supabase as any` como o resto do código.

## Plano gratuito do Supabase (500 MB): acervo enxuto

Medido em 09/10/2026 com 87,9 mil registros: 645 MB, dos quais ~220 MB eram a coluna `fts` (tsvector
armazenado), 118 MB ementas, 70 MB metadados dos espelhos e 40 MB do texto do dispositivo. Para caber no
plano gratuito:

- Espelhos do STJ sobem **sem** o texto do dispositivo e só com metadados úteis (numeroRegistro,
  registro_formatado, scon_busca, siglaClasse, tema, teseJuridica, tipoDeDecisao, referenciasLegislativas).
  O kit (`sync/vextriahub_push.py`) já envia assim; o inteiro teor fica no kit e na fonte `stj_integras`.
- A coluna `fts` saiu; a busca usa o índice GIN de expressão `idx_juris_documents_fts_expr`
  (função `juris_fts_expr`) e ranqueia só os 3.000 acertos mais recentes com vetor leve (título + ementa).
- Depois de enxugar, é preciso `vacuum full public.juris_documents;` no SQL Editor (não roda pelo conector).
- Crescimento: ~2,5 KB por espelho enxuto; ~15 a 20 MB por mês com todas as turmas do STJ.

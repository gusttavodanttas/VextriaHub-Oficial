-- pg_net catalogado em `public` (achado do advisor "Extension in Public").
-- pg_net 0.20.3 não suporta ALTER EXTENSION ... SET SCHEMA (não é
-- relocatable), então o único caminho é derrubar e recriar. As funções
-- net.http_post/http_get/http_delete usadas pelos 8 crons SEMPRE moram no
-- schema `net` (fixo pelo próprio script de instalação da extensão),
-- independente de onde a extensão fica catalogada — o `SCHEMA extensions`
-- abaixo só move o catálogo da extensão, não afeta as chamadas net.http_post
-- já existentes nas migrations dos robôs.
drop extension if exists pg_net;
create extension if not exists pg_net schema extensions;

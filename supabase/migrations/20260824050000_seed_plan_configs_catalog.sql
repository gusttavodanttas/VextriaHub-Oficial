-- Seed do catálogo de planos (fecha o gap de DR: as linhas existem em produção mas não
-- estavam em nenhuma migration → um rebuild do zero nasceria sem planos e o /pagamento
-- ficaria vazio). Idempotente e NÃO-destrutivo: só insere plan_types que ainda não existem
-- (preserva o que já está lá e planos customizados criados pela tela de Gestão de Planos).
-- Catálogo: 4 tiers (Básico/Intermediário/Avançado/Premium) × 3 ciclos; semestral=5×, anual=10×.
insert into public.plan_configs (plan_type, plan_name, price_cents, cycle, trial_days, signup_only, max_oabs, features, is_active)
select v.plan_type, v.plan_name, v.price_cents, v.cycle, v.trial_days, v.signup_only, v.max_oabs, v.features::jsonb, v.is_active
from (values
  ('BASIC','Básico Mensal',4700,'MONTHLY',0,false,1,'["Painel de processos","Gestão de prazos","Cadastro de clientes","1 usuário","até 30 processos"]',true),
  ('BASIC_SEMESTRAL','Básico Semestral',23500,'SEMIANNUALLY',7,false,1,'["Painel de processos","Gestão de prazos","Cadastro de clientes","1 usuário","até 30 processos"]',true),
  ('BASIC_ANUAL','Básico Anual',47000,'YEARLY',7,false,1,'["Painel de processos","Gestão de prazos","Cadastro de clientes","1 usuário","até 30 processos"]',true),
  ('PRO','Intermediário Mensal',9700,'MONTHLY',7,false,3,'["Tudo do Básico","Múltiplos usuários","Relatórios básicos","até 3 usuários","até 100 processos"]',true),
  ('PRO_SEMESTRAL','Intermediário Semestral',48500,'SEMIANNUALLY',7,false,3,'["Tudo do Básico","Múltiplos usuários","Relatórios básicos","até 3 usuários","até 100 processos"]',true),
  ('PRO_ANUAL','Intermediário Anual',97000,'YEARLY',7,false,3,'["Tudo do Básico","Múltiplos usuários","Relatórios básicos","até 3 usuários","até 100 processos"]',true),
  ('ENTERPRISE','Avançado Mensal',19700,'MONTHLY',7,false,5,'["Tudo do Intermediário","Módulo financeiro completo","Relatórios avançados","até 5 usuários","até 300 processos"]',true),
  ('ENTERPRISE_SEMESTRAL','Avançado Semestral',98500,'SEMIANNUALLY',7,false,5,'["Tudo do Intermediário","Módulo financeiro completo","Relatórios avançados","até 5 usuários","até 300 processos"]',true),
  ('ENTERPRISE_ANUAL','Avançado Anual',197000,'YEARLY',7,false,5,'["Tudo do Intermediário","Módulo financeiro completo","Relatórios avançados","até 5 usuários","até 300 processos"]',true),
  ('PREMIUM','Premium Mensal',39700,'MONTHLY',7,false,10,'["Tudo do Avançado","Módulo de metas","IA","Suporte VIP","até 10 usuários","processos ilimitados"]',true),
  ('PREMIUM_SEMESTRAL','Premium Semestral',198500,'SEMIANNUALLY',7,false,10,'["Tudo do Avançado","Módulo de metas","IA","Suporte VIP","até 10 usuários","processos ilimitados"]',true),
  ('PREMIUM_ANUAL','Premium Anual',397000,'YEARLY',7,false,10,'["Tudo do Avançado","Módulo de metas","IA","Suporte VIP","até 10 usuários","processos ilimitados"]',true),
  -- Plano especial escondido do checkout (só via link de indicação ?plano=PREMIUM_TRIAL30): 30 dias de Premium.
  ('PREMIUM_TRIAL30','Premium',39700,'MONTHLY',30,true,10,'["Tudo do Avançado","Módulo de metas","IA","Suporte VIP","até 10 usuários","processos ilimitados"]',true)
) as v(plan_type, plan_name, price_cents, cycle, trial_days, signup_only, max_oabs, features, is_active)
where not exists (select 1 from public.plan_configs pc where pc.plan_type = v.plan_type);

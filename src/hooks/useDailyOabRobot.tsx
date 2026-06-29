import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { runOabDiscovery } from "@/lib/oabDiscovery";

const INTERVALO_MS = 20 * 60 * 60 * 1000; // ~1x por dia

/**
 * Robô diário: roda a busca nacional pela OAB do usuário (1x/dia) e enche a
 * caixa "Processos Encontrados". Roda em segundo plano quando o app é aberto.
 */
export function useDailyOabRobot() {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const oab = (profile as any)?.oab;
    const uf = (profile as any)?.oab_uf;
    const officeId = user?.office_id;
    if (!oab || !uf || !officeId || !user?.id) return;

    const key = `oab_robot_last_${user.id}`;
    const last = Number(localStorage.getItem(key) || 0);
    if (Date.now() - last < INTERVALO_MS) return;

    // marca já para não disparar duas vezes na mesma sessão
    localStorage.setItem(key, String(Date.now()));

    const t = setTimeout(() => {
      runOabDiscovery({ oab, uf, officeId, userId: user.id, nacional: true })
        .then((novos) => {
          if (novos > 0) {
            toast({
              title: "🤖 Robô de processos",
              description: `${novos} novo(s) processo(s) encontrado(s) pela sua OAB. Veja em Processos → Encontrados.`,
            });
          }
        })
        .catch(() => {
          // falhou: libera para tentar de novo na próxima abertura
          localStorage.removeItem(key);
        });
    }, 5000); // espera o app assentar

    return () => clearTimeout(t);
  }, [user?.id, user?.office_id, (profile as any)?.oab, (profile as any)?.oab_uf]);
}

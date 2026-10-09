import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import Metas from "@/pages/Metas";
import { MetasUpsell } from "./MetasUpsell";

/**
 * Rota /metas: plano sem o módulo vê a tela de upsell; com o módulo, a
 * página normal (que já trata a permissão por papel com PermissionGuard).
 */
export default function MetasGate() {
  const { hasGoalsModule } = usePlanFeatures();
  return hasGoalsModule ? <Metas /> : <MetasUpsell />;
}

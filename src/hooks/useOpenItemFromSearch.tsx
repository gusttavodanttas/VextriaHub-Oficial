import { useEffect } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";

/**
 * Lê o parâmetro ?openId=... (gerado pela busca global) e leva o usuário
 * direto ao item: rola até o elemento com id `item-<openId>` e aplica um
 * destaque temporário. Opcionalmente executa um callback (ex.: abrir modal de
 * detalhe) quando o item é encontrado nos dados carregados.
 *
 * @param basePath   rota da página (ex.: "/tarefas") — usada para limpar o param
 * @param ready      true quando os dados da lista já carregaram
 * @param onFound    callback opcional chamado com o openId quando ready
 */
export function useOpenItemFromSearch(
  basePath: string,
  ready: boolean,
  onFound?: (openId: string) => void,
) {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const openId = searchParams.get("openId");
    if (!openId || !ready) return;

    // Deixa a lista renderizar antes de procurar o elemento
    const t = setTimeout(() => {
      const el = document.getElementById(`item-${openId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("search-highlight");
        setTimeout(() => el.classList.remove("search-highlight"), 2400);
      }
      onFound?.(openId);
      navigate(basePath, { replace: true });
    }, 250);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, ready]);
}

import { useEffect, useRef } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";

/**
 * Lê o parâmetro ?openId=... (gerado pela busca global ou pelos cards do
 * processo) e leva o usuário direto ao item: rola até o elemento com id
 * `item-<openId>`, aplica um destaque temporário e, opcionalmente, executa um
 * callback (ex.: abrir o modal de edição) quando o item é encontrado.
 *
 * O item pode ainda não estar na lista no primeiro instante (o cache do React
 * Query pode estar sendo revalidado após o item ter sido criado em outra tela).
 * Por isso tentamos algumas vezes ao longo de ~4s, sempre chamando a versão
 * mais recente do callback (via ref, evitando closure defasada), e só limpamos
 * o parâmetro quando o item é tratado ou o tempo esgota.
 *
 * @param basePath   rota da página (ex.: "/tarefas") — usada para limpar o param
 * @param ready      true quando os dados da lista já carregaram
 * @param onFound    callback opcional; retorne `true` quando tiver tratado o item
 */
export function useOpenItemFromSearch(
  basePath: string,
  ready: boolean,
  onFound?: (openId: string) => boolean | void,
) {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Mantém sempre o callback mais recente (com os dados atuais da lista)
  const onFoundRef = useRef(onFound);
  useEffect(() => { onFoundRef.current = onFound; });

  useEffect(() => {
    const openId = searchParams.get("openId");
    if (!openId || !ready) return;

    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 14; // ~4s (300ms * 14)
    let timer: ReturnType<typeof setTimeout>;

    const tryOpen = () => {
      if (cancelled) return;
      attempts++;

      const el = document.getElementById(`item-${openId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("search-highlight");
        setTimeout(() => el.classList.remove("search-highlight"), 2400);
      }

      // handled = callback tratou (retornou true) OU, sem callback, o elemento existe
      const handled = onFoundRef.current ? onFoundRef.current(openId) === true : !!el;

      if (handled || attempts >= MAX_ATTEMPTS) {
        navigate(basePath, { replace: true });
        return;
      }
      timer = setTimeout(tryOpen, 300);
    };

    // Deixa a lista renderizar antes da primeira tentativa
    timer = setTimeout(tryOpen, 250);

    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, ready]);
}

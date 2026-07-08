// Após um novo deploy, abas antigas apontam para chunks JS com hashes que não
// existem mais (404). Qualquer navegação que faça import dinâmico (React.lazy)
// quebra com "Failed to fetch dynamically imported module".
// A cura é recarregar a página uma única vez para buscar o index.html novo.

const CHUNK_ERROR_RE =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk \d+ failed|ChunkLoadError/i;

export function isChunkLoadError(message?: string | null): boolean {
  return !!message && CHUNK_ERROR_RE.test(message);
}

/** Recarrega a página se o erro for de chunk ausente. Protegido contra loop. */
export function reloadOnceForChunkError(message?: string | null): boolean {
  if (!isChunkLoadError(message)) return false;
  const KEY = 'chunk-reload-ts';
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    // só recarrega se não recarregou nos últimos 10s (evita loop infinito)
    if (Date.now() - last <= 10_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* sessionStorage indisponível — segue e recarrega mesmo assim */
  }
  window.location.reload();
  return true;
}

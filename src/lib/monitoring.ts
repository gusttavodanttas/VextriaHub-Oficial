/**
 * Monitoramento de erros (Sentry).
 * Ativa em produção com o DSN padrão (ou VITE_SENTRY_DSN se definido).
 * Em desenvolvimento, fica desativado a menos que VITE_SENTRY_DSN seja informado.
 *
 * O SDK (~265 kB) é carregado por `import()` depois do primeiro render: antes ele
 * entrava estático no entry e era pré-carregado em toda página, inclusive no login.
 * O que acontecer antes do SDK chegar fica numa fila e é enviado em seguida.
 */

type SentrySdk = typeof import("@sentry/react");

// DSN do projeto Sentry (chave pública, segura no client).
const DEFAULT_DSN = "https://0fb3ff25a1385243709b7bae44fa4b65@o4511643111522304.ingest.us.sentry.io/4511643132297216";

let sdk: SentrySdk | null = null;
let usuarioPendente: { id?: string; email?: string } | null | undefined;
const errosPendentes: Array<{ error: unknown; context?: Record<string, unknown> }> = [];
const MAX_FILA = 20;

export function initMonitoring() {
  const dsn = (import.meta.env.VITE_SENTRY_DSN as string | undefined)?.trim()
    || (import.meta.env.PROD ? DEFAULT_DSN : undefined);
  if (!dsn) return; // sem DSN → desativado (ex.: localhost)

  import("@sentry/react").then((Sentry) => {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      // Amostragem de performance (10% das transações) para não estourar cota
      tracesSampleRate: 0.1,
      // Replay de sessão só em erros (0% normal, 100% quando há erro)
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
      ],
      // Ignora ruídos comuns que não são bugs acionáveis
      ignoreErrors: [
        "ResizeObserver loop limit exceeded",
        "Non-Error promise rejection captured",
        "Failed to fetch",
        "NetworkError",
        "AbortError",
      ],
    });
    sdk = Sentry;
    if (usuarioPendente !== undefined) setMonitoringUser(usuarioPendente);
    for (const e of errosPendentes.splice(0)) captureError(e.error, e.context);
  }).catch((e) => {
    // Bloqueador de conteúdo ou rede: segue sem monitoramento, como em dev.
    console.error("[monitoring] Sentry não carregou:", e);
  });
}

/** Identifica o usuário logado nos eventos (ajuda a rastrear quem teve o erro). */
export function setMonitoringUser(user: { id?: string; email?: string } | null) {
  if (!sdk) { usuarioPendente = user; return; }
  if (user?.id) sdk.setUser({ id: user.id, email: user.email });
  else sdk.setUser(null);
}

/** Captura um erro manualmente (ex.: dentro de catch). */
export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (!sdk) {
    console.error("[erro]", error, context);
    // Só vale guardar se o SDK ainda vai chegar (em dev sem DSN nunca chega — a fila
    // tem teto para não crescer indefinidamente nesse caso).
    if (errosPendentes.length < MAX_FILA) errosPendentes.push({ error, context });
    return;
  }
  sdk.captureException(error, context ? { extra: context } : undefined);
}

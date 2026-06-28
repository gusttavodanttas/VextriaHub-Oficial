import * as Sentry from "@sentry/react";

/**
 * Monitoramento de erros (Sentry).
 * Ativa em produção com o DSN padrão (ou VITE_SENTRY_DSN se definido).
 * Em desenvolvimento, fica desativado a menos que VITE_SENTRY_DSN seja informado.
 */

// DSN do projeto Sentry (chave pública, segura no client).
const DEFAULT_DSN = "https://0fb3ff25a1385243709b7bae44fa4b65@o4511643111522304.ingest.us.sentry.io/4511643132297216";

let enabled = false;

export function initMonitoring() {
  const dsn = (import.meta.env.VITE_SENTRY_DSN as string | undefined)
    || (import.meta.env.PROD ? DEFAULT_DSN : undefined);
  if (!dsn) return; // sem DSN → desativado (ex.: localhost)

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
  enabled = true;
}

/** Identifica o usuário logado nos eventos (ajuda a rastrear quem teve o erro). */
export function setMonitoringUser(user: { id?: string; email?: string } | null) {
  if (!enabled) return;
  if (user?.id) Sentry.setUser({ id: user.id, email: user.email });
  else Sentry.setUser(null);
}

/** Captura um erro manualmente (ex.: dentro de catch). */
export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (!enabled) {
    console.error("[erro]", error, context);
    return;
  }
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

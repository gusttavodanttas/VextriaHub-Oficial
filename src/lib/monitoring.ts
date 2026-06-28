import * as Sentry from "@sentry/react";

/**
 * Inicializa o monitoramento de erros (Sentry).
 * Só ativa quando há DSN configurado (VITE_SENTRY_DSN) — ou seja, em produção.
 * Em desenvolvimento/sem DSN, não faz nada (no-op), sem quebrar nada.
 */
export function initMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return; // sem DSN → desativado

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
}

/** Identifica o usuário logado nos eventos (ajuda a rastrear quem teve o erro). */
export function setMonitoringUser(user: { id?: string; email?: string } | null) {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  if (user?.id) Sentry.setUser({ id: user.id, email: user.email });
  else Sentry.setUser(null);
}

/** Captura um erro manualmente (ex.: dentro de catch). */
export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (!import.meta.env.VITE_SENTRY_DSN) {
    console.error("[erro]", error, context);
    return;
  }
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

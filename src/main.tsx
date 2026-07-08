import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initMonitoring } from './lib/monitoring'
import { reloadOnceForChunkError } from './lib/chunkReload'

initMonitoring();

// Aplica a cor primária personalizada do escritório (se houver) antes do render
try {
  const brand = localStorage.getItem("brand_primary_hsl");
  if (brand) document.documentElement.style.setProperty("--primary", brand);
} catch { /* ignore */ }

// Abas antigas após um deploy pedem chunks que não existem mais (404).
// Estes listeners cobrem os casos fora do React; o caso do React.lazy é tratado
// no ErrorBoundary, porque o React captura a rejeição e não deixa ela vazar aqui.
window.addEventListener("vite:preloadError", () => reloadOnceForChunkError("Failed to fetch dynamically imported module"));
window.addEventListener("error", (e) => reloadOnceForChunkError(e?.message));
window.addEventListener("unhandledrejection", (e) => reloadOnceForChunkError((e?.reason && (e.reason.message || String(e.reason))) || ""));

createRoot(document.getElementById("root")!).render(<App />);

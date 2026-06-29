import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initMonitoring } from './lib/monitoring'

initMonitoring();

// Aplica a cor primária personalizada do escritório (se houver) antes do render
try {
  const brand = localStorage.getItem("brand_primary_hsl");
  if (brand) document.documentElement.style.setProperty("--primary", brand);
} catch { /* ignore */ }

// Após um novo deploy, abas antigas tentam buscar chunks com nomes antigos (404).
// Recarrega automaticamente uma única vez para pegar a versão nova.
function handleChunkError(message?: string) {
  if (!message) return;
  const isChunkError =
    /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message);
  if (!isChunkError) return;
  const KEY = "chunk-reload-ts";
  const last = Number(sessionStorage.getItem(KEY) || 0);
  // evita loop: só recarrega se não recarregou nos últimos 10s
  if (Date.now() - last > 10_000) {
    sessionStorage.setItem(KEY, String(Date.now()));
    window.location.reload();
  }
}

window.addEventListener("vite:preloadError", () => handleChunkError("Failed to fetch dynamically imported module"));
window.addEventListener("error", (e) => handleChunkError(e?.message));
window.addEventListener("unhandledrejection", (e) => handleChunkError((e?.reason && (e.reason.message || String(e.reason))) || ""));

createRoot(document.getElementById("root")!).render(<App />);

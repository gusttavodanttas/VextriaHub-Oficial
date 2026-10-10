/// <reference types="vitest" />
import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      port: 8080,
    },
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    __WS_TOKEN__: JSON.stringify(process.env.WS_TOKEN || ''),
  },
  // Remove console.log/info/debug no build de produção (mantém warn/error e os logs no dev)
  esbuild: {
    pure: mode === 'production' ? ['console.log', 'console.info', 'console.debug'] : [],
  },
  build: {
    rollupOptions: {
      output: {
        // Separa libs pesadas em chunks próprios (cacheáveis entre deploys).
        // Função, não objeto: a forma `{ charts: ["recharts"] }` arrastava para o chunk
        // as dependências do recharts (lodash, react-is…) e, como o entry também usa um
        // pedaço delas, o chunk de 420 kB era pré-carregado em TODA página — login
        // incluído. Agora só o próprio pacote entra no chunk, e ele só carrega nas
        // páginas com gráfico (Dashboard, Gráficos).
        manualChunks: (id: string) => {
          // Helpers de interop CommonJS do Rollup (\0commonjsHelpers.js): sem regra iam
          // parar no primeiro chunk em ordem alfabética ("charts"), e todo chunk que usa
          // uma lib CJS passava a importar o charts só por causa disso.
          if (id.includes("commonjsHelpers")) return "react-vendor";
          if (!id.includes("node_modules")) return undefined;
          // clsx & cia. entram aqui porque o app E o recharts os usam: deixados soltos, o
          // Rollup os colocava no chunk charts e o entry importava o charts só pelo clsx.
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|react-is|prop-types|clsx|tailwind-merge|class-variance-authority)\//.test(id)) return "react-vendor";
          if (/node_modules\/(recharts|recharts-scale|react-smooth|victory-vendor|d3-[a-z-]+)\//.test(id)) return "charts";
          if (id.includes("node_modules/@supabase/")) return "supabase";
          if (id.includes("node_modules/@tanstack/")) return "data";
          if (id.includes("node_modules/date-fns/")) return "datefns";
          if (id.includes("node_modules/@sentry/")) return "sentry";
          return undefined;
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    // Specs do Playwright (e2e/) não são do vitest.
    exclude: [...configDefaults.exclude, 'e2e/**'],
    // 5s (default) piscava vermelho no CI (2 núcleos): o NovaAudienciaDialog "abre
    // PREENCHIDO" estourava por CARGA, não por asserção. 15s dá folga sem mascarar
    // bug real (teste travado de verdade ainda falha). (v12)
    testTimeout: 15000,
    hookTimeout: 15000,
  },
}));

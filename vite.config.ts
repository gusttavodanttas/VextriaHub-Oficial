/// <reference types="vitest" />
import { defineConfig } from "vite";
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
        // Separa libs pesadas em chunks próprios (cacheáveis entre deploys)
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "charts": ["recharts"],
          "supabase": ["@supabase/supabase-js"],
          "data": ["@tanstack/react-query"],
          "datefns": ["date-fns"],
          "sentry": ["@sentry/react"],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
  },
}));

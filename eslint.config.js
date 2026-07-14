import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": "off",
      // Alvo de redução gradual (item 2 da auditoria): os `any` explícitos viram
      // AVISO, não erro — visível e rastreável (`npm run lint`) sem travar o build.
      // Zerar aos poucos; muitos hoje são legítimos (JSONB do PJE, payloads dinâmicos).
      "@typescript-eslint/no-explicit-any": "warn",
    },
  }
);

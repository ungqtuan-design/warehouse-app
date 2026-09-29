import { defineConfig, globalIgnores } from "eslint/config";
import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "node:url";

// Next 15 ships legacy configs; adapt them to ESLint 9's flat config.
const compat = new FlatCompat({ baseDirectory: fileURLToPath(new URL(".", import.meta.url)) });

const eslintConfig = defineConfig([
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // Node's existing test harness uses CommonJS; keep all other rules enabled.
  { files: ["tests/**/*.test.cjs"], rules: { "@typescript-eslint/no-require-imports": "off" } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

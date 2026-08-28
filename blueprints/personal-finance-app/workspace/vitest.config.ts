import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Only src/app/** and src/components/** use the "@/" alias, and no test
    // imports those. The alias is declared anyway so a future component test
    // resolves the same way Next.js does.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globals: false,
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    // "blueprints/**" keeps the design bundle that lives inside this project
    // out of the run: it ships a copy of this very config under
    // blueprints/personal-finance-app/workspace/.
    exclude: [
      "**/node_modules/**",
      "**/blueprints/**",
      "**/.next/**",
      "tests/e2e/**",
    ],
    setupFiles: ["tests/setup.ts"],
    // Integration tests share one Postgres database. Running files in
    // parallel makes them truncate each other's rows.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});

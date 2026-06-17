import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Integration tests that need the local Supabase stack live under tests/integration
    // and are run with `pnpm test:integration`.
    exclude: ["tests/integration/**", "node_modules/**"],
  },
});

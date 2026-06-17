import { defineConfig } from "vitest/config";

// Integration tests hit the running dev server + local Supabase.
// Run with: pnpm db:start && pnpm dev (in another shell), then pnpm test:integration
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});

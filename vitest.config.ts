import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    include: ["app/**/*.test.ts"],
    coverage: { provider: "v8", reporter: ["text", "lcov"] },
  },
});

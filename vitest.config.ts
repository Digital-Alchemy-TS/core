import "vitest/config";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["html", "lcov", "clover"],
    },
  },
});

import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

const testDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    root: testDir,
    environment: "node",
    setupFiles: [path.join(testDir, "setup.ts")],
    include: ["**/*.test.ts"]
  }
});

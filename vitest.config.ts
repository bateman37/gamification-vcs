import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    hookTimeout: 30000,
    testTimeout: 30000,
    // Varios ficheros de prueba comparten una misma base de datos real
    // (sin mocks) y cada uno reinicia su contenido en `beforeEach`:
    // ejecutarlos en paralelo provocaria condiciones de carrera entre
    // ficheros.
    fileParallelism: false,
  },
});

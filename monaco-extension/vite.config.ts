import { defineConfig } from "vite";
// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      "node:path": "/src/lightPath.ts",
    },
  },
  worker: {
    format: "es",
  },
  build: {
    target: "esnext",
  },
  plugins: [],
});

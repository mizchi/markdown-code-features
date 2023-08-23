import {defineConfig} from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.mts',
      name: 'vite-ts-checker',
      fileName: 'index',
      formats: ['es', 'cjs'],
      // formats: ['es'],
    },
    rollupOptions: {
      external: ['typescript', 'node:util', 'node:path', 'node:process', 'node:fs'],
    }
  }
});
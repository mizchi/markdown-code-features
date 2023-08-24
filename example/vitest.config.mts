import { defineConfig } from 'vitest/config'
import { markdownRunner } from "@mizchi/mdcf-core/rollup";

export default defineConfig({
  plugins: [
    markdownRunner(),
  ],
  test: {
    include: ["src/**/*.test.ts", "spec/**/*.md", "spec/**/*.mdx"],
  }
})
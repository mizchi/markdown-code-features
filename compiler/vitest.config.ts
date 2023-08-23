// import {defineConfig} from "vite";
import { defineConfig } from 'vitest/config'
import { markdownRunner } from "./src/rollup";
import path from 'path';
import ts from 'typescript';

export default defineConfig({
  plugins: [
    markdownRunner(),
  ],
  test: {
    include: ["src/**/*.test.ts", "spec/**/*.md", "spec/**/*.mdx"],
  }
})
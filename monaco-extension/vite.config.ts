import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import monacoEditorPlugin from "vite-plugin-monaco-editor";

// console.log(monacoEditorPlugin);

const prefix = `monaco-editor/esm/vs`;
// https://vitejs.dev/config/
export default defineConfig({
  optimizeDeps: {
    include: [
      `monaco-editor/esm/vs/language/json/json.worker`,
      `monaco-editor/esm/vs/language/css/css.worker.js`,
      `monaco-editor/esm/vs/language/html/html.worker.js`,
      `monaco-editor/esm/vs/language/typescript/ts.worker.js`,
      `monaco-editor/esm/vs/editor/editor.worker?worker`,
    ],
  },
  plugins: [
    // react(),
    // ((monacoEditorPlugin as any).default as typeof monacoEditorPlugin)({
    // globalAPI: true,
    // customWorkers: [
    //   {
    //     label: "editorWorkerService",
    //     entry: "monaco-editor/esm/vs/editor/editor.worker.js",
    //   },
    //   {
    //     label: "json",
    //     entry: "monaco-editor/esm/vs/language/json/json.worker",
    //   },
    //   {
    //     label: "typescript",
    //     entry: "monaco-editor/esm/vs/language/typescript/ts.worker",
    //   },
    //   {
    //     label: "css",
    //     entry: "monaco-editor/esm/vs/language/css/css.worker",
    //   },
    //   {
    //     label: "html",
    //     entry: "monaco-editor/esm/vs/language/html/html.worker",
    //   },
    // ],
    // languageWorkers: [
    //   "css",
    //   "html",
    //   "json",
    //   "typescript",
    //   "editorWorkerService",
    // ],
    // }),
  ],
});

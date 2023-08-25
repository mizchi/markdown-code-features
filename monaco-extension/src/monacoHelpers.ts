// import "monaco-editor/esm/vs/editor/editor.all.js";
// import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import * as monaco from "monaco-editor";
// import "monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution.js";
// import "monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution.js";
// import "monaco-editor/esm/vs/basic-languages/css/css.contribution.js";
// import "monaco-editor/esm/vs/basic-languages/html/html.contribution.js";
// import "monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution.js";

self.MonacoEnvironment = {
  getWorker(_workerId: any, label: string) {
    // console.log("[getWorker]", _workerId, label);
    switch (label) {
      case "json": {
        return new Worker(
          new URL(
            "monaco-editor/esm/vs/language/json/json.worker.js",
            import.meta.url,
          ),
          {
            type: "module",
          },
        );
      }
      case "css": {
        return new Worker(
          new URL(
            "monaco-editor/esm/vs/language/css/css.worker.js",
            import.meta.url,
          ),
          {
            type: "module",
          },
        );
      }
      case "html": {
        return new Worker(
          new URL(
            "monaco-editor/esm/vs/language/html/html.worker.js",
            import.meta.url,
          ),
          {
            type: "module",
          },
        );
      }
      case "typescript":
      case "javascript": {
        return new Worker(
          new URL(
            "monaco-editor/esm/vs/language/typescript/ts.worker.js",
            import.meta.url,
          ),
          {
            type: "module",
          },
        );
      }
      default: {
        return new Worker(
          new URL(
            "monaco-editor/esm/vs/editor/editor.worker.js",
            import.meta.url,
          ),
          {
            type: "module",
          },
        );
      }
    }
  },
};

// monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
//   target: monaco.languages.typescript.ScriptTarget.ESNext,
//   allowNonTsExtensions: true,
//   moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
//   module: monaco.languages.typescript.ModuleKind.ESNext,
// });
// monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
//   noSemanticValidation: false,
//   noSyntaxValidation: false,
// });

monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);

export { monaco };

// @ts-ignore
window._monaco = monaco;

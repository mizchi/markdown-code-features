import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { monaco } from "../monacoHelpers";
import { extractCodeBlocks, getVirtualFileName } from "@mizchi/mdcf-core";

const code = `
\`\`\`ts
let n: number = "";
function hello() {
  console.log("Hello, world!");
}

hell();
\`\`\`
`;

function useEditor() {
  const ref = useRef<HTMLDivElement>(null);
  const [activeEditor, setActiveEditor] =
    useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const randomId = Math.random().toString(36).slice(2);
    const model = monaco.editor.createModel(
      code,
      "markdown",
      monaco.Uri.parse(`file:///${randomId}.ts`),
    );
    if (ref.current.innerHTML !== "") return;
    const editor = monaco.editor.create(ref.current, {
      model,
      theme: "vs-dark",
      fontSize: 16,
      minimap: {
        enabled: false,
      },
      readOnly: true,
    });
    model.updateOptions({ tabSize: 2, insertSpaces: true });
    setActiveEditor(editor);
  }, [ref, setActiveEditor]);
  return { ref, activeEditor };
}

function useModel(
  editor: monaco.editor.IStandaloneCodeEditor | null,
  options: {
    fileName: string;
    initialCode: string;
  },
) {
  const [model, setModel] = useState<monaco.editor.ITextModel | null>(null);
  useEffect(() => {
    if (!editor) return;
    const model = monaco.editor.createModel(
      options.initialCode,
      "markdown",
      monaco.Uri.parse(`file:///${options.fileName}`),
    );
    setModel(model);
  }, [editor]);
  return model;
}

import ts from "typescript";
import { vfiles } from "../constants";

const compilerOptions: ts.CompilerOptions = {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
  allowJs: true,
  typeRoots: ["node_modules/@types"],
};

const versions: Record<string, number> = {};

function updateVirtualFile(vfileName: string, content: string) {
  vfiles[vfileName] = content;
  versions[vfileName] = (versions[vfileName] ?? 0) + 1;
}

const USE_LSP_LOGS = false;

const host: ts.LanguageServiceHost = {
  getDefaultLibFileName: () => {
    return "/node_modules/typescript/lib/lib.d.ts";
  },
  readFile: (fileName: string) => {
    USE_LSP_LOGS && console.log("[readFile]", fileName);
    return vfiles[fileName];
  },
  fileExists: (fileName) => {
    USE_LSP_LOGS && console.log("[fileExists]", fileName);
    return true;
  },
  getCurrentDirectory: () => {
    return "/";
  },
  getCompilationSettings: () => {
    return compilerOptions;
  },
  getScriptFileNames: () => {
    USE_LSP_LOGS && console.log("[getScriptFileNames]");
    return Object.keys(vfiles);
  },
  getScriptSnapshot: (fileName) => {
    USE_LSP_LOGS && console.log("[getScriptSnapshot]", fileName);
    const content = vfiles[fileName];
    return ts.ScriptSnapshot.fromString(content ?? "");
  },
  getScriptVersion: (fileName) => {
    USE_LSP_LOGS &&
      console.log("[getScriptVersion]", fileName, !!versions[fileName]);
    return versions[fileName] ? versions[fileName].toString() : "0";
  },
};

const service = ts.createLanguageService(host);

export function App() {
  const { ref, activeEditor } = useEditor();
  const model = useModel(activeEditor, {
    fileName: "test.md",
    initialCode: code,
  });
  // resizer
  useEffect(() => {
    if (!ref.current) return;
    if (!activeEditor) return;

    const onResize = () => {
      activeEditor.layout();
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(ref.current);
    window.addEventListener("resize", onResize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [activeEditor, ref]);

  const refresh = useCallback(
    (code: string) => {
      const model = activeEditor?.getModel();
      const blocks = extractCodeBlocks(code);
      const markers: monaco.editor.IMarkerData[] = [];
      for (const block of blocks) {
        if (block.lang === "ts") {
          const vName = getVirtualFileName(block);
          const vfileName = `/root.mdx@${vName}`;
          const vcontent =
            code.slice(0, block.codeRange[0]).replace(/[^\n]/gmu, " ") +
            block.content;
          updateVirtualFile(vfileName, vcontent);
          const diags = service.getSemanticDiagnostics(vfileName);
          if (!model) continue;
          const marker = diags.map((diag) =>
            tsSemanticDiagnosticToMonacoMarker(model, diag),
          );
          markers.push(...marker);
        }
      }
      if (model) {
        monaco.editor.setModelMarkers(model, "mdcf", markers);
      }
    },
    [activeEditor],
  );

  useEffect(() => {
    if (!activeEditor) return;
    let tid: any | null = null;
    const d = activeEditor.onDidChangeModelContent((_ev) => {
      const code = activeEditor.getValue();
      if (tid) clearTimeout(tid);
      tid = setTimeout(() => {
        tid = null;
        refresh(code);
      }, 300);
      // refresh(code);
    });
    return () => {
      d.dispose();
    };
  }, [activeEditor, model]);

  // initial mount
  useEffect(() => {
    if (!activeEditor) return;
    if (!ref.current) return;
    // setTimeout(() => {
    const code = activeEditor.getValue();
    refresh(code);
    activeEditor.layout();
    activeEditor.focus();
    activeEditor.updateOptions({
      readOnly: false,
    });
  }, [activeEditor, ref]);

  return (
    <>
      <div
        ref={ref}
        style={{ width: "100%", height: "100%", overflow: "hidden" }}
      />
    </>
  );
}

function tsSemanticDiagnosticToMonacoMarker(
  model: monaco.editor.ITextModel,
  diag: ts.Diagnostic,
): monaco.editor.IMarkerData {
  const startPos = model.getPositionAt(diag.start!);
  const endPos = model.getPositionAt(diag.start! + diag.length!);
  return {
    severity: monaco.MarkerSeverity.Error,
    message: diag.messageText as string,
    startLineNumber: startPos.lineNumber,
    startColumn: startPos.column,
    endLineNumber: endPos.lineNumber,
    endColumn: endPos.column,
  };
}

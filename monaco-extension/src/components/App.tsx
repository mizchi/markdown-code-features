import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { monaco } from "../monacoHelpers";
import { extractCodeBlocks, getVirtualFileName } from "@mizchi/mdcf-core";
import { rollup } from "@rollup/browser";

const initialCode = `
# Hello mdcf

\`\`\`ts:foo.ts
type Foo = {
  value: number;
};
export const foo: Foo = {
  value: 1
};

let x: number = "";
\`\`\`

## Import

\`\`\`ts
import { foo } from "./root.mdx@foo.ts";
console.log(foo.value);
\`\`\`
`;

const PERSIST_KEY = "@mdcf-content";
const CONFIG_PERSIST_KEY = "@mdcf-content-config";

function useEditor() {
  const ref = useRef<HTMLDivElement>(null);
  const [activeEditor, setActiveEditor] =
    useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    if (ref.current.innerHTML !== "") return;
    const model = monaco.editor.createModel(
      initialCode,
      "markdown",
      monaco.Uri.parse(`file:///root.mdx`),
    );

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
import { getVfiles } from "../constants";
import { markdownRunner } from "../blowserPlugin";
import { Preview } from "./Preview";
// import { markdownRunner } from "@mizchi/mdcf-core/rollup";

const compilerOptions: ts.CompilerOptions = {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  allowJs: true,
  checkJs: true,
  strict: true,
  allowImportingTsExtensions: true,
  noEmit: true,
  typeRoots: ["node_modules/@types"],
  paths: {
    "@*": ["/root.mdx@*"],
  },
};

const versions: Record<string, number> = {};
const vfiles: Record<string, string> = await getVfiles();

function updateVirtualFile(vfileName: string, content: string) {
  vfiles![vfileName] = content;
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
    initialCode,
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
      return blocks;
    },
    [activeEditor],
  );

  const [showPreview, setShowPreview] = useState(false);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  useEffect(() => {
    const onKeydown = async (ev: KeyboardEvent) => {
      // console.log(ev.key, ev.ctrlKey);
      if (ev.key === "1" && ev.ctrlKey) {
        setShowPreview((prev) => !prev);
        // const config = {
        //   showPreview: showPreview,
        // };
        // localStorage.setItem(CONFIG_PERSIST_KEY, JSON.stringify(config));
      }
      // console.log(ev.key, ev.ctrlKey);
      if (ev.key.toLowerCase() === "r" && ev.ctrlKey) {
        // const code = activeEditor?.getValue();
        const bundle = await rollup({
          input: "/root.mdx",
          plugins: [
            {
              name: "memory-loader",
              resolveId(id) {
                if (id === "/root.mdx") return id;
              },
            },
            markdownRunner({
              entryCode: activeEditor?.getValue() ?? "",
              fileName: "/root.mdx",
            }),
          ],
        });
        // .then(async (bundle) => {
        const generated = await bundle.generate({
          format: "es",
        });
        console.log(generated.output[0].code);
        setPreviewCode(generated.output[0].code);
        // console.log("[bundle]", generated.output[0].code);
        // })
        // setShowPreview((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeydown);
    return () => {
      window.removeEventListener("keydown", onKeydown);
    };
  }, [showPreview, setShowPreview, activeEditor, previewCode, setPreviewCode]);

  useEffect(() => {
    if (!activeEditor) return;
    let tid: any | null = null;
    let stid: any | null = null;

    // on change
    const d1 = activeEditor.onDidChangeModelContent((_ev) => {
      const code = activeEditor.getValue();
      if (tid) clearTimeout(tid);
      tid = setTimeout(() => {
        tid = null;
        refresh(code);
      }, 300);
      // refresh(code);
    });

    const d2 = activeEditor.onDidChangeModelContent((_ev) => {
      const code = activeEditor.getValue();
      if (stid) clearTimeout(stid);
      stid = setTimeout(() => {
        console.log("[save!]", code.length);
        localStorage.setItem(PERSIST_KEY, code);
        stid = null;
        // refresh(code);
      }, 1500);
      // refresh(code);
    });

    const d3 = monaco.languages.registerCompletionItemProvider("markdown", {
      triggerCharacters: ["."],
      // https://github.com/microsoft/monaco-editor/blob/38e1e3d097f84e336c311d071a9ffb5191d4ffd1/src/language/typescript/languageFeatures.ts#L440
      provideCompletionItems(model, position) {
        const offset = model.getOffsetAt(position);
        const content = model.getValue();

        const wordInfo = model.getWordUntilPosition(position);
        const wordRange = new monaco.Range(
          position.lineNumber,
          wordInfo.startColumn,
          position.lineNumber,
          wordInfo.endColumn,
        );
        const blocks = extractCodeBlocks(model.getValue());
        // vfiles["/root.mdx"] = model.getValue();
        for (const block of blocks) {
          if (block.lang === "ts") {
            const vName = getVirtualFileName(block);
            const vfileName = `/root.mdx@${vName}`;
            const vcontent =
              content.slice(0, block.codeRange[0]).replace(/[^\n]/gmu, " ") +
              block.content;
            updateVirtualFile(vfileName, vcontent);
          }
        }
        const block = blocks.find((b) => {
          return (
            b.lang === "ts" &&
            b.codeRange[0] <= offset &&
            offset <= b.codeRange[1]
          );
        });
        if (!block) return;

        const info = service.getCompletionsAtPosition(
          "/root.mdx@" + getVirtualFileName(block),
          offset,
          undefined,
          undefined,
        );
        if (!info) return;
        const suggestions = info.entries.map((entry) => {
          let range = wordRange;
          if (entry.replacementSpan) {
            const p1 = model.getPositionAt(entry.replacementSpan.start);
            const p2 = model.getPositionAt(
              entry.replacementSpan.start + entry.replacementSpan.length,
            );
            range = new monaco.Range(
              p1.lineNumber,
              p1.column,
              p2.lineNumber,
              p2.column,
            );
          }

          const tags: monaco.languages.CompletionItemTag[] = [];
          if (
            entry.kindModifiers !== undefined &&
            entry.kindModifiers.indexOf("deprecated") !== -1
          ) {
            tags.push(monaco.languages.CompletionItemTag.Deprecated);
          }

          return {
            // uri: resource,
            position: position,
            offset: offset,
            range: range,
            label: entry.name,
            insertText: entry.name,
            sortText: entry.sortText,
            kind: convertKind(entry.kind),
            tags,
          };
        });
        return {
          suggestions,
          incomplete: info.isIncomplete,
        };
      },
    });

    return () => {
      d1.dispose();
      d2.dispose();
      d3.dispose();
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

    const persited = localStorage.getItem(PERSIST_KEY);
    if (persited) {
      activeEditor.setValue(persited);
    }
  }, [activeEditor, ref]);

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <div
        ref={ref}
        style={{ flex: 1, width: "100%", height: "100%", overflow: "hidden" }}
      />
      {showPreview && (
        <div
          style={{
            width: "50vw",
            height: "100%",
          }}
        >
          {previewCode && <Preview code={previewCode ?? ""} />}
        </div>
      )}
    </div>
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

export class Kind {
  public static unknown: string = "";
  public static keyword: string = "keyword";
  public static script: string = "script";
  public static module: string = "module";
  public static class: string = "class";
  public static interface: string = "interface";
  public static type: string = "type";
  public static enum: string = "enum";
  public static variable: string = "var";
  public static localVariable: string = "local var";
  public static function: string = "function";
  public static localFunction: string = "local function";
  public static memberFunction: string = "method";
  public static memberGetAccessor: string = "getter";
  public static memberSetAccessor: string = "setter";
  public static memberVariable: string = "property";
  public static constructorImplementation: string = "constructor";
  public static callSignature: string = "call";
  public static indexSignature: string = "index";
  public static constructSignature: string = "construct";
  public static parameter: string = "parameter";
  public static typeParameter: string = "type parameter";
  public static primitiveType: string = "primitive type";
  public static label: string = "label";
  public static alias: string = "alias";
  public static const: string = "const";
  public static let: string = "let";
  public static warning: string = "warning";
}
function convertKind(kind: string): monaco.languages.CompletionItemKind {
  switch (kind) {
    case Kind.primitiveType:
    case Kind.keyword:
      return monaco.languages.CompletionItemKind.Keyword;
    case Kind.variable:
    case Kind.localVariable:
      return monaco.languages.CompletionItemKind.Variable;
    case Kind.memberVariable:
    case Kind.memberGetAccessor:
    case Kind.memberSetAccessor:
      return monaco.languages.CompletionItemKind.Field;
    case Kind.function:
    case Kind.memberFunction:
    case Kind.constructSignature:
    case Kind.callSignature:
    case Kind.indexSignature:
      return monaco.languages.CompletionItemKind.Function;
    case Kind.enum:
      return monaco.languages.CompletionItemKind.Enum;
    case Kind.module:
      return monaco.languages.CompletionItemKind.Module;
    case Kind.class:
      return monaco.languages.CompletionItemKind.Class;
    case Kind.interface:
      return monaco.languages.CompletionItemKind.Interface;
    case Kind.warning:
      return monaco.languages.CompletionItemKind.File;
  }

  return monaco.languages.CompletionItemKind.Property;
}

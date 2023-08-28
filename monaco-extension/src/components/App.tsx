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
import type ts from "typescript";
import type { WorkerApi } from "../worker";
import { wrap } from "comlink";
import type { FormatWorkerApi } from "../prettierWorker";

const api = wrap<WorkerApi>(
  new Worker(new URL("../worker.ts", import.meta.url), { type: "module" }),
);

const formatApi = wrap<FormatWorkerApi>(
  new Worker(new URL("../prettierWorker.ts", import.meta.url), {
    type: "module",
  }),
);

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
document.body.innerHTML = foo.value;
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
      // "autoIndent": true,
      formatOnPaste: true,
      // "formatOnType": true,
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

// import ts from "typescript";
import { markdownRunner } from "../blowserPlugin";
import { Preview } from "./Preview";

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
    async (code: string) => {
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
          await api.updateVirtualFile(vfileName, vcontent);
          const diags = await api.getSemanticDiagnostics(vfileName);
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

  // const [showPreview, setShowPreview] = useState(false);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [config, setConfig] = useState<{ showPreview: boolean }>({
    showPreview: false,
  });

  const togglePreview = useCallback(() => {
    const nextConfig = {
      showPreview: !config.showPreview,
    };
    setConfig(nextConfig);
    localStorage.setItem(CONFIG_PERSIST_KEY, JSON.stringify(nextConfig));
  }, [config, setConfig]);

  const runPreview = useCallback(
    async (code: string) => {
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
            entryCode: code,
            fileName: "/root.mdx",
          }),
        ],
      });
      // .then(async (bundle) => {
      const generated = await bundle.generate({
        format: "es",
      });
      // console.log(generated.output[0].code);
      setPreviewCode(generated.output[0].code);
    },
    [setPreviewCode],
  );

  useEffect(() => {
    const onKeydown = async (ev: KeyboardEvent) => {
      if (ev.key === "1" && ev.ctrlKey) {
        togglePreview();
      }
      if (ev.key.toLowerCase() === "r" && ev.ctrlKey) {
        await runPreview(activeEditor?.getValue() ?? "");
      }
      if (ev.key.toLowerCase() === "s" && ev.metaKey) {
        ev.preventDefault();
        await activeEditor?.getAction("editor.action.formatDocument")?.run();
        refresh(activeEditor?.getValue() ?? "");
        // localStorage.setItem(PERSIST_KEY, code);
      }
    };
    window.addEventListener("keydown", onKeydown);
    return () => {
      window.removeEventListener("keydown", onKeydown);
    };
  }, [togglePreview, activeEditor, previewCode, setPreviewCode]);

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
      async provideCompletionItems(model, position) {
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
            await api.updateVirtualFile(vfileName, vcontent);
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

        const info = await api.getCompletionsAtPosition(
          "/root.mdx@" + getVirtualFileName(block),
          offset,
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

    // resume
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const code = activeEditor.getValue();
        const persisted = localStorage.getItem(PERSIST_KEY);
        if (persisted) {
          if (code !== persisted) {
            activeEditor.setValue(persisted);
          }
          refresh(code);
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      d1.dispose();
      d2.dispose();
      d3.dispose();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [activeEditor, model]);

  // initial mount
  useEffect(() => {
    if (!activeEditor) return;
    if (!ref.current) return;
    monaco.languages.registerDocumentFormattingEditProvider("markdown", {
      async provideDocumentFormattingEdits(model) {
        const raw = model.getValue();
        console.log("format with", model.getValue());

        let ret = "";
        // replace all code blocks with formatted
        const blocks = extractCodeBlocks(raw);
        let offset = 0;
        for (const block of blocks) {
          if (
            block.lang === "ts" ||
            block.lang === "tsx" ||
            block.lang === "js" ||
            block.lang === "jsx"
          ) {
            const formatted = await formatApi.formatTs(block.content);
            ret += raw.slice(offset, block.codeRange[0]) + formatted;
            offset = block.codeRange[1];
          }
          if (block.lang === "html") {
            const formatted = await formatApi.formatHtml(block.content);
            ret += raw.slice(offset, block.codeRange[0]) + formatted;
            offset = block.codeRange[1];
          }
          if (block.lang === "css") {
            const formatted = await formatApi.formatCss(block.content);
            ret += raw.slice(offset, block.codeRange[0]) + formatted;
            offset = block.codeRange[1];
          }
        }
        // add rest of the document
        ret += raw.slice(offset);

        // const text = await formatApi.formatMarkdown(model.getValue());
        return [
          {
            range: model.getFullModelRange(),
            text: ret,
          },
        ];
      },
    });
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

    const persitedConfig = localStorage.getItem(CONFIG_PERSIST_KEY);
    if (persitedConfig) {
      setConfig(JSON.parse(persitedConfig));
    }
  }, [activeEditor, ref]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "1fr 32px",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateAreas: config.showPreview
          ? `
          "left   right"
          "bottom bottom"
          `
          : `
          "left   left"
          "bottom bottom"
          `,
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          gridArea: "left",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          maxWidth: "1000px",
          margin: "0 auto",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          ref={ref}
          style={{
            flex: 1,
            width: "100%",
            height: "100%",
            overflow: "hidden",
          }}
        />
      </div>
      {config.showPreview && (
        <div
          style={{
            gridArea: "right",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              right: 0,
            }}
          >
            <button
              type="button"
              onClick={() => {
                runPreview(activeEditor?.getValue() ?? "");
              }}
            >
              Run[Ctrl+R]
            </button>
          </div>
          {previewCode ? (
            <Preview code={previewCode ?? ""} />
          ) : (
            <>(not run yet)</>
          )}
        </div>
      )}
      {/* Footer */}
      <div
        style={{
          gridArea: "bottom",
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          width: "100%",
          height: "32px",
          overflow: "hidden",
          backgroundColor: "#333",
          color: "#fff",
        }}
      >
        <button type="button" onClick={togglePreview}>
          👀
        </button>
        <a
          style={{ color: "#88f", paddingRight: "8px" }}
          rel="noopener noreferrer"
          target="_blank"
          href="https://github.com/mizchi/markdown-code-features"
        >
          GitHub
        </a>
      </div>
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

const KindMap = {
  unknown: "",
  keyword: "keyword",
  script: "script",
  module: "module",
  class: "class",
  interface: "interface",
  type: "type",
  enum: "enum",
  variable: "var",
  localVariable: "local var",
  function: "function",
  localFunction: "local function",
  memberFunction: "method",
  memberGetAccessor: "getter",
  memberSetAccessor: "setter",
  memberVariable: "property",
  constructorImplementation: "constructor",
  callSignature: "call",
  indexSignature: "index",
  constructSignature: "construct",
  parameter: "parameter",
  typeParameter: "type parameter",
  primitiveType: "primitive type",
  label: "label",
  alias: "alias",
  const: "const",
  let: "let",
  warning: "warning",
};

function convertKind(kind: string): monaco.languages.CompletionItemKind {
  switch (kind) {
    case KindMap.primitiveType:
    case KindMap.keyword:
      return monaco.languages.CompletionItemKind.Keyword;
    case KindMap.variable:
    case KindMap.localVariable:
      return monaco.languages.CompletionItemKind.Variable;
    case KindMap.memberVariable:
    case KindMap.memberGetAccessor:
    case KindMap.memberSetAccessor:
      return monaco.languages.CompletionItemKind.Field;
    case KindMap.function:
    case KindMap.memberFunction:
    case KindMap.constructSignature:
    case KindMap.callSignature:
    case KindMap.indexSignature:
      return monaco.languages.CompletionItemKind.Function;
    case KindMap.enum:
      return monaco.languages.CompletionItemKind.Enum;
    case KindMap.module:
      return monaco.languages.CompletionItemKind.Module;
    case KindMap.class:
      return monaco.languages.CompletionItemKind.Class;
    case KindMap.interface:
      return monaco.languages.CompletionItemKind.Interface;
    case KindMap.warning:
      return monaco.languages.CompletionItemKind.File;
  }

  return monaco.languages.CompletionItemKind.Property;
}

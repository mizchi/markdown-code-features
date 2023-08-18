// TODO: LSP with other extensions
import * as vscode from "vscode";
import { type CodeBlock, extractCodeBlocks } from "./markdown";

const MDXV_SCHEMA = "mdxv";

type CodeBlockWithMetadata = CodeBlock & {
  vFileName: string;
  vContent: string;
};

export async function activate(context: vscode.ExtensionContext) {
  const virtualContents = new Map<string, string>();
  const diagnosticCollection =
    vscode.languages.createDiagnosticCollection("mdx");
  context.subscriptions.push(diagnosticCollection);

  // preload on activation
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      if (document.languageId !== "mdx") return;
      refresh(document.fileName, document.getText());
    }),
  );

  // create document
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(MDXV_SCHEMA, {
      onDidChange(ev) {
        console.log("[mdxv:onDidChange]", ev);
        return {
          dispose() {
            console.log("[mdxv:onDidChange:dispose]", ev);
          },
        };
      },
      provideTextDocumentContent: (uri) => {
        return virtualContents.get(uri.path);
      },
    }),
  );

  // auto complete
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider("mdx", {
      async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        context: vscode.CompletionContext,
      ) {
        const { contents } = refresh(document.fileName, document.getText());
        const offset = document.offsetAt(position);
        const currentBlock = contents.find(
          ({ codeRange: [start, end] }) => start <= offset && offset <= end,
        );
        if (!currentBlock) return [];
        const uri = vscode.Uri.parse(
          `${MDXV_SCHEMA}://${currentBlock.vFileName}`,
        );
      },
    }),
  );
  const current = vscode.window.activeTextEditor;
  if (current?.document.languageId === "mdx") {
    const doc = current.document;
    if (doc.languageId !== "mdx") return;
    refresh(doc.fileName, doc.getText());
  }
  return;

  function refresh(fileName: string, raw: string) {
    console.log("[mdxv:refresh]", fileName, raw.length);
    const blocks = extractCodeBlocks(raw);
    const contents = blocks.map<CodeBlockWithMetadata>((block, idx) => {
      const vFileName = getVirtualFileName(fileName, idx.toString());
      const maskedPrefix = [...raw.slice(0, block.codeRange[0])]
        .map((c) => (c === "\n" ? c : " "))
        .join("");
      const vContent = maskedPrefix + block.content;
      virtualContents.set(vFileName, vContent);
      return {
        ...block,
        vFileName,
        vContent,
      };
    });
    return {
      contents,
    };
  }

  function getVirtualFileName(originalFileName: string, id: string) {
    return `${originalFileName}_${id}.ts`;
  }
}

export function deactivate() {}

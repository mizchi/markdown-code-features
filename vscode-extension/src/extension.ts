// https://github.com/microsoft/vscode-extension-samples
import * as vscode from "vscode";
import ts from "typescript";
import {
  IncrementalLanguageService,
  createIncrementalLanguageService,
  createIncrementalLanguageServiceHost,
} from "./service";
import { CodeBlock, extractCodeBlocks } from "./markdown";
import { tsCompletionEntryToVscodeCompletionItem } from "./vsHelpers";

type MyDiagnostic = vscode.Diagnostic & {
  vfileName: string;
};

const SUPPORTED_EXTENIONS = [".ts", ".tsx", ".mts", ".mtsx", ".js", ".jsx"];
const SUPPORTED_LANGUAGES = [
  "ts",
  "tsx",
  "typescript",
  "typescriptreact",
  "mts",
  "mtsx",
  "cts",
  "ctsx",
  "javascript",
  "javascriptreact",
];

const DefaultCompilerOptions: ts.CompilerOptions = {
  lib: ["esnext", "dom", "dom.iterable"],
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  jsx: ts.JsxEmit.ReactJSX,
  allowJs: true,
  allowSyntheticDefaultImports: true,
  strict: true,
  esModuleInterop: true,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
  resolveJsonModule: true,
};


let extensionEnabled = false;
async function _start(context: vscode.ExtensionContext) {
  // fileName -> virtualFiles
  const virtualContents = new Map<string, string[]>();
  const root = vscode.workspace.workspaceFolders?.[0];
  const rootDir = root?.uri.fsPath!;
  const service = createLanguageService(rootDir);
  const diagnosticCollection = vscode.languages.createDiagnosticCollection(
    "markdown-code-features",
  );

  // update diagnostics by update
  let timeoutId: NodeJS.Timeout | null = null;

  // const isVirtualFile = (fileName: string) => fileName.includes(".mdx@");
  const isVirtualFile = (fileName: string) => /\.mdx?@.*/.test(fileName);
  const isExsitedMdx = (fileName: string) => /\.mdx?$/.test(fileName);

  const completion = createCompletionProvider(service);

  // TODO: check mdx is active to check
  context.subscriptions.push(
    // external: on save
    vscode.workspace.onDidSaveTextDocument((ev) => {
      if (!extensionEnabled) return;

      if (isVirtualFile(ev.fileName)) return;
      const fileName = ev.fileName;
      if (SUPPORTED_EXTENIONS.some((ext) => fileName.endsWith(ext))) {
        service.writeSnapshot(
          fileName,
          ts.ScriptSnapshot.fromString(ev.getText()),
        );
      }
    }),
    vscode.workspace.onDidChangeTextDocument((ev) => {
      if (!extensionEnabled) return;
      const fileName = ev.document.fileName;
      if (SUPPORTED_EXTENIONS.some((ext) => fileName.endsWith(ext))) {
        service.notifyFileChanged(fileName);
      }
    }),

    // external: on rename
    vscode.workspace.onDidRenameFiles((ev) => {
      if (!extensionEnabled) return;
      const oldFileNames = ev.files.map((f) => f.oldUri.fsPath);
      for (const old of oldFileNames) {
        if (isVirtualFile(old)) return;
        if (SUPPORTED_EXTENIONS.some((ext) => old.endsWith(ext))) {
          service.deleteSnapshot(old);
        }
      }
    }),
    // external: on delete
    vscode.workspace.onDidDeleteFiles((ev) => {
      if (!extensionEnabled) return;
      const fileNames = ev.files.map((f) => f.fsPath);
      for (const fileName of fileNames) {
        if (isVirtualFile(fileName)) return;
        if (SUPPORTED_EXTENIONS.some((ext) => fileName.endsWith(ext))) {
          service.deleteSnapshot(fileName);
        }
      }
    }),
    // on close .mdx
    vscode.workspace.onDidCloseTextDocument((ev) => {
      if (!extensionEnabled) return;
      if (isExsitedMdx(ev.fileName)) {
        // clear diagnostics
        diagnosticCollection.delete(ev.uri);
        const fileNames = virtualContents.get(ev.fileName) ?? [];
        fileNames.forEach((vfileName) => service.deleteSnapshot(vfileName));
        virtualContents.delete(ev.fileName);
      }
    }),
    // mdx: update diagnostics
    vscode.workspace.onDidChangeTextDocument((ev) => {
      if (!extensionEnabled) {
        virtualContents.delete(ev.document.fileName);
        return;
      }
      if (isExsitedMdx(ev.document.fileName)) {
        // deboucing
        timeoutId && clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          timeoutId = null;
          // TODO: check intersection
          const content = ev.document.getText();
          const changes = ev.contentChanges.map((change) => {
            // return vscode range
            return {
              start: change.rangeOffset,
              end: change.rangeOffset + change.rangeLength
            };
          });
          const blocks = refresh(service, ev.document.fileName, content, changes);
          const diags: MyDiagnostic[] = blocks.flatMap((block) => {
            // Now only typescript
            if (!block.lang) return [];
            if (!SUPPORTED_LANGUAGES.includes(block.lang)) return [];
            // TODO: highlight by language mode
            const tsSemanticDiagnostics = service.getSemanticDiagnostics(
              block.vfileName,
            );
            // https://code.visualstudio.com/api/language-extensions/programmatic-language-features
            return tsSemanticDiagnostics.map((diag) => {
              const start = ev.document.positionAt(diag.start!);
              const end = ev.document.positionAt(diag.start! + diag.length!);
              const d = new vscode.Diagnostic(
                new vscode.Range(start, end),
                (diag.messageText as string) ?? "unknown",
                vscode.DiagnosticSeverity.Error,
              );
              return {
                ...d,
                vfileName: block.vfileName,
              } as MyDiagnostic;
            });
          });
          diagnosticCollection.set(ev.document.uri, diags);
        }, 300);
      }
    }),
    // mdx: on open
    vscode.workspace.onDidOpenTextDocument((ev) => {
      if (!extensionEnabled) return;
      if (isExsitedMdx(ev.fileName)) {
        const content = ev.getText();
        refresh(service, ev.fileName, content, undefined);
      }
    }),
    // register completion
    vscode.languages.registerCompletionItemProvider("mdx", completion),
    // register mdx completion
    vscode.languages.registerCompletionItemProvider("markdown", completion),
    // register markdown completion
    diagnosticCollection,
  );
  return;
  function createLanguageService(rootDir: string, currentFileName?: string) {
    const registory = ts.createDocumentRegistry();
    const configFile = ts.findConfigFile(rootDir, ts.sys.fileExists);

    let fileNames: string[] = [];
    if (configFile) {
      const tsconfig = ts.readConfigFile(configFile, ts.sys.readFile);
      const options = ts.parseJsonConfigFileContent(
        tsconfig.config,
        ts.sys,
        rootDir,
      );
      fileNames = options.fileNames;
    }
    const host = createIncrementalLanguageServiceHost(
      rootDir,
      fileNames,
      !configFile ? DefaultCompilerOptions : undefined,
    );
    return createIncrementalLanguageService(host, registory);
  }

  function refresh(
    service: IncrementalLanguageService,
    fileName: string,
    rawContent: string,
    // TODO: use partial update
    ranges: {start: number, end: number}[] | undefined,
  ) {
    console.time("mdcf:refresh");
    // console.time("mdcf:extract");
    const blocks = extractCodeBlocks(rawContent);
    // console.timeEnd("mdcf:extract");

    const lastVirtualFileNames = virtualContents.get(fileName) ?? [];
    // update virtual files
    const vfileNames = blocks.map((block, idx) => {
      const id = block.id ?? idx.toString();
      const virtualFileName = getVirtualFileName(fileName, id);

      // check is changed
      if (ranges) {
        const isChanged = ranges.some(({ start, end }) => {
          return block.codeRange[0] <= start && end <= block.codeRange[1];
        });
        if (!isChanged) {
          console.log("[mdx] not changed", virtualFileName);
          // return virtualFileName;
        }
      }

      // xxxx
      const maskedPrefix = [...rawContent.slice(0, block.codeRange[0])]
        .map((c) => (c === "\n" ? c : " "))
        .join("");
      service.writeSnapshot(
        virtualFileName,
        ts.ScriptSnapshot.fromString(maskedPrefix + block.content),
      );
      return virtualFileName;
    });
    // remove unused virtual files
    lastVirtualFileNames
      .filter((vfileName) => !vfileNames.includes(vfileName))
      .forEach((vfileName) => service.deleteSnapshot(vfileName));
    virtualContents.set(fileName, vfileNames);
    console.timeEnd("mdcf:refresh");
    return blocks.map((block, idx) => {
      return {
        ...block,
        vfileName: vfileNames[idx],
        index: idx,
      };
    });
    function getVirtualFileName(originalFileName: string, localId: string) {
      const finalLocalId = /\.tsx?$/.test(localId) ? localId : `${localId}.tsx`;
      return `${originalFileName}@${finalLocalId}`;
    }
  }

  // https://qiita.com/qvtec/items/31d19dd8b86fcc19465a
  function createCompletionProvider(
    service: IncrementalLanguageService,
  ): vscode.CompletionItemProvider {
    return {
      provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        _context: vscode.CompletionContext,
      ) {
        if (extensionEnabled === false) return [];
        // offset with range
        const offset = document.offsetAt(position);

        const blocks = refresh(service, document.fileName, document.getText(), [
          {
            start: offset,
            end: offset + 1,
          }
        ]);
        const block = blocks.find(({ lang, codeRange: [start, end] }) => {
          if (!lang) return false;
          if (!SUPPORTED_LANGUAGES.includes(lang)) return false;
          // in range
          return start <= offset && offset <= end;
        });
        if (!block) return [];

        const codeOffset = offset;
        const getEntryDetails = (entryName: string) => {
          return service.getCompletionEntryDetails(
            block.vfileName,
            codeOffset,
            entryName,
            undefined,
            undefined,
            undefined,
            undefined,
          );
        };
        return (
          service
            .getCompletionsAtPosition(block.vfileName, codeOffset, undefined)
            ?.entries.map((entry) =>
              tsCompletionEntryToVscodeCompletionItem(
                getEntryDetails,
                entry,
                document,
              ),
            ) ?? []
        );
      },
    };
  }
}

export async function activate(context: vscode.ExtensionContext) {
  const settings = vscode.workspace.getConfiguration("markdown-code-features");
  console.log("[markdown-code]", settings);
  extensionEnabled = settings.get("enable") ?? false;

  vscode.workspace.onDidChangeConfiguration(async (ev) => {
    if (ev.affectsConfiguration("markdown-code-features")) {
      if (!extensionEnabled) {
        const settings = vscode.workspace.getConfiguration(
          "markdown-code-features",
        );
        let lastState = extensionEnabled;
        extensionEnabled = settings.get("enable") ?? false;
        if (extensionEnabled) {
          await _start(context);
        }

        // TODO: fixme later
        if (lastState && !extensionEnabled) {
          vscode.window.showInformationMessage(
            "markdown-code-features requires reload to disable",
          );
        }
      }
    }
  });

  if (extensionEnabled) {
    await _start(context);
    return;
  }
}

// This method is called when your extension is deactivated
export function deactivate() {}

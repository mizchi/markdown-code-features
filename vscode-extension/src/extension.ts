// https://github.com/microsoft/vscode-extension-samples
import * as vscode from "vscode";
import ts from "typescript";
import {
  IncrementalLanguageService,
  createIncrementalLanguageService,
  createIncrementalLanguageServiceHost,
} from "./service";
import { extractCodeBlocks } from "@mizchi/mdcf-compiler/src/index";
import { tsCompletionEntryToVscodeCompletionItem } from "./vsHelpers";
import { getVirtualFileName } from "@mizchi/mdcf-compiler/src/markdown";

type MyDiagnostic = vscode.Diagnostic & {
  vfileName: string;
};

const SUPPORTED_EXTENIONS = [
  // extensions
  ".ts",
  ".tsx",
  ".mts",
  ".mtsx",
  ".js",
  ".jsx",
];

const SUPPORTED_SCRIPTS = [
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

const SUPPORTED_LANGUAGES = [...SUPPORTED_SCRIPTS, "html", "css"];

const DEBUG = false;

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

const isVirtualFile = (fileName: string) => /\.mdx?@.*/.test(fileName);
const isMarkdown = (fileName: string) => /\.mdx?$/.test(fileName);

let extensionEnabled = false;

async function _start(context: vscode.ExtensionContext) {
  // fileName -> virtualFiles
  const virtualContents = new Map<string, string[]>();
  const registory = ts.createDocumentRegistry();
  const services = new Map<string, IncrementalLanguageService>();

  // virtual html/css files
  const virtualDocuments = new Map<string, string>();
  vscode.workspace.registerTextDocumentContentProvider("mdcf", {
    provideTextDocumentContent: (uri) => {
      return virtualDocuments.get(uri.fsPath);
    },
  });

  const diagnosticCollection = vscode.languages.createDiagnosticCollection(
    "markdown-code-features",
  );

  // update diagnostics by update
  let timeoutId: NodeJS.Timeout | null = null;

  const completion = createCompletionProvider(getOrCreateLanguageService);

  // TODO: check mdx is active to check
  context.subscriptions.push(
    // external: on save
    vscode.workspace.onDidSaveTextDocument((ev) => {
      if (!extensionEnabled) return;
      if (isVirtualFile(ev.fileName)) return;
      const fileName = ev.fileName;
      if (SUPPORTED_EXTENIONS.some((ext) => fileName.endsWith(ext))) {
        const service = getOrCreateLanguageService(ev.uri);
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
        const service = getOrCreateLanguageService(ev.document.uri);
        service.notifyFileChanged(fileName);
        const mdDocs = vscode.workspace.textDocuments.filter((doc) => {
          return isMarkdown(doc.fileName);
        });
        for (const doc of mdDocs) {
          updateDiagnostics(doc, []);
        }
      }
    }),

    // external: on rename
    vscode.workspace.onDidRenameFiles((ev) => {
      if (!extensionEnabled) return;
      for (const oldFile of ev.files) {
        const old = oldFile.oldUri.fsPath;
        if (isVirtualFile(old)) return;
        if (SUPPORTED_EXTENIONS.some((ext) => old.endsWith(ext))) {
          const service = getOrCreateLanguageService(oldFile.oldUri);
          service.deleteSnapshot(old);
        }
      }
    }),
    // external: on delete
    vscode.workspace.onDidDeleteFiles((ev) => {
      if (!extensionEnabled) return;
      for (const file of ev.files) {
        const fileName = file.fsPath;
        if (isVirtualFile(fileName)) return;
        if (SUPPORTED_EXTENIONS.some((ext) => fileName.endsWith(ext))) {
          const service = getOrCreateLanguageService(file);
          service.deleteSnapshot(fileName);
        }
      }
    }),
    // on close .mdx
    vscode.workspace.onDidCloseTextDocument((ev) => {
      if (!extensionEnabled) return;
      if (isMarkdown(ev.fileName)) {
        // clear diagnostics
        diagnosticCollection.delete(ev.uri);
        const fileNames = virtualContents.get(ev.fileName) ?? [];
        const service = getOrCreateLanguageService(ev.uri);
        fileNames.forEach((vfileName) => service.deleteSnapshot(vfileName));
        virtualContents.delete(ev.fileName);
        // virtualDocuments.delete(ev.fileName);
        for (const vkey of virtualDocuments.keys()) {
          if (vkey.startsWith(ev.fileName)) {
            virtualDocuments.delete(vkey);
          }
        }
      }
    }),
    // mdx: update diagnostics
    vscode.workspace.onDidChangeTextDocument((ev) => {
      if (!extensionEnabled) {
        virtualContents.delete(ev.document.fileName);
        return;
      }
      if (isMarkdown(ev.document.fileName)) {
        // deboucing
        timeoutId && clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          timeoutId = null;
          updateDiagnostics(ev.document, ev.contentChanges);
        }, 300);
      }
    }),
    // mdx: on open
    vscode.workspace.onDidOpenTextDocument((doc) => {
      if (!extensionEnabled) return;
      if (isMarkdown(doc.fileName)) {
        DEBUG && console.log("[mdcf:open]", doc.fileName);
        updateDiagnostics(doc, []);
      }
    }),
    // open default editor
    vscode.workspace.onDidChangeWorkspaceFolders((ev) => {
      // close service on remove workspace
      for (const removed of ev.removed) {
        const rootDir = removed.uri.fsPath;
        if (services.has(rootDir)) {
          const service = services.get(rootDir)!;
          service.dispose();
          services.delete(rootDir);
        }
      }
    }),
    // register completion
    vscode.languages.registerCompletionItemProvider("mdx", completion),
    // register mdx completion
    vscode.languages.registerCompletionItemProvider("markdown", completion),
    // register markdown completion
    diagnosticCollection,
  );

  // on first open document
  if (vscode.window.activeTextEditor) {
    const fileName = vscode.window.activeTextEditor.document.fileName;
    if (!extensionEnabled) return;
    if (isMarkdown(fileName)) {
      updateDiagnostics(vscode.window.activeTextEditor.document, []);
    }
  }
  return;

  function getOrCreateLanguageService(uri: vscode.Uri) {
    const workspace = vscode.workspace.getWorkspaceFolder(uri);
    const roodDir = workspace?.uri.fsPath!;
    if (services.has(roodDir)) {
      return services.get(roodDir)!;
    }
    const service = createLanguageService(roodDir);
    services.set(roodDir, service);
    return service;
  }

  function createLanguageService(rootDir: string) {
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

    const getWorkspaceContent = (fpath: string) => {
      return vscode.workspace.textDocuments
        .find((doc) => doc.uri.fsPath.endsWith(fpath))
        ?.getText();
    };
    const host = createIncrementalLanguageServiceHost(
      rootDir,
      fileNames,
      !configFile ? DefaultCompilerOptions : undefined,
      getWorkspaceContent,
    );
    return createIncrementalLanguageService(host, registory);
  }

  function refresh(
    service: IncrementalLanguageService,
    fileName: string,
    rawContent: string,
    // TODO: use partial update
    _ranges: { start: number; end: number }[] | undefined,
  ) {
    DEBUG && console.time("mdcf:refresh");
    // console.time("mdcf:extract");
    const blocks = extractCodeBlocks(rawContent);
    const lastVirtualFileNames = virtualContents.get(fileName) ?? [];
    // update virtual files
    const vfileNames = blocks.map((block) => {
      const virtualFileName = fileName + "@" + getVirtualFileName(block);
      // check is changed
      // if (ranges) {
      //   const isChanged = ranges.some(({ start, end }) => {
      //     return block.codeRange[0] <= start && end <= block.codeRange[1];
      //   });
      //   if (!isChanged) {
      //     DEBUG && console.log("[mdcf] not changed", virtualFileName);
      //   }
      // }
      const prefix = rawContent
        .slice(0, block.codeRange[0])
        .replace(/[^\n]/g, " ");
      service.writeSnapshot(
        virtualFileName,
        ts.ScriptSnapshot.fromString(prefix + block.content),
      );
      return virtualFileName;
    });
    // remove unused virtual files
    lastVirtualFileNames
      .filter((vfileName) => !vfileNames.includes(vfileName))
      .forEach((vfileName) => {
        service.deleteSnapshot(vfileName);
        // virtualDocuments.delete(vfileName);
        // for (const vkey of virtualDocuments.keys()) {
        //   if (vkey.startsWith(vfileName)) {
        //     virtualDocuments.delete(vkey);
        //   }
        // }
      });
    virtualContents.set(fileName, vfileNames);
    DEBUG && console.timeEnd("mdcf:refresh");
    return blocks.map((block, idx) => {
      return {
        ...block,
        vfileName: vfileNames[idx],
        index: idx,
      };
    });
  }

  function updateDiagnostics(
    document: vscode.TextDocument,
    contentChanges: ReadonlyArray<vscode.TextDocumentContentChangeEvent> = [],
  ) {
    // TODO: check intersection
    const content = document.getText();
    const changes = contentChanges.map((change) => {
      // return vscode range
      return {
        start: change.rangeOffset,
        end: change.rangeOffset + change.rangeLength,
      };
    });
    const service = getOrCreateLanguageService(document.uri);
    const blocks = refresh(service, document.fileName, content, changes);
    const diags: MyDiagnostic[] = blocks.flatMap((block) => {
      // Now only typescript
      if (!block.lang) return [];
      if (!SUPPORTED_SCRIPTS.includes(block.lang)) return [];
      // TODO: highlight by language mode
      const tsSemanticDiagnostics = service.getSemanticDiagnostics(
        block.vfileName,
      );
      // https://code.visualstudio.com/api/language-extensions/programmatic-language-features
      return tsSemanticDiagnostics.map((diag) => {
        const start = document.positionAt(diag.start!);
        const end = document.positionAt(diag.start! + diag.length!);
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
    diagnosticCollection.set(document.uri, diags);
  }

  // https://qiita.com/qvtec/items/31d19dd8b86fcc19465a
  function createCompletionProvider(
    // service: IncrementalLanguageService,
    getService: (uri: vscode.Uri) => IncrementalLanguageService,
  ): vscode.CompletionItemProvider {
    return {
      provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        context: vscode.CompletionContext,
      ) {
        if (extensionEnabled === false) return [];
        // offset with range
        const offset = document.offsetAt(position);
        const service = getService(document.uri);
        const blocks = refresh(service, document.fileName, document.getText(), [
          {
            start: offset,
            end: offset + 1,
          },
        ]);
        const block = blocks.find(({ lang, codeRange: [start, end] }) => {
          if (!lang) return false;
          if (!SUPPORTED_LANGUAGES.includes(lang)) return false;
          // in range
          return start <= offset && offset <= end;
        });
        if (!block) return [];

        // Delegate LSP
        if (block.lang === "html" || block.lang === "css") {
          // update virtual content
          const prefix = document
            .getText()
            .slice(0, block.codeRange[0])
            .replace(/[^\n]/g, " ");
          const vContent = prefix + block.content;
          virtualDocuments.set(block.vfileName, vContent);
          // trigger completion on virtual file
          const vdocUriString = `mdcf://${block.vfileName}`;
          // console.log("[mdcf:comp]", vdocUriString);
          const vdocUri = vscode.Uri.parse(vdocUriString);
          return vscode.commands.executeCommand<vscode.CompletionList>(
            "vscode.executeCompletionItemProvider",
            vdocUri,
            position,
            context.triggerCharacter,
          );
        }

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

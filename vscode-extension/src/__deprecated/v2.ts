// https://github.com/microsoft/vscode-extension-samples
import * as vscode from "vscode";
// TODO: use vscode-languageclient
// import {} from 'vscode-languageclient';
// https://zenn.dev/kimuson/articles/vscode_language_service_plugin

import ts from "typescript/lib/tsserverlibrary";
import {
  IncrementalLanguageService,
  createIncrementalLanguageService,
  createIncrementalLanguageServiceHost,
} from "../service";
import { CodeBlock, extractCodeBlocks } from "../markdown";

export async function activate(context: vscode.ExtensionContext) {
  console.log("start");

  const virtualDocumentContents = new Map<string, string>();
  vscode.workspace.registerTextDocumentContentProvider("mdx-vfile", {
    provideTextDocumentContent: (uri) => {
      const originalUri = uri.path.slice(1).slice(0, -4);
      const decodedUri = decodeURIComponent(originalUri);
      return virtualDocumentContents.get(decodedUri);
    },
  });

  const service = createService();
  const completionProvider = createCompletionProvider(service);
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider("mdx", completionProvider),
  );

  // const langs = vscode.languages.getLanguages();

  // listen current textContent change
  const diagnosticCollection =
    vscode.languages.createDiagnosticCollection("mdx");

  let tid: any;
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((ev) => {
      if (ev.document.fileName.endsWith(".mdx")) {
        // reset diagnostics to it
        tid && clearTimeout(tid);
        tid = setTimeout(() => {
          // TODO: check intersection
          const content = ev.document.getText();
          const blocks = updateFilesFromMarkdown(
            service,
            ev.document.fileName,
            content,
          );
          // TODO: check intersection
          // const changedRanges = ev.contentChanges.map((change) => {
          //   const start = ev.document.offsetAt(change.range.start);
          //   const end = ev.document.offsetAt(change.range.end);
          //   return { start, end };
          // });
          // const changedBlocks = blocks.filter((block) => {
          //   const [start, end] = block.codeRange;
          //   return changedRanges.some((change) => {
          //     return start <= change.start && change.end <= end;
          //   });
          // });
          type MyDiagnostic = vscode.Diagnostic & {
            vfileName: string;
          };
          // TODO: use update virtual files
          // const nonTargetDiags =
          //   diagnosticCollection.get(ev.document.uri)?.filter((diag) => {
          //     return !changedBlocks.some(
          //       (block) => block.vfileName !== (diag as MyDiagnostic).vfileName,
          //     );
          //   }) ?? [];
          // diagnosticCollection.set(ev.document.uri, nonTargetDiags ?? []);
          // for (const block of changedBlocks) {
          //   const lastDiags = diagnosticCollection.get(ev.document.uri);
          //   // diagnosticCollection.set(ev.document.uri, diags);
          //   // service.writeSnapshot(
          //   //   block.vfileName,
          //   //   ts.ScriptSnapshot.fromString(block.content),
          //   // );
          // }
          const diags: MyDiagnostic[] = blocks.flatMap((block) => {
            // const codeStart = block.codeRange[0];
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
  );
  // console.log("activated");
}

// TODO: Scope
const virtualFileMap = new Map<string, string[]>();

function updateFilesFromMarkdown(
  service: IncrementalLanguageService,
  fileName: string,
  md: string,
  // TODO: use partial update
  _ranges: vscode.Range[] = [],
) {
  const blocks = extractCodeBlocks(md);
  const lastVirtualFileNames = virtualFileMap.get(fileName) ?? [];
  // update virtual files
  const vfileNames = blocks.map((block, idx) =>
    createVirtualFileFromCodeBlock(fileName, block, idx),
  );
  // remove unused virtual files
  lastVirtualFileNames
    .filter((vfileName) => !vfileNames.includes(vfileName))
    .forEach((vfileName) => service.deleteSnapshot(vfileName));
  virtualFileMap.set(fileName, vfileNames);

  return blocks.map((block, idx) => {
    return {
      ...block,
      vfileName: vfileNames[idx],
      index: idx,
    };
  });

  function getVirtualFileName(originalFileName: string, id: string) {
    return `${originalFileName}$${id}.ts`;
  }
  function createVirtualFileFromCodeBlock(
    originalFileName: string,
    block: CodeBlock,
    idx: number,
  ) {
    const id = block.id ?? idx.toString();
    const virtualFileName = getVirtualFileName(originalFileName, id);
    const maskContent = " ".repeat(block.codeRange[0] - 1) + "\n";
    service.writeSnapshot(
      virtualFileName,
      ts.ScriptSnapshot.fromString(maskContent + block.content),
    );
    return virtualFileName;
  }
}

// This method is called when your extension is deactivated
export function deactivate() {}

function createService() {
  const root = vscode.workspace.workspaceFolders?.[0];
  const rootDir = root?.uri.fsPath!;
  const registory = ts.createDocumentRegistry();

  const configFile = ts.findConfigFile(rootDir, ts.sys.fileExists);
  const tsconfig = ts.readConfigFile(configFile!, ts.sys.readFile);
  const options = ts.parseJsonConfigFileContent(
    tsconfig.config,
    ts.sys,
    rootDir,
  );
  const host = createIncrementalLanguageServiceHost(rootDir, options.fileNames);
  const service = createIncrementalLanguageService(host, registory);
  return service;
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
      const blocks = updateFilesFromMarkdown(
        service,
        document.fileName,
        document.getText(),
      );
      const offset = document.offsetAt(position);
      const block = blocks.find(
        ({ codeRange: [start, end] }) => start <= offset && offset <= end,
      );
      if (!block) return [];
      // const codeStart = block.codeRange[0];
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

function tsCompletionEntryToVscodeCompletionItem(
  getEntryDetails: (entryName: string) => ts.CompletionEntryDetails | undefined,
  entry: ts.CompletionEntry,
  document: vscode.TextDocument,
) {
  const item = new vscode.CompletionItem(entry.name);
  // const details = getDetails(fileName, offset, entry.name, undefined, undefined, undefined, undefined);
  // console.log("[details]", details);
  item.detail = entry.kind;
  // item.documentation = entry.source;
  // build documentation
  let doc = "";
  {
    doc += entry.sourceDisplay?.map((s) => s.text).join(" ") ?? "";
    const details = getEntryDetails(entry.name);
    if (details?.displayParts) {
      doc += ts.displayPartsToString(details.displayParts);
    }
    if (details?.documentation) {
      doc += ts.displayPartsToString(details.documentation);
    }
  }
  // entry.sourceDisplay && (item.documentation += `\n${entry.sourceDisplay}`);
  item.documentation = doc;

  item.kind = entry.kind
    ? entryKindToCompletionKind(entry.kind)
    : vscode.CompletionItemKind.Text;

  if (entry.replacementSpan) {
    const start = entry.replacementSpan.start;
    const end = entry.replacementSpan.start + entry.replacementSpan.length;
    const range = new vscode.Range(
      document.positionAt(start),
      document.positionAt(end),
    );
    item.range = range;
    return item;
  }
  return item;
  function entryKindToCompletionKind(kind: ts.ScriptElementKind) {
    switch (kind) {
      case ts.ScriptElementKind.functionElement: {
        return vscode.CompletionItemKind.Function;
      }
      case ts.ScriptElementKind.classElement: {
        return vscode.CompletionItemKind.Class;
      }
      case ts.ScriptElementKind.interfaceElement: {
        return vscode.CompletionItemKind.Interface;
      }
      case ts.ScriptElementKind.constElement: {
        return vscode.CompletionItemKind.Constant;
      }
      case ts.ScriptElementKind.letElement: {
        return vscode.CompletionItemKind.Variable;
      }
      case ts.ScriptElementKind.variableElement: {
        return vscode.CompletionItemKind.Variable;
      }
      case ts.ScriptElementKind.localVariableElement: {
        return vscode.CompletionItemKind.Variable;
      }
      case ts.ScriptElementKind.memberVariableElement: {
        return vscode.CompletionItemKind.Variable;
      }
      case ts.ScriptElementKind.memberGetAccessorElement: {
        return vscode.CompletionItemKind.Property;
      }
      case ts.ScriptElementKind.memberSetAccessorElement: {
        return vscode.CompletionItemKind.Property;
      }
      case ts.ScriptElementKind.memberFunctionElement: {
        return vscode.CompletionItemKind.Method;
      }
      case ts.ScriptElementKind.constructSignatureElement: {
        return vscode.CompletionItemKind.Constructor;
      }
      case ts.ScriptElementKind.callSignatureElement: {
        return vscode.CompletionItemKind.Method;
      }
      case ts.ScriptElementKind.indexSignatureElement: {
        return vscode.CompletionItemKind.Method;
      }
      case ts.ScriptElementKind.enumElement: {
        return vscode.CompletionItemKind.Enum;
      }
      case ts.ScriptElementKind.moduleElement: {
        return vscode.CompletionItemKind.Module;
      }
      case ts.ScriptElementKind.alias: {
        return vscode.CompletionItemKind.Module;
      }
      case ts.ScriptElementKind.constElement: {
        return vscode.CompletionItemKind.Constant;
      }
      case ts.ScriptElementKind.letElement: {
        return vscode.CompletionItemKind.Variable;
      }
      case ts.ScriptElementKind.variableElement: {
        return vscode.CompletionItemKind.Variable;
      }
      case ts.ScriptElementKind.localVariableElement: {
        return vscode.CompletionItemKind.Variable;
      }
      case ts.ScriptElementKind.keyword: {
        return vscode.CompletionItemKind.Keyword;
      }
      default: {
        // @ts-ignore

        console.error("[fallback]", ts.ScriptElementKind[kind]);
        return vscode.CompletionItemKind.Text;
      }
    }
  }
}

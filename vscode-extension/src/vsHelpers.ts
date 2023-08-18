import * as vscode from "vscode";
import ts from "typescript";

export function tsCompletionEntryToVscodeCompletionItem(
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

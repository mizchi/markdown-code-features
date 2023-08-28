import { expose } from "comlink";
import ts from "typescript";
import { getVfiles } from "./constants";

const USE_LSP_LOGS = false;

const vfiles: Record<string, string> = await getVfiles();
const versions: Record<string, number> = {};

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

const api = {
  updateVirtualFile(fileName: string, content: string) {
    vfiles[fileName] = content;
    versions[fileName] = (versions[fileName] ?? 0) + 1;
  },
  getCompletionsAtPosition(fileName: string, offset: number) {
    return service.getCompletionsAtPosition(
      fileName,
      offset,
      undefined,
      undefined,
    );
  },
  async getSemanticDiagnostics(fileName: string) {
    const info = service.getSemanticDiagnostics(fileName);
    // debugger;
    return info.map((d) => {
      return { ...d, file: undefined };
    });
  },
};

export type WorkerApi = typeof api;

expose(api);

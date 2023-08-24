import { parseArgs } from "node:util";
import ts from "typescript";
import path from 'node:path';
import process from "node:process";
import fs from 'node:fs';
import { extractCodeBlocks, getVirtualFileName } from "@mizchi/mdcf-core";

const tsconfig = ts.readConfigFile("./tsconfig.json", ts.sys.readFile);
const options = ts.parseJsonConfigFileContent(tsconfig.config, ts.sys, "./");

const args = parseArgs({
  allowPositionals: true,
  options: {
    // name: {
    //   type: "string",
    //   alias: "n",
    //   default: "world",
    // },
  },
});

const cwd = process.cwd();

const [command, ...positionalFiles] = args.positionals;

if (command === "check") {
  const targetFiles = positionalFiles.map((positional) => {
    return path.join(cwd, positional);
  });
  
  const files = options.fileNames;
  // const files: string[] = [];
  const results: Record<string, string> = {}
  for (const targetFile of targetFiles) {
    const code = fs.readFileSync(targetFile, "utf-8");
    const blocks = extractCodeBlocks(code);
    for (const block of blocks) {
      const vname = getVirtualFileName(block);
      const vpath = targetFile + '@' + vname;
      const prefix = code.slice(0, block.blockRange[0]).replace(/[^\n]/ug, ' ');
      const vcontent =  prefix + block.content;
      results[vpath] = vcontent;
      files.push(vpath);
    }
    // extract
  }
  
  const host = ts.createCompilerHost(options.options);
  
  const originalReadFile = host.readFile;
  host.readFile = (fileName) => {
    fileName = fileName.startsWith("/") ? fileName : path.join(cwd, fileName);
    if (fileName in results) {
      return results[fileName];
    }
    return originalReadFile(fileName);
  }
  
  const program = ts.createProgram(files, options.options, host);
  
  const diags: ts.Diagnostic[] = [];
  for (const file of files) {
    const sourceFile = program.getSourceFile(file);
    const diagnostics = program.getSemanticDiagnostics(sourceFile);
    diags.push(...diagnostics);
  }
  
  if (diags.length === 0) {
    process.exit(0);
  }
  
  console.error("Error:", diags.length);
  for (const diag of diags) {
    printDiagnostics(diag);
  }
  
  process.exit(1);
  
} else {
  console.error("Unknown command:", command);
  process.exit(1);
}


function printDiagnostics(diagnostic: ts.Diagnostic) {
  if (diagnostic.file) {
    const originalFileName = diagnostic.file.fileName.split('@')[0];
    const { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start!);
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
    const localPath = `${originalFileName}:${line + 2}:${character + 2}`;
    console.log(`${message} (${localPath})`);
  } else {
    console.log(`${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`);
  }
}

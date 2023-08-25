import { type Plugin } from "rollup";
import { extractCodeBlocks, getVirtualFileName } from "@mizchi/mdcf-core";
import * as path from "./lightPath";
import ts from "typescript";

type CodeBlock = any;

export function markdownRunner(opts: { entryCode: string; fileName: string }) {
  // const blockMap = new Map<string, CodeBlock[]>();
  let _blocks: CodeBlock[] = [];
  return {
    name: "mardown-runner",
    // enforce: "pre",
    resolveId(id, importer) {
      if (id.startsWith("@")) {
        return `${opts.fileName}${id}`;
      }
      // console.log("[resolveId]", id, importer);
      if (id.endsWith(".mdx") || id.endsWith(".md")) {
        if (importer && id.startsWith("./")) {
          console.log(
            "[resolveId:mdx-dot]",
            path.join(path.dirname(importer), id),
          );
          const rid = path.join(path.dirname(importer), id);
          // validate(rid);
          return rid;
        }
        // validate(id);
        return id;
      }
      if (
        importer &&
        id.match(/\.mdx?@/) &&
        (id.endsWith(".ts") || id.endsWith(".tsx"))
      ) {
        if (id.startsWith(".")) {
          const rid = path.join(path.dirname(importer), id);
          // validate(rid);
          return rid;
        }

        const pwd = process.cwd();

        if (id.startsWith(pwd)) {
          return id;
        }
        if (id.startsWith("/")) {
          const rid = path.join("/", id);
          // validate(rid);
          return rid;
        }
      }
      return;
    },
    load(id) {
      if (id.match(/\.mdx?@/) && (id.endsWith(".ts") || id.endsWith(".tsx"))) {
        // console.log("[load]", id, Object.keys(blockMap));

        const [_, localName] = id.split("@");
        const localIdx = Number(localName.split(".")[0]);
        // debugger;
        const block = _blocks!.find((block, idx) => {
          return block.fileName === localName || localIdx === idx;
        });
        return block?.content;
      }
      if (id === "/root.mdx") {
        return opts.entryCode;
      }
      return undefined;
    },
    transform(code, id) {
      if (id.endsWith(".mdx") || id.endsWith(".md")) {
        const blocks = extractCodeBlocks(code);
        _blocks = blocks;
        const ret = blocks
          .map((block) => {
            const vname = getVirtualFileName(block);
            return `import ".${opts.fileName}@${vname}"`;
          })
          .join("\n");
        console.log("[transform:mdx]", id, ret);
        return ret;
      }

      if (id.endsWith(".ts") || id.endsWith(".tsx")) {
        console.log("[transform:ts]", id);
        const compiled = ts.transpileModule(code, {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ESNext,
            jsx: ts.JsxEmit.ReactJSX,
          },
          fileName: id,
        });
        // console.log("[transform:ts]", id, compiled.outputText);
        return compiled.outputText;
      }
      return undefined;
    },
  } as Plugin;
}

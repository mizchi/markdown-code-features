import { CodeBlock, extractCodeBlocks } from "./markdown";
import { test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { rollup, Plugin } from "rollup";
import ts from "typescript";

test("extractCodeBlocks #1", () => {
  const case1 = fs.readFileSync(
    path.join(__dirname, "./__fixtures/case1.mdx"),
    "utf-8",
  );
  const blocks = extractCodeBlocks(case1);
  expect(blocks).toHaveLength(2);
});

test.only("extractCodeBlocks #2", async () => {
  const case3 = fs.readFileSync(
    path.join(__dirname, "./__fixtures/case3.mdx"),
    "utf-8",
  );
  const blocks = extractCodeBlocks(case3);
  expect(blocks).toHaveLength(2);

  let blockMap = new Map<string, CodeBlock[]>();
  const bundle = await rollup({
    input: "entry.mdx",
    plugins: [
      {
        name: "test-loader",
        resolveId(id, importer) {
          if (id === "entry.mdx") {
            return id;
          }
          if (importer && id.endsWith(".ts")) {
            // const resolved = path.resolve(dirname, id);
            const rid = path.resolve(path.dirname(importer), id);
            return rid;
          }
          return;
        },
        load(id) {
          // console.log("[mdx:load]", id);
          if (id === "entry.mdx") {
            // const [originalPath, localId] = id.split("@");
            // TODO: replace loader
            const blocks = extractCodeBlocks(case3);
            const rid = path.resolve(__dirname, id);
            console.log("loader:id", rid);

            blockMap.set(rid, blocks);
            return case3;
          }
          return;
        },
      },
      {
        name: "mdx",
        load(id) {
          if (
            id.includes(".mdx@") &&
            (id.endsWith(".ts") || id.endsWith(".tsx"))
          ) {
            const [originalPath, localId] = id.split("@");
            console.log("id", id, originalPath);
            const blocks = blockMap.get(originalPath) ?? [];
            // TODO: replace loader
            // const blocks = extractCodeBlocks(case3);
            const block = blocks.find((block) => {
              // TODO: number id
              return block.id === localId;
            });
            return block?.content;
          }
          if (id.endsWith(".ts")) {
            return fs.readFileSync(id, "utf-8");
          }
          return undefined;
        },
        transform(code, id) {
          if (id.endsWith(".mdx")) {
            const blocks = extractCodeBlocks(code);
            return blocks
              .map((block) => {
                const vfileName = `${id}@${block.id}`;
                // this.emitFile({
                //   type: "chunk",
                //   id: vfileName,
                // });
                return `import "./${vfileName}"`;
              })
              .join("\n");
          }
          if (id.endsWith(".ts")) {
            const transpile = ts.transpileModule(code, {
              compilerOptions: {
                module: ts.ModuleKind.ESNext,
                target: ts.ScriptTarget.ESNext,
                jsx: ts.JsxEmit.ReactJSX,
              },
            });
            return {
              code: transpile.outputText,
              map: transpile.sourceMapText,
            };
          }
          return undefined;
        },
      } as Plugin,
    ],
  });

  const { output } = await bundle.generate({
    format: "es",
  });
  const code = output[0].code;
  console.log(code);
});

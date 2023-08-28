import { format } from "prettier/standalone";
// import parserBabel from "prettier/plugins/babel";
import parserTs from "prettier/plugins/typescript";
import parserHtml from "prettier/plugins/html";
import parserCss from "prettier/plugins/postcss";
import parserMarkdown from "prettier/plugins/markdown";
// @ts-ignore
import parserEstree from "prettier/plugins/estree.mjs";

import { expose } from "comlink";

const api = {
  async formatMarkdown(code: string) {
    return await format(code, {
      filepath: "test.md",
      parser: "markdown",
      semi: true,
      singleQuote: false,
      tabWidth: 2,
      plugins: [parserTs, parserHtml, parserCss, parserMarkdown],
      // embeddedLanguageFormatting: "auto",
    });
  },
  async formatTs(code: string) {
    return (
      await format(code, {
        filepath: "test.tsx",
        parser: "typescript",
        semi: true,
        singleQuote: false,
        tabWidth: 2,
        plugins: [parserTs, parserEstree],
      })
    ).replace(/\n$/, "");
  },
  async formatCss(code: string) {
    return (
      await format(code, {
        filepath: "test.css",
        parser: "css",
        semi: true,
        singleQuote: false,
        tabWidth: 2,
        plugins: [parserCss],
      })
    ).replace(/\n$/, "");
  },

  async formatHtml(code: string) {
    return (
      await format(code, {
        filepath: "test.html",
        parser: "html",
        semi: true,
        singleQuote: false,
        tabWidth: 2,
        plugins: [parserHtml],
      })
    ).replace(/\n$/, "");
  },
};

export type FormatWorkerApi = typeof api;

expose(api);

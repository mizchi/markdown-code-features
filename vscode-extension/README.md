# Markdown Code Features

Support diagnostics and completion in markdown code blocks.

![Alt text](https://raw.githubusercontent.com/mizchi/markdown-code-features/main/vscode-extension/demo.png)

## Example

```md:doc.md
<!-- doc.md -->
\`\`\`ts:foo.ts
// virtual file in markdown
export const foo = { value: 1 };
\`\`\`

\`\`\`ts
// import from local file
import Index from "./index";

// import from self
import { foo } from "./doc.md@foo";
\`\`\`
```

(Now only for `ts` and `tsx` in `.md` and `.mdx`.)

## Features

- Show typescript diagnostics in markdown.
  - use `tsconfig.json` at project root
- Import other `.ts` files
  - `import Foo from "./index";`
- Import self code block file
  - Code block with `ts:foo.ts` and `import {} from "./self.md@foo.ts";`

## Example

## Run 

Install and `markdown-code-features.enabled: true` in .vscode/settings.json

```json
{
  "markdown-code-features.enable": true,
  // enable completion for markdown
  "[markdown]": {
    "editor.quickSuggestions": {
        "comments": true,
        "strings": true,
        "other": true
    }
  }
}
```

## TODO

- [x] activate in `.md` and `.mdx`
- [x] typescript: completion
- [x] typescript: diagnostics
- [ ] mdx: completion
- [ ] css: completion
- [ ] html: completion
- [ ] Selective update for performance
- [ ] compiler: run
- [ ] compiler: run tests
- [ ] compiler: run with mdx component
- [ ] CLI: typechecker

## Develop

```bash
# for test
code vscode-extensions
```

- Run and Debug on Vscode > Run (F5)

## Local install

```bash
# cd vscode-extenions
$ pnpm install
$ pnpm build
$ pnpm package # generate markdown-code-features-x.x.x.vsix
```

Local install

- Install `ctrl-shift-p` in vscode
- `Extensions: Install from VSIX` and select it


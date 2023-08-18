# Markdown Code Features

Support diagnostics and completion in markdown code block

- markdown-compiler
- vscode


## Example

```ts
import { ex } from "./index";

// @ts-expect-error
let num: number = "";

console.log("hello");
function hello() {
  console.log("");
}
```
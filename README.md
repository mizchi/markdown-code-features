# Markdown Code Features

Support diagnostics and completion in markdown code block

- markdown-compiler
- vscode


## Example

```ts
import { ex } from "./index";

const x: string = ex;

// @ts-expect-error
let num: number = "";

console.log("hello");

function hello() {
  console.log("");
}
```
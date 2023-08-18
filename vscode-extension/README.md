# Markdown Code Features

Support diagnostics and completion in markdown code block

Now only for typescript in `.md` and `.mdx`.

**CAUTION**: not performance-tuned yet.

## Example

![Alt text](demo.png)

## Run 

Install and `markdown-code-features.enabled: true` in .vscode/settings.json

```json
{
  "markdow-code-features.enable": true
}
```

## TODO

- [ ] activate in `.md` and `.mdx`
- [x] typescript: completion
- [x] typescript: diagnostics
- [ ] css: completion
- [ ] html: completion
- [ ] Selective update for performance
- [ ] compiler: run
- [ ] compiler: run tests
- [ ] compiler: run with mdx component

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


-----------------------

original readme

# vscode extension boilerplate

<div align="center">

[![Version](https://img.shields.io/visual-studio-marketplace/v/YuTengjing.awesome-vscode-extension-boilerplate)](https://marketplace.visualstudio.com/items/YuTengjing.awesome-vscode-extension-boilerplate/changelog) [![Installs](https://img.shields.io/visual-studio-marketplace/i/YuTengjing.awesome-vscode-extension-boilerplate)](https://marketplace.visualstudio.com/items?itemName=YuTengjing.awesome-vscode-extension-boilerplate) [![Downloads](https://img.shields.io/visual-studio-marketplace/d/YuTengjing.awesome-vscode-extension-boilerplate)](https://marketplace.visualstudio.com/items?itemName=YuTengjing.awesome-vscode-extension-boilerplate) [![Rating Star](https://img.shields.io/visual-studio-marketplace/stars/YuTengjing.awesome-vscode-extension-boilerplate)](https://marketplace.visualstudio.com/items?itemName=YuTengjing.awesome-vscode-extension-boilerplate&ssr=false#review-details) [![Last Updated](https://img.shields.io/visual-studio-marketplace/last-updated/YuTengjing.awesome-vscode-extension-boilerplate)](https://github.com/tjx666/awesome-vscode-extension-boilerplate)

![CI](https://github.com/tjx666/awesome-vscode-extension-boilerplate/actions/workflows/ci.yml/badge.svg) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat)](http://makeapullrequest.com) [![Github Open Issues](https://img.shields.io/github/issues/tjx666/awesome-vscode-extension-boilerplate)](https://github.com/tjx666/awesome-vscode-extension-boilerplate/issues) [![LICENSE](https://img.shields.io/badge/license-Anti%20996-blue.svg?style=flat-square)](https://github.com/996icu/996.ICU/blob/master/LICENSE)

</div>

## Features

- github actions support publish extension to both vs marketplace and open vsx
- auto generate changelog and publish github release, make sure you enabled the write permission of github actions
- pnpm/eslint/prettier/ling-staged/simple-git-hooks/stale-dep
- use esbuild to bundle extension

## Setup

After fork this repository and clone it to local, run:

```bash
cd <your-extension-directory>
npx setup-boilerplate
```

You can also just skip this step and adjust the boilerplate by yourself.

## Development

Install dependencies by:

```shell
pnpm install
```

Then run and debug extension like in [official documentation](https://code.visualstudio.com/api/get-started/your-first-extension)

## Publish

You need set two github actions secrets:

- VS_MARKETPLACE_TOKEN: [Visual Studio Marketplace token](https://learn.microsoft.com/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate)
- OPEN_VSX_TOKEN: [Open VSX Registry token](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions#3-create-an-access-token)

```shell
pnpm release
```

## My extensions

- [Open in External App](https://github.com/tjx666/open-in-external-app)
- [VSCode archive](https://github.com/tjx666/vscode-archive)
- [Neo File Utils](https://github.com/tjx666/vscode-neo-file-utils)
- [VSCode FE Helper](https://github.com/tjx666/vscode-fe-helper)
- [Modify File Warning](https://github.com/tjx666/modify-file-warning)
- [Power Edit](https://github.com/tjx666/power-edit)
- [Adobe Extension Development Tools](https://github.com/tjx666/vscode-adobe-extension-devtools)
- [Scripting Listener](https://github.com/tjx666/scripting-listener)

Check all here: [publishers/YuTengjing](https://marketplace.visualstudio.com/publishers/YuTengjing)
const regex = new RegExp(/```(?<type>[^\n]*)?\n(?<content>[.\s\S\n]*?)\n```/gm);
type Range = [from: number, to: number];
export type CodeBlock = {
  blockRange: Range;
  codeRange: Range;
  content: string;
  id: string | undefined;
  lang: string;
};

export function extractCodeBlocks(text: string) {
  const blocks: Array<CodeBlock> = [];
  for (const match of text.matchAll(regex)) {
    const { content, type } = match.groups! as {
      content: string;
      type: string;
    };
    const start = match.index!;
    const end = start + match[0].length;
    const codeStart = start + 3 + type.length + 1;
    const codeEnd = codeStart + content.length;
    const [lang, id] = type.split(":");
    blocks.push({
      blockRange: [start, end],
      codeRange: [codeStart, codeEnd],
      lang,
      content,
      id,
    });
  }
  return blocks;
}

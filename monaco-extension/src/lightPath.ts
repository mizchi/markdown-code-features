export function join(...paths: string[]): string {
  return paths
    .join("/")
    .replace(/\/+/g, "/") // 複数のスラッシュを一つにまとめる
    .replace(/^\/|\/$/g, ""); // 文字列の最初と最後のスラッシュを取り除く
}

export function dirname(path: string): string {
  const parts = path.split("/");
  parts.pop(); // 最後の部分（ファイル名またはディレクトリ名）を取り除く
  return parts.join("/") || "/";
}

export function basename(path: string, ext?: string): string {
  const base = path.split("/").pop() || "";
  if (ext && base.endsWith(ext)) {
    return base.substring(0, base.length - ext.length);
  }
  return base;
}

export default {
  join,
  dirname,
  basename,
};

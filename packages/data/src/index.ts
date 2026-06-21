import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const dataRoot = join(packageRoot, "data");

export function readDataJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(join(dataRoot, relativePath), "utf8")) as T;
}

export function getDataRoot(): string {
  return dataRoot;
}

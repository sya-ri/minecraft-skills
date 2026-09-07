import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildCommandTreeSurface, getVersionDetail } from "@minecraft-skills/catalog";

export function ingestCommandTree(options: {
  root: string;
  version: string;
  reportsDir: string;
  retrievedAt: string;
}): string {
  const path = join(options.reportsDir, "commands.json");
  if (statSync(path).size > 16 * 1024 * 1024)
    throw new Error("commands.json exceeds 16 MiB input limit");
  const bytes = readFileSync(path),
    download = getVersionDetail("java", options.version).downloads?.server;
  if (
    !download ||
    typeof download !== "object" ||
    !("url" in download) ||
    typeof download.url !== "string" ||
    !("sha1" in download) ||
    typeof download.sha1 !== "string"
  )
    throw new Error("Version has no official server artifact");
  const surface = buildCommandTreeSurface(JSON.parse(bytes.toString("utf8")), options.version, {
    kind: "official-generated",
    url: download.url,
    serverSha1: download.sha1,
    reportSha256: createHash("sha256").update(bytes).digest("hex"),
    retrievedAt: options.retrievedAt,
  });
  const directory = join(options.root, "packages/data/data/java/command-trees");
  mkdirSync(directory, { recursive: true });
  const output = join(directory, `${options.version}.json`);
  writeFileSync(output, `${JSON.stringify(surface)}\n`);
  return output;
}

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildEntityMetadataSurface,
  entityMetadataArtifacts,
  searchRegistryEntries,
} from "@minecraft-skills/catalog";

export function ingestEntityMetadata(options: {
  root: string;
  version: string;
  input: string;
  retrievedAt: string;
}): string {
  const artifact = entityMetadataArtifacts[options.version as keyof typeof entityMetadataArtifacts];
  if (!artifact)
    throw new Error("Entity metadata ingestion supports exact versions 26.2 and 1.21.11");
  if (statSync(options.input).size > 16 * 1024 * 1024)
    throw new Error("Entity metadata report exceeds the 16 MiB input limit");
  const bytes = readFileSync(options.input);
  const registry = searchRegistryEntries({
    version: options.version,
    registry: "minecraft:entity_type",
    limit: 500,
  });
  if (registry.registryStatus !== "indexed" || registry.truncated)
    throw new Error("Complete official entity registry coverage is required for ingestion");
  const extractor = readFileSync(
    join(options.root, "packages/maintainer/scripts/ExtractEntityMetadata.java"),
    "utf8",
  ).replaceAll("\r\n", "\n");
  const surface = buildEntityMetadataSurface(
    JSON.parse(bytes.toString("utf8")),
    options.version,
    registry.entries.map((entry) => entry.entryId),
    {
      kind: "official-reflection",
      url: `https://piston-data.mojang.com/v1/objects/${artifact.serverSha1}/server.jar`,
      serverSha1: artifact.serverSha1,
      mappings:
        artifact.mappingsSha1 === null
          ? null
          : {
              url: `https://piston-data.mojang.com/v1/objects/${artifact.mappingsSha1}/server.txt`,
              sha1: artifact.mappingsSha1,
            },
      reportSha256: createHash("sha256").update(bytes).digest("hex"),
      extractorSha256: createHash("sha256").update(extractor).digest("hex"),
      retrievedAt: options.retrievedAt,
    },
  );
  const directory = join(options.root, "packages/data/data/java/entity-metadata");
  mkdirSync(directory, { recursive: true });
  const output = join(directory, `${options.version}.json`);
  writeFileSync(output, `${JSON.stringify(surface)}\n`);
  return output;
}

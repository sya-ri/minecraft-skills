import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildJavaReportsSummary } from "./javaReports.js";

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

describe("buildJavaReportsSummary", () => {
  it("summarizes command paths and datapack reports", () => {
    const reportsDir = mkdtempSync(join(tmpdir(), "minecraft-skills-java-reports-"));
    writeJson(join(reportsDir, "commands.json"), {
      type: "root",
      children: {
        say: {
          type: "literal",
          children: {
            message: {
              type: "argument",
              parser: "minecraft:message",
              executable: true,
            },
          },
        },
      },
    });
    writeJson(join(reportsDir, "datapack.json"), {
      others: {
        function: { elements: true, format: "mcfunction", stable: true, tags: true },
      },
      registries: {
        "minecraft:damage_type": { elements: true, stable: false, tags: true },
      },
    });
    writeJson(join(reportsDir, "registries.json"), {
      "minecraft:damage_type": {
        protocol_id: 23,
        entries: {
          "minecraft:generic": {},
          "minecraft:magic": {},
        },
      },
    });
    for (const name of ["blocks.json", "json-rpc-api-schema.json", "packets.json"]) {
      writeJson(join(reportsDir, name), {});
    }

    const result = buildJavaReportsSummary({
      version: "26.2",
      reportsDir,
      serverJarUrl: "https://example.test/server.jar",
      retrievedAt: "2026-06-22T00:00:00+09:00",
    });

    expect(result.commandPaths).toEqual(["say <message:minecraft:message>"]);
    expect(result.summary.commands.rootLiterals).toEqual(["say"]);
    expect(result.summary.commands.argumentParsers).toEqual(["minecraft:message"]);
    expect(result.summary.datapack.registries).toContainEqual({
      id: "minecraft:damage_type",
      elements: true,
      stable: false,
      tags: true,
      entryCount: 2,
      protocolId: 23,
    });
  });
});

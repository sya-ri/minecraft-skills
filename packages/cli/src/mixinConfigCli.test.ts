import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mixinConfigValidationLimits } from "@minecraft-skills/catalog";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "./cli.js";

const temporaryRoots: string[] = [];

function temporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "minecraft-skills-mixin-"));
  temporaryRoots.push(root);
  return root;
}

async function capture(argv: string[]) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await runCli(argv, {
    write: (value) => stdout.push(value),
    error: (value) => stderr.push(value),
  });
  return { code, stdout, stderr };
}

describe("minecraft validate-mixin-config CLI", () => {
  afterEach(() => {
    for (const root of temporaryRoots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("validates raw config text and complete local archive evidence", async () => {
    const root = temporaryRoot();
    const configPath = join(root, "example.mixins.json");
    const entriesPath = join(root, "entries.json");
    writeFileSync(
      configPath,
      '{"minVersion":"0.8.7","package":"example.mixin","mixins":["Feature"]}',
    );
    writeFileSync(entriesPath, JSON.stringify(["example/mixin/Feature.class"]));

    const result = await capture([
      "minecraft",
      "validate-mixin-config",
      configPath,
      "--archive-entries",
      entriesPath,
      "--archive-entries-complete",
      "true",
    ]);
    const output = JSON.parse(result.stdout[0] ?? "null") as {
      valid: boolean;
      outcome: string;
      source: { inputKind: string; duplicateKeys: string };
      archiveEvidence: { observedReferences: number };
    };

    expect(result.code).toBe(0);
    expect(result.stderr).toEqual([]);
    expect(output).toMatchObject({
      valid: true,
      outcome: "valid",
      source: { inputKind: "text", duplicateKeys: "checked-unique" },
      archiveEvidence: { observedReferences: 1 },
    });
  });

  it("preserves raw duplicate-key evidence and returns one for definitive errors", async () => {
    const root = temporaryRoot();
    const duplicatePath = join(root, "duplicate.json");
    const invalidPath = join(root, "invalid.json");
    writeFileSync(duplicatePath, '{"minVersion":"0.8.7","package":"first","package":"second"}');
    writeFileSync(invalidPath, '{"package":"","mixins":["Feature"]}');

    const duplicate = await capture(["minecraft", "validate-mixin-config", duplicatePath]);
    const invalid = await capture(["minecraft", "validate-mixin-config", invalidPath]);

    expect(duplicate.code).toBe(0);
    expect(duplicate.stdout.join("\n")).toContain('"duplicateKeys": "observed"');
    expect(invalid.code).toBe(1);
    expect(invalid.stdout.join("\n")).toContain('"config.missing-package"');
  });

  it("defaults supplied archive metadata to incomplete evidence", async () => {
    const root = temporaryRoot();
    const configPath = join(root, "config.json");
    const entriesPath = join(root, "entries.json");
    writeFileSync(configPath, '{"minVersion":"0.8.7","package":"example","mixins":["External"]}');
    writeFileSync(entriesPath, "[]");

    const result = await capture([
      "minecraft",
      "validate-mixin-config",
      configPath,
      "--archive-entries",
      entriesPath,
    ]);

    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"entryListDeclaredComplete": false');
    expect(result.stdout.join("\n")).toContain('"suppliedArchive": "not-checked"');
  });

  it("rejects unknown, repeated, and unsupported edition options", async () => {
    const root = temporaryRoot();
    const configPath = join(root, "config.json");
    writeFileSync(configPath, "{}");

    const unknown = await capture([
      "minecraft",
      "validate-mixin-config",
      configPath,
      "--unknown",
      "value",
    ]);
    const repeated = await capture([
      "minecraft",
      "validate-mixin-config",
      configPath,
      "--archive-entries-complete",
      "false",
      "--archive-entries-complete",
      "true",
    ]);
    const edition = await capture([
      "minecraft",
      "validate-mixin-config",
      configPath,
      "--edition",
      "java",
    ]);

    expect(unknown.code).toBe(1);
    expect(unknown.stderr).toEqual(["Unknown option: --unknown"]);
    expect(repeated.code).toBe(1);
    expect(repeated.stderr[0]).toContain("must not be repeated");
    expect(edition.code).toBe(1);
    expect(edition.stderr).toEqual(["Unknown option: --edition"]);
  });

  it("rejects missing option values and completeness claims without an entry list", async () => {
    const root = temporaryRoot();
    const configPath = join(root, "config.json");
    writeFileSync(configPath, "{}");

    const missingEntriesValue = await capture([
      "minecraft",
      "validate-mixin-config",
      configPath,
      "--archive-entries",
    ]);
    const missingCompleteValue = await capture([
      "minecraft",
      "validate-mixin-config",
      configPath,
      "--archive-entries-complete",
    ]);
    const unsupportedClaim = await capture([
      "minecraft",
      "validate-mixin-config",
      configPath,
      "--archive-entries-complete",
      "true",
    ]);

    expect(missingEntriesValue.code).toBe(1);
    expect(missingEntriesValue.stderr).toEqual(["--archive-entries requires a value"]);
    expect(missingCompleteValue.code).toBe(1);
    expect(missingCompleteValue.stderr).toEqual(["--archive-entries-complete requires a value"]);
    expect(unsupportedClaim.code).toBe(1);
    expect(unsupportedClaim.stderr).toEqual([
      "minecraft validate-mixin-config --archive-entries-complete true requires --archive-entries",
    ]);
  });

  it("does not expose local paths in regular-file or UTF-8 failures", async () => {
    const root = temporaryRoot();
    const missingPath = join(root, "secret-project-name.json");
    const directoryPath = join(root, "private-directory");
    const invalidUtf8Path = join(root, "private-utf8.json");
    mkdirSync(directoryPath);
    writeFileSync(invalidUtf8Path, Buffer.from([0xc3, 0x28]));

    for (const path of [missingPath, directoryPath, invalidUtf8Path]) {
      const result = await capture(["minecraft", "validate-mixin-config", path]);
      expect(result.code).toBe(1);
      expect(result.stderr.join("\n")).not.toContain(path);
      expect(result.stderr.join("\n")).not.toContain(root);
    }
  });

  it("bounds config file bytes before parsing", async () => {
    const root = temporaryRoot();
    const configPath = join(root, "oversized.json");
    writeFileSync(configPath, "x".repeat(mixinConfigValidationLimits.maxConfigBytes + 1));

    const result = await capture(["minecraft", "validate-mixin-config", configPath]);

    expect(result.code).toBe(1);
    expect(result.stderr).toEqual(["Mixin configuration exceeds its fixed byte limit."]);
  });

  it("requires archive-entry metadata to be valid JSON", async () => {
    const root = temporaryRoot();
    const configPath = join(root, "config.json");
    const entriesPath = join(root, "entries.json");
    writeFileSync(configPath, '{"minVersion":"0.8.7","package":"example"}');
    writeFileSync(entriesPath, "not-json");

    const result = await capture([
      "minecraft",
      "validate-mixin-config",
      configPath,
      "--archive-entries",
      entriesPath,
    ]);

    expect(result.code).toBe(1);
    expect(result.stderr).toEqual(["Archive-entry metadata must contain valid JSON."]);
  });
});

import { type BigIntStats, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mixinConfigValidationLimits } from "@minecraft-skills/catalog";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runCli } from "./cli.js";
import { readMixinConfigCliFiles } from "./mixinConfigFiles.js";

const temporaryRoots: string[] = [];

type FakeFileKind = "file" | "symlink" | "fifo" | "device";

function fakeBigIntStats(kind: FakeFileKind, identity: bigint, size = 0n): BigIntStats {
  return {
    dev: 1n,
    ino: identity,
    mode: 0o100644n,
    nlink: 1n,
    size,
    ctimeNs: identity * 10n,
    mtimeNs: identity * 10n,
    isFile: () => kind === "file",
    isSymbolicLink: () => kind === "symlink",
  } as unknown as BigIntStats;
}

function changedSnapshot(status: BigIntStats, field: "mode" | "nlink"): BigIntStats {
  return { ...status, [field]: status[field] + 1n } as BigIntStats;
}

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

  it("rejects symlink and special config inputs before opening them", () => {
    for (const kind of ["symlink", "fifo", "device"] as const) {
      const open = vi.fn(() => 7);
      expect(() =>
        readMixinConfigCliFiles(
          { configPath: "config.json" },
          { lstat: () => fakeBigIntStats(kind, 1n), open },
        ),
      ).toThrow("regular non-symbolic-link file");
      expect(open).not.toHaveBeenCalled();
    }
  });

  it("uses no-follow nonblocking flags and explicit bounded read positions", () => {
    const contents = Buffer.from("{}", "utf8");
    const expected = fakeBigIntStats("file", 1n, BigInt(contents.byteLength));
    const positions: number[] = [];
    const open = vi.fn(() => 7);
    const close = vi.fn(() => {
      throw new Error("private close failure");
    });

    const result = readMixinConfigCliFiles(
      { configPath: "config.json" },
      {
        lstat: () => expected,
        open,
        fstat: () => expected,
        read: (_handle, buffer, offset, length, position) => {
          positions.push(position);
          const bytesRead = Math.min(1, length);
          contents.copy(buffer, offset, position, position + bytesRead);
          return bytesRead;
        },
        close,
        openFlags: { readonly: 1, noFollow: 2, nonBlock: 4 },
      },
    );

    expect(result).toEqual({ config: "{}" });
    expect(open).toHaveBeenCalledWith("config.json", 7);
    expect(positions).toEqual([0, 1]);
    expect(close).toHaveBeenCalledWith(7);
  });

  it("rejects path, mode, and link-count replacement during a read", () => {
    const contents = Buffer.from("{}", "utf8");
    const expected = fakeBigIntStats("file", 1n, BigInt(contents.byteLength));
    const replacement = fakeBigIntStats("file", 2n, BigInt(contents.byteLength));
    let openingPathChecks = 0;
    expect(() =>
      readMixinConfigCliFiles(
        { configPath: "config.json" },
        {
          lstat: () => {
            openingPathChecks += 1;
            return openingPathChecks === 1 ? expected : replacement;
          },
          open: () => 7,
          fstat: () => expected,
          close: () => undefined,
        },
      ),
    ).toThrow("changed identity while it was being opened");

    let pathChecks = 0;

    expect(() =>
      readMixinConfigCliFiles(
        { configPath: "config.json" },
        {
          lstat: () => {
            pathChecks += 1;
            return pathChecks < 3 ? expected : replacement;
          },
          open: () => 7,
          fstat: () => expected,
          read: (_handle, buffer, offset, length, position) => {
            contents.copy(buffer, offset, position, position + length);
            return length;
          },
          close: () => undefined,
        },
      ),
    ).toThrow("changed while it was being read");

    for (const field of ["mode", "nlink"] as const) {
      let descriptorChecks = 0;
      expect(() =>
        readMixinConfigCliFiles(
          { configPath: "config.json" },
          {
            lstat: () => expected,
            open: () => 7,
            fstat: () => {
              descriptorChecks += 1;
              return descriptorChecks === 1 ? expected : changedSnapshot(expected, field);
            },
            read: (_handle, buffer, offset, length, position) => {
              contents.copy(buffer, offset, position, position + length);
              return length;
            },
            close: () => undefined,
          },
        ),
      ).toThrow("changed while it was being read");
    }
  });

  it("sanitizes low-level inspection, open, and read failures", () => {
    const privateDetail = "C:\\private\\mixin-config.json";
    const expected = fakeBigIntStats("file", 1n, 2n);
    const cases = [
      {
        lstat: () => {
          throw new Error(privateDetail);
        },
      },
      {
        lstat: () => expected,
        open: () => {
          throw new Error(privateDetail);
        },
      },
      {
        lstat: () => expected,
        open: () => 7,
        fstat: () => expected,
        read: () => {
          throw new Error(privateDetail);
        },
        close: () => undefined,
      },
      {
        lstat: () => expected,
        open: () => 7,
        fstat: () => expected,
        read: () => 3,
        close: () => undefined,
      },
    ];

    for (const overrides of cases) {
      let message = "";
      try {
        readMixinConfigCliFiles({ configPath: "config.json" }, overrides);
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }
      expect(message).not.toContain(privateDetail);
      expect(message).toContain("Mixin configuration");
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

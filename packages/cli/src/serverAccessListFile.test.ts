import { type BigIntStats, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultServerAccessListValidationLimits } from "@minecraft-skills/catalog";
import { describe, expect, it, vi } from "vitest";
import { runCli } from "./cli.js";
import { readServerAccessListFile } from "./serverAccessListFile.js";

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

function captureError(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("Expected the operation to throw");
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

describe("server access-list CLI", () => {
  it("infers canonical filenames and does not print identity values", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-access-list-cli-"));
    const file = join(root, "whitelist.json");
    const uuid = "123e4567-e89b-42d3-a456-426614174000";
    const name = "PrivateName";
    try {
      writeFileSync(file, `\uFEFF${JSON.stringify([{ uuid, name }])}`);
      const result = await capture([
        "minecraft",
        "validate-access-list",
        file,
        "--evaluated-at",
        "2026-08-25T00:00:00.000Z",
      ]);
      const output = result.stdout.join("\n");

      expect(result.code).toBe(0);
      expect(output).toContain('"kind": "whitelist"');
      expect(output).toContain('"evaluatedAt": "2026-08-25T00:00:00.000Z"');
      expect(output).toContain('"code": "utf8-bom"');
      expect(output).not.toContain(uuid);
      expect(output).not.toContain(name);
      expect(output).not.toContain(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("accepts a regular custom file with an explicit kind", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-access-list-custom-"));
    const file = join(root, "custom.json");
    try {
      writeFileSync(file, "[]");
      const result = await capture(["minecraft", "validate-access-list", file, "--kind", "ops"]);

      expect(result.code).toBe(0);
      expect(result.stdout.join("\n")).toContain('"kind": "ops"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects symlink, FIFO, and device inputs before attempting to open them", () => {
    for (const kind of ["symlink", "fifo", "device"] as const) {
      const open = vi.fn(() => 7);
      expect(() =>
        readServerAccessListFile("special.json", 1_024, {
          lstat: () => fakeBigIntStats(kind, 1n),
          open,
        }),
      ).toThrow("requires a regular local file that is not a symlink");
      expect(open).not.toHaveBeenCalled();
    }
  });

  it("uses no-follow nonblocking flags and explicit bounded read positions", () => {
    const contents = Buffer.from("[]", "utf8");
    const expected = fakeBigIntStats("file", 1n, BigInt(contents.byteLength));
    const positions: number[] = [];
    const open = vi.fn(() => 7);
    const close = vi.fn(() => {
      throw new Error("private close failure");
    });

    const result = readServerAccessListFile("whitelist.json", 1_024, {
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
    });

    expect(result).toBe("[]");
    expect(open).toHaveBeenCalledWith("whitelist.json", 7);
    expect(positions).toEqual([0, 1]);
    expect(close).toHaveBeenCalledWith(7);
  });

  it("rejects a path replaced before or during its read", () => {
    const contents = Buffer.from("[]", "utf8");
    const expected = fakeBigIntStats("file", 1n, BigInt(contents.byteLength));
    const replacement = fakeBigIntStats("file", 2n, BigInt(contents.byteLength));
    const closeBefore = vi.fn();

    expect(() =>
      readServerAccessListFile("whitelist.json", 1_024, {
        lstat: () => expected,
        open: () => 7,
        fstat: () => replacement,
        close: closeBefore,
      }),
    ).toThrow("changed before it could be read");
    expect(closeBefore).toHaveBeenCalledWith(7);

    let pathChecks = 0;
    const closeDuring = vi.fn();
    expect(() =>
      readServerAccessListFile("whitelist.json", 1_024, {
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
        close: closeDuring,
      }),
    ).toThrow("changed while it was being read");
    expect(closeDuring).toHaveBeenCalledWith(7);
  });

  it("rejects mode and link-count changes after reading", () => {
    const contents = Buffer.from("[]", "utf8");
    const expected = fakeBigIntStats("file", 1n, BigInt(contents.byteLength));
    for (const field of ["mode", "nlink"] as const) {
      let descriptorChecks = 0;
      expect(() =>
        readServerAccessListFile("whitelist.json", 1_024, {
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
        }),
      ).toThrow("changed while it was being read");
    }
  });

  it("sanitizes inspection, open, and read failures", () => {
    const privateDetail = "C:\\private\\access-list.json";
    const expected = fakeBigIntStats("file", 1n, 2n);
    const cases = [
      () =>
        readServerAccessListFile("whitelist.json", 1_024, {
          lstat: () => {
            throw new Error(privateDetail);
          },
        }),
      () =>
        readServerAccessListFile("whitelist.json", 1_024, {
          lstat: () => expected,
          open: () => {
            throw new Error(privateDetail);
          },
        }),
      () =>
        readServerAccessListFile("whitelist.json", 1_024, {
          lstat: () => expected,
          open: () => 7,
          fstat: () => expected,
          read: () => {
            throw new Error(privateDetail);
          },
          close: () => undefined,
        }),
    ];

    for (const run of cases) {
      const message = captureError(run);
      expect(message).not.toContain(privateDetail);
      expect(message).toContain("minecraft validate-access-list");
    }
  });

  it("rejects directories, oversized files, and malformed UTF-8 with path-free errors", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-access-list-errors-"));
    const oversized = join(root, "whitelist.json");
    const malformed = join(root, "ops.json");
    const directory = join(root, "banned-players.json");
    try {
      writeFileSync(
        oversized,
        Buffer.alloc(defaultServerAccessListValidationLimits.maxInputBytes + 1, 0x20),
      );
      writeFileSync(malformed, Buffer.from([0xc3, 0x28]));
      mkdirSync(directory);

      const oversizedResult = await capture(["minecraft", "validate-access-list", oversized]);
      const malformedResult = await capture(["minecraft", "validate-access-list", malformed]);
      const directoryResult = await capture(["minecraft", "validate-access-list", directory]);

      expect(oversizedResult.code).toBe(1);
      expect(oversizedResult.stderr.join("\n")).toContain("fixed byte limit");
      expect(malformedResult.code).toBe(1);
      expect(malformedResult.stderr.join("\n")).toContain("valid UTF-8");
      expect(directoryResult.code).toBe(1);
      expect(directoryResult.stderr.join("\n")).toContain("regular local file");
      expect(
        [oversizedResult, malformedResult, directoryResult]
          .flatMap((result) => result.stderr)
          .join("\n"),
      ).not.toContain(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("requires a kind for noncanonical filenames without printing the path", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-access-list-kind-"));
    const file = join(root, "custom.json");
    const canonicalFile = join(root, "ops.json");
    try {
      writeFileSync(file, "[]");
      writeFileSync(canonicalFile, "[]");
      const result = await capture(["minecraft", "validate-access-list", file]);
      const mismatch = await capture([
        "minecraft",
        "validate-access-list",
        canonicalFile,
        "--kind",
        "whitelist",
      ]);

      expect(result.code).toBe(1);
      expect(result.stderr.join("\n")).toContain("requires --kind");
      expect(result.stderr.join("\n")).not.toContain(file);
      expect(mismatch.code).toBe(1);
      expect(mismatch.stderr.join("\n")).toContain("does not match the canonical filename");
      expect(mismatch.stderr.join("\n")).not.toContain(canonicalFile);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

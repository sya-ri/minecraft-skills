import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  type BlockbenchProjectFileOperations,
  type BlockbenchProjectFileStats,
  readBlockbenchProjectFile,
} from "./blockbenchProjectFile.js";

const temporaryDirectories: string[] = [];

function temporaryFile(contents: string | Uint8Array): string {
  const directory = mkdtempSync(join(tmpdir(), "minecraft-skills-bbmodel-"));
  temporaryDirectories.push(directory);
  const path = join(directory, "model.bbmodel");
  writeFileSync(path, contents);
  return path;
}

function stats(overrides: Partial<BlockbenchProjectFileStats> = {}): BlockbenchProjectFileStats {
  return {
    dev: 1n,
    ino: 2n,
    size: 4n,
    mtimeNs: 10n,
    ctimeNs: 11n,
    isFile: true,
    isSymbolicLink: false,
    ...overrides,
  };
}

function operations(options: {
  pathStats?: BlockbenchProjectFileStats[];
  fileStats?: BlockbenchProjectFileStats[];
  reads?: number[];
  content?: string;
}): BlockbenchProjectFileOperations {
  const pathStats = [...(options.pathStats ?? [stats(), stats()])];
  const fileStats = [...(options.fileStats ?? [stats(), stats()])];
  const reads = [...(options.reads ?? [4])];
  const content = Buffer.from(options.content ?? "test");
  return {
    lstat: () => pathStats.shift() ?? stats(),
    open: () => 10,
    fstat: () => fileStats.shift() ?? stats(),
    read: (_file, buffer, offset, length) => {
      const count = reads.shift() ?? 0;
      content.copy(buffer, offset, 0, Math.min(count, length));
      return count;
    },
    close: () => undefined,
  };
}

describe("Blockbench project file reader", () => {
  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("reads a stable regular UTF-8 .bbmodel file", () => {
    const content = '{"meta":{"format_version":"5.0","model_format":"free"}}';
    const path = temporaryFile(content);
    expect(readBlockbenchProjectFile(path)).toBe(content);
  });

  it("rejects invalid UTF-8 without including the local path", () => {
    const path = temporaryFile(new Uint8Array([0xc3, 0x28]));
    expect(() => readBlockbenchProjectFile(path)).toThrow("requires valid UTF-8");
    try {
      readBlockbenchProjectFile(path);
    } catch (error) {
      expect(String(error)).not.toContain(path);
    }
  });

  it("rejects non-bbmodel paths before opening them", () => {
    expect(() => readBlockbenchProjectFile("model.json", operations({}))).toThrow(
      "requires one local .bbmodel file path",
    );
  });

  it("rejects symlink and special-file evidence before opening", () => {
    expect(() =>
      readBlockbenchProjectFile(
        "model.bbmodel",
        operations({ pathStats: [stats({ isFile: false, isSymbolicLink: true })] }),
      ),
    ).toThrow("refuses links");
    expect(() =>
      readBlockbenchProjectFile(
        "model.bbmodel",
        operations({ pathStats: [stats({ isFile: false })] }),
      ),
    ).toThrow("requires a regular local .bbmodel file");
  });

  it("rejects path-to-handle identity changes", () => {
    expect(() =>
      readBlockbenchProjectFile(
        "model.bbmodel",
        operations({ fileStats: [stats({ ino: 3n }), stats({ ino: 3n })] }),
      ),
    ).toThrow("requires a stable regular local .bbmodel file");
  });

  it("rejects size and timestamp changes while reading", () => {
    expect(() =>
      readBlockbenchProjectFile(
        "model.bbmodel",
        operations({ fileStats: [stats(), stats({ mtimeNs: 12n })] }),
      ),
    ).toThrow("changed while it was being read");
    expect(() =>
      readBlockbenchProjectFile(
        "model.bbmodel",
        operations({ pathStats: [stats(), stats({ ctimeNs: 13n })] }),
      ),
    ).toThrow("changed while it was being read");
  });

  it("rejects short and invalid read lengths", () => {
    expect(() => readBlockbenchProjectFile("model.bbmodel", operations({ reads: [2, 0] }))).toThrow(
      "changed while it was being read",
    );
    expect(() => readBlockbenchProjectFile("model.bbmodel", operations({ reads: [5] }))).toThrow(
      "invalid local file read length",
    );
  });

  it("rejects oversized file metadata before allocation", () => {
    expect(() =>
      readBlockbenchProjectFile(
        "model.bbmodel",
        operations({ pathStats: [stats({ size: 8n * 1024n * 1024n + 1n })] }),
      ),
    ).toThrow("refuses project files larger");
  });

  it("sanitizes unexpected filesystem errors", () => {
    const privatePath = "C:/private/secret/model.bbmodel";
    expect(() =>
      readBlockbenchProjectFile(privatePath, {
        ...operations({}),
        lstat: () => {
          throw new Error(`ENOENT ${privatePath}`);
        },
      }),
    ).toThrow("could not safely read the local .bbmodel file");
    try {
      readBlockbenchProjectFile(privatePath, {
        ...operations({}),
        lstat: () => {
          throw new Error(`ENOENT ${privatePath}`);
        },
      });
    } catch (error) {
      expect(String(error)).not.toContain(privatePath);
    }
  });
});

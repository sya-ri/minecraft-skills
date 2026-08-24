import {
  type BigIntStats,
  constants,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runCli } from "./cli.js";
import {
  validateNewPlayerTexturePngPath,
  writeNewPlayerTexturePng,
} from "./playerTextureOutput.js";

const referenceHash = "0123456789abcdef".repeat(4);

function crc32(value: Uint8Array): number {
  let crc = 0xffff_ffff;
  for (const byte of value) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb8_8320 : 0);
    }
  }
  return (crc ^ 0xffff_ffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array = new Uint8Array()): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const result = Buffer.alloc(12 + data.byteLength);
  result.writeUInt32BE(data.byteLength, 0);
  typeBytes.copy(result, 4);
  Buffer.from(data).copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([typeBytes, Buffer.from(data)])), 8 + data.byteLength);
  return result;
}

function structuralPng(width = 64, height = 64): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", Buffer.from([0x78, 0x9c, 0x03, 0x00])),
    pngChunk("IEND"),
  ]);
}

function response(bytes: Uint8Array): Response {
  return new Response(bytes, {
    status: 200,
    headers: {
      "content-type": "image/png",
      "content-length": String(bytes.byteLength),
    },
  });
}

function withDifferentIdentity(status: BigIntStats): BigIntStats {
  return Object.assign(Object.create(Object.getPrototypeOf(status)), status, {
    ino: status.ino + 1n,
  }) as BigIntStats;
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

describe("player-texture download CLI", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("downloads and exclusively saves a validated skin without JSON byte or path disclosure", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-player-texture-"));
    const outputPath = join(root, "PRIVATE_OUTPUT_PATH.png");
    const bytes = structuralPng();
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => response(bytes));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const result = await capture([
        "player-texture",
        "download",
        referenceHash,
        "--kind",
        "skin",
        "--output",
        outputPath,
      ]);

      expect(result.code).toBe(0);
      expect(result.stderr).toEqual([]);
      expect(readFileSync(outputPath)).toEqual(bytes);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0]?.[0]).toBe(
        `https://textures.minecraft.net/texture/${referenceHash}`,
      );
      const output = JSON.parse(result.stdout.join("\n")) as {
        status: string;
        saved: boolean;
        content: {
          kind: string;
          byteLength: number;
          evidence: { requestedReferenceHash: string; downloadedContentSha256: string };
          png: { valid: boolean };
          skinLayout: { valid: boolean; layoutStatus: string };
          bytes?: unknown;
        };
      };
      expect(output).toMatchObject({
        status: "downloaded",
        saved: true,
        content: {
          kind: "skin",
          byteLength: bytes.byteLength,
          evidence: { requestedReferenceHash: referenceHash },
          png: { valid: true },
          skinLayout: { valid: true, layoutStatus: "current" },
        },
      });
      expect(output.content).not.toHaveProperty("bytes");
      expect(result.stdout.join("\n")).not.toContain("PRIVATE_OUTPUT_PATH");
      expect(result.stdout.join("\n")).not.toContain(bytes.toString("base64"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("saves cape PNG structure without adding a skin-layout claim", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-player-cape-"));
    const outputPath = join(root, "cape.png");
    vi.stubGlobal("fetch", async () => response(structuralPng(17, 31)));
    try {
      const result = await capture([
        "player-texture",
        "download",
        referenceHash,
        "--kind",
        "cape",
        "--output",
        outputPath,
      ]);

      expect(result.code).toBe(0);
      expect(JSON.parse(result.stdout.join("\n"))).toMatchObject({
        saved: true,
        content: { kind: "cape", png: { valid: true }, skinLayout: null },
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not create output for invalid downloaded PNG content", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-player-invalid-"));
    const outputPath = join(root, "invalid.png");
    vi.stubGlobal("fetch", async () => response(Buffer.from("not a png")));
    try {
      const result = await capture([
        "player-texture",
        "download",
        referenceHash,
        "--kind",
        "skin",
        "--output",
        outputPath,
      ]);

      expect(result.code).toBe(1);
      expect(existsSync(outputPath)).toBe(false);
      expect(JSON.parse(result.stdout.join("\n"))).toMatchObject({
        status: "invalid-content",
        code: "invalid-png",
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not create output or leak response detail for a failed request", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-player-missing-"));
    const outputPath = join(root, "missing.png");
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response("PRIVATE_RESPONSE_BODY", {
          status: 404,
          statusText: "PRIVATE_STATUS_TEXT",
        }),
    );
    try {
      const result = await capture([
        "player-texture",
        "download",
        referenceHash,
        "--kind",
        "skin",
        "--output",
        outputPath,
      ]);

      expect(result.code).toBe(1);
      expect(existsSync(outputPath)).toBe(false);
      expect(result.stdout.join("\n")).toContain('"code": "unexpected-status"');
      expect(result.stdout.join("\n")).not.toContain("PRIVATE");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    [referenceHash.toUpperCase(), "--kind", "skin", "--output", "new.png"],
    ["Steve", "--kind", "skin", "--output", "new.png"],
    [referenceHash, "--kind", "head", "--output", "new.png"],
    [referenceHash, "--output", "new.png"],
    [referenceHash, "--kind", "skin"],
    [referenceHash, "--kind", "skin", "--url", "https://private.example", "--output", "new.png"],
    [referenceHash, "--kind", "skin", "--header", "Private: value", "--output", "new.png"],
    [referenceHash, "--kind", "skin", "--kind", "cape", "--output", "new.png"],
  ])("rejects closed or ambiguous caller input before network %#", async (...args) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await capture(["player-texture", "download", ...args]);

    expect(result.code).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    "texture.PNG",
    "texture.png.tmp",
    ".png",
  ])("requires the exact .png output extension before network: %s", async (name) => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-player-extension-"));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    try {
      const result = await capture([
        "player-texture",
        "download",
        referenceHash,
        "--kind",
        "skin",
        "--output",
        join(root, name),
      ]);
      expect(result.code).toBe(1);
      expect(result.stderr.join("\n")).toContain("ending exactly in .png");
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects existing regular, directory, junction, and linked-parent paths before network", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-player-output-kind-"));
    const regular = join(root, "regular.png");
    const directory = join(root, "directory.png");
    const junctionTarget = join(root, "junction-target");
    const junction = join(root, "junction.png");
    const linkedParent = join(root, "linked-parent");
    writeFileSync(regular, "keep");
    mkdirSync(directory);
    mkdirSync(junctionTarget);
    symlinkSync(junctionTarget, junction, process.platform === "win32" ? "junction" : "dir");
    symlinkSync(junctionTarget, linkedParent, process.platform === "win32" ? "junction" : "dir");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    try {
      for (const outputPath of [regular, directory, junction, join(linkedParent, "child.png")]) {
        const result = await capture([
          "player-texture",
          "download",
          referenceHash,
          "--kind",
          "skin",
          "--output",
          outputPath,
        ]);
        expect(result.code).toBe(1);
      }
      expect(readFileSync(regular, "utf8")).toBe("keep");
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("preserves a race winner created while the download is in progress", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-player-race-"));
    const outputPath = join(root, "race.png");
    vi.stubGlobal("fetch", async () => {
      writeFileSync(outputPath, "race winner");
      return response(structuralPng());
    });
    try {
      const result = await capture([
        "player-texture",
        "download",
        referenceHash,
        "--kind",
        "skin",
        "--output",
        outputPath,
      ]);

      expect(result.code).toBe(1);
      expect(readFileSync(outputPath, "utf8")).toBe("race winner");
      expect(result.stderr.join("\n")).not.toContain(outputPath);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a parent directory replaced while the download is in progress", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-player-parent-download-race-"));
    const originalParent = join(root, "output");
    const replacementParent = join(root, "replacement");
    const movedOriginalParent = join(root, "original");
    const outputPath = join(originalParent, "skin.png");
    mkdirSync(originalParent);
    mkdirSync(replacementParent);
    vi.stubGlobal("fetch", async () => {
      renameSync(originalParent, movedOriginalParent);
      renameSync(replacementParent, originalParent);
      return response(structuralPng());
    });
    try {
      const result = await capture([
        "player-texture",
        "download",
        referenceHash,
        "--kind",
        "skin",
        "--output",
        outputPath,
      ]);

      expect(result.code).toBe(1);
      expect(existsSync(outputPath)).toBe(false);
      expect(result.stderr.join("\n")).toContain("output parent changed");
      expect(result.stderr.join("\n")).not.toContain(outputPath);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("player texture exclusive output writer", () => {
  it("uses exclusive creation and never overwrites a winner of the final open race", () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-player-open-race-"));
    const outputPath = join(root, "race.png");
    try {
      expect(() =>
        writeNewPlayerTexturePng(validateNewPlayerTexturePngPath(outputPath), structuralPng(), {
          openExclusive: (path) => {
            writeFileSync(path, "winner");
            return openSync(path, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY);
          },
        }),
      ).toThrow("could not safely create");
      expect(readFileSync(outputPath, "utf8")).toBe("winner");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("loops across short writes and verifies the complete regular file", () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-player-short-write-"));
    const outputPath = join(root, "short.png");
    const bytes = structuralPng();
    try {
      writeNewPlayerTexturePng(validateNewPlayerTexturePngPath(outputPath), bytes, {
        write: (handle, value, offset, length) =>
          writeSync(handle, value, offset, Math.min(3, length), null),
      });
      expect(readFileSync(outputPath)).toEqual(bytes);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("removes only the exact partial file created by a failed write", () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-player-partial-"));
    const outputPath = join(root, "partial.png");
    try {
      expect(() =>
        writeNewPlayerTexturePng(validateNewPlayerTexturePngPath(outputPath), structuralPng(), {
          write: (handle, value, offset, length) => {
            writeSync(handle, value, offset, Math.min(5, length), null);
            throw new Error("simulated write failure");
          },
        }),
      ).toThrow("could not safely create");
      expect(existsSync(outputPath)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("never unlinks a replacement winner with a different target identity", () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-player-replacement-"));
    const outputPath = join(root, "replacement.png");
    let replacementVisible = false;
    let unlinkCalls = 0;
    try {
      expect(() =>
        writeNewPlayerTexturePng(validateNewPlayerTexturePngPath(outputPath), structuralPng(), {
          lstat: (path) => {
            const status = lstatSync(path, { bigint: true, throwIfNoEntry: false });
            return replacementVisible && resolve(path) === resolve(outputPath) && status
              ? withDifferentIdentity(status)
              : status;
          },
          unlink: (path) => {
            unlinkCalls += 1;
            unlinkSync(path);
          },
          write: (handle) => {
            writeSync(handle, Buffer.from("winner"), 0, 6, null);
            replacementVisible = true;
            throw new Error("simulated post-replacement failure");
          },
        }),
      ).toThrow("could not safely create");
      expect(unlinkCalls).toBe(0);
      expect(readFileSync(outputPath, "utf8")).toBe("winner");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("detects a parent identity swap and removes only its own matching output", () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-player-parent-swap-"));
    const outputPath = join(root, "parent-swap.png");
    let parentSwapped = false;
    try {
      expect(() =>
        writeNewPlayerTexturePng(validateNewPlayerTexturePngPath(outputPath), structuralPng(), {
          fsync: (handle) => {
            fsyncSync(handle);
            parentSwapped = true;
          },
          lstat: (path) => {
            const status = lstatSync(path, { bigint: true, throwIfNoEntry: false });
            return parentSwapped && resolve(path) === resolve(root) && status
              ? withDifferentIdentity(status)
              : status;
          },
        }),
      ).toThrow("output parent changed");
      expect(existsSync(outputPath)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

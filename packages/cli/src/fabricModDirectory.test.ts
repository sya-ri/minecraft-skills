import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "./cli.js";
import {
  defaultFabricModDirectoryInventoryLimits,
  diffFabricModDirectories,
  inventoryFabricModsDirectory,
} from "./fabricModDirectory.js";
import { readFabricModJarFile } from "./fabricModJarFile.js";

const temporaryRoots: string[] = [];

function temporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "minecraft-skills-fabric-mods-"));
  temporaryRoots.push(root);
  return root;
}

function crc32(value: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of value) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createStoredZip(entries: Record<string, string>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const nameBytes = Buffer.from(name);
    const contentBytes = Buffer.from(content);
    const checksum = crc32(contentBytes);
    const localHeader = Buffer.alloc(30 + nameBytes.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt32LE(0, 10);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(contentBytes.length, 18);
    localHeader.writeUInt32LE(contentBytes.length, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    localHeader.writeUInt16LE(0, 28);
    nameBytes.copy(localHeader, 30);
    localParts.push(localHeader, contentBytes);

    const centralHeader = Buffer.alloc(46 + nameBytes.length);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt32LE(0, 12);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(contentBytes.length, 20);
    centralHeader.writeUInt32LE(contentBytes.length, 24);
    centralHeader.writeUInt16LE(nameBytes.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    nameBytes.copy(centralHeader, 46);
    centralParts.push(centralHeader);
    offset += localHeader.length + contentBytes.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(centralParts.length, 8);
  end.writeUInt16LE(centralParts.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function fabricJar(
  id: string | undefined,
  version: string | undefined,
  environment: "*" | "client" | "server" = "*",
): Buffer {
  return createStoredZip({
    "fabric.mod.json": JSON.stringify({
      schemaVersion: 1,
      ...(id === undefined ? {} : { id }),
      ...(version === undefined ? {} : { version }),
      environment,
    }),
  });
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

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("Fabric mods directory inventory", () => {
  it("reads only direct exact .jar regular files and emits sorted normalized facts", () => {
    const root = temporaryRoot();
    const alpha = fabricJar("alpha", "1.0.0", "client");
    const zeta = fabricJar("zeta", "2.0.0", "server");
    writeFileSync(join(root, "zeta.jar"), zeta);
    writeFileSync(join(root, "alpha.jar"), alpha);
    writeFileSync(join(root, "ignored.JAR"), fabricJar("ignored", "1.0.0"));
    mkdirSync(join(root, "nested"));
    writeFileSync(join(root, "nested", "nested.jar"), fabricJar("nested", "1.0.0"));

    const result = inventoryFabricModsDirectory(root);

    expect(result.validationComplete).toBe(true);
    expect(result.valid).toBe(true);
    expect(result.observedDirectoryEntries).toBe(4);
    expect(result.observedJarCandidates).toBe(2);
    expect(result.entries.map((entry) => entry.fileName)).toEqual(["alpha.jar", "zeta.jar"]);
    expect(result.entries[0]).toMatchObject({
      byteLength: alpha.byteLength,
      sha256: createHash("sha256").update(alpha).digest("hex"),
      status: "validated",
      rejectionCode: null,
      mod: { id: "alpha", version: "1.0.0", environment: "client" },
      validation: { strength: "binary", valid: true, errorCount: 0 },
    });
    expect(result.accountedJarBytes).toBe(alpha.byteLength + zeta.byteLength);
    expect(result.nonClaims.join(" ")).toContain("Dependency graphs");
    expect(JSON.stringify(result)).not.toContain(root);
  });

  it("rejects linked roots and direct JAR reparse entries without exposing target paths", () => {
    const root = temporaryRoot();
    const target = join(root, "target");
    const linkedRoot = join(root, "linked-root");
    const scanRoot = join(root, "scan");
    const linkedJarTarget = join(root, "linked-jar-target");
    const linkedFileTarget = join(root, "linked-file-target.bin");
    mkdirSync(target);
    mkdirSync(scanRoot);
    mkdirSync(linkedJarTarget);
    writeFileSync(linkedFileTarget, fabricJar("linked", "1.0.0"));
    const linkType = process.platform === "win32" ? "junction" : "dir";
    symlinkSync(target, linkedRoot, linkType);
    symlinkSync(linkedJarTarget, join(scanRoot, "linked.jar"), linkType);
    let fileSymlinkCreated = true;
    try {
      symlinkSync(linkedFileTarget, join(scanRoot, "linked-file.jar"), "file");
    } catch (error) {
      if (process.platform !== "win32" || (error as NodeJS.ErrnoException).code !== "EPERM") {
        throw error;
      }
      fileSymlinkCreated = false;
    }

    const rootResult = inventoryFabricModsDirectory(linkedRoot);
    expect(rootResult.validationComplete).toBe(false);
    expect(rootResult.valid).toBe(false);
    expect(rootResult.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "directory.not-regular",
    );

    const jarResult = inventoryFabricModsDirectory(scanRoot);
    expect(jarResult.validationComplete).toBe(true);
    expect(jarResult.valid).toBe(false);
    expect(jarResult.entries).toEqual([
      ...(fileSymlinkCreated
        ? [
            expect.objectContaining({
              fileName: "linked-file.jar",
              status: "rejected",
              rejectionCode: "entry-not-regular-file",
            }),
          ]
        : []),
      expect.objectContaining({
        fileName: "linked.jar",
        status: "rejected",
        rejectionCode: "entry-not-regular-file",
      }),
    ]);
    expect(JSON.stringify({ rootResult, jarResult })).not.toContain(target);
    expect(JSON.stringify({ rootResult, jarResult })).not.toContain(linkedJarTarget);
  });

  it("reports all duplicate IDs while bounding retained groups and diagnostics", () => {
    const root = temporaryRoot();
    writeFileSync(join(root, "alpha-1.jar"), fabricJar("alpha", "1.0.0"));
    writeFileSync(join(root, "alpha-2.jar"), fabricJar("alpha", "2.0.0"));
    writeFileSync(join(root, "beta-1.jar"), fabricJar("beta", "1.0.0"));
    writeFileSync(join(root, "beta-2.jar"), fabricJar("beta", "2.0.0"));

    const duplicates = inventoryFabricModsDirectory(root, {
      limits: { maxDuplicateGroups: 1 },
    });
    expect(duplicates.valid).toBe(false);
    expect(duplicates.validationComplete).toBe(true);
    expect(duplicates.duplicateModIdGroupCount).toBe(2);
    expect(duplicates.duplicateGroupsTruncated).toBe(true);
    expect(duplicates.duplicateModIds).toEqual([
      { modId: "alpha", count: 2, fileNames: ["alpha-1.jar", "alpha-2.jar"] },
    ]);

    const diagnosticRoot = join(root, "diagnostics");
    mkdirSync(diagnosticRoot);
    mkdirSync(join(diagnosticRoot, "first.jar"));
    mkdirSync(join(diagnosticRoot, "second.jar"));
    const boundedDiagnostics = inventoryFabricModsDirectory(diagnosticRoot, {
      limits: { maxDiagnostics: 1 },
    });
    expect(boundedDiagnostics.rejectedJarCount).toBe(2);
    expect(boundedDiagnostics.diagnostics).toHaveLength(1);
    expect(boundedDiagnostics.diagnosticsTruncated).toBe(true);
    expect(boundedDiagnostics.omittedDiagnosticCount).toBe(1);
  });

  it("fails closed when fixed file-count or byte ceilings are exceeded", () => {
    const root = temporaryRoot();
    const first = fabricJar("first", "1.0.0");
    writeFileSync(join(root, "first.jar"), first);
    writeFileSync(join(root, "second.jar"), fabricJar("second", "1.0.0"));

    const fileLimited = inventoryFabricModsDirectory(root, { limits: { maxJarFiles: 1 } });
    expect(fileLimited.validationComplete).toBe(false);
    expect(fileLimited.valid).toBe(false);
    expect(fileLimited.observedJarCandidates).toBe(2);
    expect(fileLimited.entries).toHaveLength(0);
    expect(fileLimited.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "directory.jar-limit-exceeded",
    );

    const byteRoot = join(root, "bytes");
    mkdirSync(byteRoot);
    writeFileSync(join(byteRoot, "first.jar"), first);
    const byteLimited = inventoryFabricModsDirectory(byteRoot, {
      limits: { maxTotalJarBytes: first.byteLength - 1 },
    });
    expect(byteLimited.validationComplete).toBe(false);
    expect(byteLimited.accountedJarBytes).toBe(0);
    expect(byteLimited.entries[0]).toMatchObject({
      fileName: "first.jar",
      byteLength: first.byteLength,
      rejectionCode: "total-byte-limit-exceeded",
    });
    expect(byteLimited.limits.maxJarBytes).toBe(
      defaultFabricModDirectoryInventoryLimits.maxJarBytes,
    );

    const perFileLimited = inventoryFabricModsDirectory(byteRoot, {
      limits: { maxJarBytes: first.byteLength - 1 },
    });
    expect(perFileLimited.validationComplete).toBe(false);
    expect(perFileLimited.entries[0]).toMatchObject({
      fileName: "first.jar",
      rejectionCode: "jar-too-large",
    });

    const entryRoot = join(root, "entries");
    mkdirSync(entryRoot);
    writeFileSync(join(entryRoot, "one.txt"), "one");
    writeFileSync(join(entryRoot, "two.txt"), "two");
    const entryLimited = inventoryFabricModsDirectory(entryRoot, {
      limits: { maxDirectoryEntries: 1 },
    });
    expect(entryLimited.validationComplete).toBe(false);
    expect(entryLimited.observedDirectoryEntries).toBe(2);
    expect(entryLimited.entries).toHaveLength(0);
    expect(entryLimited.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "directory.entry-limit-exceeded",
    );

    const deterministicRoot = join(root, "deterministic-total");
    mkdirSync(deterministicRoot);
    const alpha = fabricJar("alpha", "1.0.0");
    const zeta = fabricJar("zeta", "1.0.0");
    writeFileSync(join(deterministicRoot, "zeta.jar"), zeta);
    writeFileSync(join(deterministicRoot, "alpha.jar"), alpha);
    const deterministicTotal = inventoryFabricModsDirectory(deterministicRoot, {
      limits: { maxTotalJarBytes: alpha.byteLength },
    });
    expect(deterministicTotal.entries).toEqual([
      expect.objectContaining({ fileName: "alpha.jar", status: "validated" }),
      expect.objectContaining({
        fileName: "zeta.jar",
        rejectionCode: "total-byte-limit-exceeded",
      }),
    ]);
    expect(deterministicTotal.accountedJarBytes).toBe(alpha.byteLength);
  });

  it("fails closed on a stable-read race and sanitizes filesystem failures", async () => {
    const root = temporaryRoot();
    const modPath = join(root, "racing.jar");
    const archive = fabricJar("racing", "1.0.0");
    writeFileSync(modPath, archive);
    const staleSnapshot = lstatSync(modPath, { bigint: true });
    writeFileSync(modPath, Buffer.concat([archive, Buffer.from("changed")]));
    expect(() =>
      readFabricModJarFile(modPath, defaultFabricModDirectoryInventoryLimits.maxJarBytes, {
        expectedPathSnapshot: staleSnapshot,
      }),
    ).toThrow("archive changed before it could be read");
    writeFileSync(modPath, archive);

    const stopBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
    const stop = new Int32Array(stopBuffer);
    const worker = new Worker(
      `
        const { parentPort, workerData } = require("node:worker_threads");
        const { utimesSync } = require("node:fs");
        const stop = new Int32Array(workerData.stopBuffer);
        let tick = 0;
        parentPort.postMessage("ready");
        while (Atomics.load(stop, 0) === 0) {
          const timestamp = new Date(1700000000000 + (tick % 100000) * 1000);
          tick += 1;
          try { utimesSync(workerData.modPath, timestamp, timestamp); } catch {}
        }
      `,
      { eval: true, workerData: { modPath, stopBuffer } },
    );
    await new Promise<void>((resolve, reject) => {
      worker.once("message", () => resolve());
      worker.once("error", reject);
    });

    let raced = inventoryFabricModsDirectory(root);
    try {
      for (let attempt = 0; attempt < 50 && raced.validationComplete; attempt += 1) {
        raced = inventoryFabricModsDirectory(root);
      }
    } finally {
      Atomics.store(stop, 0, 1);
      await worker.terminate();
    }
    expect(raced.validationComplete).toBe(false);
    expect(raced.entries).toEqual([
      expect.objectContaining({ fileName: "racing.jar", rejectionCode: "jar-read-failed" }),
    ]);
    const racedJson = JSON.stringify(raced);
    expect(racedJson).not.toContain(root);
    expect(racedJson).not.toContain(archive.toString("base64"));

    const missingPath = join(root, "private", "missing-mods");
    const missing = inventoryFabricModsDirectory(missingPath);
    const missingJson = JSON.stringify(missing);
    expect(missing.validationComplete).toBe(false);
    expect(missingJson).not.toContain(missingPath);
    expect(missingJson).not.toMatch(/ENOENT|EACCES|EPERM|system error/i);
  });
});

describe("Fabric mods directory diff", () => {
  it("pairs only unique valid mod IDs and separates ambiguous or unidentified entries", () => {
    const root = temporaryRoot();
    const leftRoot = join(root, "left");
    const rightRoot = join(root, "right");
    mkdirSync(leftRoot);
    mkdirSync(rightRoot);

    writeFileSync(join(leftRoot, "alpha-old.jar"), fabricJar("alpha", "1.0.0", "client"));
    writeFileSync(join(leftRoot, "removed.jar"), fabricJar("removed", "1.0.0"));
    writeFileSync(join(leftRoot, "dup-a.jar"), fabricJar("duplicate", "1.0.0"));
    writeFileSync(join(leftRoot, "dup-b.jar"), fabricJar("duplicate", "2.0.0"));
    writeFileSync(join(leftRoot, "invalid-peer.jar"), fabricJar("peer", undefined));
    writeFileSync(join(leftRoot, "unidentified.jar"), fabricJar(undefined, "1.0.0"));

    writeFileSync(join(rightRoot, "alpha-new.jar"), fabricJar("alpha", "2.0.0", "server"));
    writeFileSync(join(rightRoot, "added.jar"), fabricJar("added", "1.0.0"));
    writeFileSync(join(rightRoot, "dup.jar"), fabricJar("duplicate", "3.0.0"));
    writeFileSync(join(rightRoot, "peer.jar"), fabricJar("peer", "1.0.0"));

    const result = diffFabricModDirectories(
      inventoryFabricModsDirectory(leftRoot),
      inventoryFabricModsDirectory(rightRoot),
    );

    expect(result.comparisonComplete).toBe(false);
    expect(result.hasDifferences).toBe(true);
    expect(result.added.map((entry) => entry.modId)).toEqual(["added"]);
    expect(result.removed.map((entry) => entry.modId)).toEqual(["removed"]);
    expect(result.changed).toEqual([
      expect.objectContaining({
        modId: "alpha",
        changes: {
          version: true,
          environment: true,
          sha256: true,
          validation: false,
          fileName: true,
        },
      }),
    ]);
    expect(result.ambiguous.map((group) => group.modId)).toEqual(["duplicate", "peer"]);
    expect(result.ambiguous[0]?.reasons).toEqual(["left-duplicate"]);
    expect(result.ambiguous[1]?.reasons).toEqual(["left-invalid"]);
    expect(result.unidentified).toEqual([
      expect.objectContaining({
        side: "left",
        reason: "missing-mod-id",
        entry: expect.objectContaining({ fileName: "unidentified.jar" }),
      }),
    ]);
    expect(result.added.map((entry) => entry.modId)).not.toContain("peer");
    expect(result.removed.map((entry) => entry.modId)).not.toContain("peer");
    expect(JSON.stringify(result)).not.toContain(leftRoot);
    expect(JSON.stringify(result)).not.toContain(rightRoot);
  });

  it("provides automation-friendly CLI exit codes for inventories and factual differences", async () => {
    const root = temporaryRoot();
    const leftRoot = join(root, "left");
    const rightRoot = join(root, "right");
    mkdirSync(leftRoot);
    mkdirSync(rightRoot);
    const sameJar = fabricJar("same", "1.0.0");
    writeFileSync(join(leftRoot, "same.jar"), sameJar);
    writeFileSync(join(rightRoot, "same.jar"), sameJar);

    const inventory = await capture(["fabric", "mods", "inventory", leftRoot]);
    expect(inventory.code).toBe(0);
    expect(inventory.stderr).toEqual([]);
    expect(JSON.parse(inventory.stdout.join("\n"))).toMatchObject({
      kind: "fabric-mod-directory-inventory",
      valid: true,
    });
    expect(inventory.stdout.join("\n")).not.toContain(leftRoot);

    const identical = await capture(["fabric", "mods", "diff", leftRoot, rightRoot]);
    expect(identical.code).toBe(0);
    expect(JSON.parse(identical.stdout.join("\n"))).toMatchObject({
      comparisonComplete: true,
      hasDifferences: false,
    });

    writeFileSync(join(rightRoot, "same.jar"), fabricJar("same", "2.0.0"));
    const different = await capture(["fabric", "mods", "diff", leftRoot, rightRoot]);
    expect(different.code).toBe(1);
    expect(JSON.parse(different.stdout.join("\n"))).toMatchObject({
      comparisonComplete: true,
      hasDifferences: true,
      counts: { changed: 1 },
    });

    const unknownOption = await capture(["fabric", "mods", "inventory", leftRoot, "--recursive"]);
    expect(unknownOption.code).toBe(1);
    expect(unknownOption.stderr).toEqual(["Unknown option: --recursive"]);

    const sharedOption = await capture([
      "fabric",
      "mods",
      "diff",
      leftRoot,
      rightRoot,
      "--edition",
      "java",
    ]);
    expect(sharedOption.code).toBe(1);
    expect(sharedOption.stderr).toEqual(["Unknown option: --edition"]);

    const help = await capture(["help"]);
    expect(help.stdout.join("\n")).toContain("fabric mods inventory <directory>");
    expect(help.stdout.join("\n")).toContain("fabric mods diff <left-directory> <right-directory>");
  });
});

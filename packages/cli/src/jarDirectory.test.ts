import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runCli } from "./cli.js";
import {
  defaultFabricModDirectoryInventoryLimits,
  diffFabricModDirectories,
  inventoryFabricModsDirectory,
} from "./fabricModDirectory.js";
import { inventoryJarDirectory, jarDirectoryInventoryLimits } from "./jarDirectory.js";

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

function createStoredZip(entries: Record<string, string | Uint8Array>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const nameBytes = Buffer.from(name);
    const contentBytes = typeof content === "string" ? Buffer.from(content) : Buffer.from(content);
    const checksum = crc32(contentBytes);
    const localHeader = Buffer.alloc(30 + nameBytes.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(contentBytes.length, 18);
    localHeader.writeUInt32LE(contentBytes.length, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    nameBytes.copy(localHeader, 30);
    localParts.push(localHeader, contentBytes);

    const centralHeader = Buffer.alloc(46 + nameBytes.length);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(contentBytes.length, 20);
    centralHeader.writeUInt32LE(contentBytes.length, 24);
    centralHeader.writeUInt16LE(nameBytes.length, 28);
    centralHeader.writeUInt32LE(offset, 42);
    nameBytes.copy(centralHeader, 46);
    centralParts.push(centralHeader);
    offset += localHeader.length + contentBytes.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(centralParts.length, 8);
  end.writeUInt16LE(centralParts.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

const roots: string[] = [];
function root() {
  const value = mkdtempSync(join(tmpdir(), "minecraft-skills-jar-inventory-"));
  roots.push(value);
  return value;
}
function fabric(id = "example", version = "1.0.0") {
  return createStoredZip({ "fabric.mod.json": JSON.stringify({ schemaVersion: 1, id, version }) });
}
async function capture(args: string[]) {
  const stdout: string[] = [],
    stderr: string[] = [];
  const code = await runCli(args, {
    write: (line) => stdout.push(line),
    error: (line) => stderr.push(line),
  });
  return { code, stdout, stderr };
}
afterEach(() => {
  for (const value of roots.splice(0)) rmSync(value, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

describe("shared local JAR directory inspection", () => {
  it("inventories direct Fabric, Paper and Velocity archives without leaking paths or fetching", () => {
    const directory = root();
    writeFileSync(join(directory, "fabric.jar"), fabric());
    writeFileSync(
      join(directory, "paper.JAR"),
      createStoredZip({ "plugin.yml": "name: Example\nversion: 1.0\nmain: example.Main\n" }),
    );
    writeFileSync(
      join(directory, "velocity.jar"),
      createStoredZip({
        "velocity-plugin.json": JSON.stringify({
          id: "example",
          version: "2.0",
          main: "example.Main",
        }),
      }),
    );
    mkdirSync(join(directory, "nested"));
    writeFileSync(join(directory, "nested", "unseen.jar"), fabric("unseen"));
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const result = inventoryJarDirectory(directory);
    expect(result).toMatchObject({
      complete: true,
      evidenceStrength: "binary",
      inventory: { schemaVersion: 1, scanComplete: true },
      summary: { recordCount: 3, duplicateIdentityCount: 0 },
    });
    expect(result.inventory.records.map((record) => record.platform)).toEqual([
      "fabric",
      "paper",
      "velocity",
    ]);
    expect(JSON.stringify(result)).not.toContain(directory);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("preserves legacy Fabric output, limits, exact lowercase selection and diff behavior", () => {
    const directory = root();
    writeFileSync(join(directory, "example.jar"), fabric());
    writeFileSync(join(directory, "upper.JAR"), fabric("upper"));
    const legacy = inventoryFabricModsDirectory(directory),
      generic = inventoryJarDirectory(directory);
    expect(legacy).toMatchObject({
      schemaVersion: 1,
      kind: "fabric-mod-directory-inventory",
      validationComplete: true,
      valid: true,
      observedJarCandidates: 1,
      validJarCount: 1,
      invalidJarCount: 0,
      rejectedJarCount: 0,
    });
    expect(legacy.entries).toHaveLength(1);
    expect(legacy.entries[0]).toMatchObject({
      fileName: "example.jar",
      status: "validated",
      rejectionCode: null,
      mod: { id: "example", version: "1.0.0", environment: "*" },
      validation: { strength: "binary", valid: true },
    });
    expect(legacy.limits).toEqual(defaultFabricModDirectoryInventoryLimits);
    expect(legacy.limits.maxJarBytes).toBe(256 * 1024 * 1024);
    expect(generic.inventory.records).toHaveLength(2);
    expect(generic.inventory.records[0]?.sha256).toBe(legacy.entries[0]?.sha256);
    expect(jarDirectoryInventoryLimits.maxJarBytes).toBe(64 * 1024 * 1024);
    expect(diffFabricModDirectories(legacy, legacy)).toMatchObject({
      kind: "fabric-mod-directory-diff",
      comparisonComplete: true,
      hasDifferences: false,
      counts: { added: 0, removed: 0, changed: 0 },
    });
  });

  it("marks bounded and failed scans incomplete without producing absence evidence", () => {
    const directory = root();
    writeFileSync(join(directory, "a.jar"), fabric("first"));
    writeFileSync(join(directory, "b.jar"), fabric("second"));
    const limited = inventoryJarDirectory(directory, { limits: { maxJarFiles: 1 } });
    expect(limited).toMatchObject({
      complete: false,
      inventory: { scanComplete: false, records: [] },
    });
    const bytes = inventoryJarDirectory(directory, { limits: { maxJarBytes: 1 } });
    expect(bytes.inventory.scanComplete).toBe(false);
    expect(
      bytes.inventory.records.every(
        (entry) => entry.sha256 === null && entry.metadataIssue === "archive-limit",
      ),
    ).toBe(true);
    const failed = inventoryJarDirectory(join(directory, "missing"));
    expect(failed.inventory.scanComplete).toBe(false);
    expect(JSON.stringify(failed)).not.toContain(directory);
    const legacy = inventoryFabricModsDirectory(directory, { limits: { maxJarFiles: 1 } });
    expect(legacy).toMatchObject({ validationComplete: false, entries: [] });
  });

  it("keeps library JAR metadata and duplicate plugin identities explicit", () => {
    const directory = root();
    writeFileSync(join(directory, "a.jar"), fabric());
    writeFileSync(join(directory, "b.jar"), fabric());
    writeFileSync(join(directory, "library.jar"), createStoredZip({ "readme.txt": "library" }));
    const result = inventoryJarDirectory(directory);
    expect(result).toMatchObject({
      complete: false,
      inventory: { scanComplete: true },
      summary: { duplicateIdentityCount: 1, identityComplete: false },
    });
    expect(result.inventory.records[2]).toMatchObject({
      platform: null,
      id: null,
      metadataIssue: "descriptor-missing",
    });
  });

  it("routes generic CLI collection and comparison with complete/changed/unknown exit codes", async () => {
    const left = root(),
      right = root();
    writeFileSync(join(left, "example.jar"), fabric());
    writeFileSync(join(right, "example.jar"), fabric());
    const listed = await capture(["minecraft", "jars", "inventory", left]);
    expect(listed.code).toBe(0);
    expect(JSON.parse(listed.stdout.join("\n"))).toMatchObject({
      kind: "jar-directory-inventory",
      evidenceStrength: "binary",
    });
    expect((await capture(["minecraft", "jars", "diff", left, right])).code).toBe(0);
    writeFileSync(join(right, "example.jar"), fabric("example", "2.0"));
    const changed = await capture(["minecraft", "jars", "diff", left, right]);
    expect(changed.code).toBe(1);
    expect(JSON.parse(changed.stdout.join("\n"))).toMatchObject({
      comparisonComplete: true,
      hasDifferences: true,
      collectionEvidence: "stable-local-archive-bytes",
      counts: { changed: 1 },
    });
    const unknown = await capture(["minecraft", "jars", "diff", left, join(right, "missing")]);
    expect(unknown.code).toBe(1);
    expect(JSON.parse(unknown.stdout.join("\n"))).toMatchObject({
      comparisonComplete: false,
      hasDifferences: null,
      counts: { removed: 0 },
    });
    expect((await capture(["minecraft", "jars", "inventory", left, "--recursive"])).code).toBe(1);
  });
});

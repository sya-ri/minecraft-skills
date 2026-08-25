import { createHash } from "node:crypto";
import {
  type BigIntStats,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { deflateSync } from "node:zlib";
import {
  defaultServerPropertiesValidationLimits,
  getVersionDetail,
} from "@minecraft-skills/catalog";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runCli } from "./cli.js";
import { classifyDatapackProjectEntry, readDatapackProjectFiles } from "./datapackProjectFiles.js";
import { readFilePrefix } from "./filePrefix.js";
import {
  classifyResourcepackProjectEntry,
  readResourcepackProjectFiles,
} from "./resourcepackProjectFiles.js";
import { readBoundedServerProperties } from "./serverPropertiesFile.js";

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

function validVorbisIdentificationPage(): Buffer {
  return Buffer.from(
    "4f676753000200000000000000000100000000000000a7b4565b011e01766f72626973000000000180bb00000000000000000000000000008601",
    "hex",
  );
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

function testPng(width = 1, height = 1): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT"),
    pngChunk("IEND"),
  ]);
}

function testAlphaPng(alphaRows: readonly (readonly number[])[]): Buffer {
  const height = alphaRows.length;
  const width = alphaRows[0]?.length ?? 0;
  if (
    width === 0 ||
    height === 0 ||
    alphaRows.some((row) => row.length !== width || row.some((alpha) => alpha < 0 || 255 < alpha))
  ) {
    throw new Error("testAlphaPng requires a non-empty rectangular 8-bit alpha grid");
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const filtered = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (1 + width * 4);
    filtered[rowOffset] = 0;
    for (let x = 0; x < width; x += 1) {
      const pixelOffset = rowOffset + 1 + x * 4;
      filtered[pixelOffset] = 0x12;
      filtered[pixelOffset + 1] = 0x34;
      filtered[pixelOffset + 2] = 0x56;
      filtered[pixelOffset + 3] = alphaRows[y]?.[x] ?? 0;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(filtered)),
    pngChunk("IEND"),
  ]);
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

describe("minecraft-skills CLI", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("prints domains", async () => {
    const result = await capture(["domain", "list"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain("paper-plugin");
  });

  it("prints installable skills", async () => {
    const result = await capture(["skill", "list", "--domain", "paper-plugin"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toEqual([
      "minecraft-paper-plugins\tpaper-plugin\tskills/minecraft-paper-plugins\tMinecraft Paper Plugins",
    ]);
  });

  it("validates a bounded server.properties file without returning values", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-server-properties-cli-"));
    const propertyPath = join(root, "server.properties");
    const invalidPath = join(root, "invalid.properties");
    const bomPath = join(root, "bom.properties");
    try {
      writeFileSync(
        propertyPath,
        "server-port=25565\nonline-mode=true\nrcon.password=private-rcon-value\n",
        "utf8",
      );
      writeFileSync(invalidPath, "server-port=70000\n", "utf8");
      writeFileSync(bomPath, Buffer.from("\uFEFFpvp=true\n", "utf8"));

      const result = await capture([
        "server",
        "validate-properties",
        propertyPath,
        "--version",
        "1.21.11",
      ]);
      const serialized = result.stdout.join("\n");
      expect(result.code).toBe(0);
      expect(serialized).toContain('"targetVersion": "1.21.11"');
      expect(serialized).toContain('"validationComplete": false');
      expect(serialized).not.toContain("private-rcon-value");

      const invalid = await capture(["server", "validate-properties", invalidPath]);
      expect(invalid.code).toBe(1);
      expect(invalid.stdout.join("\n")).toContain("property.port-invalid");

      const bomPrefixed = await capture(["server", "validate-properties", bomPath]);
      const bomResult = JSON.parse(bomPrefixed.stdout.join("\n")) as {
        coverage: {
          recognizedKeyCount: number;
          unknownKeyCount: number;
          unknownKeys: Array<{ key: string }>;
        };
      };
      expect(bomPrefixed.code).toBe(0);
      expect(bomResult.coverage).toMatchObject({
        recognizedKeyCount: 0,
        unknownKeyCount: 1,
        unknownKeys: [{ key: "\uFEFFpvp" }],
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects unsafe server.properties inputs before parsing", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-server-properties-input-"));
    const invalidUtf8Path = join(root, "invalid-utf8.properties");
    const oversizedPath = join(root, "oversized.properties");
    const directoryPath = join(root, "directory.properties");
    try {
      writeFileSync(invalidUtf8Path, Buffer.from([0xff]));
      writeFileSync(
        oversizedPath,
        Buffer.alloc(defaultServerPropertiesValidationLimits.maxInputBytes + 1, 0x61),
      );
      mkdirSync(directoryPath);

      const invalidUtf8 = await capture(["server", "validate-properties", invalidUtf8Path]);
      const oversized = await capture(["server", "validate-properties", oversizedPath]);
      const directory = await capture(["server", "validate-properties", directoryPath]);
      const unknownOption = await capture([
        "server",
        "validate-properties",
        invalidUtf8Path,
        "--allow-unsafe",
      ]);
      const repeatedVersion = await capture([
        "server",
        "validate-properties",
        invalidUtf8Path,
        "--version",
        "1.21.11",
        "--version",
        "26.2",
      ]);
      const unsupportedEdition = await capture([
        "server",
        "validate-properties",
        invalidUtf8Path,
        "--edition",
        "java",
      ]);

      expect(invalidUtf8).toMatchObject({
        code: 1,
        stdout: [],
        stderr: ["server validate-properties requires strict UTF-8 input"],
      });
      expect(oversized.code).toBe(1);
      expect(oversized.stderr.join("\n")).toContain("refuses files larger than");
      expect(directory.code).toBe(1);
      expect(directory.stderr.join("\n")).toContain("regular, non-symlink local file");
      expect(unknownOption.stderr).toEqual(["Unknown option: --allow-unsafe"]);
      expect(repeatedVersion.stderr).toEqual([
        "server validate-properties --version must not be repeated",
      ]);
      expect(unsupportedEdition.stderr).toEqual(["Unknown option: --edition"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("binds server.properties reads to the captured regular-file identity", () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-server-properties-identity-"));
    const expectedPath = join(root, "expected.properties");
    const replacementPath = join(root, "replacement.properties");
    writeFileSync(expectedPath, "pvp=true\n", "utf8");
    writeFileSync(replacementPath, "pvp=false", "utf8");

    try {
      expect(() =>
        readBoundedServerProperties(expectedPath, {
          open: () => openSync(replacementPath, "r"),
        }),
      ).toThrow("file identity changed before it could be read");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("prints packaged skill payloads", async () => {
    const result = await capture(["skill", "show", "minecraft-paper-plugins"]);
    const output = result.stdout.join("\n");
    expect(result.code).toBe(0);
    expect(output).toContain('"name": "minecraft-paper-plugins"');
    expect(output).toContain("# Minecraft Paper Plugins");
    expect(output).toContain("display_name");
    expect(output).toContain("Minecraft Paper Plugins");
    expect(output).toContain("# Paper Plugin Sources");
  });

  it("writes packaged skill folders", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-cli-"));
    try {
      const result = await capture(["skill", "write", "minecraft-paper-plugins", "--output", root]);
      const skillRoot = join(root, "minecraft-paper-plugins");
      expect(result.code).toBe(0);
      expect(result.stdout).toContain(join(skillRoot, "SKILL.md"));
      expect(readFileSync(join(skillRoot, "SKILL.md"), "utf8")).toContain(
        "# Minecraft Paper Plugins",
      );
      expect(readFileSync(join(skillRoot, "agents/openai.yaml"), "utf8")).toContain("display_name");
      expect(readFileSync(join(skillRoot, "references/sources.md"), "utf8")).toContain(
        "# Paper Plugin Sources",
      );

      const blocked = await capture([
        "skill",
        "write",
        "minecraft-paper-plugins",
        "--output",
        root,
      ]);
      expect(blocked.code).toBe(1);
      expect(blocked.stderr.join("\n")).toContain("Refusing to overwrite existing file");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("prints bundled coverage summary", async () => {
    const result = await capture(["data", "coverage"]);
    const output = result.stdout.join("\n");
    expect(result.code).toBe(0);
    expect(output).toContain('"complete": true');
    expect(output).toContain('"latestSupportedVersion": "26.2"');
    expect(output).toContain('"packagedPayloads": 3');
  });

  it("creates RCON config files and warns before overwriting", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-rcon-cli-"));
    const configPath = join(root, "rcon.json");
    try {
      const created = await capture([
        "rcon",
        "init",
        "--config",
        configPath,
        "--preset",
        "guarded",
      ]);
      expect(created.code).toBe(0);
      expect(created.stdout.join("\n")).toContain('"written": true');
      expect(readFileSync(configPath, "utf8")).toContain('"preset": "guarded"');

      const blocked = await capture(["rcon", "init", "--config", configPath, "--preset", "full"]);
      expect(blocked.code).toBe(0);
      expect(blocked.stdout.join("\n")).toContain('"written": false');
      expect(blocked.stdout.join("\n")).toContain("already exists");
      expect(readFileSync(configPath, "utf8")).toContain('"preset": "guarded"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("prints RCON status without secrets", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-rcon-cli-"));
    const configPath = join(root, "rcon.json");
    try {
      await capture(["rcon", "init", "--config", configPath]);
      vi.stubEnv("MINECRAFT_SKILLS_RCON_PASSWORD", "secret");

      const status = await capture(["rcon", "status", "--config", configPath]);
      expect(status.code).toBe(0);
      expect(status.stdout.join("\n")).toContain('"configured": true');
      expect(status.stdout.join("\n")).not.toContain("secret");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("prints fact surfaces and their non-guarantees", async () => {
    const list = await capture(["datapack", "fact-surfaces"]);
    expect(list.code).toBe(0);
    expect(list.stdout.join("\n")).toContain('"id": "datapack-schema-surface"');
    expect(list.stdout.join("\n")).toContain('"id": "command-paths"');

    const single = await capture(["plugin", "paper", "fact-surface", "paper-api-surface"]);
    expect(single.code).toBe(0);
    expect(single.stdout.join("\n")).toContain("does not prove method behavior");
  });

  it("prints authoring checklists", async () => {
    const list = await capture(["plugin", "paper", "checklists"]);
    expect(list.code).toBe(0);
    expect(list.stdout.join("\n")).toContain('"domain": "paper-plugin"');
    expect(list.stdout.join("\n")).toContain("verify-types-members-and-events");

    const single = await capture(["datapack", "checklist"]);
    expect(single.code).toBe(0);
    expect(single.stdout.join("\n")).toContain("verify-commands-and-paths");
    expect(single.stdout.join("\n")).toContain("datapack search-schema");
  });

  it("prints authoring recipes", async () => {
    const list = await capture(["plugin", "paper", "recipes"]);
    expect(list.code).toBe(0);
    expect(list.stdout.join("\n")).toContain('"id": "paper-event-listener"');
    expect(list.stdout.join("\n")).toContain('"id": "paper-api-or-scheduler-code"');
    expect(list.stdout.join("\n")).toContain('"id": "paper-safe-item-delivery"');
    expect(list.stdout.join("\n")).toContain('"id": "paper-inventory-gui-interactions"');

    const single = await capture(["datapack", "recipe", "datapack-function-command"]);
    expect(single.code).toBe(0);
    expect(single.stdout.join("\n")).toContain("verify-command-path");
    expect(single.stdout.join("\n")).toContain("search_commands");

    const itemDelivery = await capture(["plugin", "paper", "recipe", "paper-safe-item-delivery"]);
    expect(itemDelivery.code).toBe(0);
    expect(itemDelivery.stdout.join("\n")).toContain("define-delivery-and-overflow-outcomes");
    expect(itemDelivery.stdout.join("\n")).toContain("Player.give");
  });

  it("prints authoring scenarios", async () => {
    const list = await capture(["plugin", "paper", "scenarios"]);
    expect(list.code).toBe(0);
    expect(list.stdout.join("\n")).toContain('"id": "paper-event-listener-review"');
    expect(list.stdout.join("\n")).toContain('"id": "paper-api-scheduler-review"');
    expect(list.stdout.join("\n")).toContain('"id": "paper-item-delivery-review"');
    expect(list.stdout.join("\n")).toContain('"id": "paper-inventory-gui-interaction-review"');

    const single = await capture(["plugin", "paper", "scenario", "paper-event-listener-review"]);
    expect(single.code).toBe(0);
    expect(single.stdout.join("\n")).toContain('"paper-event-listener"');
    expect(single.stdout.join("\n")).toContain("paper-event-candidate-unverified");

    const itemDelivery = await capture([
      "plugin",
      "paper",
      "scenario",
      "paper-item-delivery-review",
    ]);
    expect(itemDelivery.code).toBe(0);
    expect(itemDelivery.stdout.join("\n")).toContain('"paper-safe-item-delivery"');
    expect(itemDelivery.stdout.join("\n")).toContain("paper-inventory-leftovers-unhandled");
  });

  it("searches authoring scenarios", async () => {
    const result = await capture(["plugin", "paper", "search-scenarios", "Paper event listener"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"query": "Paper event listener"');
    expect(result.stdout.join("\n")).toContain('"id": "paper-event-listener-review"');
    expect(result.stdout.join("\n")).toContain('"matchedTokens"');

    const itemDelivery = await capture([
      "plugin",
      "paper",
      "search-scenarios",
      "full inventory reward leftovers",
    ]);
    expect(itemDelivery.code).toBe(0);
    expect(itemDelivery.stdout.join("\n")).toContain('"id": "paper-item-delivery-review"');

    const inventory = await capture([
      "plugin",
      "paper",
      "search-scenarios",
      "inventory GUI shift-click drag hotbar offhand double-click",
    ]);
    expect(inventory.code).toBe(0);
    expect(inventory.stdout.join("\n")).toContain('"id": "paper-inventory-gui-interaction-review"');
  });

  it("routes Paper plugin protocol tasks through recipes, scenarios, and diagnostics", async () => {
    const scenarioSearch = await capture([
      "plugin",
      "paper",
      "search-scenarios",
      "custom payload request correlation",
    ]);
    expect(scenarioSearch.code).toBe(0);
    expect(scenarioSearch.stdout.join("\n")).toContain(
      '"id": "paper-plugin-protocol-safety-review"',
    );

    const catalogSearch = await capture([
      "plugin",
      "paper",
      "search",
      "chunked upload codec",
      "--kind",
      "authoring-recipe",
    ]);
    expect(catalogSearch.code).toBe(0);
    expect(catalogSearch.stdout.join("\n")).toContain('"id": "paper-plugin-protocol-safety"');

    const diagnostic = await capture([
      "plugin",
      "paper",
      "diagnostic",
      "paper-plugin-protocol-unsafe",
    ]);
    expect(diagnostic.code).toBe(0);
    expect(diagnostic.stdout.join("\n")).toContain("authenticated connection");
    expect(diagnostic.stdout.join("\n")).toContain("Messenger.MAX_MESSAGE_SIZE");
  });

  it("prints authoring plans", async () => {
    const result = await capture([
      "plugin",
      "paper",
      "plan",
      "paper-event-listener-review",
      "1.21.11",
    ]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"scenario"');
    expect(result.stdout.join("\n")).toContain('"id": "paper-event-listener-review"');
    expect(result.stdout.join("\n")).toContain('"recipes"');
    expect(result.stdout.join("\n")).toContain('"id": "paper-event-listener"');
    expect(result.stdout.join("\n")).toContain('"diagnostics"');
    expect(result.stdout.join("\n")).toContain('"id": "paper-event-candidate-unverified"');
    expect(result.stdout.join("\n")).toContain('"preflight"');
    expect(result.stdout.join("\n")).toContain('"resolvedVersion": "1.21.11"');
    expect(result.stdout.join("\n")).toContain('"id": "paper-javadocs"');

    const itemDelivery = await capture([
      "plugin",
      "paper",
      "plan",
      "paper-item-delivery-review",
      "1.21.11",
    ]);
    expect(itemDelivery.code).toBe(0);
    expect(itemDelivery.stdout.join("\n")).toContain('"id": "paper-safe-item-delivery"');
    expect(itemDelivery.stdout.join("\n")).toContain('"id": "paper-inventory-leftovers-unhandled"');
  });

  it("prints administrative command operability guidance", async () => {
    const recipe = await capture([
      "plugin",
      "paper",
      "recipe",
      "paper-administrative-command-operability",
    ]);
    expect(recipe.code).toBe(0);
    expect(recipe.stdout.join("\n")).toContain("model-sender-target-and-scope");

    const scenario = await capture([
      "plugin",
      "paper",
      "scenario",
      "paper-administrative-command-operability-review",
    ]);
    expect(scenario.code).toBe(0);
    expect(scenario.stdout.join("\n")).toContain("paper-administrative-command-incomplete");

    const plan = await capture([
      "plugin",
      "paper",
      "plan",
      "paper-administrative-command-operability-review",
      "1.21.11",
    ]);
    expect(plan.code).toBe(0);
    expect(plan.stdout.join("\n")).toContain("paper-administrative-command-operability");

    const guardrail = await capture([
      "plugin",
      "paper",
      "guardrail",
      "paper-administrative-command-operability",
    ]);
    expect(guardrail.code).toBe(0);
    expect(guardrail.stdout.join("\n")).toContain("Allow console execution");

    const diagnostic = await capture([
      "plugin",
      "paper",
      "diagnostic",
      "paper-administrative-command-incomplete",
    ]);
    expect(diagnostic.code).toBe(0);
    expect(diagnostic.stdout.join("\n")).toContain('"severity": "error"');
  });

  it("prints authoring guardrails", async () => {
    const list = await capture(["plugin", "paper", "guardrails"]);
    expect(list.code).toBe(0);
    expect(list.stdout.join("\n")).toContain('"id": "global-source-provenance"');
    expect(list.stdout.join("\n")).toContain('"id": "paper-api-surface-limits"');
    expect(list.stdout.join("\n")).toContain('"id": "paper-inventory-delivery-outcomes"');
    expect(list.stdout.join("\n")).toContain('"id": "paper-inventory-gui-interaction-safety"');

    const single = await capture(["plugin", "paper", "guardrail", "paper-api-surface-limits"]);
    expect(single.code).toBe(0);
    expect(single.stdout.join("\n")).toContain("Javadocs package, type, and member indexes");
    expect(single.stdout.join("\n")).toContain("nonexistent APIs");

    const itemDelivery = await capture([
      "plugin",
      "paper",
      "guardrail",
      "paper-inventory-delivery-outcomes",
    ]);
    expect(itemDelivery.code).toBe(0);
    expect(itemDelivery.stdout.join("\n")).toContain("uninserted stacks");
    expect(itemDelivery.stdout.join("\n")).toContain("Player.give");
  });

  it("prints authoring diagnostics", async () => {
    const list = await capture(["plugin", "paper", "diagnostics"]);
    expect(list.code).toBe(0);
    expect(list.stdout.join("\n")).toContain('"id": "paper-api-member-unverified"');
    expect(list.stdout.join("\n")).toContain('"id": "paper-threading-assumption"');
    expect(list.stdout.join("\n")).toContain('"id": "paper-inventory-leftovers-unhandled"');
    expect(list.stdout.join("\n")).toContain('"id": "paper-inventory-gui-interaction-unbounded"');

    const single = await capture(["plugin", "paper", "diagnostic", "paper-api-member-unverified"]);
    expect(single.code).toBe(0);
    expect(single.stdout.join("\n")).toContain('"severity": "error"');
    expect(single.stdout.join("\n")).toContain("searchPaperMembers");

    const itemDelivery = await capture([
      "plugin",
      "paper",
      "diagnostic",
      "paper-inventory-leftovers-unhandled",
    ]);
    expect(itemDelivery.code).toBe(0);
    expect(itemDelivery.stdout.join("\n")).toContain('"severity": "error"');
    expect(itemDelivery.stdout.join("\n")).toContain("original requested stack");
  });

  it("prints Paper player identity and display guidance", async () => {
    const recipe = await capture([
      "plugin",
      "paper",
      "recipe",
      "paper-player-identity-and-display",
    ]);
    expect(recipe.code).toBe(0);
    expect(recipe.stdout.join("\n")).toContain("persist-and-resolve-stable-identity");
    expect(recipe.stdout.join("\n")).toContain("make-each-display-source-explicit");

    const scenario = await capture([
      "plugin",
      "paper",
      "scenario",
      "paper-player-identity-and-display-review",
    ]);
    expect(scenario.code).toBe(0);
    expect(scenario.stdout.join("\n")).toContain("paper-player-identity-display-confusion");

    const search = await capture([
      "plugin",
      "paper",
      "search-scenarios",
      "UUID player display name OfflinePlayer rename",
    ]);
    expect(search.code).toBe(0);
    expect(search.stdout.join("\n")).toContain('"id": "paper-player-identity-and-display-review"');

    const plan = await capture([
      "plugin",
      "paper",
      "plan",
      "paper-player-identity-and-display-review",
      "1.21.11",
    ]);
    expect(plan.code).toBe(0);
    expect(plan.stdout.join("\n")).toContain('"id": "paper-player-identity-and-display"');
    expect(plan.stdout.join("\n")).toContain('"id": "paper-player-identity-display-confusion"');

    const guardrail = await capture([
      "plugin",
      "paper",
      "guardrail",
      "paper-player-identity-and-display",
    ]);
    expect(guardrail.code).toBe(0);
    expect(guardrail.stdout.join("\n")).toContain("stable player identifier");

    const diagnostic = await capture([
      "plugin",
      "paper",
      "diagnostic",
      "paper-player-identity-display-confusion",
    ]);
    expect(diagnostic.code).toBe(0);
    expect(diagnostic.stdout.join("\n")).toContain("only persistent player key");
  });

  it("prints and routes Paper player-session lifecycle safety guidance", async () => {
    const recipe = await capture(["plugin", "paper", "recipe", "paper-player-session-lifecycle"]);
    expect(recipe.code).toBe(0);
    expect(recipe.stdout.join("\n")).toContain("reject-stale-asynchronous-publication");
    expect(recipe.stdout.join("\n")).toContain("bound-durable-flush-and-shutdown");

    const scenario = await capture([
      "plugin",
      "paper",
      "scenario",
      "paper-player-session-lifecycle-review",
    ]);
    expect(scenario.code).toBe(0);
    expect(scenario.stdout.join("\n")).toContain("paper-player-session-lifecycle-unsafe");

    const search = await capture([
      "plugin",
      "paper",
      "search-scenarios",
      "player session rapid reconnect stale callback teardown",
    ]);
    expect(search.code).toBe(0);
    expect(search.stdout.join("\n")).toContain('"id": "paper-player-session-lifecycle-review"');

    const plan = await capture([
      "plugin",
      "paper",
      "plan",
      "paper-player-session-lifecycle-review",
      "1.21.11",
    ]);
    expect(plan.code).toBe(0);
    expect(plan.stdout.join("\n")).toContain('"id": "paper-player-session-lifecycle"');
    expect(plan.stdout.join("\n")).toContain('"id": "paper-player-session-lifecycle-unsafe"');

    const guardrail = await capture([
      "plugin",
      "paper",
      "guardrail",
      "paper-player-session-lifecycle-safety",
    ]);
    expect(guardrail.code).toBe(0);
    expect(guardrail.stdout.join("\n")).toContain("session instance or generation");

    const diagnostic = await capture([
      "plugin",
      "paper",
      "diagnostic",
      "paper-player-session-lifecycle-unsafe",
    ]);
    expect(diagnostic.code).toBe(0);
    expect(diagnostic.stdout.join("\n")).toContain("fire-and-forget persistence");

    const catalog = await capture([
      "plugin",
      "paper",
      "search",
      "session generation teardown reconnect",
      "--kind",
      "authoring-recipe",
    ]);
    expect(catalog.code).toBe(0);
    expect(catalog.stdout.join("\n")).toContain('"id": "paper-player-session-lifecycle"');
  });

  it("prints Paper plugin testing evidence guidance", async () => {
    const recipe = await capture(["plugin", "paper", "recipe", "paper-plugin-testing-evidence"]);
    expect(recipe.code).toBe(0);
    expect(recipe.stdout.join("\n")).toContain("choose-the-minimum-sufficient-evidence-layer");
    expect(recipe.stdout.join("\n")).toContain("loaded-server test");

    const scenario = await capture([
      "plugin",
      "paper",
      "scenario",
      "paper-plugin-testing-evidence-review",
    ]);
    expect(scenario.code).toBe(0);
    expect(scenario.stdout.join("\n")).toContain("paper-plugin-test-evidence-gap");

    const search = await capture([
      "plugin",
      "paper",
      "search-scenarios",
      "MockBukkit loaded server test evidence",
    ]);
    expect(search.code).toBe(0);
    expect(search.stdout.join("\n")).toContain('"id": "paper-plugin-testing-evidence-review"');

    const plan = await capture([
      "plugin",
      "paper",
      "plan",
      "paper-plugin-testing-evidence-review",
      "1.21.11",
    ]);
    expect(plan.code).toBe(0);
    expect(plan.stdout.join("\n")).toContain('"id": "paper-plugin-testing-evidence"');
    expect(plan.stdout.join("\n")).toContain('"id": "paper-plugin-test-evidence-gap"');

    const guardrail = await capture([
      "plugin",
      "paper",
      "guardrail",
      "paper-plugin-testing-evidence",
    ]);
    expect(guardrail.code).toBe(0);
    expect(guardrail.stdout.join("\n")).toContain("type-compatibility evidence only");

    const diagnostic = await capture([
      "plugin",
      "paper",
      "diagnostic",
      "paper-plugin-test-evidence-gap",
    ]);
    expect(diagnostic.code).toBe(0);
    expect(diagnostic.stdout.join("\n")).toContain("loaded-plugin evidence");
  });

  it("prints claim policies", async () => {
    const list = await capture(["plugin", "paper", "claim-policies"]);
    expect(list.code).toBe(0);
    expect(list.stdout.join("\n")).toContain('"id": "paper-type-or-member-exists"');
    expect(list.stdout.join("\n")).toContain('"id": "folia-or-thread-safety"');

    const single = await capture(["datapack", "claim-policy", "command-syntax-exists"]);
    expect(single.code).toBe(0);
    expect(single.stdout.join("\n")).toContain("parser shape, not gameplay behavior");
    expect(single.stdout.join("\n")).toContain("will succeed at runtime");
  });

  it("prints output requirements", async () => {
    const list = await capture(["plugin", "paper", "output-requirements"]);
    expect(list.code).toBe(0);
    expect(list.stdout.join("\n")).toContain('"id": "global-version-and-evidence"');
    expect(list.stdout.join("\n")).toContain('"id": "paper-plugin-output-safety"');

    const single = await capture([
      "plugin",
      "paper",
      "output-requirement",
      "paper-plugin-output-safety",
    ]);
    expect(single.code).toBe(0);
    expect(single.stdout.join("\n")).toContain("Javadocs type/member evidence");
    expect(single.stdout.join("\n")).toContain("unverified event class names");
  });

  it("prints response patterns", async () => {
    const list = await capture(["plugin", "paper", "response-patterns"]);
    expect(list.code).toBe(0);
    expect(list.stdout.join("\n")).toContain('"id": "verified-authoring-answer"');
    expect(list.stdout.join("\n")).toContain('"id": "paper-api-answer"');

    const single = await capture(["plugin", "paper", "response-pattern", "paper-api-answer"]);
    expect(single.code).toBe(0);
    expect(single.stdout.join("\n")).toContain("Javadocs type/member evidence");
    expect(single.stdout.join("\n")).toContain("name presence, not behavior");
  });

  it("prints authoring preflight payloads", async () => {
    const datapack = await capture(["datapack", "preflight", "26.2"]);
    expect(datapack.code).toBe(0);
    expect(datapack.stdout.join("\n")).toContain('"resolvedVersion": "26.2"');
    expect(datapack.stdout.join("\n")).toContain('"id": "verify-commands-and-paths"');

    const paper = await capture(["plugin", "paper", "preflight", "26.1"]);
    expect(paper.code).toBe(0);
    expect(paper.stdout.join("\n")).toContain("Paper is not marked supported for 26.1");
  });

  it("prints authoring contexts", async () => {
    const result = await capture(["plugin", "paper", "context", "1.21.11"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"resolvedVersion": "1.21.11"');
    expect(result.stdout.join("\n")).toContain('"recipes"');
    expect(result.stdout.join("\n")).toContain('"id": "paper-event-listener"');
    expect(result.stdout.join("\n")).toContain('"scenarios"');
    expect(result.stdout.join("\n")).toContain('"id": "paper-event-listener-review"');
    expect(result.stdout.join("\n")).toContain('"guardrails"');
    expect(result.stdout.join("\n")).toContain('"id": "paper-api-surface-limits"');
    expect(result.stdout.join("\n")).toContain('"diagnostics"');
    expect(result.stdout.join("\n")).toContain('"id": "paper-api-member-unverified"');
    expect(result.stdout.join("\n")).toContain('"claimPolicies"');
    expect(result.stdout.join("\n")).toContain('"id": "paper-type-or-member-exists"');
    expect(result.stdout.join("\n")).toContain('"outputRequirements"');
    expect(result.stdout.join("\n")).toContain('"id": "paper-plugin-output-safety"');
    expect(result.stdout.join("\n")).toContain('"responsePatterns"');
    expect(result.stdout.join("\n")).toContain('"id": "paper-api-answer"');
    expect(result.stdout.join("\n")).toContain('"intentLookups"');
    expect(result.stdout.join("\n")).toContain('"id": "verify-paper-type-or-member"');
    expect(result.stdout.join("\n")).toContain('"id": "paper-javadocs"');
  });

  it("prints evidence bundles", async () => {
    const result = await capture(["plugin", "paper", "evidence", "1.21.11"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"minecraftWikiTextRedistribution": "forbidden"');
    expect(result.stdout.join("\n")).toContain('"id": "paper-javadocs"');
    expect(result.stdout.join("\n")).toContain('"kind": "paper-api-surface"');
  });

  it("prints source reports", async () => {
    const result = await capture(["source", "report", "datapack", "26.2"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"minecraftWikiAutomation": "forbidden"');
    expect(result.stdout.join("\n")).toContain('"id": "prismarinejs-minecraft-data"');
    expect(result.stdout.join("\n")).toContain('"id": "misode-mcmeta-data-json"');

    const alias = await capture(["minecraft", "sources", "resourcepack", "26.2"]);
    expect(alias.code).toBe(0);
    expect(alias.stdout.join("\n")).toContain('"id": "prismarinejs-minecraft-assets"');

    const datasets = await capture(["source", "datasets"]);
    expect(datasets.code).toBe(0);
    expect(datasets.stdout.join("\n")).toContain('"id": "misode-mcmeta"');

    const tier = await capture(["source", "tier", "community-structured"]);
    expect(tier.code).toBe(0);
    expect(tier.stdout.join("\n")).toContain("PrismarineJS/minecraft-data");
  });

  it("prints intent lookups", async () => {
    const list = await capture(["plugin", "paper", "intents"]);
    expect(list.code).toBe(0);
    expect(list.stdout.join("\n")).toContain('"id": "verify-paper-type-or-member"');
    expect(list.stdout.join("\n")).toContain('"id": "discover-paper-event-candidates"');

    const single = await capture(["datapack", "intent", "verify-command-syntax"]);
    expect(single.code).toBe(0);
    expect(single.stdout.join("\n")).toContain('"search_commands"');
    expect(single.stdout.join("\n")).toContain("does not prove gameplay behavior");
  });

  it("prints data manifest and cache state", async () => {
    const manifest = await capture(["data", "manifest"]);
    expect(manifest.code).toBe(0);
    expect(manifest.stdout.join("\n")).toContain('"dataVersion": "2026.06.23-2"');

    const cacheDir = await capture(["data", "cache-dir"]);
    expect(cacheDir.code).toBe(0);
    expect(cacheDir.stdout[0]).toContain("minecraft-skills");

    const cacheList = await capture(["data", "cache-list"]);
    expect(cacheList.code).toBe(0);
    expect(cacheList.stdout.join("\n")).toContain('"files"');
  });

  it("prints support matrix aliases", async () => {
    const result = await capture(["minecraft", "support-matrix"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"latestWithDatapackSchemaSurface": "26.2"');
    expect(result.stdout.join("\n")).toContain('"latestWithPaperApiSurface": "26.2"');
  });

  it("prints per-version support", async () => {
    const result = await capture(["minecraft", "support", "--domain", "paper-plugin"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"version": "26.2"');
    expect(result.stdout.join("\n")).toContain('"latestBuild": 30');
    expect(result.stdout.join("\n")).toContain('"version": "26.1"');
    expect(result.stdout.join("\n")).toContain('"supported": false');
  });

  it("fetches downloadable data into the cache", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-cli-cache-"));
    const previousCacheDir = process.env.MINECRAFT_SKILLS_CACHE_DIR;
    process.env.MINECRAFT_SKILLS_CACHE_DIR = root;
    try {
      const body = readFileSync(
        join(process.cwd(), "../data/data/java/datapack-schema-surfaces/26.2.json"),
      );
      vi.stubGlobal(
        "fetch",
        vi.fn(async (_url: string) => ({
          ok: true,
          status: 200,
          statusText: "OK",
          arrayBuffer: async () => body,
        })),
      );

      const result = await capture([
        "data",
        "fetch",
        "datapack-schema-surface",
        "--version",
        "26.2",
        "--force",
      ]);
      expect(result.code).toBe(0);
      expect(result.stdout.join("\n")).toContain("java/datapack-schema-surfaces/26.2.json");
    } finally {
      if (previousCacheDir === undefined) {
        delete process.env.MINECRAFT_SKILLS_CACHE_DIR;
      } else {
        process.env.MINECRAFT_SKILLS_CACHE_DIR = previousCacheDir;
      }
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("prints latest Java version", async () => {
    expect((await capture(["minecraft", "latest"])).stdout).toEqual(["26.2"]);
  });

  it("prints effective version coverage", async () => {
    const result = await capture(["minecraft", "list"]);
    expect(result.stdout[0]).toBe("26.2\trelease\t2026-06-16T12:03:33+00:00\tversion-json-and-jar");
  });

  it("prints pack formats by version", async () => {
    const result = await capture(["minecraft", "pack-formats"]);
    expect(result.stdout[0]).toContain("26.2\t2026-06-16T12:03:33+00:00\tdata=107");
    expect(result.stdout[0]).toContain("resource=88");
    expect(result.stdout[0]).toContain("paper=api-reference-linked");
  });

  it("prints one pack format and reverse pack format matches", async () => {
    const format = await capture(["minecraft", "pack-format", "26.2", "datapack"]);
    expect(format.code).toBe(0);
    expect(format.stdout.join("\n")).toContain('"format": 107');
    expect(format.stdout.join("\n")).toContain('"minor": 1');

    const versions = await capture(["minecraft", "versions-for-pack-format", "resourcepack", "88"]);
    expect(versions.code).toBe(0);
    expect(versions.stdout.join("\n")).toContain('"version": "26.2"');
    expect(versions.stdout.join("\n")).toContain('"domain": "resourcepack"');
  });

  it("filters references by domain", async () => {
    const result = await capture(["reference", "list", "--domain", "paper-plugin"]);
    expect(result.stdout.join("\n")).toContain("minecraft-paper-plugins");
  });

  it("prints Paper plugin support data", async () => {
    const result = await capture(["plugin", "paper", "info"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"minecraftVersion": "1.21.11"');
    expect(result.stdout.join("\n")).toContain(
      "https://spigot-event-list.s7a.dev/api/search/events",
    );
  });

  it("looks up a bounded Fabric toolchain tuple", async () => {
    const intermediary = {
      maven: "net.fabricmc:intermediary:1.21.11",
      version: "1.21.11",
      stable: true,
    };
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      const body = url.includes("/loader/")
        ? [
            {
              loader: {
                separator: "+build.",
                build: 1,
                maven: "net.fabricmc:fabric-loader:0.17.0",
                version: "0.17.0",
                stable: true,
              },
              intermediary,
            },
          ]
        : url.includes("/yarn/")
          ? [
              {
                gameVersion: "1.21.11",
                separator: "+build.",
                build: 6,
                maven: "net.fabricmc:yarn:1.21.11+build.6",
                version: "1.21.11+build.6",
                stable: true,
              },
            ]
          : [intermediary];
      return new Response(JSON.stringify(body));
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await capture([
      "fabric",
      "toolchain",
      "1.21.11",
      "--limit",
      "1",
      "--timeout-ms",
      "1000",
    ]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"version": "0.17.0"');
    expect(result.stdout.join("\n")).toContain('"version": "1.21.11+build.6"');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(
      expect.arrayContaining([
        "https://meta.fabricmc.net/v2/versions/loader/1.21.11",
        "https://meta.fabricmc.net/v2/versions/yarn/1.21.11",
        "https://meta.fabricmc.net/v2/versions/intermediary/1.21.11",
      ]),
    );
  });

  it("resolves the current official Velocity API toolchain", async () => {
    const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<metadata><groupId>com.velocitypowered</groupId><artifactId>velocity-api</artifactId>
<versioning><latest>4.1.0-SNAPSHOT</latest><release>4.0.0</release>
<versions><version>4.0.0</version><version>4.1.0-SNAPSHOT</version></versions>
<lastUpdated>20260814105730</lastUpdated></versioning></metadata>`;
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.includes("maven-metadata.xml")) {
        return new Response(metadata, { headers: { "Content-Type": "application/xml" } });
      }
      if (url.includes("creating-your-first-plugin")) {
        return new Response(
          `<html><body>Project JDK is Java 25 or later
          <table><tr><td>com.velocitypowered</td><td>velocity-api</td><td>4.1.0-SNAPSHOT</td></tr></table>
          https://repo.papermc.io/repository/maven-public/</body></html>`,
          { headers: { "Content-Type": "text/html" } },
        );
      }
      return new Response(
        "<html><body>Velocity 4.0.x and above requires at least Java 25.</body></html>",
        { headers: { "Content-Type": "text/html" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await capture(["velocity", "toolchain", "--limit", "1", "--timeout-ms", "1000"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain(
      '"coordinate": "com.velocitypowered:velocity-api:4.1.0-SNAPSHOT"',
    );
    expect(result.stdout.join("\n")).toContain('"minimumVersion": 25');
    expect(result.stdout.join("\n")).toContain('"minecraftGameVersions": "not-inferred"');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("searches Modrinth projects with filters", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ hits: [{ slug: "simple-voice-chat" }] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await capture([
      "modrinth",
      "search",
      "voice chat",
      "--version",
      "1.21.11",
      "--type",
      "mod",
      "--loader",
      "fabric",
      "--index",
      "downloads",
      "--limit",
      "5",
    ]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain("simple-voice-chat");
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toContain("api.modrinth.com/v2/search");
    expect(url).toContain("query=voice+chat");
    expect(url).toContain("versions%3A1.21.11");
    expect(new Headers(init?.headers).get("User-Agent")).toContain("minecraft-skills");
  });

  it("lists versions for a Modrinth project", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => [{ id: "abc123", version_number: "2.5.0" }],
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await capture([
      "modrinth",
      "versions",
      "simple-voice-chat",
      "--game-version",
      "1.21.11",
      "--loader",
      "fabric",
      "--featured",
      "true",
    ]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"version_number": "2.5.0"');
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toContain("/v2/project/simple-voice-chat/version");
    expect(url).toContain("game_versions=%5B%221.21.11%22%5D");
    expect(url).toContain("loaders=%5B%22fabric%22%5D");
    expect(url).toContain("featured=true");
    expect(url).toContain("include_changelog=false");
    expect(new Headers(init?.headers).get("User-Agent")).toContain("minecraft-skills");
  });

  it("resolves compatibility metadata for multiple Modrinth projects", async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      const projectId = url.includes("sodium") ? "sodium-id" : "iris-id";
      return new Response(
        JSON.stringify(
          url.includes("/check")
            ? { id: projectId }
            : [
                {
                  id: projectId === "sodium-id" ? "sodium-version" : "iris-version",
                  project_id: projectId,
                  version_number: "1.0.0",
                  version_type: "release",
                  featured: true,
                  date_published: "2026-01-01T00:00:00Z",
                  game_versions: ["1.21.11"],
                  loaders: ["fabric"],
                },
              ],
        ),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await capture([
      "modrinth",
      "compatibility",
      "sodium",
      "iris",
      "--game-version",
      "1.21.11",
      "--loader",
      "fabric",
      "--featured",
      "true",
      "--limit",
      "1",
    ]);

    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"scope": "modrinth-version-metadata"');
    expect(result.stdout.join("\n")).toContain('"sodium-version"');
    expect(result.stdout.join("\n")).toContain('"iris-version"');
    expect(result.stdout.join("\n")).toContain('"gameVersion": "1.21.11"');
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const versionCalls = fetchMock.mock.calls.filter(([url]) => url.includes("/version"));
    expect(versionCalls[0]?.[0]).toContain("featured=true");
    expect(versionCalls[0]?.[0]).toContain("include_changelog=false");
  });

  it("strictly parses Modrinth compatibility value options", async () => {
    const missing = await capture(["modrinth", "compatibility", "sodium", "iris", "--loader"]);
    expect(missing.code).toBe(1);
    expect(missing.stderr.join("\n")).toContain("--loader requires a value");

    const followedByOption = await capture([
      "modrinth",
      "compatibility",
      "sodium",
      "iris",
      "--loader",
      "--limit",
      "1",
    ]);
    expect(followedByOption.code).toBe(1);
    expect(followedByOption.stderr.join("\n")).toContain("--loader requires a value");

    const unknown = await capture([
      "modrinth",
      "compatibility",
      "sodium",
      "iris",
      "--unknown",
      "value",
    ]);
    expect(unknown.code).toBe(1);
    expect(unknown.stderr.join("\n")).toContain("unknown option: --unknown");

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/check")) {
        return new Response(
          JSON.stringify({ id: url.includes("--example") ? "example-id" : "sodium-id" }),
        );
      }
      return new Response("[]");
    });
    vi.stubGlobal("fetch", fetchMock);
    const optionLikeSlug = await capture([
      "modrinth",
      "compatibility",
      "sodium",
      "--",
      "--example",
    ]);
    expect(optionLikeSlug.code).toBe(0);
    expect(fetchMock.mock.calls.some(([url]) => url.includes("/project/--example/check"))).toBe(
      true,
    );
  });

  it("gets Modrinth public resources", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ slug: "sodium" }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const project = await capture(["modrinth", "get", "project", "sodium"]);
    expect(project.code).toBe(0);
    expect(project.stdout.join("\n")).toContain('"slug": "sodium"');
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.modrinth.com/v2/project/sodium");

    await capture(["modrinth", "get", "game-versions"]);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.modrinth.com/v2/tag/game_version");
  });

  it("validates a local Modrinth pack archive without network access", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-mrpack-cli-"));
    const packPath = join(root, "example.mrpack");
    const index = JSON.stringify({
      formatVersion: 1,
      game: "minecraft",
      versionId: "example-1.0.0",
      name: "Example",
      files: [],
      dependencies: { minecraft: "1.21.11" },
    });
    try {
      writeFileSync(packPath, createStoredZip({ "modrinth.index.json": index }));
      const result = await capture(["modrinth", "validate-pack", packPath]);
      expect(result.code).toBe(0);
      expect(result.stderr).toEqual([]);
      expect(result.stdout.join("\n")).toContain('"valid": true');
      expect(result.stdout.join("\n")).toContain('"entries": 1');
      expect(result.stdout.join("\n")).toContain('"validationStrength": "binary"');

      const warningIndex = JSON.stringify({
        formatVersion: 1,
        game: "minecraft",
        versionId: "example-1.0.0",
        name: "Example",
        files: [
          {
            path: "mods/example.jar",
            hashes: { sha1: "a".repeat(40), sha512: "b".repeat(128) },
            downloads: ["https://downloads.example.org/example.jar"],
            fileSize: 1,
          },
        ],
        dependencies: { minecraft: "1.21.11" },
      });
      writeFileSync(packPath, createStoredZip({ "modrinth.index.json": warningIndex }));
      const warningOnly = await capture([
        "modrinth",
        "validate-pack",
        packPath,
        "--allow-download-host",
        "downloads.example.org",
      ]);
      expect(warningOnly.code).toBe(0);
      expect(warningOnly.stdout.join("\n")).toContain('"valid": true');
      expect(warningOnly.stdout.join("\n")).toContain('"file.unofficial-download-host"');

      const wrongExtensionPath = join(root, "example.zip");
      writeFileSync(wrongExtensionPath, createStoredZip({ "modrinth.index.json": index }));
      const wrongExtension = await capture(["modrinth", "validate-pack", wrongExtensionPath]);
      expect(wrongExtension.code).toBe(1);
      expect(wrongExtension.stderr.join("\n")).toContain(".mrpack extension");

      const directoryPath = join(root, "directory.mrpack");
      mkdirSync(directoryPath);
      const directory = await capture(["modrinth", "validate-pack", directoryPath]);
      expect(directory.code).toBe(1);
      expect(directory.stderr.join("\n")).toContain("regular local .mrpack file");

      const overLimit = await capture([
        "modrinth",
        "validate-pack",
        packPath,
        "--max-archive-bytes",
        "1",
      ]);
      expect(overLimit.code).toBe(1);
      expect(overLimit.stderr.join("\n")).toContain("larger than 1 bytes");

      writeFileSync(packPath, Buffer.from("not a zip"));
      const invalid = await capture(["modrinth", "validate-pack", packPath]);
      expect(invalid.code).toBe(1);
      expect(invalid.stdout.join("\n")).toContain('"code": "archive.invalid-zip"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("prints Paper API references", async () => {
    const result = await capture(["plugin", "paper", "api", "1.21.11"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain("io.papermc.paper:paper-api:1.21.11-R0.1-SNAPSHOT");
    expect(result.stdout.join("\n")).toContain("https://jd.papermc.io/paper/1.21.11/");
  });

  it("prints Paper API package indexes", async () => {
    const result = await capture(["plugin", "paper", "api-index", "1.21.11"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain("io.papermc.paper.threadedregions.scheduler");
  });

  it("prints and searches Paper API surfaces", async () => {
    const surface = await capture(["plugin", "paper", "api-surface", "1.21.11"]);
    expect(surface.code).toBe(0);
    expect(surface.stdout.join("\n")).toContain('"coverage": "javadocs-search-index"');

    const types = await capture([
      "plugin",
      "paper",
      "types",
      "1.21.11",
      "--contains",
      "org.bukkit.entity.Player",
      "--limit",
      "5",
    ]);
    expect(types.code).toBe(0);
    expect(types.stdout.join("\n")).toContain("org.bukkit.entity.Player");

    const members = await capture([
      "plugin",
      "paper",
      "members",
      "1.21.11",
      "--type",
      "org.bukkit.entity.Player",
      "--contains",
      "sendMessage",
      "--kind",
      "method",
      "--limit",
      "5",
    ]);
    expect(members.code).toBe(0);
    expect(members.stdout.join("\n")).toContain("sendMessage");
  });

  it("compares Paper API package indexes", async () => {
    const result = await capture(["plugin", "paper", "compare-api", "1.20.4", "1.21.11"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"added"');
    expect(result.stdout.join("\n")).toContain("io.papermc.paper.datacomponent");
  });

  it("compares Paper API surfaces", async () => {
    const result = await capture(["plugin", "paper", "compare-api-surface", "1.21.11", "1.21.11"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"addedTypes": []');
    expect(result.stdout.join("\n")).toContain('"changes": []');
  });

  it("prints vanilla inventory", async () => {
    const result = await capture(["minecraft", "vanilla-inventory"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"version": "26.2"');
    expect(result.stdout.join("\n")).toContain('"assets/minecraft/models"');
    expect(result.stdout.join("\n")).toContain('"data/minecraft/tags"');
  });

  it("prints and searches observed datapack schema surfaces", async () => {
    const surface = await capture(["datapack", "schema", "26.2"]);
    expect(surface.code).toBe(0);
    expect(surface.stdout.join("\n")).toContain("vanilla-observed-datapack-json-shape");

    const search = await capture([
      "datapack",
      "search-schema",
      "26.2",
      "--kind",
      "advancement",
      "--contains",
      "criteria",
      "--limit",
      "5",
    ]);
    expect(search.code).toBe(0);
    expect(search.stdout.join("\n")).toContain('"path": "$.criteria"');
  });

  it("compares observed datapack schema surfaces", async () => {
    const result = await capture(["datapack", "compare-schema", "26.2", "26.2"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"addedTotal": 0');
    expect(result.stdout.join("\n")).toContain('"changes": []');
  });

  it("classifies datapack and resourcepack files", async () => {
    const datapack = await capture([
      "datapack",
      "classify-files",
      "data/example/advancement/root.json",
      "data/example/functions/tick.mcfunction",
    ]);
    expect(datapack.code).toBe(0);
    expect(datapack.stdout.join("\n")).toContain('"kind": "advancement"');
    expect(datapack.stdout.join("\n")).toContain('"schemaAvailable": true');

    const resourcepack = await capture([
      "resourcepack",
      "classify-files",
      "assets/example/models/item/widget.json",
    ]);
    expect(resourcepack.code).toBe(0);
    expect(resourcepack.stdout.join("\n")).toContain('"kind": "model"');
    expect(resourcepack.stdout.join("\n")).toContain('"schemaKind": "model"');
  });

  it("prints observed schemas for pack files", async () => {
    const datapack = await capture([
      "datapack",
      "file-schema",
      "26.2",
      "data/example/advancement/root.json",
    ]);
    expect(datapack.code).toBe(0);
    expect(datapack.stdout.join("\n")).toContain('"normative": false');
    expect(datapack.stdout.join("\n")).toContain('"path": "$.criteria"');

    const resourcepack = await capture([
      "resourcepack",
      "file-schema",
      "26.2",
      "assets/example/items/widget.json",
    ]);
    expect(resourcepack.code).toBe(0);
    expect(resourcepack.stdout.join("\n")).toContain('"schemaKind": "item-definition"');
    expect(resourcepack.stdout.join("\n")).toContain('"path": "model.type"');
  });

  it("validates pack files from disk", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-pack-"));
    const file = join(root, "pack.mcmeta");
    writeFileSync(
      file,
      `${JSON.stringify({
        pack: {
          pack_format: 107,
          description: "test",
        },
      })}\n`,
    );
    const result = await capture(["datapack", "validate-files", "26.2", file, "--pack-root", root]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"validatedFiles": 1');
    expect(result.stdout.join("\n")).toContain('"validFiles": 1');
    expect(result.stdout.join("\n")).toContain('"path": "pack.mcmeta"');
    rmSync(root, { recursive: true, force: true });
  });

  it("validates a complete datapack directory and its reference graph", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-datapack-"));
    const functionDirectory = join(root, "data", "example", "function");
    const tagDirectory = join(root, "data", "example", "tags", "function");
    mkdirSync(functionDirectory, { recursive: true });
    mkdirSync(tagDirectory, { recursive: true });
    writeFileSync(
      join(root, "pack.mcmeta"),
      JSON.stringify({ pack: { pack_format: 48, description: "CLI fixture" } }),
    );
    writeFileSync(join(functionDirectory, "root.mcfunction"), "function #example:load\n");
    writeFileSync(join(functionDirectory, "child.mcfunction"), "say child\n");
    writeFileSync(join(tagDirectory, "load.json"), JSON.stringify({ values: ["example:child"] }));

    try {
      const result = await capture(["datapack", "validate-project", "1.21", root]);
      expect(result.code).toBe(0);
      expect(result.stdout.join("\n")).toContain('"valid": true');
      expect(result.stdout.join("\n")).toContain('"validationComplete": true');
      expect(result.stdout.join("\n")).toContain('"checkedReferences": 2');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns a failing status for a missing datapack function reference", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-invalid-datapack-"));
    const functionDirectory = join(root, "data", "example", "function");
    mkdirSync(functionDirectory, { recursive: true });
    writeFileSync(
      join(root, "pack.mcmeta"),
      JSON.stringify({ pack: { pack_format: 48, description: "CLI fixture" } }),
    );
    writeFileSync(join(functionDirectory, "root.mcfunction"), "function example:missing\n");

    try {
      const result = await capture(["datapack", "validate-project", "1.21", root]);
      expect(result.code).toBe(1);
      expect(result.stdout.join("\n")).toContain('"code": "missing-datapack-reference"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("allows merged namespace dependencies only when explicitly requested", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-merged-datapack-"));
    const functionDirectory = join(root, "data", "example", "function");
    mkdirSync(functionDirectory, { recursive: true });
    writeFileSync(
      join(root, "pack.mcmeta"),
      JSON.stringify({ pack: { pack_format: 48, description: "CLI dependency fixture" } }),
    );
    writeFileSync(join(functionDirectory, "root.mcfunction"), "function example:dependency\n");

    try {
      const result = await capture([
        "datapack",
        "validate-project",
        "1.21",
        "--allow-merged-namespace-dependencies",
        "--limit",
        "100",
        root,
      ]);
      expect(result.code).toBe(0);
      expect(result.stdout.join("\n")).toContain('"validationComplete": false');
      expect(result.stdout.join("\n")).toContain('"external-reference"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("bounds datapack traversal and rejects special directory entries", () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-datapack-scan-"));
    writeFileSync(join(root, "first.json"), "{}");
    writeFileSync(join(root, "second.json"), "{}");

    try {
      expect(() =>
        readDatapackProjectFiles(root, {
          maxContentDepth: 4,
          maxFiles: 1,
          maxPathLength: 100,
          maxTextContentCharacters: 100,
        }),
      ).toThrow("more than 1 files");
      expect(() =>
        readDatapackProjectFiles(root, {
          maxContentDepth: 4,
          maxFiles: 10,
          maxPathLength: 100,
          maxTextContentCharacters: 2,
        }),
      ).toThrow("remaining 0-byte project budget");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }

    const specialEntry = {
      isBlockDevice: () => false,
      isCharacterDevice: () => false,
      isDirectory: () => false,
      isFIFO: () => false,
      isFile: () => false,
      isSocket: () => false,
      isSymbolicLink: () => true,
    };
    expect(classifyDatapackProjectEntry(specialEntry, "link")).toBe("unsupported");
  });

  it("rejects a text handle whose identity differs from the classified project file", () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-datapack-file-swap-"));
    const projectFile = join(root, "pack.mcmeta");
    const outsideFile = join(root, "outside.txt");
    writeFileSync(projectFile, "{}");
    writeFileSync(outsideFile, '{"outside":true}');
    try {
      expect(() =>
        readDatapackProjectFiles(root, undefined, {
          open: (path) =>
            openSync(resolve(path) === resolve(projectFile) ? outsideFile : path, "r"),
        }),
      ).toThrow("input identity changed");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a queued directory whose captured identity changes before traversal", () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-datapack-dir-swap-"));
    const child = join(root, "data");
    mkdirSync(child);
    writeFileSync(join(child, "ignored.json"), "{}");
    let childChecks = 0;
    try {
      expect(() =>
        readDatapackProjectFiles(root, undefined, {
          lstat: (path) => {
            const status = lstatSync(path, { bigint: true, throwIfNoEntry: false });
            if (status && resolve(path) === resolve(child)) {
              childChecks += 1;
              return childChecks > 1 ? withDifferentIdentity(status) : status;
            }
            return status;
          },
        }),
      ).toThrow("directory identity changed");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("validates a resource-pack directory with bounded Ogg/Vorbis header reads", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-resourcepack-"));
    const itemDirectory = join(root, "assets", "example", "items");
    const modelDirectory = join(root, "assets", "example", "models", "item");
    const soundDirectory = join(root, "assets", "example", "sounds");
    const textureDirectory = join(root, "assets", "example", "textures", "item");
    mkdirSync(itemDirectory, { recursive: true });
    mkdirSync(modelDirectory, { recursive: true });
    mkdirSync(soundDirectory, { recursive: true });
    mkdirSync(textureDirectory, { recursive: true });
    writeFileSync(
      join(itemDirectory, "widget.json"),
      JSON.stringify({ model: { type: "minecraft:model", model: "example:item/widget" } }),
    );
    writeFileSync(
      join(modelDirectory, "widget.json"),
      JSON.stringify({
        parent: "minecraft:item/generated",
        textures: { layer0: "example:item/widget" },
      }),
    );
    writeFileSync(
      join(root, "assets", "example", "sounds.json"),
      JSON.stringify({ widget: { sounds: ["example:widget"] } }),
    );
    writeFileSync(
      join(soundDirectory, "widget.ogg"),
      Buffer.concat([validVorbisIdentificationPage(), Buffer.alloc(256, 0xff)]),
    );
    writeFileSync(join(root, "pack.png"), testPng(3, 5));
    writeFileSync(join(textureDirectory, "widget.png"), testPng());

    try {
      const result = await capture(["resourcepack", "validate-project", "26.2", root]);
      expect(result.code).toBe(0);
      expect(result.stdout.join("\n")).toContain('"valid": true');
      expect(result.stdout.join("\n")).toContain('"binaryFiles": 3');
      expect(result.stdout.join("\n")).toContain('"inspectedSoundFiles": 1');
      expect(result.stdout.join("\n")).toContain("bounded 58-byte");
      expect(result.stdout.join("\n")).toContain('"inspectedPngFiles": 2');
      expect(result.stdout.join("\n")).toContain("IDAT payloads were not decompressed");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fills a bounded sound prefix across short reads and rejects non-regular handles", () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-prefix-read-"));
    const file = join(root, "sound.ogg");
    const contents = Buffer.concat([validVorbisIdentificationPage(), Buffer.alloc(20, 0xff)]);
    writeFileSync(file, contents);
    let calls = 0;

    try {
      const prefix = readFilePrefix(file, 58, (handle, target, offset, length, position) => {
        calls += 1;
        return readSync(handle, target, offset, Math.min(7, length), position);
      });
      expect(prefix).toEqual(contents.subarray(0, 58));
      expect(calls).toBeGreaterThan(1);
      expect(() => readFilePrefix(file, 58, undefined, () => false)).toThrow(
        "requires regular local OGG files",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("validates a bounded local PNG from bytes without relying on its extension", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-png-"));
    const file = join(root, "texture.bin");
    writeFileSync(file, testPng(3, 5));

    try {
      const result = await capture(["resourcepack", "validate-png", file]);
      expect(result.code).toBe(0);
      expect(result.stderr).toEqual([]);
      expect(result.stdout.join("\n")).toContain('"validationStrength": "structure"');
      expect(result.stdout.join("\n")).toContain('"width": 3');
      expect(result.stdout.join("\n")).toContain('"height": 5');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("inspects alpha content bounds and evaluates only requested CLI policies", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-png-alpha-"));
    const centeredFile = join(root, "centered.bin");
    const emptyFile = join(root, "empty.png");
    writeFileSync(
      centeredFile,
      testAlphaPng([
        [0, 0, 0],
        [0, 255, 0],
        [0, 0, 0],
      ]),
    );
    writeFileSync(
      emptyFile,
      testAlphaPng([
        [0, 0],
        [0, 0],
      ]),
    );

    try {
      const centered = await capture(["resourcepack", "inspect-png-alpha", centeredFile]);
      expect(centered.code).toBe(0);
      expect(centered.stderr).toEqual([]);
      expect(centered.stdout.join("\n")).toContain('"pixelInspectionStatus": "complete"');
      expect(centered.stdout.join("\n")).toContain('"content": "nonempty"');
      expect(centered.stdout.join("\n")).toContain('"xEndExclusive": 2');
      expect(centered.stdout.join("\n")).toContain('"minimum": 1');
      expect(centered.stdout.join("\n")).toContain('"status": "not-requested"');

      const marginMet = await capture([
        "resourcepack",
        "inspect-png-alpha",
        centeredFile,
        "--require-nonempty",
        "--minimum-transparent-margin-pixels",
        "1",
      ]);
      expect(marginMet.code).toBe(0);
      expect(marginMet.stdout.join("\n")).toContain('"status": "met"');

      const marginNotMet = await capture([
        "resourcepack",
        "inspect-png-alpha",
        centeredFile,
        "--minimum-transparent-margin-pixels",
        "2",
      ]);
      expect(marginNotMet.code).toBe(1);
      expect(marginNotMet.stdout.join("\n")).toContain('"minimum-transparent-margin"');

      const emptyFact = await capture(["resourcepack", "inspect-png-alpha", emptyFile]);
      expect(emptyFact.code).toBe(0);
      expect(emptyFact.stdout.join("\n")).toContain('"content": "empty"');
      expect(emptyFact.stdout.join("\n")).toContain('"contentBounds": null');

      const emptyRequired = await capture([
        "resourcepack",
        "inspect-png-alpha",
        emptyFile,
        "--require-nonempty",
      ]);
      expect(emptyRequired.code).toBe(1);
      expect(emptyRequired.stdout.join("\n")).toContain('"content-empty"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns failure for bounded or invalid PNG alpha inspection", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-png-alpha-boundary-"));
    const validFile = join(root, "valid.png");
    const structuralOnlyFile = join(root, "structural-only.png");
    writeFileSync(
      validFile,
      testAlphaPng([
        [0, 0, 0],
        [0, 255, 0],
        [0, 0, 0],
      ]),
    );
    writeFileSync(structuralOnlyFile, testPng());

    try {
      const bounded = await capture([
        "resourcepack",
        "inspect-png-alpha",
        validFile,
        "--max-inflated-bytes",
        "38",
      ]);
      expect(bounded.code).toBe(1);
      expect(bounded.stdout.join("\n")).toContain(
        '"pixelInspectionReason": "inflated-byte-limit-exceeded"',
      );
      expect(bounded.stdout.join("\n")).toContain('"valid": true');

      const invalid = await capture(["resourcepack", "inspect-png-alpha", structuralOnlyFile]);
      expect(invalid.code).toBe(1);
      expect(invalid.stdout.join("\n")).toContain(
        '"pixelInspectionReason": "zlib-decompression-failed"',
      );

      const invalidMargin = await capture([
        "resourcepack",
        "inspect-png-alpha",
        validFile,
        "--minimum-transparent-margin-pixels",
        "16385",
      ]);
      expect(invalidMargin.code).toBe(1);
      expect(invalidMargin.stderr.join("\n")).toContain(
        "--minimum-transparent-margin-pixels must be between 0 and 16384",
      );

      const unknown = await capture([
        "resourcepack",
        "inspect-png-alpha",
        validFile,
        "--return-pixels",
      ]);
      expect(unknown.code).toBe(1);
      expect(unknown.stderr.join("\n")).toContain("Unknown option: --return-pixels");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("validates current and legacy player-skin dimensions from structurally valid PNGs", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-player-skin-"));
    const currentFile = join(root, "current.png");
    const legacyFile = join(root, "legacy.png");
    writeFileSync(currentFile, testPng(64, 64));
    writeFileSync(legacyFile, testPng(64, 32));

    try {
      const current = await capture([
        "player-skin",
        "validate-layout",
        currentFile,
        "--base-rect",
        "8,8,8,8",
        "--hat-rect",
        "40,8,8,8",
      ]);
      expect(current.code).toBe(0);
      const currentOutput = JSON.parse(current.stdout.join("\n")) as {
        valid: boolean;
        layoutValidationStatus: string;
        layout: { layoutStatus: string; requestedSourceRectChecks: unknown };
      };
      expect(currentOutput).toMatchObject({
        valid: true,
        layoutValidationStatus: "checked-from-valid-png-ihdr",
        layout: {
          layoutStatus: "current",
          requestedSourceRectChecks: { base: "matches", hat: "matches" },
        },
      });
      expect(current.stdout.join("\n")).not.toContain(currentFile);

      const legacy = await capture(["player-skin", "validate-layout", legacyFile]);
      expect(legacy.code).toBe(0);
      expect(legacy.stdout.join("\n")).toContain('"layoutStatus": "legacy"');
      expect(legacy.stdout.join("\n")).toContain(
        '"normalization": "client-converts-legacy-to-64x64"',
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("detects one-pixel right and bottom omissions in requested player-face rectangles", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-player-face-rect-"));
    const file = join(root, "skin.png");
    writeFileSync(file, testPng(64, 64));

    try {
      const result = await capture([
        "player-skin",
        "validate-layout",
        file,
        "--base-rect",
        "8,8,7,8",
        "--hat-rect",
        "40,8,8,7",
      ]);
      expect(result.code).toBe(1);
      const output = JSON.parse(result.stdout.join("\n")) as {
        valid: boolean;
        png: { valid: boolean };
        layout: {
          valid: boolean;
          requestedSourceRectChecks: { base: string; hat: string };
          diagnostics: Array<{ code: string }>;
        };
      };
      expect(output.valid).toBe(false);
      expect(output.png.valid).toBe(true);
      expect(output.layout.valid).toBe(false);
      expect(output.layout.requestedSourceRectChecks).toEqual({
        base: "mismatch",
        hat: "mismatch",
      });
      expect(output.layout.diagnostics.map((item) => item.code)).toEqual([
        "skin.face-base-rect-mismatch",
        "skin.face-hat-rect-mismatch",
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects malformed, oversized, and repeated player-face rectangle options", async () => {
    const missingFile = join(tmpdir(), "minecraft-skills-missing-player-skin.png");
    const malformed = await capture([
      "player-skin",
      "validate-layout",
      missingFile,
      "--base-rect",
      "8,8,8",
    ]);
    expect(malformed.code).toBe(1);
    expect(malformed.stderr.join("\n")).toContain("must be x,y,width,height");

    const oversized = await capture([
      "player-skin",
      "validate-layout",
      missingFile,
      "--hat-rect",
      "16385,8,8,8",
    ]);
    expect(oversized.code).toBe(1);
    expect(oversized.stderr.join("\n")).toContain("within 0..16384");

    const repeated = await capture([
      "player-skin",
      "validate-layout",
      missingFile,
      "--base-rect",
      "8,8,8,8",
      "--base-rect",
      "8,8,8,8",
    ]);
    expect(repeated.code).toBe(1);
    expect(repeated.stderr.join("\n")).toContain("must not be repeated");
  });

  it("does not trust IHDR layout evidence after a CRC failure or truncated IHDR", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-untrusted-skin-png-"));
    const crcFile = join(root, "crc.png");
    const truncatedFile = join(root, "truncated.png");
    const corrupted = testPng(64, 64);
    corrupted[corrupted.length - 1] = (corrupted[corrupted.length - 1] ?? 0) ^ 0xff;
    writeFileSync(crcFile, corrupted);
    writeFileSync(truncatedFile, testPng(64, 64).subarray(0, 20));

    try {
      for (const [file, expectedCode] of [
        [crcFile, "png.crc-mismatch"],
        [truncatedFile, "png.truncated-chunk"],
      ] as const) {
        const result = await capture(["player-skin", "validate-layout", file]);
        expect(result.code).toBe(1);
        const output = JSON.parse(result.stdout.join("\n")) as {
          valid: boolean;
          png: { valid: boolean; diagnostics: Array<{ code: string }> };
          layoutValidationStatus: string;
          layout: unknown;
        };
        expect(output.valid).toBe(false);
        expect(output.png.valid).toBe(false);
        expect(output.png.diagnostics.map((diagnostic) => diagnostic.code)).toContain(expectedCode);
        expect(output.layoutValidationStatus).toBe("not-checked");
        expect(output.layout).toBeNull();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("bounds resource-pack directory traversal and JSON reads before catalog validation", () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-project-scan-"));
    writeFileSync(join(root, "first.json"), "{}");
    writeFileSync(join(root, "second.json"), "{}");

    try {
      expect(() =>
        readResourcepackProjectFiles(root, {
          maxBinaryContentBytes: 100,
          maxContentDepth: 4,
          maxFiles: 1,
          maxPathLength: 100,
          maxTextContentCharacters: 100,
        }),
      ).toThrow("more than 1 files");
      expect(() =>
        readResourcepackProjectFiles(root, {
          maxBinaryContentBytes: 100,
          maxContentDepth: 4,
          maxFiles: 10,
          maxPathLength: 100,
          maxTextContentCharacters: 2,
        }),
      ).toThrow("remaining 0-byte project budget");

      const nested = join(root, "one", "two");
      mkdirSync(nested, { recursive: true });
      expect(() =>
        readResourcepackProjectFiles(root, {
          maxBinaryContentBytes: 100,
          maxContentDepth: 1,
          maxFiles: 10,
          maxPathLength: 100,
          maxTextContentCharacters: 100,
        }),
      ).toThrow("directory depth above 1");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns failing PNG diagnostics for corruption and bounded reads", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-invalid-png-"));
    const corruptedFile = join(root, "corrupted.png");
    const oversizedFile = join(root, "oversized.png");
    const corrupted = testPng();
    corrupted[corrupted.length - 1] = (corrupted[corrupted.length - 1] ?? 0) ^ 0xff;
    writeFileSync(corruptedFile, corrupted);
    writeFileSync(oversizedFile, testPng());

    try {
      const corruptedResult = await capture(["resourcepack", "validate-png", corruptedFile]);
      expect(corruptedResult.code).toBe(1);
      expect(corruptedResult.stdout.join("\n")).toContain('"code": "png.crc-mismatch"');
      expect(corruptedResult.stdout.join("\n")).toContain('"validationComplete": false');

      const boundedResult = await capture([
        "resourcepack",
        "validate-png",
        oversizedFile,
        "--max-bytes",
        "8",
      ]);
      expect(boundedResult.code).toBe(1);
      expect(boundedResult.stdout.join("\n")).toContain('"code": "png.input-byte-limit-exceeded"');
      expect(boundedResult.stdout.join("\n")).toContain('"inputBytes": 9');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("shares the project binary budget across bounded OGG prefixes and complete PNG bytes", () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-binary-budget-"));
    const soundDirectory = join(root, "assets", "example", "sounds");
    mkdirSync(soundDirectory, { recursive: true });
    writeFileSync(join(soundDirectory, "test.ogg"), validVorbisIdentificationPage());
    writeFileSync(join(root, "pack.png"), testPng());
    const scanLimits = {
      maxBinaryContentBytes: 115,
      maxContentDepth: 10,
      maxFiles: 10,
      maxPathLength: 1_024,
      maxTextContentCharacters: 1_024,
    };

    try {
      const files = readResourcepackProjectFiles(root, scanLimits);
      expect(files.find((file) => file.path.endsWith(".ogg"))?.content).toHaveLength(58);
      expect(files.find((file) => file.path.endsWith(".png"))?.content).toHaveLength(57);
      expect(() =>
        readResourcepackProjectFiles(root, { ...scanLimits, maxBinaryContentBytes: 114 }),
      ).toThrow("project budget");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("stats directory entries whose filesystem type is unknown", () => {
    const unknownEntry = {
      isBlockDevice: () => false,
      isCharacterDevice: () => false,
      isDirectory: () => false,
      isFIFO: () => false,
      isFile: () => false,
      isSocket: () => false,
      isSymbolicLink: () => false,
    };
    const status = (kind: "directory" | "file" | "link") => () => ({
      isDirectory: () => kind === "directory",
      isFile: () => kind === "file",
      isSymbolicLink: () => kind === "link",
    });

    expect(classifyResourcepackProjectEntry(unknownEntry, "unknown", status("directory"))).toBe(
      "directory",
    );
    expect(classifyResourcepackProjectEntry(unknownEntry, "unknown", status("file"))).toBe("file");
    expect(classifyResourcepackProjectEntry(unknownEntry, "unknown", status("link"))).toBe(
      "unsupported",
    );
  });

  it("returns a failing status for an unsupported resource-pack sound codec", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-invalid-sound-"));
    const soundDirectory = join(root, "assets", "example", "sounds");
    mkdirSync(soundDirectory, { recursive: true });
    writeFileSync(
      join(root, "assets", "example", "sounds.json"),
      JSON.stringify({ bad: { sounds: ["example:bad"] } }),
    );
    writeFileSync(join(soundDirectory, "bad.ogg"), Buffer.from("RIFF/WAVE"));

    try {
      const result = await capture(["resourcepack", "validate-project", "26.2", root]);
      expect(result.code).toBe(1);
      expect(result.stdout.join("\n")).toContain('"code": "unsupported-sound-codec"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects directories and invalid PNG limits before reading", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-png-boundary-"));
    try {
      const directory = await capture(["resourcepack", "validate-png", root]);
      expect(directory.code).toBe(1);
      expect(directory.stderr.join("\n")).toContain("regular local PNG files");

      const alphaDirectory = await capture(["resourcepack", "inspect-png-alpha", root]);
      expect(alphaDirectory.code).toBe(1);
      expect(alphaDirectory.stderr.join("\n")).toContain("regular local PNG files");

      const targetDirectory = join(root, "target");
      const linkedPath = join(root, "linked.png");
      mkdirSync(targetDirectory);
      symlinkSync(targetDirectory, linkedPath, process.platform === "win32" ? "junction" : "dir");
      const symlink = await capture(["resourcepack", "validate-png", linkedPath]);
      expect(symlink.code).toBe(1);
      expect(symlink.stderr.join("\n")).toContain("refuses symbolic links");

      const alphaSymlink = await capture(["resourcepack", "inspect-png-alpha", linkedPath]);
      expect(alphaSymlink.code).toBe(1);
      expect(alphaSymlink.stderr.join("\n")).toContain("refuses symbolic links");

      const invalidLimit = await capture([
        "resourcepack",
        "validate-png",
        join(root, "missing.png"),
        "--max-pixels",
        "0",
      ]);
      expect(invalidLimit.code).toBe(1);
      expect(invalidLimit.stderr.join("\n")).toContain("--max-pixels must be between 1 and");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns a failing status for an invalid resource-pack reference graph", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-invalid-resourcepack-"));
    const itemDirectory = join(root, "assets", "example", "items");
    mkdirSync(itemDirectory, { recursive: true });
    writeFileSync(
      join(itemDirectory, "widget.json"),
      JSON.stringify({ model: { type: "minecraft:model", model: "example:item/missing" } }),
    );

    try {
      const result = await capture(["resourcepack", "validate-project", "26.2", root]);
      expect(result.code).toBe(1);
      expect(result.stdout.join("\n")).toContain('"valid": false');
      expect(result.stdout.join("\n")).toContain('"code": "missing-item-model"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("prints pack migration plans", async () => {
    const datapack = await capture([
      "datapack",
      "migration-plan",
      "1.20.6",
      "1.21",
      "pack.mcmeta",
      "data/example/advancement/root.json",
      "--limit",
      "5",
    ]);
    expect(datapack.code).toBe(0);
    expect(datapack.stdout.join("\n")).toContain('"domain": "datapack"');
    expect(datapack.stdout.join("\n")).toContain('"schemaBackedFiles": 2');
    expect(datapack.stdout.join("\n")).toContain('"datapack compare-schema"');

    const resourcepack = await capture([
      "resourcepack",
      "migration-plan",
      "1.20.6",
      "1.21",
      "assets/example/items/widget.json",
      "--limit",
      "5",
    ]);
    expect(resourcepack.code).toBe(0);
    expect(resourcepack.stdout.join("\n")).toContain('"domain": "resourcepack"');
    expect(resourcepack.stdout.join("\n")).toContain('"resourcepack file-schema"');
  });

  it("searches vanilla paths", async () => {
    const result = await capture([
      "resourcepack",
      "vanilla-paths",
      "26.2",
      "--prefix",
      "assets/minecraft/models/block/",
      "--contains",
      "acacia_button",
      "--extension",
      "json",
    ]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain("assets/minecraft/models/block/acacia_button.json");
  });

  it("inspects and searches cached vanilla datapack JSON content", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-cli-vanilla-json-"));
    vi.stubEnv("MINECRAFT_SKILLS_CACHE_DIR", root);
    let restoreServerMetadata = () => undefined;
    try {
      const jarDir = join(root, "mojang-server-jars");
      mkdirSync(jarDir, { recursive: true });
      const jar = createStoredZip({
        "data/minecraft/recipe/widget.json": JSON.stringify({
          type: "minecraft:crafting_shapeless",
          ingredients: [{ item: "minecraft:diamond" }],
        }),
      });
      writeFileSync(join(jarDir, "26.2.jar"), jar);
      const server = getVersionDetail("java", "26.2").downloads.server as {
        sha1?: string;
        size?: number;
      };
      const previousSha1 = server.sha1;
      const previousSize = server.size;
      server.sha1 = createHash("sha1").update(jar).digest("hex");
      server.size = jar.length;
      restoreServerMetadata = () => {
        if (previousSha1 === undefined) delete server.sha1;
        else server.sha1 = previousSha1;
        if (previousSize === undefined) delete server.size;
        else server.size = previousSize;
      };

      const status = await capture(["datapack", "vanilla-json", "status", "26.2"]);
      expect(status.code).toBe(0);
      expect(status.stdout.join("\n")).toContain('"cached": true');

      const files = await capture([
        "datapack",
        "vanilla-json",
        "files",
        "26.2",
        "--kind",
        "recipe",
      ]);
      expect(files.code).toBe(0);
      expect(files.stdout.join("\n")).toContain("data/minecraft/recipe/widget.json");

      const get = await capture([
        "datapack",
        "vanilla-json",
        "get",
        "26.2",
        "data/minecraft/recipe/widget.json",
      ]);
      expect(get.code).toBe(0);
      expect(get.stdout.join("\n")).toContain('"minecraft:crafting_shapeless"');

      const search = await capture([
        "datapack",
        "vanilla-json",
        "search",
        "minecraft:diamond",
        "--version",
        "26.2",
        "--scope",
        "values",
      ]);
      expect(search.code).toBe(0);
      expect(search.stdout.join("\n")).toContain('"pointer": "/ingredients/0/item"');

      const clean = await capture(["datapack", "vanilla-json", "clean", "26.2"]);
      expect(clean.code).toBe(0);
      expect(clean.stdout.join("\n")).toContain('"removed": true');
      expect(existsSync(join(jarDir, "26.2.jar"))).toBe(false);
    } finally {
      restoreServerMetadata();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps a vanilla datapack JSON version after the --force flag", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("fetch should not run for an unsupported version");
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await capture([
      "datapack",
      "vanilla-json",
      "fetch",
      "--force",
      "unsupported-parser-probe",
    ]);

    expect(result.code).toBe(1);
    expect(result.stderr.join("\n")).toContain("unsupported-parser-probe");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects missing vanilla datapack JSON boolean option values", async () => {
    const get = await capture([
      "datapack",
      "vanilla-json",
      "get",
      "26.2",
      "data/minecraft/recipe/widget.json",
      "--parse",
    ]);
    expect(get.code).toBe(1);
    expect(get.stderr).toEqual(["--parse requires a value"]);

    const search = await capture([
      "datapack",
      "vanilla-json",
      "search",
      "minecraft:diamond",
      "--case-sensitive",
    ]);
    expect(search.code).toBe(1);
    expect(search.stderr).toEqual(["--case-sensitive requires a value"]);
  });

  it("compares vanilla paths", async () => {
    const result = await capture([
      "resourcepack",
      "compare-vanilla-paths",
      "1.20.6",
      "1.21",
      "--prefix",
      "assets/minecraft/models/item/",
      "--limit",
      "10",
    ]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain(
      "assets/minecraft/models/item/music_disc_creator.json",
    );
  });

  it("prints version comparison", async () => {
    const result = await capture(["minecraft", "compare", "1.20.6", "1.21"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"from": "1.20.6"');
    expect(result.stdout.join("\n")).toContain('"to": "1.21"');
    expect(result.stdout.join("\n")).toContain('"vanillaInventory"');
  });

  it("prints server reports", async () => {
    const result = await capture(["datapack", "server-reports"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"coverage": "server-reports"');
    expect(result.stdout.join("\n")).toContain('"execute"');
  });

  it("searches command paths", async () => {
    const result = await capture(["datapack", "commands", "26.2", "--prefix", "execute"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"matchedPaths"');
    expect(result.stdout.join("\n")).toContain("execute");
  });

  it("searches and compares official registry entry indexes", async () => {
    const search = await capture([
      "minecraft",
      "registry-entries",
      "26.2",
      "--registry",
      "minecraft:item",
      "--exact",
      "minecraft:stone",
    ]);
    expect(search.code).toBe(0);
    expect(search.stdout.join("\n")).toContain('"registryStatus": "indexed"');
    expect(search.stdout.join("\n")).toContain('"entryId": "minecraft:stone"');
    expect(search.stdout.join("\n")).toContain('"protocolId": 1');

    const comparison = await capture([
      "minecraft",
      "compare-registry-entries",
      "26.1.2",
      "26.2",
      "--registry",
      "minecraft:block",
      "--exact",
      "minecraft:cinnabar",
    ]);
    expect(comparison.code).toBe(0);
    expect(comparison.stdout.join("\n")).toContain('"addedTotal": 1');
    expect(comparison.stdout.join("\n")).toContain('"entryId": "minecraft:cinnabar"');

    const protocolComparison = await capture([
      "minecraft",
      "compare-registry-entries",
      "26.1.2",
      "26.2",
      "--registry",
      "minecraft:attribute",
      "--exact",
      "minecraft:armor",
    ]);
    expect(protocolComparison.code).toBe(0);
    expect(protocolComparison.stdout.join("\n")).toContain('"outcome": "compared"');
    expect(protocolComparison.stdout.join("\n")).toContain('"changedProtocolIdsTotal": 1');
    expect(protocolComparison.stdout.join("\n")).toContain('"from": 0');
    expect(protocolComparison.stdout.join("\n")).toContain('"to": 1');
  });

  it("searches lightweight catalog entries by domain", async () => {
    const result = await capture([
      "plugin",
      "paper",
      "search",
      "event listener",
      "--kind",
      "authoring-recipe",
    ]);

    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"kind": "authoring-recipe"');
    expect(result.stdout.join("\n")).toContain('"id": "paper-event-listener"');
  });

  it("searches lightweight catalog entries across domains", async () => {
    const result = await capture([
      "minecraft",
      "search",
      "prismarine assets",
      "--kind",
      "community-dataset",
    ]);

    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"id": "prismarinejs-minecraft-assets"');
  });

  it("compares command paths", async () => {
    const result = await capture([
      "datapack",
      "compare-commands",
      "1.20.6",
      "1.21",
      "--prefix",
      "attribute",
    ]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain("modifier add");
  });

  it("prints resourcepack model summaries", async () => {
    const result = await capture(["resourcepack", "models", "26.2"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain('"coverage": "client-resourcepack-models"');
    expect(result.stdout.join("\n")).toContain('"minecraft:model"');
  });

  it("searches resourcepack model paths", async () => {
    const result = await capture([
      "resourcepack",
      "search-models",
      "26.2",
      "--kind",
      "item-definition",
      "--contains",
      "bundle",
    ]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain("assets/minecraft/items/bundle.json");
  });

  it("prints discovery-oriented search helpers", async () => {
    const searchAll = await capture([
      "minecraft",
      "search-all",
      "bundle item model",
      "--domain",
      "resourcepack",
      "--limit",
      "80",
    ]);
    expect(searchAll.code).toBe(0);
    expect(searchAll.stdout.join("\n")).toContain("resourcepack-models");

    const datapack = await capture(["datapack", "find", "execute", "--limit", "5"]);
    expect(datapack.code).toBe(0);
    expect(datapack.stdout.join("\n")).toContain('"source": "commands"');

    const resourcepack = await capture([
      "resourcepack",
      "assets",
      "find",
      "Diamond Sword",
      "--kind",
      "item-definition",
    ]);
    expect(resourcepack.code).toBe(0);
    expect(resourcepack.stdout.join("\n")).toContain("assets/minecraft/items/diamond_sword.json");

    const explain = await capture([
      "minecraft",
      "explain-path",
      "26.2",
      "assets/example/items/widget.json",
      "--domain",
      "resourcepack",
    ]);
    expect(explain.code).toBe(0);
    expect(explain.stdout.join("\n")).toContain('"kind": "item-definition"');

    const suggestions = await capture([
      "minecraft",
      "suggest-lookups",
      "migrate resource pack item model",
      "--domain",
      "resourcepack",
    ]);
    expect(suggestions.code).toBe(0);
    expect(suggestions.stdout.join("\n")).toContain("resourcepack assets find");

    const itemDelivery = await capture([
      "minecraft",
      "suggest-lookups",
      "handle full inventory reward leftovers",
      "--version",
      "1.21.11",
    ]);
    expect(itemDelivery.code).toBe(0);
    expect(itemDelivery.stdout.join("\n")).toContain("plugin paper search");
    expect(itemDelivery.stdout.join("\n")).toContain('"id": "paper-item-delivery-review"');
    expect(itemDelivery.stdout.join("\n")).not.toContain("resourcepack assets find");

    const itemModel = await capture([
      "minecraft",
      "suggest-lookups",
      "give an item model a custom texture",
      "--version",
      "1.21.11",
    ]);
    expect(itemModel.code).toBe(0);
    expect(itemModel.stdout.join("\n")).not.toContain("plugin paper search");

    const experienceReward = await capture([
      "minecraft",
      "suggest-lookups",
      "reward a player with experience points",
      "--version",
      "1.21.11",
    ]);
    expect(experienceReward.code).toBe(0);
    const experienceRewardOutput = JSON.parse(experienceReward.stdout.join("\n")) as {
      suggestedTools: Array<{ tool: string }>;
    };
    expect(
      experienceRewardOutput.suggestedTools.some((entry) => entry.tool.startsWith("plugin paper ")),
    ).toBe(false);
  });

  it("routes inventory GUI lookup suggestions to Paper without migration false positives", async () => {
    const inventory = await capture([
      "minecraft",
      "suggest-lookups",
      "inventory GUI shift-click drag",
      "--domain",
      "paper-plugin",
      "--version",
      "1.21.11",
    ]);
    expect(inventory.code).toBe(0);
    const inventoryOutput = JSON.parse(inventory.stdout.join("\n")) as {
      suggestedTools: Array<{ tool: string }>;
      scenarios: { results: Array<{ scenario: { id: string } }> };
    };
    expect(
      inventoryOutput.suggestedTools.some((entry) => entry.tool.startsWith("plugin paper search")),
    ).toBe(true);
    expect(
      inventoryOutput.suggestedTools.some((entry) =>
        entry.tool.startsWith("minecraft pack-format"),
      ),
    ).toBe(false);
    expect(inventoryOutput.scenarios.results[0]?.scenario.id).toBe(
      "paper-inventory-gui-interaction-review",
    );

    const resourcepack = await capture([
      "minecraft",
      "suggest-lookups",
      "design a resource pack inventory GUI texture",
      "--version",
      "1.21.11",
    ]);
    expect(resourcepack.code).toBe(0);
    const resourcepackOutput = JSON.parse(resourcepack.stdout.join("\n")) as {
      suggestedTools: Array<{ tool: string }>;
    };
    expect(
      resourcepackOutput.suggestedTools.some((entry) =>
        entry.tool.startsWith("resourcepack assets"),
      ),
    ).toBe(true);
    expect(
      resourcepackOutput.suggestedTools.some((entry) =>
        entry.tool.startsWith("plugin paper search"),
      ),
    ).toBe(false);
  });

  it("caches and searches external resourcepack assets", async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "minecraft-skills-cli-assets-"));
    vi.stubEnv("MINECRAFT_SKILLS_CACHE_DIR", cacheDir);
    vi.stubGlobal("fetch", async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/git/trees/26.2")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({
            tree: [
              { path: "assets/minecraft/models/item/apple.json", type: "blob" },
              { path: "assets/minecraft/textures/item/apple.png", type: "blob" },
            ],
          }),
        } as unknown as Response;
      }
      if (url.endsWith("/26.2.zip")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          arrayBuffer: async () => Buffer.from("zip bytes"),
        } as unknown as Response;
      }
      if (url.endsWith("/assets/minecraft/models/item/apple.json")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          arrayBuffer: async () => Buffer.from('{"parent":"minecraft:item/generated"}'),
        } as unknown as Response;
      }
      throw new Error(`unexpected url ${url}`);
    });
    try {
      const fetchResult = await capture(["resourcepack", "assets", "fetch", "26.2"]);
      expect(fetchResult.code).toBe(0);
      expect(fetchResult.stdout.join("\n")).toContain('"bytes": 9');

      const search = await capture([
        "resourcepack",
        "assets",
        "search",
        "26.2",
        "--extension",
        "json",
      ]);
      expect(search.code).toBe(0);
      expect(search.stdout.join("\n")).toContain("assets/minecraft/models/item/apple.json");

      const get = await capture([
        "resourcepack",
        "assets",
        "get",
        "26.2",
        "assets/minecraft/models/item/apple.json",
      ]);
      expect(get.code).toBe(0);
      expect(get.stdout.join("\n")).toContain('"cached": false');

      const status = await capture(["resourcepack", "assets", "status", "26.2"]);
      expect(status.code).toBe(0);
      expect(status.stdout.join("\n")).toContain('"archiveCached": true');
      expect(status.stdout.join("\n")).toContain('"cachedFileCount": 1');
    } finally {
      rmSync(cacheDir, { recursive: true, force: true });
    }
  });

  it("searches Paper events", async () => {
    const fetchMock = vi.fn(async (_url: string) => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ events: [{ name: "PlayerJoinEvent" }] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await capture([
      "plugin",
      "paper",
      "events",
      "player join",
      "--version",
      "1.21.11",
    ]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain("PlayerJoinEvent");
    const url = fetchMock.mock.calls[0]?.[0] ?? "";
    expect(url).toContain("q=player+join");
    expect(url).toContain("version=1.21.11");
  });

  it("reports unknown commands", async () => {
    const result = await capture(["nope"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toEqual(["Unknown command: nope"]);
  });

  it("reports unknown grouped subcommands", async () => {
    const pluginResult = await capture(["plugin", "nope"]);
    expect(pluginResult.code).toBe(1);
    expect(pluginResult.stderr).toEqual(["Unknown subcommand: plugin nope"]);

    const velocityResult = await capture(["velocity", "nope"]);
    expect(velocityResult.code).toBe(1);
    expect(velocityResult.stderr).toEqual(["Unknown subcommand: velocity nope"]);
  });

  it("rejects flat public command forms", async () => {
    const result = await capture(["paper-members", "1.21.11"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toEqual(["Use subcommands: minecraft-skills plugin paper members"]);
  });

  it("prints practical help with workflows and safety notes", async () => {
    const result = await capture(["--help"]);
    const output = result.stdout.join("\n");
    expect(result.code).toBe(0);
    expect(output).toContain("Start here:");
    expect(output).toContain("Common workflows:");
    expect(output).toMatch(
      /translate non-English user intent into concise English\s+canonical Minecraft terms/,
    );
    expect(output).toMatch(/Keep exact identifiers, namespace IDs, file\s+paths, project titles/);
    expect(output).toMatch(/keep the user's requested response language/);
    expect(output).toContain(
      'minecraft-skills plugin paper search-scenarios "Paper event listener"',
    );
    expect(output).toContain("minecraft-skills plugin paper search <query>");
    expect(output).toContain("Grouped commands:");
    expect(output).not.toContain("Compatibility:");
    expect(output).toContain("Safety notes:");
    expect(output).toContain("Paper Javadocs indexes prove API name presence");
    expect(output).toContain("docs/USAGE.md");
  });

  it("continues to accept Unicode literal search input", async () => {
    const result = await capture(["minecraft", "search", "日本語プロジェクト"]);
    expect(result.code).toBe(0);
    expect(result.stderr).toEqual([]);
    expect(result.stdout.join("\n")).toContain('"query": "日本語プロジェクト"');
  });
});

import { describe, expect, it } from "vitest";
import {
  paperPluginJarValidationLimits,
  validatePaperPluginArchiveMetadata,
  validatePaperPluginJar,
} from "./paperPluginJar.js";

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
    centralHeader.writeUInt32LE(0, 12);
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

const pluginYml = [
  "name: ExamplePlugin",
  "version: 1.0",
  "main: dev.example.ExamplePlugin",
  "api-version: '26.2'",
].join("\n");

const paperPluginYml = [
  "name: PaperExample",
  "version: '1.0'",
  "main: dev.example.PaperExample",
  "api-version: '1.21'",
  "bootstrapper: dev.example.PaperBootstrap",
  "loader: dev.example.PaperLoader",
  "dependencies:",
  "  server:",
  "    ProtocolLib:",
  "      load: BEFORE",
  "      required: false",
  "      join-classpath: true",
].join("\n");

describe("Paper plugin JAR validation", () => {
  it("validates a binary Bukkit plugin JAR without expanding class bytecode", () => {
    const archive = createStoredZip({
      "plugin.yml": pluginYml,
      "dev/example/ExamplePlugin.class": "class bytes are deliberately opaque",
    });

    const result = validatePaperPluginJar({ archive });

    expect(result.valid).toBe(true);
    expect(result.validationStrength).toBe("binary");
    expect(result.validationComplete).toBe(false);
    expect(result.archive).toMatchObject({
      entryListComplete: true,
      zipStructureValidated: true,
      descriptorCount: 1,
      bothDescriptorsObserved: false,
      allEntryContentIntegrityValidated: false,
    });
    expect(result.descriptors[0]).toMatchObject({
      kind: "plugin.yml",
      contentIntegrityValidated: true,
      yamlValidated: true,
      declaredClasses: [{ field: "main", entryObserved: true, entryPresenceProven: true }],
    });
  });

  it("treats paper-plugin.yml as active and plugin.yml as shadowed when both exist", () => {
    const result = validatePaperPluginJar({
      archive: createStoredZip({
        "plugin.yml": pluginYml,
        "paper-plugin.yml": paperPluginYml,
        "dev/example/ExamplePlugin.class": "",
        "dev/example/PaperExample.class": "",
        "dev/example/PaperBootstrap.class": "",
        "dev/example/PaperLoader.class": "",
      }),
    });

    expect(result.valid).toBe(true);
    expect(result.archive.bothDescriptorsObserved).toBe(true);
    expect(result.descriptors).toHaveLength(2);
    expect(result.descriptors[0]).toMatchObject({ kind: "plugin.yml", role: "shadowed" });
    expect(result.descriptors[1]).toMatchObject({
      kind: "paper-plugin.yml",
      role: "active",
      experimental: true,
    });
    expect(result.incompleteReasons).toContain("paper-plugin-format-experimental");
    expect(result.diagnostics).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: expect.stringContaining("conflict") }),
      ]),
    );
  });

  it("ignores malformed shadowed plugin.yml content when paper-plugin.yml is active", () => {
    const result = validatePaperPluginJar({
      archive: createStoredZip({
        "plugin.yml": "main: [",
        "paper-plugin.yml": paperPluginYml,
        "dev/example/PaperExample.class": "",
        "dev/example/PaperBootstrap.class": "",
        "dev/example/PaperLoader.class": "",
      }),
    });

    expect(result.valid).toBe(true);
    expect(result.descriptors[0]).toMatchObject({
      kind: "plugin.yml",
      role: "shadowed",
      yamlValidated: false,
    });
    expect(result.diagnostics).not.toContainEqual(
      expect.objectContaining({ severity: "error", path: "/descriptors/plugin.yml" }),
    );
  });

  it("accepts default-package entrypoints in both descriptor formats", () => {
    const pluginDescriptor = pluginYml.replace("dev.example.ExamplePlugin", "ExamplePlugin");
    const plugin = validatePaperPluginArchiveMetadata({
      archiveEntries: [
        { path: "plugin.yml", size: Buffer.byteLength(pluginDescriptor) },
        { path: "ExamplePlugin.class", size: 1 },
      ],
      archiveEntriesComplete: true,
      pluginYml: pluginDescriptor,
    });
    const paperDescriptor = paperPluginYml
      .replace("dev.example.PaperExample", "PaperExample")
      .replace("dev.example.PaperBootstrap", "PaperBootstrap")
      .replace("dev.example.PaperLoader", "PaperLoader");
    const paper = validatePaperPluginArchiveMetadata({
      archiveEntries: [
        { path: "paper-plugin.yml", size: Buffer.byteLength(paperDescriptor) },
        { path: "PaperExample.class", size: 1 },
        { path: "PaperBootstrap.class", size: 1 },
        { path: "PaperLoader.class", size: 1 },
      ],
      archiveEntriesComplete: true,
      paperPluginYml: paperDescriptor,
    });

    expect(plugin.valid).toBe(true);
    expect(paper.valid).toBe(true);
    expect(plugin.descriptors[0]?.declaredClasses[0]?.entryObserved).toBe(true);
    expect(paper.descriptors[0]?.declaredClasses[0]?.entryObserved).toBe(true);
  });

  it("separates incomplete archive evidence from invalid descriptors", () => {
    const result = validatePaperPluginArchiveMetadata({
      archiveEntries: [{ path: "plugin.yml", size: Buffer.byteLength(pluginYml) }],
      archiveEntriesComplete: false,
      pluginYml,
    });

    expect(result.valid).toBe(true);
    expect(result.unknownCount).toBeGreaterThan(0);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ severity: "unknown", code: "descriptor.selection-unproven" }),
    );
    expect(result.descriptors[0]).toMatchObject({
      kind: "plugin.yml",
      role: "selection-unknown",
      yamlValidated: false,
      declaredClasses: [],
    });
    expect(result.incompleteReasons).toContain("active-descriptor-selection-not-proven");
  });

  it("does not parse malformed plugin.yml while descriptor selection is unknown", () => {
    const result = validatePaperPluginArchiveMetadata({
      archiveEntries: [{ path: "plugin.yml", size: 7 }],
      archiveEntriesComplete: false,
      pluginYml: "main: [",
    });

    expect(result.valid).toBe(true);
    expect(result.descriptors[0]).toMatchObject({
      kind: "plugin.yml",
      role: "selection-unknown",
      yamlValidated: false,
    });
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ severity: "unknown", code: "descriptor.selection-unproven" }),
    );
    expect(result.diagnostics).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: "error", code: expect.stringMatching(/^yaml\./u) }),
      ]),
    );
  });

  it("keeps plugin.yml selection unknown when paper-plugin.yml falls beyond the entry limit", () => {
    const entries = [
      { path: "plugin.yml", size: Buffer.byteLength(pluginYml) },
      { path: "dev/example/ExamplePlugin.class", size: 1 },
      ...Array.from(
        { length: paperPluginJarValidationLimits.maxArchiveEntries - 2 },
        (_, index) => ({ path: `classes/C${index}.class`, size: 0 }),
      ),
      { path: "paper-plugin.yml", size: Buffer.byteLength(paperPluginYml) },
    ];
    const result = validatePaperPluginArchiveMetadata({
      archiveEntries: entries,
      archiveEntriesComplete: true,
      pluginYml,
    });

    expect(result.archive.entryListComplete).toBe(false);
    expect(result.descriptors[0]).toMatchObject({
      kind: "plugin.yml",
      role: "selection-unknown",
      yamlValidated: false,
    });
    expect(result.incompleteReasons).toContain("active-descriptor-selection-not-proven");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ severity: "unknown", code: "descriptor.selection-unproven" }),
    );
  });

  it("keeps an observed paper-plugin.yml active in an incomplete listing", () => {
    const result = validatePaperPluginArchiveMetadata({
      archiveEntries: [
        { path: "plugin.yml", size: 7 },
        { path: "paper-plugin.yml", size: Buffer.byteLength(paperPluginYml) },
        { path: "dev/example/PaperExample.class", size: 1 },
        { path: "dev/example/PaperBootstrap.class", size: 1 },
        { path: "dev/example/PaperLoader.class", size: 1 },
      ],
      archiveEntriesComplete: false,
      pluginYml: "main: [",
      paperPluginYml,
    });

    expect(result.valid).toBe(true);
    expect(result.descriptors[0]).toMatchObject({
      kind: "plugin.yml",
      role: "shadowed",
      yamlValidated: false,
    });
    expect(result.descriptors[1]).toMatchObject({
      kind: "paper-plugin.yml",
      role: "active",
      yamlValidated: true,
    });
    expect(result.diagnostics).not.toContainEqual(
      expect.objectContaining({ code: "descriptor.selection-unproven" }),
    );
  });

  it("selects plugin.yml when a complete listing proves paper-plugin.yml absent", () => {
    const result = validatePaperPluginArchiveMetadata({
      archiveEntries: [
        { path: "plugin.yml", size: Buffer.byteLength(pluginYml) },
        { path: "dev/example/ExamplePlugin.class", size: 1 },
      ],
      archiveEntriesComplete: true,
      pluginYml,
    });

    expect(result.valid).toBe(true);
    expect(result.descriptors[0]).toMatchObject({
      kind: "plugin.yml",
      role: "active",
      yamlValidated: true,
    });
    expect(result.diagnostics).not.toContainEqual(
      expect.objectContaining({ code: "descriptor.selection-unproven" }),
    );
  });

  it("warns without rejecting when a declared class is absent from the plugin JAR", () => {
    const result = validatePaperPluginArchiveMetadata({
      archiveEntries: [{ path: "plugin.yml", size: Buffer.byteLength(pluginYml) }],
      archiveEntriesComplete: true,
      pluginYml,
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ severity: "warning", code: "class.entry-missing-from-archive" }),
    );
    expect(result.incompleteReasons).toContain("declared-class-runtime-resolution-not-proven");
  });

  it("does not assert descriptor absence after archive metadata is truncated", () => {
    const result = validatePaperPluginArchiveMetadata({
      archiveEntries: [
        ...Array.from({ length: paperPluginJarValidationLimits.maxArchiveEntries }, (_, index) => ({
          path: `classes/C${index}.class`,
          size: 0,
        })),
        { path: "plugin.yml", size: Buffer.byteLength(pluginYml) },
      ],
      archiveEntriesComplete: true,
      pluginYml,
    });

    expect(result.archive.entryListComplete).toBe(false);
    expect(result.incompleteReasons).toContain("archive-entry-list-incomplete");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ severity: "unknown", code: "descriptor.entry-not-observed" }),
    );
    expect(result.diagnostics).not.toContainEqual(
      expect.objectContaining({ code: "descriptor.content-entry-mismatch" }),
    );
  });

  it("does not assert class absence when its entry may be beyond the metadata limit", () => {
    const result = validatePaperPluginArchiveMetadata({
      archiveEntries: [
        { path: "plugin.yml", size: Buffer.byteLength(pluginYml) },
        ...Array.from(
          { length: paperPluginJarValidationLimits.maxArchiveEntries - 1 },
          (_, index) => ({ path: `classes/C${index}.class`, size: 0 }),
        ),
        { path: "dev/example/ExamplePlugin.class", size: 1 },
      ],
      archiveEntriesComplete: true,
      pluginYml,
    });

    expect(result.archive.entryListComplete).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ severity: "unknown", code: "descriptor.selection-unproven" }),
    );
    expect(result.diagnostics).not.toContainEqual(
      expect.objectContaining({ code: "class.entry-missing-from-archive" }),
    );
    expect(result.descriptors[0]).toMatchObject({ role: "selection-unknown", declaredClasses: [] });
  });

  it("downgrades absence claims when invalid entry metadata is filtered", () => {
    const result = validatePaperPluginArchiveMetadata({
      archiveEntries: [
        { path: "plugin.yml", size: Buffer.byteLength(pluginYml) },
        { path: "../untrusted.class", size: 1 },
      ],
      archiveEntriesComplete: true,
      pluginYml,
    });

    expect(result.archive.entryListComplete).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: "error", code: "archive.unsafe-path" }),
        expect.objectContaining({ severity: "unknown", code: "descriptor.selection-unproven" }),
      ]),
    );
    expect(result.diagnostics).not.toContainEqual(
      expect.objectContaining({ code: "class.entry-missing-from-archive" }),
    );
  });

  it("rejects descriptor character overflow before measuring UTF-8 bytes", () => {
    const result = validatePaperPluginArchiveMetadata({
      archiveEntries: [],
      archiveEntriesComplete: false,
      pluginYml: "a".repeat(paperPluginJarValidationLimits.maxDescriptorCharacters + 1),
    });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "descriptor.character-limit" }),
    );
    expect(result.diagnostics).not.toContainEqual(
      expect.objectContaining({ code: "descriptor.byte-limit" }),
    );
  });

  it("keeps syntactic but undocumented Paper API versions unknown", () => {
    for (const unsupportedVersion of ["2.0", "999.999"]) {
      const descriptor = pluginYml.replace("26.2", unsupportedVersion);
      const result = validatePaperPluginArchiveMetadata({
        archiveEntries: [
          { path: "plugin.yml", size: Buffer.byteLength(descriptor) },
          { path: "dev/example/ExamplePlugin.class", size: 1 },
        ],
        archiveEntriesComplete: true,
        pluginYml: descriptor,
      });

      expect(result.valid).toBe(true);
      expect(result.validationComplete).toBe(false);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          severity: "unknown",
          code: "descriptor.api-version-support-unproven",
        }),
      );
      expect(result.incompleteReasons).toContain("unvalidated-or-unknown-fields-present");
    }
  });

  it("accepts a null command value as an empty command definition", () => {
    const descriptor = `${pluginYml}\ncommands:\n  apocalypse:`;
    const result = validatePaperPluginArchiveMetadata({
      archiveEntries: [
        { path: "plugin.yml", size: Buffer.byteLength(descriptor) },
        { path: "dev/example/ExamplePlugin.class", size: 1 },
      ],
      archiveEntriesComplete: true,
      pluginYml: descriptor,
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).not.toContainEqual(
      expect.objectContaining({ code: "commands.entry-type" }),
    );
  });

  it("matches Bukkit load-order normalization for plugin.yml", () => {
    for (const load of ["startup", "post-world"]) {
      const descriptor = `${pluginYml}\nload: ${load}`;
      const result = validatePaperPluginArchiveMetadata({
        archiveEntries: [
          { path: "plugin.yml", size: Buffer.byteLength(descriptor) },
          { path: "dev/example/ExamplePlugin.class", size: 1 },
        ],
        archiveEntriesComplete: true,
        pluginYml: descriptor,
      });

      expect(result.valid).toBe(true);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          severity: "warning",
          code: "plugin.load-order-normalized",
        }),
      );
      expect(result.diagnostics).not.toContainEqual(
        expect.objectContaining({ severity: "error", code: "plugin.load-order" }),
      );
    }
  });

  it("matches Configurate enum lookup for Paper load-order tokens", () => {
    for (const [load, dependencyLoad] of [
      ["startup", "before"],
      ["post_world", "be_fore"],
    ] as const) {
      const descriptor = paperPluginYml
        .replace("api-version: '1.21'", `api-version: '1.21'\nload: ${load}`)
        .replace("load: BEFORE", `load: ${dependencyLoad}`);
      const result = validatePaperPluginArchiveMetadata({
        archiveEntries: [
          { path: "paper-plugin.yml", size: Buffer.byteLength(descriptor) },
          { path: "dev/example/PaperExample.class", size: 1 },
          { path: "dev/example/PaperBootstrap.class", size: 1 },
          { path: "dev/example/PaperLoader.class", size: 1 },
        ],
        archiveEntriesComplete: true,
        paperPluginYml: descriptor,
      });

      expect(result.valid).toBe(true);
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            severity: "warning",
            code: "paper.load-order-normalized",
          }),
          expect.objectContaining({
            severity: "warning",
            code: "paper.dependency-load-normalized",
          }),
        ]),
      );
      expect(result.diagnostics).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ severity: "error", code: "paper.load-order" }),
          expect.objectContaining({ severity: "error", code: "paper.dependency-load" }),
        ]),
      );
    }
  });

  it("accepts plugin.yml paper-skip-libraries text booleans", () => {
    for (const skipLibraries of ["true", "FALSE"]) {
      const descriptor = `${pluginYml}\npaper-skip-libraries: '${skipLibraries}'`;
      const result = validatePaperPluginArchiveMetadata({
        archiveEntries: [
          { path: "plugin.yml", size: Buffer.byteLength(descriptor) },
          { path: "dev/example/ExamplePlugin.class", size: 1 },
        ],
        archiveEntriesComplete: true,
        pluginYml: descriptor,
      });

      expect(result.valid).toBe(true);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          severity: "warning",
          code: "plugin.paper-skip-libraries-string",
        }),
      );
      expect(result.diagnostics).not.toContainEqual(
        expect.objectContaining({ severity: "error", code: "plugin.paper-skip-libraries" }),
      );
    }

    const unknownScalarDescriptor = `${pluginYml}\npaper-skip-libraries: 1`;
    const unknownScalarResult = validatePaperPluginArchiveMetadata({
      archiveEntries: [
        { path: "plugin.yml", size: Buffer.byteLength(unknownScalarDescriptor) },
        { path: "dev/example/ExamplePlugin.class", size: 1 },
      ],
      archiveEntriesComplete: true,
      pluginYml: unknownScalarDescriptor,
    });
    expect(unknownScalarResult.valid).toBe(true);
    expect(unknownScalarResult.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "unknown",
        code: "plugin.paper-skip-libraries-unverified",
      }),
    );
  });

  it("keeps plugin.yml iterable scalar coercion distinct from Paper descriptors", () => {
    const pluginDescriptor = [
      pluginYml,
      "authors: [123, true]",
      "contributors: [false]",
      "depend: [456]",
      "softdepend: [true]",
      "loadbefore: [789]",
      "provides: [false]",
      "libraries: [123]",
    ].join("\n");
    const pluginResult = validatePaperPluginArchiveMetadata({
      archiveEntries: [
        { path: "plugin.yml", size: Buffer.byteLength(pluginDescriptor) },
        { path: "dev/example/ExamplePlugin.class", size: 1 },
      ],
      archiveEntriesComplete: true,
      pluginYml: pluginDescriptor,
    });
    const paperDescriptor = `${paperPluginYml}\nauthors: [42]`;
    const paperResult = validatePaperPluginArchiveMetadata({
      archiveEntries: [
        { path: "paper-plugin.yml", size: Buffer.byteLength(paperDescriptor) },
        { path: "dev/example/PaperExample.class", size: 1 },
        { path: "dev/example/PaperBootstrap.class", size: 1 },
        { path: "dev/example/PaperLoader.class", size: 1 },
      ],
      archiveEntriesComplete: true,
      paperPluginYml: paperDescriptor,
    });

    expect(pluginResult.valid).toBe(true);
    expect(pluginResult.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        code: "plugin.list-item-coerced-to-string",
      }),
    );
    expect(pluginResult.diagnostics).not.toContainEqual(
      expect.objectContaining({ code: "descriptor.string-list-item" }),
    );
    expect(paperResult.valid).toBe(false);
    expect(paperResult.diagnostics).toContainEqual(
      expect.objectContaining({ severity: "error", code: "descriptor.string-list-item" }),
    );
  });

  it("rejects command names containing the documented forbidden colon", () => {
    const descriptor = `${pluginYml}\ncommands:\n  'namespace:command': {}`;
    const result = validatePaperPluginArchiveMetadata({
      archiveEntries: [
        { path: "plugin.yml", size: Buffer.byteLength(descriptor) },
        { path: "dev/example/ExamplePlugin.class", size: 1 },
      ],
      archiveEntriesComplete: true,
      pluginYml: descriptor,
    });

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ severity: "error", code: "commands.name-colon" }),
    );
  });

  it("validates permission child lists and nested permission definitions", () => {
    const descriptor = [
      pluginYml,
      "permissions:",
      "  example.list:",
      "    children:",
      "      - example.first",
      "      - example.second",
      "  example.nested:",
      "    children:",
      "      example.child:",
      "        description: Nested permission",
      "        default: false",
      "        children:",
      "          example.leaf: true",
    ].join("\n");
    const result = validatePaperPluginArchiveMetadata({
      archiveEntries: [
        { path: "plugin.yml", size: Buffer.byteLength(descriptor) },
        { path: "dev/example/ExamplePlugin.class", size: 1 },
      ],
      archiveEntriesComplete: true,
      pluginYml: descriptor,
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "permissions.children-type" }),
        expect.objectContaining({ code: "permissions.child-type" }),
      ]),
    );
  });

  it("matches Paper permission child list scalar conversion and null skipping", () => {
    const descriptor = [
      pluginYml,
      "permissions:",
      "  example.root:",
      "    children:",
      "      - 42",
      "      - true",
      "      -",
    ].join("\n");
    const result = validatePaperPluginArchiveMetadata({
      archiveEntries: [
        { path: "plugin.yml", size: Buffer.byteLength(descriptor) },
        { path: "dev/example/ExamplePlugin.class", size: 1 },
      ],
      archiveEntriesComplete: true,
      pluginYml: descriptor,
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "warning",
          code: "permissions.child-coerced-to-string",
        }),
        expect.objectContaining({
          severity: "warning",
          code: "permissions.null-child-ignored",
        }),
      ]),
    );
    expect(result.diagnostics).not.toContainEqual(
      expect.objectContaining({ code: "descriptor.string-list-item" }),
    );
  });

  it("keeps unverified permission child shapes unknown instead of invalid", () => {
    const descriptor = `${pluginYml}\npermissions:\n  example.root:\n    children: 42`;
    const result = validatePaperPluginArchiveMetadata({
      archiveEntries: [
        { path: "plugin.yml", size: Buffer.byteLength(descriptor) },
        { path: "dev/example/ExamplePlugin.class", size: 1 },
      ],
      archiveEntriesComplete: true,
      pluginYml: descriptor,
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "unknown",
        code: "permissions.children-shape-unverified",
      }),
    );
  });

  it("rejects duplicate YAML keys and aliases without echoing descriptor values", () => {
    const duplicate = validatePaperPluginArchiveMetadata({
      archiveEntries: [
        { path: "plugin.yml", size: 128 },
        { path: "dev/example/ExamplePlugin.class", size: 1 },
      ],
      archiveEntriesComplete: true,
      pluginYml: `${pluginYml}\nname: OtherName\nprivate-token: super-secret-value`,
    });
    const alias = validatePaperPluginArchiveMetadata({
      archiveEntries: [{ path: "plugin.yml", size: 128 }],
      archiveEntriesComplete: true,
      pluginYml: [
        "defaults: &defaults",
        "  main: dev.example.ExamplePlugin",
        "name: ExamplePlugin",
        "version: '1'",
        "main: *defaults",
      ].join("\n"),
    });

    expect(duplicate.diagnostics).toContainEqual(
      expect.objectContaining({ code: "yaml.duplicate-key" }),
    );
    expect(alias.valid).toBe(false);
    expect(alias.diagnostics).toContainEqual(
      expect.objectContaining({ code: "yaml.alias-or-conversion" }),
    );
    expect(JSON.stringify(duplicate)).not.toContain("super-secret-value");
    expect(JSON.stringify(duplicate)).not.toContain("private-token");
  });

  it("bounds YAML nesting, archive paths, entry counts, and compression metadata", () => {
    const deeplyNested = `${Array.from({ length: 30 }, (_, index) => `${"  ".repeat(index)}k${index}:`).join("\n")}\n${"  ".repeat(30)}value`;
    const yamlResult = validatePaperPluginArchiveMetadata({
      archiveEntries: [{ path: "plugin.yml", size: deeplyNested.length }],
      archiveEntriesComplete: true,
      pluginYml: deeplyNested,
    });
    const metadataResult = validatePaperPluginArchiveMetadata({
      archiveEntries: [
        { path: "../plugin.yml", size: 1 },
        { path: "plugin.yml", size: 10_000, compressedSize: 1 },
        ...Array.from({ length: paperPluginJarValidationLimits.maxArchiveEntries }, (_, index) => ({
          path: `classes/C${index}.class`,
          size: 0,
        })),
      ],
      archiveEntriesComplete: true,
    });

    expect(yamlResult.diagnostics).toContainEqual(
      expect.objectContaining({ code: "yaml.complexity-limit" }),
    );
    expect(metadataResult.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "archive.entry-limit" }),
        expect.objectContaining({ code: "archive.unsafe-path" }),
        expect.objectContaining({ code: "archive.compression-ratio" }),
      ]),
    );
  });

  it("does not expose ZIP parser details or descriptor content when integrity checks fail", () => {
    const archive = createStoredZip({
      "plugin.yml": `${pluginYml}\nwebsite: https://user:password@example.invalid/?token=secret`,
      "dev/example/ExamplePlugin.class": "",
    });
    const marker = archive.indexOf(Buffer.from("ExamplePlugin\nversion"));
    archive[marker] = (archive[marker] ?? 0) ^ 1;

    const result = validatePaperPluginJar({ archive });
    const serialized = JSON.stringify(result);

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "descriptor.unreadable" }),
    );
    expect(serialized).not.toContain("password");
    expect(serialized).not.toContain("token=secret");
  });
});

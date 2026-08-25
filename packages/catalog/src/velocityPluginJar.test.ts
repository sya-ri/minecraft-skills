import { describe, expect, it } from "vitest";
import {
  validateVelocityPluginArchiveMetadata,
  validateVelocityPluginJar,
  velocityPluginJarValidationLimits,
} from "./velocityPluginJar.js";

function u1(value: number): Buffer {
  return Buffer.from([value]);
}

function u2(value: number): Buffer {
  const result = Buffer.alloc(2);
  result.writeUInt16BE(value);
  return result;
}

function u4(value: number): Buffer {
  const result = Buffer.alloc(4);
  result.writeUInt32BE(value);
  return result;
}

function constantUtf8(value: string): Buffer {
  const bytes = Buffer.from(value, "utf8");
  return Buffer.concat([u1(1), u2(bytes.length), bytes]);
}

function constantClass(nameIndex: number): Buffer {
  return Buffer.concat([u1(7), u2(nameIndex)]);
}

function createEntrypointClass(
  options: {
    internalName?: string;
    pluginId?: string;
    majorVersion?: number;
    minorVersion?: number;
    annotation?: boolean;
  } = {},
): Buffer {
  const internalName = options.internalName ?? "dev/example/ExamplePlugin";
  const pluginId = options.pluginId ?? "example";
  const annotation = options.annotation ?? true;
  const pool = [
    constantUtf8(internalName),
    constantClass(1),
    constantUtf8("java/lang/Object"),
    constantClass(3),
    constantUtf8("RuntimeVisibleAnnotations"),
    constantUtf8("Lcom/velocitypowered/api/plugin/Plugin;"),
    constantUtf8("id"),
    constantUtf8(pluginId),
  ];
  const annotationBody = Buffer.concat([u2(1), u2(6), u2(1), u2(7), u1("s".charCodeAt(0)), u2(8)]);
  const attributes = annotation
    ? Buffer.concat([u2(1), u2(5), u4(annotationBody.length), annotationBody])
    : u2(0);
  return Buffer.concat([
    u4(0xcafebabe),
    u2(options.minorVersion ?? 0),
    u2(options.majorVersion ?? 65),
    u2(pool.length + 1),
    ...pool,
    u2(0x0021),
    u2(2),
    u2(4),
    u2(0),
    u2(0),
    u2(0),
    attributes,
  ]);
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

const descriptor = JSON.stringify({
  id: "example",
  main: "dev.example.ExamplePlugin",
});

describe("Velocity plugin JAR validation", () => {
  it("validates binary descriptor, class identity, target Java, CRC, and @Plugin evidence", () => {
    const result = validateVelocityPluginJar({
      archive: createStoredZip({
        "velocity-plugin.json": descriptor,
        "dev/example/ExamplePlugin.class": createEntrypointClass(),
      }),
    });

    expect(result.valid).toBe(true);
    expect(result.validationStrength).toBe("binary");
    expect(result.archive).toMatchObject({
      entryListComplete: true,
      zipStructureValidated: true,
      descriptorObserved: true,
    });
    expect(result.descriptor).toMatchObject({
      contentIntegrityValidated: true,
      inputKind: "text",
      duplicateKeysChecked: true,
      jsonValidated: true,
      id: "example",
      main: "dev.example.ExamplePlugin",
    });
    expect(result.entrypoint).toMatchObject({
      entryObserved: true,
      entryPresenceProven: true,
      contentIntegrityValidated: true,
      classFileHeaderValidated: true,
      declaredInternalNameMatched: true,
      majorVersion: 65,
      javaRelease: 21,
      targetJavaRelease: 25,
      targetCompatible: true,
      pluginAnnotationObserved: true,
      pluginAnnotationParsed: true,
      annotationMatchesDescriptor: true,
    });
  });

  it("accepts a valid entrypoint class in the default Java package", () => {
    const result = validateVelocityPluginJar({
      archive: createStoredZip({
        "velocity-plugin.json": JSON.stringify({ id: "example", main: "ExamplePlugin" }),
        "ExamplePlugin.class": createEntrypointClass({ internalName: "ExamplePlugin" }),
      }),
    });

    expect(result.valid).toBe(true);
    expect(result.descriptor.main).toBe("ExamplePlugin");
    expect(result.entrypoint).toMatchObject({
      path: "ExamplePlugin.class",
      entryObserved: true,
      declaredInternalNameMatched: true,
    });
  });

  it("keeps MCP-style descriptor and entry evidence metadata-only", () => {
    const result = validateVelocityPluginArchiveMetadata({
      descriptor: JSON.parse(descriptor),
      archiveEntries: [
        { path: "velocity-plugin.json", size: descriptor.length },
        { path: "dev/example/ExamplePlugin.class", size: 123 },
      ],
      archiveEntriesComplete: true,
    });

    expect(result.valid).toBe(true);
    expect(result.validationStrength).toBe("metadata");
    expect(result.archive.zipStructureValidated).toBe(false);
    expect(result.descriptor.contentIntegrityValidated).toBe(false);
    expect(result.descriptor).toMatchObject({
      inputKind: "object",
      duplicateKeysChecked: false,
    });
    expect(result.incompleteReasons).toContain(
      "parsed-descriptor-cannot-prove-original-json-key-uniqueness",
    );
    expect(result.entrypoint).toMatchObject({
      entryObserved: true,
      entryPresenceProven: true,
      contentIntegrityValidated: false,
      classFileHeaderValidated: false,
      targetCompatible: null,
      pluginAnnotationObserved: null,
    });
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ severity: "unknown", code: "class.bytes-unavailable" }),
    );
  });

  it("uses completeness to separate missing-class errors from unknown evidence", () => {
    const complete = validateVelocityPluginArchiveMetadata({
      descriptor,
      archiveEntries: [{ path: "velocity-plugin.json", size: descriptor.length }],
      archiveEntriesComplete: true,
    });
    const incomplete = validateVelocityPluginArchiveMetadata({
      descriptor,
      archiveEntries: [{ path: "velocity-plugin.json", size: descriptor.length }],
      archiveEntriesComplete: false,
    });

    expect(complete.valid).toBe(false);
    expect(complete.diagnostics).toContainEqual(
      expect.objectContaining({ severity: "error", code: "class.entry-missing" }),
    );
    expect(incomplete.valid).toBe(true);
    expect(incomplete.diagnostics).toContainEqual(
      expect.objectContaining({ severity: "unknown", code: "class.entry-not-observed" }),
    );
  });

  it("does not use filtered metadata as complete absence evidence", () => {
    const result = validateVelocityPluginArchiveMetadata({
      descriptor,
      archiveEntries: [
        { path: "velocity-plugin.json", size: descriptor.length },
        { path: "../discarded.class", size: 1 },
      ],
      archiveEntriesComplete: true,
    });

    expect(result.archive.entryListComplete).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ severity: "unknown", code: "class.entry-not-observed" }),
    );
    expect(result.diagnostics).not.toContainEqual(
      expect.objectContaining({ code: "class.entry-missing" }),
    );
  });

  it("proves an observed entrypoint even when the supplied entry list is incomplete", () => {
    const result = validateVelocityPluginArchiveMetadata({
      descriptor,
      archiveEntries: [
        { path: "velocity-plugin.json", size: descriptor.length },
        { path: "dev/example/ExamplePlugin.class", size: 1 },
      ],
      archiveEntriesComplete: false,
    });

    expect(result.archive.entryListComplete).toBe(false);
    expect(result.entrypoint).toMatchObject({
      entryObserved: true,
      entryPresenceProven: true,
    });
  });

  it("validates official ids, provides, dependency shapes, and required main", () => {
    const result = validateVelocityPluginArchiveMetadata({
      descriptor: {
        id: "Bad ID",
        main: "not-qualified",
        authors: ["Author", 4],
        dependencies: [
          { id: "bad.id", optional: "yes" },
          { id: "valid_dependency", optional: "yes" },
        ],
        provides: ["bad.id", "valid_alias", "valid_alias"],
      },
      archiveEntries: [],
      archiveEntriesComplete: true,
    });

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "descriptor.invalid-id" }),
        expect.objectContaining({ code: "descriptor.invalid-main" }),
        expect.objectContaining({ code: "descriptor.gson-string-coercion" }),
        expect.objectContaining({ code: "descriptor.gson-boolean-coercion" }),
        expect.objectContaining({ code: "descriptor.invalid-dependency-id" }),
        expect.objectContaining({ code: "descriptor.invalid-provided-id" }),
        expect.objectContaining({ code: "descriptor.duplicate-provided-id" }),
      ]),
    );
  });

  it("rejects unsafe and duplicate normalized archive paths within fixed limits", () => {
    const result = validateVelocityPluginArchiveMetadata({
      descriptor,
      archiveEntries: [
        { path: "../velocity-plugin.json", size: 1 },
        { path: "velocity-plugin.json", size: descriptor.length },
        { path: "dev/example/ExamplePlugin.class", size: 1 },
        { path: "dev/example/ExamplePlugin.class", size: 1 },
        { path: "A.class", size: 1 },
        { path: "a.class", size: 1 },
      ],
      archiveEntriesComplete: true,
    });

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "archive.unsafe-path" }),
        expect.objectContaining({ code: "archive.duplicate-path" }),
        expect.objectContaining({ code: "archive.portable-path-conflict" }),
      ]),
    );
  });

  it("checks selected Java targets, preview constraints, and class identity", () => {
    const belowVelocityFloor = validateVelocityPluginJar({
      archive: createStoredZip({
        "velocity-plugin.json": descriptor,
        "dev/example/ExamplePlugin.class": createEntrypointClass(),
      }),
      targetJavaRelease: 24,
    });
    const targetResult = validateVelocityPluginJar({
      archive: createStoredZip({
        "velocity-plugin.json": descriptor,
        "dev/example/ExamplePlugin.class": createEntrypointClass({ majorVersion: 70 }),
      }),
      targetJavaRelease: 25,
    });
    const identityResult = validateVelocityPluginJar({
      archive: createStoredZip({
        "velocity-plugin.json": descriptor,
        "dev/example/ExamplePlugin.class": createEntrypointClass({
          internalName: "dev/example/OtherPlugin",
        }),
      }),
    });
    const previewResult = validateVelocityPluginJar({
      archive: createStoredZip({
        "velocity-plugin.json": descriptor,
        "dev/example/ExamplePlugin.class": createEntrypointClass({
          majorVersion: 65,
          minorVersion: 0xffff,
        }),
      }),
      targetJavaRelease: 25,
    });
    const matchingPreviewResult = validateVelocityPluginJar({
      archive: createStoredZip({
        "velocity-plugin.json": descriptor,
        "dev/example/ExamplePlugin.class": createEntrypointClass({
          majorVersion: 69,
          minorVersion: 0xffff,
        }),
      }),
      targetJavaRelease: 25,
    });

    expect(belowVelocityFloor.valid).toBe(false);
    expect(belowVelocityFloor.entrypoint.targetJavaRelease).toBe(25);
    expect(belowVelocityFloor.diagnostics).toContainEqual(
      expect.objectContaining({ code: "target.invalid-java-release" }),
    );
    expect(targetResult.diagnostics).toContainEqual(
      expect.objectContaining({ code: "class.target-too-new" }),
    );
    expect(identityResult.diagnostics).toContainEqual(
      expect.objectContaining({ code: "class.declared-name-mismatch" }),
    );
    expect(previewResult.diagnostics).toContainEqual(
      expect.objectContaining({ code: "class.preview-target" }),
    );
    expect(matchingPreviewResult.valid).toBe(true);
    expect(matchingPreviewResult.entrypoint.targetCompatible).toBeNull();
    expect(matchingPreviewResult.diagnostics).toContainEqual(
      expect.objectContaining({ severity: "warning", code: "class.preview-runtime" }),
    );
  });

  it("rejects null roots and duplicate JSON keys without collapsing evidence", () => {
    const archiveEntries = [
      { path: "velocity-plugin.json", size: descriptor.length },
      { path: "dev/example/ExamplePlugin.class", size: 1 },
    ];
    const nullObject = validateVelocityPluginArchiveMetadata({
      descriptor: null,
      archiveEntries,
      archiveEntriesComplete: true,
    });
    const nullText = validateVelocityPluginArchiveMetadata({
      descriptor: "null",
      archiveEntries,
      archiveEntriesComplete: true,
    });
    const duplicateText =
      '{"id":"example","\\u0069d":"shadowed","main":"dev.example.ExamplePlugin"}';
    const duplicateBinary = validateVelocityPluginJar({
      archive: createStoredZip({
        "velocity-plugin.json": duplicateText,
        "dev/example/ExamplePlugin.class": createEntrypointClass(),
      }),
    });

    for (const result of [nullObject, nullText]) {
      expect(result.valid).toBe(false);
      expect(result.descriptor.jsonValidated).toBe(false);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({ severity: "error", code: "descriptor.root-type" }),
      );
    }
    expect(duplicateBinary.valid).toBe(false);
    expect(duplicateBinary.descriptor).toMatchObject({
      inputKind: "text",
      duplicateKeysChecked: true,
      jsonValidated: false,
    });
    expect(duplicateBinary.diagnostics).toContainEqual(
      expect.objectContaining({ severity: "error", code: "descriptor.duplicate-key" }),
    );
    expect(JSON.stringify(duplicateBinary)).not.toContain("shadowed");
  });

  it("reports stale annotation metadata without claiming a loader failure", () => {
    const result = validateVelocityPluginJar({
      archive: createStoredZip({
        "velocity-plugin.json": descriptor,
        "dev/example/ExamplePlugin.class": createEntrypointClass({ pluginId: "stale" }),
      }),
    });

    expect(result.valid).toBe(true);
    expect(result.entrypoint.annotationMatchesDescriptor).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ severity: "warning", code: "annotation.metadata-mismatch" }),
    );
  });

  it("rejects non-UTF-8 descriptor bytes before JSON parsing", () => {
    const result = validateVelocityPluginJar({
      archive: createStoredZip({
        "velocity-plugin.json": Buffer.from([0xff]),
        "dev/example/ExamplePlugin.class": createEntrypointClass(),
      }),
    });

    expect(result.valid).toBe(false);
    expect(result.descriptor.contentProvided).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "descriptor.unreadable" }),
    );
  });

  it("does not execute accessors or expose descriptor content after CRC failure", () => {
    let getterCalled = false;
    const malicious = Object.defineProperty({}, "descriptor", {
      enumerable: true,
      get() {
        getterCalled = true;
        return descriptor;
      },
    }) as never;
    const preflightResult = validateVelocityPluginArchiveMetadata(malicious);
    const unknownFieldResult = validateVelocityPluginArchiveMetadata({
      descriptor: {
        id: "example",
        main: "dev.example.ExamplePlugin",
        privateToken: "super-secret-value",
      },
      archiveEntries: [
        { path: "velocity-plugin.json", size: descriptor.length },
        { path: "dev/example/ExamplePlugin.class", size: 1 },
      ],
      archiveEntriesComplete: true,
    });
    const nonEnumerableDescriptor = Object.defineProperty(
      { id: "example", main: "dev.example.ExamplePlugin" },
      "privateToken",
      { value: "super-secret-value", enumerable: false },
    );
    const nonEnumerableResult = validateVelocityPluginArchiveMetadata({
      descriptor: nonEnumerableDescriptor,
      archiveEntries: [],
      archiveEntriesComplete: false,
    });

    const archive = createStoredZip({
      "velocity-plugin.json": JSON.stringify({
        id: "example",
        main: "dev.example.ExamplePlugin",
        privateToken: "super-secret-value",
      }),
      "dev/example/ExamplePlugin.class": createEntrypointClass(),
    });
    const marker = archive.indexOf(Buffer.from("super-secret-value"));
    archive[marker] = (archive[marker] ?? 0) ^ 1;
    const crcResult = validateVelocityPluginJar({ archive });

    expect(getterCalled).toBe(false);
    expect(preflightResult.valid).toBe(false);
    expect(JSON.stringify(unknownFieldResult)).not.toContain("privateToken");
    expect(JSON.stringify(unknownFieldResult)).not.toContain("super-secret-value");
    expect(nonEnumerableResult.valid).toBe(false);
    expect(JSON.stringify(nonEnumerableResult)).not.toContain("privateToken");
    expect(JSON.stringify(nonEnumerableResult)).not.toContain("super-secret-value");
    expect(crcResult.valid).toBe(false);
    expect(crcResult.diagnostics).toContainEqual(
      expect.objectContaining({ code: "descriptor.unreadable" }),
    );
    expect(JSON.stringify(crcResult)).not.toContain("super-secret-value");
    expect(JSON.stringify(crcResult)).not.toContain("privateToken");
  });

  it("bounds entry counts and descriptor text before parsing", () => {
    const entryLimit = validateVelocityPluginArchiveMetadata({
      descriptor,
      archiveEntries: Array.from(
        { length: velocityPluginJarValidationLimits.maxArchiveEntries + 1 },
        (_, index) => ({ path: `classes/C${index}.class`, size: 0 }),
      ),
      archiveEntriesComplete: true,
    });
    const descriptorLimit = validateVelocityPluginArchiveMetadata({
      descriptor: "x".repeat(velocityPluginJarValidationLimits.maxDescriptorBytes + 1),
      archiveEntries: [],
      archiveEntriesComplete: false,
    });

    expect(entryLimit.diagnostics).toContainEqual(
      expect.objectContaining({ code: "archive.entry-limit" }),
    );
    expect(entryLimit.archive.entryListComplete).toBe(false);
    expect(descriptorLimit.diagnostics).toContainEqual(
      expect.objectContaining({ code: "descriptor.input-limit" }),
    );
  });
});

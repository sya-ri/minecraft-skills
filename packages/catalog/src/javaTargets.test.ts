import { describe, expect, it } from "vitest";
import {
  inspectJavaJarTargets,
  type JavaClassTargetMetadata,
  javaTargetInspectionLimits,
  validateJavaTargetMetadata,
} from "./javaTargets.js";

function u2(value: number): Buffer {
  const bytes = Buffer.alloc(2);
  bytes.writeUInt16BE(value);
  return bytes;
}
function u4(value: number): Buffer {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32BE(value);
  return bytes;
}
function utf8(value: string): Buffer {
  const bytes = Buffer.from(value);
  return Buffer.concat([Buffer.from([1]), u2(bytes.length), bytes]);
}
function classFile(major = 65, minor = 0): Buffer {
  return Buffer.concat([
    u4(0xcafebabe),
    u2(minor),
    u2(major),
    u2(5),
    utf8("example/Plugin"),
    Buffer.from([7]),
    u2(1),
    utf8("java/lang/Object"),
    Buffer.from([7]),
    u2(3),
    u2(0x21),
    u2(2),
    u2(4),
    u2(0),
    u2(0),
    u2(0),
    u2(0),
  ]);
}
function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(files: Record<string, string | Buffer>): Buffer {
  const local: Buffer[] = [],
    central: Buffer[] = [];
  let offset = 0;
  for (const [path, content] of Object.entries(files)) {
    const name = Buffer.from(path),
      bytes = Buffer.from(content);
    const header = Buffer.alloc(30 + name.length),
      directory = Buffer.alloc(46 + name.length);
    header.writeUInt32LE(0x04034b50);
    header.writeUInt16LE(20, 4);
    header.writeUInt32LE(crc32(bytes), 14);
    header.writeUInt32LE(bytes.length, 18);
    header.writeUInt32LE(bytes.length, 22);
    header.writeUInt16LE(name.length, 26);
    name.copy(header, 30);
    directory.writeUInt32LE(0x02014b50);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt32LE(crc32(bytes), 16);
    directory.writeUInt32LE(bytes.length, 20);
    directory.writeUInt32LE(bytes.length, 24);
    directory.writeUInt16LE(name.length, 28);
    directory.writeUInt32LE(offset, 42);
    name.copy(directory, 46);
    local.push(header, bytes);
    central.push(directory);
    offset += header.length + bytes.length;
  }
  const directory = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(central.length, 8);
  end.writeUInt16LE(central.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
function metadata(
  classes: JavaClassTargetMetadata[],
  options: {
    targetJavaRelease?: number;
    previewEnabled?: boolean;
    multiRelease?: boolean | null;
    classEntriesComplete?: boolean;
  } = {},
) {
  return validateJavaTargetMetadata({
    targetJavaRelease: 21,
    multiRelease: false,
    classEntriesComplete: true,
    ...options,
    classes,
  });
}
const root = (majorVersion = 65, minorVersion = 0): JavaClassTargetMetadata => ({
  path: "example/Plugin.class",
  majorVersion,
  minorVersion,
});

describe("whole-JAR Java target inspection", () => {
  it("finds a newer helper class beyond a plugin entrypoint without runtime claims", () => {
    const result = inspectJavaJarTargets({
      archive: zip({
        "example/Plugin.class": classFile(65),
        "example/Helper.class": classFile(69),
        "plugin.yml": "main: example.Plugin",
      }),
      targetJavaRelease: 21,
    });
    expect(result).toMatchObject({
      targetCompatible: false,
      scanComplete: true,
      classCount: 2,
      effectiveClassCount: 2,
      inspectedClassCount: 2,
      minimumJavaRelease: 25,
    });
    expect(result.evidence).toMatchObject({
      strength: "binary",
      zipStructureValidated: true,
      classContentIntegrityValidated: true,
      allEntryContentIntegrityValidated: false,
    });
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "class.newer-java-target", path: "example/Helper.class" }),
    );
  });

  it.each([8, 9, 17, 21, 26])("selects the highest eligible MR class on Java %s", (java) => {
    const result = inspectJavaJarTargets({
      targetJavaRelease: java,
      archive: zip({
        "META-INF/MANIFEST.MF":
          "Manifest-Version: 1.0\r\nmUlTi-ReLeAsE: tr\r\n ue\r\n\r\nName: example/Plugin.class\r\nMulti-Release: false\r\n",
        "example/Plugin.class": classFile(52),
        "META-INF/versions/9/example/Plugin.class": classFile(53),
        "META-INF/versions/17/example/Plugin.class": classFile(61),
        "META-INF/versions/25/example/Plugin.class": classFile(69),
        "META-INF/versions/08/example/Other.class": classFile(70),
        "META-INF/versions/8/example/Other.class": classFile(70),
        "META-INF/versions/9/META-INF/example/Other.class": classFile(70),
      }),
    });
    expect(result).toMatchObject({
      targetCompatible: true,
      multiRelease: true,
      effectiveClassCount: 1,
      scanComplete: true,
    });
    expect(result.classes.find((entry) => entry.effective)?.versionDirectory).toBe(
      java >= 25 ? 25 : java >= 17 ? 17 : java >= 9 ? 9 : null,
    );
  });

  it("ignores versioned entries when Multi-Release is absent or false", () => {
    for (const manifest of [
      undefined,
      "Manifest-Version: 1.0\nMulti-Release: false\n\n",
      "Manifest-Version: 1.0\n\nName: x\nMulti-Release: true\n",
    ]) {
      const result = inspectJavaJarTargets({
        targetJavaRelease: 21,
        archive: zip({
          ...(manifest ? { "META-INF/MANIFEST.MF": manifest } : {}),
          "example/Plugin.class": classFile(52),
          "META-INF/versions/21/example/Plugin.class": classFile(70),
        }),
      });
      expect(result.targetCompatible).toBe(true);
      expect(result.classes.find((entry) => entry.effective)?.path).toBe("example/Plugin.class");
    }
  });

  it("keeps ambiguous manifest selection unknown instead of blaming a replaced root", () => {
    const result = inspectJavaJarTargets({
      targetJavaRelease: 21,
      archive: zip({
        "META-INF/MANIFEST.MF":
          "Manifest-Version: 1.0\nMulti-Release: true\nMulti-Release: false\n\n",
        "example/Plugin.class": classFile(70),
        "META-INF/versions/21/example/Plugin.class": classFile(65),
      }),
    });
    expect(result).toMatchObject({
      multiRelease: null,
      targetCompatible: null,
      scanComplete: false,
      effectiveClassCount: 0,
    });
    expect(result.incompleteReasons).toContain("multi-release-setting-unknown");
  });

  it("requires exact preview releases and an explicitly enabled supplied setting", () => {
    expect(metadata([root(65, 65535)]).targetCompatible).toBe(false);
    expect(metadata([root(65, 65535)], { previewEnabled: true }).targetCompatible).toBe(true);
    expect(
      metadata([root(65, 65535)], { targetJavaRelease: 25, previewEnabled: true }).diagnostics,
    ).toContainEqual(expect.objectContaining({ code: "class.preview-release-mismatch" }));
    expect(metadata([root(65, 65535)], { previewEnabled: true }).minimumJavaRelease).toBeNull();
    expect(metadata([root(55, 65535)]).classes[0]?.preview).toBe(false);
    expect(metadata([root(55, 65535)]).targetCompatible).toBe(true);
  });

  it("validates major/minor format boundaries and ignores a Java 9 module descriptor on Java 8", () => {
    expect(metadata([root(44)]).targetCompatible).toBe(false);
    expect(metadata([root(56, 1)]).targetCompatible).toBe(false);
    expect(metadata([root(45, 3)], { targetJavaRelease: 8 }).targetCompatible).toBe(true);
    const result = metadata(
      [root(52), { path: "module-info.class", majorVersion: 53, minorVersion: 0 }],
      { targetJavaRelease: 8 },
    );
    expect(result).toMatchObject({ targetCompatible: true, effectiveClassCount: 1 });
  });

  it.each([
    8, 9, 10, 11,
  ])("keeps Java %s's historical highest-major minor-zero boundary", (java) => {
    const result = metadata([root(java + 44, 65535)], { targetJavaRelease: java });
    expect(result.targetCompatible).toBe(false);
    expect(result.classes[0]?.preview).toBe(false);
    expect(result.diagnostics[0]?.code).toBe("class.unsupported-minor-version");
    expect(
      metadata([root(java + 44, 65535)], { targetJavaRelease: java + 1 }).targetCompatible,
    ).toBe(true);
    expect(metadata([root(java + 43, 65535)], { targetJavaRelease: java }).targetCompatible).toBe(
      true,
    );
  });

  it("reports version-directory target violations separately from selected target compatibility", () => {
    const result = metadata(
      [{ path: "META-INF/versions/9/example/Plugin.class", majorVersion: 65, minorVersion: 0 }],
      { multiRelease: true },
    );
    expect(result.targetCompatible).toBe(true);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "class.version-directory-mismatch", severity: "warning" }),
    );
  });

  it("keeps incomplete inventories, unreadable classes, empty archives and nested JARs explicit", () => {
    expect(metadata([root()], { classEntriesComplete: false }).targetCompatible).toBeNull();
    expect(
      metadata([{ path: "Missing.class", majorVersion: null, minorVersion: null }])
        .targetCompatible,
    ).toBeNull();
    expect(
      inspectJavaJarTargets({ archive: zip({}), targetJavaRelease: 21 }).targetCompatible,
    ).toBeNull();
    const malformed = inspectJavaJarTargets({
      archive: zip({ "Broken.class": Buffer.from("not a class") }),
      targetJavaRelease: 21,
    });
    expect(malformed).toMatchObject({
      targetCompatible: null,
      scanComplete: false,
      inspectedClassCount: 0,
    });
    const nested = inspectJavaJarTargets({
      archive: zip({
        "Main.class": classFile(),
        "META-INF/jars/child.jar": zip({ "Other.class": classFile(70) }),
      }),
      targetJavaRelease: 21,
    });
    expect(nested).toMatchObject({ targetCompatible: null, archive: { nestedJarCount: 1 } });
    expect(nested.incompleteReasons).toContain("nested-jars-not-inspected");
  });

  it("does not assert incompatible selection when a partial MR inventory may omit an override", () => {
    for (const multiRelease of [true, null]) {
      const result = metadata([root(70)], { classEntriesComplete: false, multiRelease });
      expect(result).toMatchObject({
        targetCompatible: null,
        effectiveClassCount: 0,
        scanComplete: false,
      });
      expect(result.classes[0]?.ignoredReason).toBe("incomplete-multi-release-selection");
      expect(result.classes[0]?.targetCompatible).toBeNull();
    }
    expect(
      metadata([root(70)], { classEntriesComplete: false, multiRelease: false }).targetCompatible,
    ).toBe(false);
    expect(
      metadata([root(70)], { classEntriesComplete: true, multiRelease: true }).targetCompatible,
    ).toBe(false);
    expect(
      metadata(
        [{ path: "META-INF/versions/17/example/Plugin.class", majorVersion: 70, minorVersion: 0 }],
        { classEntriesComplete: false, multiRelease: true },
      ).targetCompatible,
    ).toBeNull();
  });

  it("does not promote supplied metadata to byte or archive integrity evidence", () => {
    const result = metadata([root()]);
    expect(result.evidence).toEqual({
      strength: "metadata",
      classEntriesComplete: true,
      zipStructureValidated: false,
      manifestContentIntegrityValidated: false,
      classContentIntegrityValidated: false,
      allEntryContentIntegrityValidated: false,
    });
    expect(result.archive).toEqual({ bytes: null, entries: null, nestedJarCount: null });
    expect(result.nonGuarantees.join(" ")).toContain("caller-supplied");
  });

  it("rejects unbounded or unsafe caller claims without invoking accessors", () => {
    for (const path of [
      "../Main.class",
      "C:/Main.class",
      "/Main.class",
      "a\\Main.class",
      "a//Main.class",
    ])
      expect(() => metadata([{ ...root(), path }])).toThrow(/safe/);
    expect(() => metadata([root(), root()])).toThrow(/duplicate/);
    expect(() => metadata([root()], { targetJavaRelease: 27 })).toThrow(/8 through 26/);
    expect(() => metadata([root()], { targetJavaRelease: 7 })).toThrow();
    expect(() =>
      metadata(Array(javaTargetInspectionLimits.maxClassEntries + 1).fill(root())),
    ).toThrow(/bounded/);
    expect(() => metadata([{ ...root(), minorVersion: null }])).toThrow(/both/);
    let calls = 0;
    const input = {
      get classes() {
        calls += 1;
        return [];
      },
      targetJavaRelease: 21,
      multiRelease: false,
      classEntriesComplete: true,
    };
    expect(() => validateJavaTargetMetadata(input)).toThrow(/accessors/);
    expect(calls).toBe(0);
    expect(() =>
      validateJavaTargetMetadata({ ...input, classes: [root()], archiveVerified: true } as never),
    ).toThrow(/unsupported/);
  });

  it("checks classes beyond bounded output and diagnostics without silently stopping the scan", () => {
    const classes = Array.from({ length: 240 }, (_, index) => ({
      ...root(index === 239 ? 70 : 65),
      path: `example/Class${String(index).padStart(3, "0")}.class`,
    }));
    const result = metadata(classes);
    expect(result).toMatchObject({
      targetCompatible: false,
      scanComplete: true,
      classCount: 240,
      inspectedClassCount: 240,
      classesTruncated: true,
      omittedClassCount: 40,
    });
    expect(result.diagnostics.some((item) => item.path === "example/Class239.class")).toBe(true);
    const errors = metadata(classes.map((item) => ({ ...item, majorVersion: 70 })));
    expect(errors).toMatchObject({ diagnosticCount: 240, diagnosticsTruncated: true });
    expect(errors.diagnostics).toHaveLength(200);
  });

  it("rejects unsafe ZIP structure and verifies CRC before trusting class bytes", () => {
    expect(
      inspectJavaJarTargets({ archive: Buffer.from("bad"), targetJavaRelease: 21 }).diagnostics[0]
        ?.code,
    ).toBe("archive.invalid-zip");
    expect(
      inspectJavaJarTargets({
        archive: zip({ "../Main.class": classFile() }),
        targetJavaRelease: 21,
      }).targetCompatible,
    ).toBeNull();
    const corrupted = zip({ "Main.class": classFile() });
    const corruptionOffset = 30 + Buffer.byteLength("Main.class") + 7;
    corrupted[corruptionOffset] = (corrupted[corruptionOffset] ?? 0) ^ 1;
    const result = inspectJavaJarTargets({ archive: corrupted, targetJavaRelease: 21 });
    expect(result).toMatchObject({
      targetCompatible: null,
      inspectedClassCount: 0,
      evidence: { classContentIntegrityValidated: false },
    });
  });

  it("preserves unknown class evidence when the per-class byte limit is exceeded", () => {
    const result = inspectJavaJarTargets({
      archive: zip({ "Main.class": Buffer.alloc(javaTargetInspectionLimits.maxClassBytes + 1) }),
      targetJavaRelease: 21,
    });
    expect(result).toMatchObject({
      targetCompatible: null,
      scanComplete: false,
      classCount: 1,
      inspectedClassCount: 0,
    });
    expect(result.diagnostics[0]?.code).toBe("class.byte-limit");
  });
});

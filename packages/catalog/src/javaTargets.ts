import { types as nodeTypes } from "node:util";
import { openZipArchive, type ZipArchive } from "@minecraft-skills/data";
import { inspectJavaClassFile, velocityPluginClassFileLimits } from "./velocityPluginClassFile.js";

export const javaTargetInspectionLimits = Object.freeze({
  maxArchiveBytes: 64 * 1024 * 1024,
  maxArchiveEntries: 16_384,
  maxClassEntries: 16_384,
  maxEntryPathCharacters: 1_024,
  maxDeclaredUncompressedBytes: 512 * 1024 * 1024,
  maxCompressionRatio: 200,
  maxClassBytes: velocityPluginClassFileLimits.maxBytes,
  maxTotalClassBytes: 64 * 1024 * 1024,
  maxManifestBytes: 256 * 1024,
  maxOutputClasses: 200,
  maxDiagnostics: 200,
  minTargetJavaRelease: 8,
  maxTargetJavaRelease: 26,
});

export type JavaClassTargetMetadata = {
  path: string;
  majorVersion: number | null;
  minorVersion: number | null;
};

export type JavaTargetRuntimeOptions = {
  /** Supplied runtime release; runtime execution and flags are not observed. */
  targetJavaRelease: number;
  previewEnabled?: boolean;
};

export type ValidateJavaTargetMetadataOptions = JavaTargetRuntimeOptions & {
  classes: readonly JavaClassTargetMetadata[];
  classEntriesComplete: boolean;
  /** null means the archive's multi-release setting is unknown. */
  multiRelease: boolean | null;
};

export type InspectJavaJarTargetsOptions = JavaTargetRuntimeOptions & {
  archive: Uint8Array;
};

export type JavaTargetDiagnostic = {
  code: string;
  path: string | null;
  severity: "error" | "warning" | "unknown";
  message: string;
};

export type JavaClassTargetResult = JavaClassTargetMetadata & {
  logicalPath: string | null;
  versionDirectory: number | null;
  effective: boolean;
  ignoredReason: string | null;
  javaRelease: number | null;
  preview: boolean | null;
  targetCompatible: boolean | null;
};

export type JavaTargetInspectionResult = {
  schemaVersion: 1;
  targetJavaRelease: number;
  previewEnabled: boolean;
  /** Only the selected classfile version constraints, never JVM/linkage compatibility. */
  targetCompatible: boolean | null;
  scanComplete: boolean;
  evidence: {
    strength: "binary" | "metadata";
    classEntriesComplete: boolean;
    zipStructureValidated: boolean;
    manifestContentIntegrityValidated: boolean;
    classContentIntegrityValidated: boolean;
    allEntryContentIntegrityValidated: false;
  };
  archive: { bytes: number | null; entries: number | null; nestedJarCount: number | null };
  multiRelease: boolean | null;
  classCount: number;
  effectiveClassCount: number;
  inspectedClassCount: number;
  minimumJavaRelease: number | null;
  classes: JavaClassTargetResult[];
  classesTruncated: boolean;
  omittedClassCount: number;
  diagnostics: JavaTargetDiagnostic[];
  diagnosticCount: number;
  diagnosticsTruncated: boolean;
  incompleteReasons: string[];
  sources: { classFile: string; jar: string };
  nonGuarantees: string[];
};

class Diagnostics {
  readonly values: JavaTargetDiagnostic[] = [];
  count = 0;

  add(
    code: string,
    severity: JavaTargetDiagnostic["severity"],
    path: string | null,
    message: string,
  ) {
    this.count += 1;
    if (this.values.length < javaTargetInspectionLimits.maxDiagnostics) {
      this.values.push({ code, severity, path, message });
    }
  }
}

function plainRecord(
  value: unknown,
  allowed: readonly string[],
  label: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || nodeTypes.isProxy(value)) {
    throw new Error(`${label} must be a plain data object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null)
    throw new Error(`${label} must be a plain data object`);
  const properties = Object.getOwnPropertyDescriptors(value);
  if (
    Reflect.ownKeys(properties).some((key) => typeof key !== "string" || !allowed.includes(key))
  ) {
    throw new Error(`${label} contains an unsupported field`);
  }
  const result: Record<string, unknown> = {};
  for (const [key, descriptor] of Object.entries(properties)) {
    if (!("value" in descriptor)) throw new Error(`${label} must not contain accessors`);
    result[key] = descriptor.value;
  }
  return result;
}

function runtimeOptions(input: Record<string, unknown>): Required<JavaTargetRuntimeOptions> {
  const targetJavaRelease = input.targetJavaRelease;
  if (
    typeof targetJavaRelease !== "number" ||
    !Number.isInteger(targetJavaRelease) ||
    targetJavaRelease < javaTargetInspectionLimits.minTargetJavaRelease ||
    targetJavaRelease > javaTargetInspectionLimits.maxTargetJavaRelease
  ) {
    throw new Error(
      "targetJavaRelease must be an integer from 8 through 26, the audited runtime range",
    );
  }
  if (input.previewEnabled !== undefined && typeof input.previewEnabled !== "boolean") {
    throw new Error("previewEnabled must be a boolean when supplied");
  }
  return { targetJavaRelease, previewEnabled: input.previewEnabled === true };
}

function safeEntryPath(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > javaTargetInspectionLimits.maxEntryPathCharacters ||
    /[\p{C}\\:]/u.test(value) ||
    value.startsWith("/")
  )
    return false;
  return value
    .replace(/\/$/, "")
    .split("/")
    .every((part) => part !== "" && part !== "." && part !== "..");
}

function classVersion(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 0xffff)
  );
}

function metadataClasses(value: unknown): JavaClassTargetMetadata[] {
  if (
    !Array.isArray(value) ||
    nodeTypes.isProxy(value) ||
    value.length > javaTargetInspectionLimits.maxClassEntries
  ) {
    throw new Error("classes must be a bounded array of extracted classfile metadata");
  }
  const entries: JavaClassTargetMetadata[] = [];
  const paths = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, index);
    if (!descriptor || !("value" in descriptor))
      throw new Error("classes must not contain holes or accessors");
    const entry = plainRecord(
      descriptor.value,
      ["path", "majorVersion", "minorVersion"],
      "class metadata",
    );
    if (!safeEntryPath(entry.path) || !entry.path.endsWith(".class"))
      throw new Error("class metadata path must identify a safe .class entry");
    if (paths.has(entry.path)) throw new Error("class metadata contains duplicate paths");
    if (
      !classVersion(entry.majorVersion) ||
      !classVersion(entry.minorVersion) ||
      (entry.majorVersion === null) !== (entry.minorVersion === null)
    ) {
      throw new Error("class versions must both be unsigned 16-bit integers or both null");
    }
    paths.add(entry.path);
    entries.push({
      path: entry.path,
      majorVersion: entry.majorVersion,
      minorVersion: entry.minorVersion,
    });
  }
  return entries;
}

function selectClassPath(
  path: string,
  multiRelease: boolean | null,
  targetJavaRelease: number,
): {
  logicalPath: string | null;
  versionDirectory: number | null;
  ignoredReason: string | null;
} {
  if (!path.startsWith("META-INF/")) {
    return {
      logicalPath: path,
      versionDirectory: null,
      ignoredReason:
        path === "module-info.class" && targetJavaRelease < 9
          ? "module-descriptor-before-java-9"
          : null,
    };
  }
  const versioned = /^META-INF\/versions\/([1-9][0-9]*)\/(.+)$/.exec(path);
  if (
    !versioned?.[1] ||
    !versioned[2] ||
    !Number.isSafeInteger(Number(versioned[1])) ||
    Number(versioned[1]) < 9
  ) {
    return {
      logicalPath: null,
      versionDirectory: null,
      ignoredReason: "non-versioned-meta-inf-entry",
    };
  }
  const release = Number(versioned[1]);
  const logicalPath = versioned[2];
  const ignoredReason = logicalPath.startsWith("META-INF/")
    ? "versioned-meta-inf-resource"
    : multiRelease === null
      ? "unknown-multi-release-setting"
      : !multiRelease
        ? "multi-release-disabled"
        : release > targetJavaRelease
          ? "newer-version-directory"
          : null;
  return { logicalPath, versionDirectory: release, ignoredReason };
}

function inspectTargets(
  classes: JavaClassTargetMetadata[],
  runtime: Required<JavaTargetRuntimeOptions>,
  context: {
    strength: "binary" | "metadata";
    entriesComplete: boolean;
    multiRelease: boolean | null;
    zipValidated: boolean;
    manifestValidated: boolean;
    classBytesValidated: boolean;
    bytes: number | null;
    archiveEntries: number | null;
    nestedJarCount: number | null;
    incompleteReasons: Set<string>;
    diagnostics: Diagnostics;
  },
): JavaTargetInspectionResult {
  const { targetJavaRelease, previewEnabled } = runtime;
  const { diagnostics, incompleteReasons } = context;
  const results: JavaClassTargetResult[] = classes.map((entry) => ({
    ...entry,
    ...selectClassPath(entry.path, context.multiRelease, targetJavaRelease),
    effective: false,
    javaRelease:
      entry.majorVersion !== null && entry.majorVersion >= 45 ? entry.majorVersion - 44 : null,
    preview:
      entry.majorVersion === null || entry.minorVersion === null
        ? null
        : entry.majorVersion >= 56 && entry.minorVersion === 0xffff,
    targetCompatible: null,
  }));
  const selected = new Map<string, JavaClassTargetResult>();
  const uncertainOverrides = new Set(
    results
      .filter(
        (entry) =>
          entry.ignoredReason === "unknown-multi-release-setting" &&
          entry.versionDirectory !== null &&
          entry.versionDirectory <= targetJavaRelease,
      )
      .map((entry) => entry.logicalPath),
  );
  for (const entry of results) {
    if (!entry.ignoredReason && !context.entriesComplete && context.multiRelease !== false) {
      entry.ignoredReason = "incomplete-multi-release-selection";
    }
    if (entry.versionDirectory === null && uncertainOverrides.has(entry.logicalPath)) {
      entry.ignoredReason = "unknown-multi-release-setting";
    }
    if (entry.ignoredReason || !entry.logicalPath) continue;
    const previous = selected.get(entry.logicalPath);
    if (!previous || (entry.versionDirectory ?? 0) > (previous.versionDirectory ?? 0)) {
      if (previous) previous.ignoredReason = "replaced-by-versioned-entry";
      selected.set(entry.logicalPath, entry);
    } else entry.ignoredReason = "replaced-by-versioned-entry";
  }
  for (const entry of selected.values()) entry.effective = true;
  let incompatible = false;
  let unknownTarget = !context.entriesComplete || context.multiRelease === null;
  let versionsKnown = true;
  let minimumJavaRelease = 0;
  for (const entry of results) {
    const major = entry.majorVersion;
    const minor = entry.minorVersion;
    if (major === null || minor === null) {
      versionsKnown = false;
      if (entry.effective) unknownTarget = true;
      continue;
    }
    const invalidVersion = major < 45 || (major >= 56 && minor !== 0 && minor !== 0xffff);
    if (invalidVersion)
      diagnostics.add(
        "class.invalid-version",
        "error",
        entry.path,
        "Classfile version fields do not match the audited JVM format rules.",
      );
    if (entry.versionDirectory !== null && major > entry.versionDirectory + 44) {
      diagnostics.add(
        "class.version-directory-mismatch",
        "warning",
        entry.path,
        "Classfile target exceeds the Java release named by its version directory.",
      );
    }
    if (!entry.effective) continue;
    minimumJavaRelease = Math.max(minimumJavaRelease, entry.javaRelease ?? 0);
    const unsupportedLegacyMinor =
      targetJavaRelease <= 11 && major === targetJavaRelease + 44 && minor !== 0;
    const compatible =
      !invalidVersion &&
      !unsupportedLegacyMinor &&
      major <= targetJavaRelease + 44 &&
      (!entry.preview || (major === targetJavaRelease + 44 && previewEnabled));
    entry.targetCompatible = compatible;
    incompatible ||= !compatible;
    if (!invalidVersion && major > targetJavaRelease + 44) {
      diagnostics.add(
        "class.newer-java-target",
        "error",
        entry.path,
        "Selected classfile requires a newer Java release than the supplied runtime.",
      );
    } else if (unsupportedLegacyMinor) {
      diagnostics.add(
        "class.unsupported-minor-version",
        "error",
        entry.path,
        "Java 8–11 support their highest classfile major version only with minor version zero.",
      );
    } else if (entry.preview && major !== targetJavaRelease + 44) {
      diagnostics.add(
        "class.preview-release-mismatch",
        "error",
        entry.path,
        "Preview classfiles require their exact Java release, even when the supplied runtime is newer.",
      );
    } else if (entry.preview && !previewEnabled) {
      diagnostics.add(
        "class.preview-disabled",
        "error",
        entry.path,
        "Selected preview classfiles require previewEnabled for the supplied runtime assessment.",
      );
    }
  }
  if (!context.entriesComplete) incompleteReasons.add("class-entry-list-incomplete");
  if (!versionsKnown) incompleteReasons.add("class-version-evidence-incomplete");
  if (context.multiRelease === null) incompleteReasons.add("multi-release-setting-unknown");
  if (selected.size === 0) {
    unknownTarget = true;
    incompleteReasons.add("no-effective-class-evidence");
  }
  if (context.nestedJarCount) {
    unknownTarget = true;
    incompleteReasons.add("nested-jars-not-inspected");
    diagnostics.add(
      "archive.nested-jars",
      "unknown",
      null,
      "Nested JAR contents are not scanned; their Java target requirements remain unknown.",
    );
  }
  results.sort(
    (left, right) =>
      Number(right.effective) - Number(left.effective) || left.path.localeCompare(right.path),
  );
  const returned = results.slice(0, javaTargetInspectionLimits.maxOutputClasses);
  return {
    schemaVersion: 1,
    ...runtime,
    targetCompatible: incompatible ? false : unknownTarget ? null : true,
    scanComplete: incompleteReasons.size === 0,
    evidence: {
      strength: context.strength,
      classEntriesComplete: context.entriesComplete,
      zipStructureValidated: context.zipValidated,
      manifestContentIntegrityValidated: context.manifestValidated,
      classContentIntegrityValidated: context.classBytesValidated,
      allEntryContentIntegrityValidated: false,
    },
    archive: {
      bytes: context.bytes,
      entries: context.archiveEntries,
      nestedJarCount: context.nestedJarCount,
    },
    multiRelease: context.multiRelease,
    classCount: classes.length,
    effectiveClassCount: selected.size,
    inspectedClassCount: classes.filter((entry) => entry.majorVersion !== null).length,
    minimumJavaRelease:
      minimumJavaRelease > 0 &&
      !unknownTarget &&
      !results.some(
        (entry) => entry.effective && (entry.minorVersion !== 0 || entry.javaRelease === null),
      )
        ? minimumJavaRelease
        : null,
    classes: returned,
    classesTruncated: returned.length < results.length,
    omittedClassCount: results.length - returned.length,
    diagnostics: diagnostics.values,
    diagnosticCount: diagnostics.count,
    diagnosticsTruncated: diagnostics.count > diagnostics.values.length,
    incompleteReasons: [...incompleteReasons].sort(),
    sources: {
      classFile:
        targetJavaRelease <= 11
          ? "https://docs.oracle.com/javase/specs/jvms/se11/html/jvms-4.html#jvms-4.1"
          : "https://docs.oracle.com/javase/specs/jvms/se26/html/jvms-4.html#jvms-4.1",
      jar: "https://docs.oracle.com/en/java/javase/25/docs/specs/jar/jar.html#multi-release-jar-files",
    },
    nonGuarantees: [
      "Compatibility covers classfile version fields for the supplied Java release and preview setting, not JVM execution, linkage, dependencies, Minecraft or plugin APIs.",
      "Multi-release selection models the standard runtime class path or module path; custom and boot class loaders can use different selection rules.",
      "The minimum release summarizes selected classfile targets only; it is not a minimum supported JAR runtime, especially across multi-release selections.",
      "Nested JAR contents, resource integrity, signatures, module resolution and multi-release public API parity are not validated.",
      ...(context.strength === "metadata"
        ? [
            "All class fields, entry-list completeness and the multi-release setting are caller-supplied; no archive or class bytes were verified.",
          ]
        : []),
    ],
  };
}

/** Assesses caller-extracted classfile fields without inspecting an archive or trusting byte claims. */
export function validateJavaTargetMetadata(
  options: ValidateJavaTargetMetadataOptions,
): JavaTargetInspectionResult {
  const input = plainRecord(
    options,
    ["classes", "classEntriesComplete", "multiRelease", "targetJavaRelease", "previewEnabled"],
    "Java target metadata input",
  );
  const runtime = runtimeOptions(input);
  if (typeof input.classEntriesComplete !== "boolean")
    throw new Error("classEntriesComplete must be a boolean");
  if (input.multiRelease !== null && typeof input.multiRelease !== "boolean")
    throw new Error("multiRelease must be boolean or null");
  return inspectTargets(metadataClasses(input.classes), runtime, {
    strength: "metadata",
    entriesComplete: input.classEntriesComplete,
    multiRelease: input.multiRelease,
    zipValidated: false,
    manifestValidated: false,
    classBytesValidated: false,
    bytes: null,
    archiveEntries: null,
    nestedJarCount: null,
    incompleteReasons: new Set(),
    diagnostics: new Diagnostics(),
  });
}

/** Reads only the bounded manifest main section; ambiguous duplicate attributes stay unknown. */
function manifestMultiRelease(bytes: Buffer): boolean | null {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
  if (text.includes("\0")) return null;
  const headers = new Map<string, string>();
  let current: string | null = null;
  for (const line of text.split(/\r\n|\n|\r/)) {
    if (line === "") break;
    if (line.startsWith(" ")) {
      if (current === null) return null;
      headers.set(current, `${headers.get(current) ?? ""}${line.slice(1)}`);
      continue;
    }
    const header = /^([A-Za-z0-9][A-Za-z0-9_-]*): (.*)$/.exec(line);
    if (!header?.[1] || header[2] === undefined) return null;
    current = header[1].toLowerCase();
    if (headers.has(current)) return null;
    headers.set(current, header[2]);
  }
  return headers.get("multi-release")?.toLowerCase() === "true";
}

/** Scans bounded classfile bytes in a local archive without loading code or extracting files. */
export function inspectJavaJarTargets(
  options: InspectJavaJarTargetsOptions,
): JavaTargetInspectionResult {
  const input = plainRecord(
    options,
    ["archive", "targetJavaRelease", "previewEnabled"],
    "Java JAR target input",
  );
  const runtime = runtimeOptions(input);
  if (nodeTypes.isProxy(input.archive) || !(input.archive instanceof Uint8Array))
    throw new Error("archive must be Uint8Array bytes");
  const context = {
    strength: "binary" as const,
    entriesComplete: false,
    multiRelease: null as boolean | null,
    zipValidated: false,
    manifestValidated: false,
    classBytesValidated: false,
    bytes: input.archive.byteLength,
    archiveEntries: null as number | null,
    nestedJarCount: null as number | null,
    incompleteReasons: new Set<string>(),
    diagnostics: new Diagnostics(),
  };
  const fail = (code: string, message: string) => {
    context.diagnostics.add(code, "unknown", null, message);
    context.incompleteReasons.add(code);
    return inspectTargets([], runtime, context);
  };
  if (input.archive.byteLength > javaTargetInspectionLimits.maxArchiveBytes)
    return fail("archive.byte-limit", "Archive exceeds the binary input limit.");
  let archive: ZipArchive;
  try {
    archive = openZipArchive(
      Buffer.from(input.archive.buffer, input.archive.byteOffset, input.archive.byteLength),
    );
  } catch {
    return fail(
      "archive.invalid-zip",
      "Archive is not a supported internally consistent ZIP/JAR file.",
    );
  }
  context.zipValidated = true;
  context.archiveEntries = archive.entries.length;
  if (archive.entries.length > javaTargetInspectionLimits.maxArchiveEntries)
    return fail("archive.entry-limit", "Archive exceeds the entry-count limit.");
  let declaredBytes = 0;
  for (const entry of archive.entries) {
    if (!safeEntryPath(entry.name))
      return fail("archive.unsafe-path", "Archive has an unsafe or oversized entry path.");
    declaredBytes += entry.uncompressedSize;
    if (
      declaredBytes > javaTargetInspectionLimits.maxDeclaredUncompressedBytes ||
      entry.uncompressedSize >
        Math.max(1, entry.compressedSize) * javaTargetInspectionLimits.maxCompressionRatio
    ) {
      return fail(
        "archive.expansion-limit",
        "Archive exceeds the declared size or compression-ratio limits.",
      );
    }
  }
  context.entriesComplete = true;
  context.nestedJarCount = archive.entries.filter(
    (entry) => !entry.directory && entry.name.toLowerCase().endsWith(".jar"),
  ).length;
  context.multiRelease = false;
  const manifest = archive.entries.find(
    (entry) => !entry.directory && entry.name === "META-INF/MANIFEST.MF",
  );
  if (manifest) {
    try {
      if (manifest.uncompressedSize > javaTargetInspectionLimits.maxManifestBytes)
        throw new Error();
      context.multiRelease = manifestMultiRelease(archive.readEntry(manifest.name));
      context.manifestValidated = true;
    } catch {
      context.multiRelease = null;
    }
    if (context.multiRelease === null)
      context.diagnostics.add(
        "manifest.unavailable",
        "unknown",
        manifest.name,
        "Manifest main attributes could not be read unambiguously within the configured bounds.",
      );
  }
  const classes: JavaClassTargetMetadata[] = [];
  let classBytes = 0;
  let allClassBytesValidated = true;
  for (const entry of archive.entries) {
    if (entry.directory || !entry.name.endsWith(".class")) continue;
    const metadata: JavaClassTargetMetadata = {
      path: entry.name,
      majorVersion: null,
      minorVersion: null,
    };
    classes.push(metadata);
    if (
      entry.uncompressedSize > javaTargetInspectionLimits.maxClassBytes ||
      classBytes + entry.uncompressedSize > javaTargetInspectionLimits.maxTotalClassBytes
    ) {
      allClassBytesValidated = false;
      context.diagnostics.add(
        "class.byte-limit",
        "unknown",
        entry.name,
        "Classfile bytes were not inspected because an individual or cumulative class byte limit was reached.",
      );
      continue;
    }
    classBytes += entry.uncompressedSize;
    try {
      const evidence = inspectJavaClassFile(archive.readEntry(entry.name));
      metadata.majorVersion = evidence.majorVersion;
      metadata.minorVersion = evidence.minorVersion;
    } catch {
      allClassBytesValidated = false;
      context.diagnostics.add(
        "class.unreadable",
        "unknown",
        entry.name,
        "Classfile bytes failed bounded structure or content-integrity inspection.",
      );
    }
  }
  context.classBytesValidated = allClassBytesValidated && classes.length > 0;
  return inspectTargets(classes, runtime, context);
}

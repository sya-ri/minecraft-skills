import {
  type VelocityPluginArchiveEntry,
  velocityPluginJarValidationLimits,
} from "@minecraft-skills/catalog";

export type VelocityPluginMcpInput = {
  descriptor: unknown;
  archiveEntries: VelocityPluginArchiveEntry[];
  archiveEntriesComplete: boolean;
};

function plainDataRecord(
  value: unknown,
  label: string,
  allowedFields: readonly string[] | null,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`validate_velocity_plugin_jar ${label} must be a plain object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`validate_velocity_plugin_jar ${label} must be a plain object`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some((key) => typeof key === "symbol")) {
    throw new Error(`validate_velocity_plugin_jar ${label} must not contain symbol fields`);
  }
  const allowed = allowedFields === null ? null : new Set(allowedFields);
  const record: Record<string, unknown> = Object.create(null);
  for (const key of keys as string[]) {
    const descriptor = descriptors[key];
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      throw new Error(
        `validate_velocity_plugin_jar ${label} must contain only enumerable data fields`,
      );
    }
    if (allowed !== null && !allowed.has(key)) {
      throw new Error(`validate_velocity_plugin_jar ${label} contains an unknown field`);
    }
    record[key] = descriptor.value;
  }
  return record;
}

function arrayValues(value: unknown, label: string, maxItems: number): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`validate_velocity_plugin_jar ${label} must be an array`);
  }
  if (value.length > maxItems) {
    throw new Error(`validate_velocity_plugin_jar ${label} exceeds its bounded item limit`);
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new Error(`validate_velocity_plugin_jar ${label} must not contain symbol fields`);
  }
  const names = Object.getOwnPropertyNames(value);
  if (
    names.some(
      (name) =>
        name !== "length" && (!/^(?:0|[1-9]\d*)$/u.test(name) || Number(name) >= value.length),
    )
  ) {
    throw new Error(`validate_velocity_plugin_jar ${label} must not contain named fields`);
  }
  const result: unknown[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, index);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      throw new Error(
        `validate_velocity_plugin_jar ${label} must be a dense array of data properties`,
      );
    }
    result.push(descriptor.value);
  }
  return result;
}

function boundedDescriptorObject(value: unknown): unknown {
  const seen = new Set<object>();
  const state = { nodes: 0, characters: 0, utf8Bytes: 0 };

  const clone = (candidate: unknown, depth: number): unknown => {
    state.nodes += 1;
    if (
      state.nodes > velocityPluginJarValidationLimits.maxJsonNodes ||
      depth > velocityPluginJarValidationLimits.maxJsonDepth
    ) {
      throw new Error("validate_velocity_plugin_jar descriptor exceeds its complexity limit");
    }
    if (typeof candidate === "string") {
      state.characters += candidate.length;
      state.utf8Bytes += Buffer.byteLength(candidate, "utf8");
      if (
        candidate.length > velocityPluginJarValidationLimits.maxScalarCharacters ||
        state.characters > velocityPluginJarValidationLimits.maxDescriptorCharacters ||
        state.utf8Bytes > velocityPluginJarValidationLimits.maxDescriptorBytes
      ) {
        throw new Error("validate_velocity_plugin_jar descriptor exceeds its text limit");
      }
      return candidate;
    }
    if (
      candidate === null ||
      typeof candidate === "boolean" ||
      (typeof candidate === "number" && Number.isFinite(candidate))
    ) {
      return candidate;
    }
    if (typeof candidate !== "object") {
      throw new Error("validate_velocity_plugin_jar descriptor must contain only JSON data");
    }
    if (seen.has(candidate)) {
      throw new Error("validate_velocity_plugin_jar descriptor must not contain cycles or aliases");
    }
    seen.add(candidate);

    if (Array.isArray(candidate)) {
      const values = arrayValues(
        candidate,
        "descriptor array",
        velocityPluginJarValidationLimits.maxCollectionEntries,
      );
      return values.map((item) => clone(item, depth + 1));
    }

    const record = plainDataRecord(candidate, "descriptor object", null);
    const entries = Object.entries(record);
    if (entries.length > velocityPluginJarValidationLimits.maxCollectionEntries) {
      throw new Error("validate_velocity_plugin_jar descriptor exceeds its collection limit");
    }
    const result: Record<string, unknown> = Object.create(null);
    for (const [key, item] of entries) {
      state.characters += key.length;
      state.utf8Bytes += Buffer.byteLength(key, "utf8");
      if (
        key.length > velocityPluginJarValidationLimits.maxScalarCharacters ||
        state.characters > velocityPluginJarValidationLimits.maxDescriptorCharacters ||
        state.utf8Bytes > velocityPluginJarValidationLimits.maxDescriptorBytes
      ) {
        throw new Error("validate_velocity_plugin_jar descriptor exceeds its text limit");
      }
      result[key] = clone(item, depth + 1);
    }
    return result;
  };

  return clone(value, 0);
}

function boundedDescriptor(value: unknown): unknown {
  if (typeof value === "string") {
    if (
      value.length > velocityPluginJarValidationLimits.maxDescriptorCharacters ||
      Buffer.byteLength(value, "utf8") > velocityPluginJarValidationLimits.maxDescriptorBytes
    ) {
      throw new Error("validate_velocity_plugin_jar descriptor exceeds its bounded text limit");
    }
    return value;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("validate_velocity_plugin_jar descriptor must be a JSON string or object");
  }
  return boundedDescriptorObject(value);
}

/** Converts untrusted MCP input into fixed-size plain metadata without reading accessors. */
export function preflightVelocityPluginMcpInput(input: unknown): VelocityPluginMcpInput {
  const args = plainDataRecord(input, "input", [
    "archiveEntries",
    "archiveEntriesComplete",
    "descriptor",
  ]);
  if (!("descriptor" in args)) {
    throw new Error("validate_velocity_plugin_jar requires descriptor JSON data");
  }
  if (typeof args.archiveEntriesComplete !== "boolean") {
    throw new Error("validate_velocity_plugin_jar requires boolean archiveEntriesComplete");
  }
  const rawEntries = arrayValues(
    args.archiveEntries,
    "archiveEntries",
    velocityPluginJarValidationLimits.maxArchiveEntries,
  );
  const archiveEntries: VelocityPluginArchiveEntry[] = [];
  let totalUncompressedBytes = 0;
  for (const rawEntry of rawEntries) {
    const entry = plainDataRecord(rawEntry, "archive entry", [
      "compressedSize",
      "directory",
      "path",
      "size",
    ]);
    if (
      typeof entry.path !== "string" ||
      entry.path.length === 0 ||
      entry.path.length > velocityPluginJarValidationLimits.maxEntryPathCharacters
    ) {
      throw new Error("validate_velocity_plugin_jar archive entry path is invalid");
    }
    if (
      typeof entry.size !== "number" ||
      !Number.isSafeInteger(entry.size) ||
      entry.size < 0 ||
      entry.size > velocityPluginJarValidationLimits.maxEntryUncompressedBytes
    ) {
      throw new Error("validate_velocity_plugin_jar archive entry size is outside its limit");
    }
    const compressedSize = entry.compressedSize;
    if (
      compressedSize !== undefined &&
      (typeof compressedSize !== "number" ||
        !Number.isSafeInteger(compressedSize) ||
        compressedSize < 0 ||
        compressedSize > velocityPluginJarValidationLimits.maxArchiveBytes)
    ) {
      throw new Error(
        "validate_velocity_plugin_jar archive entry compressedSize is outside its limit",
      );
    }
    if (entry.directory !== undefined && typeof entry.directory !== "boolean") {
      throw new Error("validate_velocity_plugin_jar archive entry directory must be boolean");
    }
    totalUncompressedBytes += entry.size;
    if (totalUncompressedBytes > velocityPluginJarValidationLimits.maxTotalUncompressedBytes) {
      throw new Error("validate_velocity_plugin_jar archiveEntries exceed the total byte limit");
    }
    if (
      typeof compressedSize === "number" &&
      entry.size > 0 &&
      (compressedSize === 0 ||
        entry.size / compressedSize > velocityPluginJarValidationLimits.maxCompressionRatio)
    ) {
      throw new Error(
        "validate_velocity_plugin_jar archive entry exceeds the compression-ratio limit",
      );
    }
    archiveEntries.push({
      path: entry.path,
      size: entry.size,
      ...(typeof compressedSize === "number" ? { compressedSize } : {}),
      ...(typeof entry.directory === "boolean" ? { directory: entry.directory } : {}),
    });
  }
  return {
    descriptor: boundedDescriptor(args.descriptor),
    archiveEntries,
    archiveEntriesComplete: args.archiveEntriesComplete,
  };
}

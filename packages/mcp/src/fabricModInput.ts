import {
  defaultFabricModValidationLimits,
  type FabricModArchiveEntry,
  type FabricModValidationLimits,
  type FabricModValidationOptions,
} from "@minecraft-skills/catalog";

export const fabricModArchivePathMaxLength = 4_096;

const fabricModLimitNames = [
  "maxArchiveEntries",
  "maxMetadataBytes",
  "maxDiagnostics",
  "maxMetadataNodes",
  "maxMetadataDepth",
  "maxMetadataStringBytes",
] as const satisfies readonly (keyof FabricModValidationLimits)[];

const fabricModLimitNameSet = new Set<string>(fabricModLimitNames);

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function dataProperties(value: Record<string, unknown>, label: string) {
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new Error(`${label} must be JSON data without symbol properties`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const descriptor of Object.values(descriptors)) {
    if (!("value" in descriptor)) {
      throw new Error(`${label} must contain only JSON data properties`);
    }
  }
  return descriptors;
}

function preflightArrayOwnProperties(value: unknown[], label: string): void {
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new Error(`${label} must not contain symbol properties`);
  }
  for (const key of Object.getOwnPropertyNames(value)) {
    if (key === "length") continue;
    if (!/^(?:0|[1-9]\d*)$/u.test(key) || value.length <= Number(key)) {
      throw new Error(`${label} must not contain named own properties`);
    }
  }
}

function preflightMetadata(metadata: unknown): void {
  if (typeof metadata === "string") {
    if (defaultFabricModValidationLimits.maxMetadataBytes < Buffer.byteLength(metadata, "utf8")) {
      throw new Error(
        `validate_fabric_mod metadata must not exceed ${defaultFabricModValidationLimits.maxMetadataBytes} UTF-8 bytes`,
      );
    }
    return;
  }
  if (!isRecord(metadata)) {
    throw new Error("validate_fabric_mod metadata must be a JSON object or bounded JSON text");
  }

  const stack: Array<{ value: unknown; depth: number }> = [{ value: metadata, depth: 0 }];
  const seen = new Set<object>();
  let nodes = 0;
  let stringBytes = 0;
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) break;
    nodes += 1;
    if (defaultFabricModValidationLimits.maxMetadataNodes < nodes) {
      throw new Error(
        `validate_fabric_mod metadata must not exceed ${defaultFabricModValidationLimits.maxMetadataNodes} JSON nodes`,
      );
    }
    if (defaultFabricModValidationLimits.maxMetadataDepth < current.depth) {
      throw new Error(
        `validate_fabric_mod metadata must not exceed ${defaultFabricModValidationLimits.maxMetadataDepth} levels`,
      );
    }
    if (typeof current.value === "string") {
      stringBytes += Buffer.byteLength(current.value, "utf8");
      if (defaultFabricModValidationLimits.maxMetadataStringBytes < stringBytes) {
        throw new Error(
          `validate_fabric_mod metadata strings must not exceed ${defaultFabricModValidationLimits.maxMetadataStringBytes} aggregate UTF-8 bytes`,
        );
      }
      continue;
    }
    if (
      current.value === null ||
      typeof current.value === "boolean" ||
      (typeof current.value === "number" && Number.isFinite(current.value))
    ) {
      continue;
    }
    if (typeof current.value !== "object") {
      throw new Error("validate_fabric_mod metadata must contain only JSON values");
    }
    if (seen.has(current.value)) {
      throw new Error("validate_fabric_mod metadata must not contain cycles or shared objects");
    }
    seen.add(current.value);

    if (Array.isArray(current.value)) {
      preflightArrayOwnProperties(current.value, "validate_fabric_mod metadata arrays");
      if (defaultFabricModValidationLimits.maxMetadataNodes < current.value.length) {
        throw new Error(
          `validate_fabric_mod metadata arrays must not exceed ${defaultFabricModValidationLimits.maxMetadataNodes} items`,
        );
      }
      for (let index = current.value.length - 1; 0 <= index; index -= 1) {
        const descriptor = Object.getOwnPropertyDescriptor(current.value, index);
        if (descriptor === undefined) {
          throw new Error("validate_fabric_mod metadata must not contain sparse arrays");
        }
        if (!("value" in descriptor)) {
          throw new Error("validate_fabric_mod metadata arrays must contain JSON data properties");
        }
        stack.push({ value: descriptor.value, depth: current.depth + 1 });
      }
      continue;
    }
    if (!isRecord(current.value)) {
      throw new Error("validate_fabric_mod metadata must contain only JSON objects and arrays");
    }
    const descriptors = dataProperties(current.value, "validate_fabric_mod metadata");
    const entries = Object.entries(descriptors);
    if (defaultFabricModValidationLimits.maxMetadataNodes < entries.length) {
      throw new Error(
        `validate_fabric_mod metadata objects must not exceed ${defaultFabricModValidationLimits.maxMetadataNodes} properties`,
      );
    }
    for (let index = entries.length - 1; 0 <= index; index -= 1) {
      const entry = entries[index];
      if (entry === undefined) continue;
      const [key, descriptor] = entry;
      stringBytes += Buffer.byteLength(key, "utf8");
      if (defaultFabricModValidationLimits.maxMetadataStringBytes < stringBytes) {
        throw new Error(
          `validate_fabric_mod metadata strings must not exceed ${defaultFabricModValidationLimits.maxMetadataStringBytes} aggregate UTF-8 bytes`,
        );
      }
      stack.push({ value: descriptor.value, depth: current.depth + 1 });
    }
  }
}

function preflightArchiveEntries(value: unknown): FabricModArchiveEntry[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new Error("validate_fabric_mod archiveEntries must be an array");
  }
  preflightArrayOwnProperties(value, "validate_fabric_mod archiveEntries");
  if (defaultFabricModValidationLimits.maxArchiveEntries < value.length) {
    throw new Error(
      `validate_fabric_mod archiveEntries must not exceed ${defaultFabricModValidationLimits.maxArchiveEntries} entries`,
    );
  }

  const entries: FabricModArchiveEntry[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const entryDescriptor = Object.getOwnPropertyDescriptor(value, index);
    if (entryDescriptor === undefined) {
      throw new Error("validate_fabric_mod archiveEntries must not be sparse");
    }
    if (!("value" in entryDescriptor)) {
      throw new Error("validate_fabric_mod archiveEntries must contain JSON data properties");
    }
    const rawEntry = entryDescriptor.value;
    if (!isRecord(rawEntry)) {
      throw new Error("validate_fabric_mod archive entries must be objects");
    }
    const descriptors = dataProperties(rawEntry, `validate_fabric_mod archiveEntries[${index}]`);
    for (const key of Object.keys(descriptors)) {
      if (key !== "path" && key !== "size" && key !== "directory") {
        throw new Error("validate_fabric_mod archive entries contain unknown properties");
      }
    }
    const path = descriptors.path?.value;
    if (typeof path !== "string") {
      throw new Error("validate_fabric_mod archive entries require string path");
    }
    if (fabricModArchivePathMaxLength < path.length) {
      throw new Error(
        `validate_fabric_mod archive entry paths must not exceed ${fabricModArchivePathMaxLength} characters`,
      );
    }
    const size = descriptors.size?.value;
    if (
      size !== undefined &&
      (typeof size !== "number" || !Number.isSafeInteger(size) || size < 0)
    ) {
      throw new Error("validate_fabric_mod archive entry size must be a non-negative safe integer");
    }
    const directory = descriptors.directory?.value;
    if (directory !== undefined && typeof directory !== "boolean") {
      throw new Error("validate_fabric_mod archive entry directory must be a boolean");
    }
    entries.push({
      path,
      ...(typeof size === "number" ? { size } : {}),
      ...(typeof directory === "boolean" ? { directory } : {}),
    });
  }
  return entries;
}

function preflightLimits(value: unknown): Partial<FabricModValidationLimits> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw new Error("validate_fabric_mod limits must be an object");
  }
  const descriptors = dataProperties(value, "validate_fabric_mod limits");
  for (const key of Object.keys(descriptors)) {
    if (!fabricModLimitNameSet.has(key)) {
      throw new Error("validate_fabric_mod limits contains unknown properties");
    }
  }

  const limits: Partial<FabricModValidationLimits> = {};
  for (const name of fabricModLimitNames) {
    const candidate = descriptors[name]?.value;
    if (candidate === undefined) continue;
    if (
      typeof candidate !== "number" ||
      !Number.isFinite(candidate) ||
      candidate < 1 ||
      !Number.isSafeInteger(candidate) ||
      defaultFabricModValidationLimits[name] < candidate
    ) {
      throw new Error(
        `validate_fabric_mod ${name} must be a positive safe integer no greater than ${defaultFabricModValidationLimits[name]}`,
      );
    }
    limits[name] = candidate;
  }
  return limits;
}

/** Converts untrusted MCP arguments into a bounded Catalog validation request. */
export function preflightFabricModInput(args: Record<string, unknown>): FabricModValidationOptions {
  const descriptors = dataProperties(args, "validate_fabric_mod input");
  for (const key of Object.keys(descriptors)) {
    if (key !== "metadata" && key !== "archiveEntries" && key !== "limits") {
      throw new Error("validate_fabric_mod contains unknown properties");
    }
  }
  const metadataDescriptor = descriptors.metadata;
  if (metadataDescriptor === undefined) {
    throw new Error("validate_fabric_mod requires metadata JSON data");
  }
  const metadata = metadataDescriptor.value;
  preflightMetadata(metadata);
  const archiveEntries = preflightArchiveEntries(descriptors.archiveEntries?.value);
  const limits = preflightLimits(descriptors.limits?.value);
  return {
    metadata,
    ...(archiveEntries === undefined ? {} : { archiveEntries }),
    ...(limits === undefined ? {} : { limits }),
  };
}

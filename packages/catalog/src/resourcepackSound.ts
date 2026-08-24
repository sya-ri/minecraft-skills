import type {
  ResourcepackProjectValidationLimitName,
  ResourcepackProjectValidationLimits,
  ResourcepackSoundValidationIncompleteReason,
} from "./resourcepackProject.js";

type SoundProjectFile = {
  normalizedPath: string;
  validPath: boolean;
  validAssetPath: boolean;
  content?: unknown;
};

type SoundDiagnostic = {
  severity: "error" | "warning";
  code: string;
  path: string;
  reference: string | null;
  source?: string;
  message: string;
  dedupeIdentity?: string;
};

export type ResourcepackSoundValidationResult = {
  soundDefinitionFiles: number;
  soundEvents: number;
  soundFileReferences: number;
  soundEventReferences: number;
  soundFiles: number;
  inspectedSoundFiles: number;
  soundValidationComplete: boolean;
  incompleteReasons: ResourcepackSoundValidationIncompleteReason[];
  parsedJsonFiles: number;
  checkedReferences: number;
  exceededLimits: ResourcepackProjectValidationLimitName[];
};

type JsonObject = Record<string, unknown>;

type SoundReference = {
  sourceEventId: string;
  sourceNamespace: string;
  sourcePath: string;
  sourceReference: string;
  sourceIdentity: string;
  raw: string;
  targetId: string;
  targetNamespace: string;
  targetPath: string;
  type: "file" | "event";
  unqualified: boolean;
};

type ParsedSoundEvent = {
  id: string;
  file: SoundProjectFile;
  references: SoundReference[];
};

type VorbisInspection =
  | { valid: true; channels: number }
  | {
      valid: false;
      code: "invalid-ogg-container" | "unsupported-sound-codec" | "invalid-vorbis-identification";
      message: string;
    };

// RFC 3533's 27-byte Ogg page header plus one lacing byte and the Vorbis I specification's
// 30-byte identification packet form the complete first page required by Vorbis I.
export const vorbisIdentificationPageBytes = 58;

const resourceLocationPattern = /^([a-z0-9_.-]+):([a-z0-9/._-]+)$/;
const soundDefinitionPathPattern = /^assets\/([^/]+)\/sounds\.json$/;
const soundAssetPathPattern = /^assets\/([^/]+)\/sounds\/(.+)\.ogg$/;

function diagnosticFingerprint(value: string): string {
  let hash = 0x811c_9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x0100_0193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function boundedDiagnosticValue(value: string, maxLength: number, fingerprint?: string): string {
  if (value.length <= maxLength) {
    return value;
  }
  if (maxLength <= 0) {
    return "";
  }
  const marker = `…#${fingerprint ?? diagnosticFingerprint(value)}`;
  if (marker.length >= maxLength) {
    return marker.slice(marker.length - maxLength);
  }
  return `${value.slice(0, maxLength - marker.length)}${marker}`;
}

function boundedDiagnosticLocation(
  base: string,
  suffix: string,
  maxLength: number,
  fingerprint?: string,
): string {
  if (base.length + suffix.length <= maxLength) {
    return `${base}${suffix}`;
  }
  if (suffix.length >= maxLength) {
    return suffix.slice(suffix.length - maxLength);
  }
  return `${boundedDiagnosticValue(base, maxLength - suffix.length, fingerprint)}${suffix}`;
}

function isJsonObject(value: unknown): value is JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function resourceLocation(reference: string): { namespace: string; path: string } | null {
  if (reference.trim() !== reference) {
    return null;
  }
  const qualified = reference.includes(":") ? reference : `minecraft:${reference}`;
  const matched = resourceLocationPattern.exec(qualified);
  if (!matched?.[1] || !matched[2] || matched[1] === "." || matched[1] === "..") {
    return null;
  }
  if (matched[2].split("/").some((segment) => !segment || segment === "." || segment === "..")) {
    return null;
  }
  return { namespace: matched[1], path: matched[2] };
}

function parseProjectJson(
  file: SoundProjectFile,
): { json: JsonObject } | { error: string } | { unavailable: true } {
  if (typeof file.content === "string") {
    try {
      const parsed = JSON.parse(file.content) as unknown;
      return isJsonObject(parsed)
        ? { json: parsed }
        : { error: "Resource-pack JSON must contain an object at the document root." };
    } catch (error) {
      return {
        error: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
  if (isJsonObject(file.content)) {
    return { json: file.content };
  }
  return { unavailable: true };
}

function canonicalCycle(cycle: string[]): string[] {
  if (cycle.length < 2) {
    return cycle;
  }
  let firstIndex = 0;
  for (let index = 1; index < cycle.length; index += 1) {
    if ((cycle[index] ?? "") < (cycle[firstIndex] ?? "")) {
      firstIndex = index;
    }
  }
  return [...cycle.slice(firstIndex), ...cycle.slice(0, firstIndex)];
}

function bytesEqual(bytes: Uint8Array, offset: number, expected: readonly number[]): boolean {
  return expected.every((value, index) => bytes[offset + index] === value);
}

function readUint32LittleEndian(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) |
      ((bytes[offset + 1] ?? 0) << 8) |
      ((bytes[offset + 2] ?? 0) << 16) |
      ((bytes[offset + 3] ?? 0) << 24)) >>>
    0
  );
}

const oggCrcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index << 24;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 0x8000_0000 ? (value << 1) ^ 0x04c1_1db7 : value << 1;
  }
  return value >>> 0;
});

function oggPageCrc(bytes: Uint8Array): number {
  let crc = 0;
  for (let index = 0; index < vorbisIdentificationPageBytes; index += 1) {
    const byte = index >= 22 && index <= 25 ? 0 : (bytes[index] ?? 0);
    const tableIndex = ((crc >>> 24) ^ byte) & 0xff;
    crc = ((crc << 8) ^ (oggCrcTable[tableIndex] ?? 0)) >>> 0;
  }
  return crc;
}

function inspectVorbisIdentificationPage(bytes: Uint8Array): VorbisInspection {
  if (bytesEqual(bytes, 0, [0x52, 0x49, 0x46, 0x46])) {
    return {
      valid: false,
      code: "unsupported-sound-codec",
      message: "Minecraft Java resource-pack sounds must use Ogg Vorbis, not RIFF/WAVE audio.",
    };
  }
  if (!bytesEqual(bytes, 0, [0x4f, 0x67, 0x67, 0x53])) {
    return {
      valid: false,
      code: "invalid-ogg-container",
      message: "The sound does not begin with an Ogg capture pattern.",
    };
  }
  if (bytesEqual(bytes, 28, [0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64])) {
    return {
      valid: false,
      code: "unsupported-sound-codec",
      message: "The sound uses Ogg Opus, but Minecraft Java resource packs require Ogg Vorbis.",
    };
  }
  if (bytes.length < vorbisIdentificationPageBytes) {
    return {
      valid: false,
      code: "invalid-ogg-container",
      message: `The first Ogg/Vorbis identification page is truncated; ${vorbisIdentificationPageBytes} bytes are required.`,
    };
  }
  if (bytes[4] !== 0) {
    return {
      valid: false,
      code: "invalid-ogg-container",
      message: "The first Ogg page uses an unsupported container version.",
    };
  }
  if (bytes[5] !== 0x02) {
    return {
      valid: false,
      code: "invalid-ogg-container",
      message: "The first Ogg page must be an uncontinued beginning-of-stream page.",
    };
  }
  if (!bytesEqual(bytes, 6, [0, 0, 0, 0, 0, 0, 0, 0])) {
    return {
      valid: false,
      code: "invalid-ogg-container",
      message: "The first Ogg/Vorbis page must have a zero granule position.",
    };
  }
  if (readUint32LittleEndian(bytes, 18) !== 0 || bytes[26] !== 1 || bytes[27] !== 30) {
    return {
      valid: false,
      code: "invalid-ogg-container",
      message:
        "The first Ogg page must have sequence number zero and contain only the 30-byte Vorbis identification packet.",
    };
  }
  if (!bytesEqual(bytes, 28, [0x01, 0x76, 0x6f, 0x72, 0x62, 0x69, 0x73])) {
    return {
      valid: false,
      code: "unsupported-sound-codec",
      message: "The first Ogg packet is not a Vorbis identification header.",
    };
  }
  if (oggPageCrc(bytes) !== readUint32LittleEndian(bytes, 22)) {
    return {
      valid: false,
      code: "invalid-ogg-container",
      message: "The first Ogg page checksum does not match its contents.",
    };
  }

  const channels = bytes[39] ?? 0;
  const sampleRate = readUint32LittleEndian(bytes, 40);
  const blocksize = bytes[56] ?? 0;
  const shortBlockExponent = blocksize & 0x0f;
  const longBlockExponent = blocksize >>> 4;
  if (
    readUint32LittleEndian(bytes, 35) !== 0 ||
    channels === 0 ||
    sampleRate === 0 ||
    shortBlockExponent < 6 ||
    shortBlockExponent > 13 ||
    longBlockExponent < 6 ||
    longBlockExponent > 13 ||
    shortBlockExponent > longBlockExponent ||
    bytes[57] !== 1
  ) {
    return {
      valid: false,
      code: "invalid-vorbis-identification",
      message:
        "The Vorbis identification header has an invalid version, channel count, sample rate, block size, or framing bit.",
    };
  }
  return { valid: true, channels };
}

function invalidOptionalFields(value: JsonObject): string[] {
  const invalid: string[] = [];
  if (value.replace !== undefined && typeof value.replace !== "boolean") {
    invalid.push("replace");
  }
  if (value.subtitle !== undefined && typeof value.subtitle !== "string") {
    invalid.push("subtitle");
  }
  return invalid;
}

function invalidSoundEntryFields(value: JsonObject): string[] {
  const invalid: string[] = [];
  if (
    value.volume !== undefined &&
    (typeof value.volume !== "number" || !Number.isFinite(value.volume) || value.volume <= 0)
  ) {
    invalid.push("volume");
  }
  if (
    value.pitch !== undefined &&
    (typeof value.pitch !== "number" || !Number.isFinite(value.pitch) || value.pitch <= 0)
  ) {
    invalid.push("pitch");
  }
  if (
    value.weight !== undefined &&
    (typeof value.weight !== "number" || !Number.isInteger(value.weight) || value.weight <= 0)
  ) {
    invalid.push("weight");
  }
  if (value.stream !== undefined && typeof value.stream !== "boolean") {
    invalid.push("stream");
  }
  if (
    value.attenuation_distance !== undefined &&
    (typeof value.attenuation_distance !== "number" ||
      !Number.isInteger(value.attenuation_distance))
  ) {
    invalid.push("attenuation_distance");
  }
  if (value.preload !== undefined && typeof value.preload !== "boolean") {
    invalid.push("preload");
  }
  return invalid;
}

export function validateResourcepackSounds(options: {
  files: readonly SoundProjectFile[];
  localPaths: ReadonlySet<string>;
  limits: ResourcepackProjectValidationLimits;
  addDiagnostic: (diagnostic: SoundDiagnostic) => void;
}): ResourcepackSoundValidationResult {
  const diagnostics = { push: options.addDiagnostic };
  const maxDiagnosticLocationLength = Math.min(options.limits.maxDiagnosticTextLength, 256);
  const diagnosticValue = (value: string): string =>
    boundedDiagnosticValue(value, options.limits.maxDiagnosticTextLength);
  const diagnosticLocation = (base: string, suffix: string, fingerprint?: string): string =>
    boundedDiagnosticLocation(base, suffix, maxDiagnosticLocationLength, fingerprint);
  const definitionFiles = options.files.filter(
    (file) =>
      file.validPath && file.validAssetPath && soundDefinitionPathPattern.test(file.normalizedPath),
  );
  const soundFiles = options.files.filter(
    (file) =>
      file.validPath && file.validAssetPath && soundAssetPathPattern.test(file.normalizedPath),
  );
  const soundNamespaces = new Set<string>();
  for (const file of [...definitionFiles, ...soundFiles]) {
    const matched = /^assets\/([^/]+)\//.exec(file.normalizedPath);
    if (matched?.[1]) {
      soundNamespaces.add(matched[1]);
    }
  }

  let parsedJsonFiles = 0;
  let checkedReferences = 0;
  let soundFileReferences = 0;
  let soundEventReferences = 0;
  let inspectedSoundFiles = 0;
  let soundValidationComplete = true;
  let soundEntries = 0;
  let soundEventOccurrences = 0;
  let soundEventLimitReached = false;
  let soundEntryLimitReached = false;
  const events = new Map<string, ParsedSoundEvent>();
  const exceededLimits = new Set<ResourcepackProjectValidationLimitName>();
  const incompleteReasons = new Set<ResourcepackSoundValidationIncompleteReason>();

  const addLimitDiagnostic = (
    file: SoundProjectFile,
    name: "maxSoundEvents" | "maxSoundEntries",
  ): void => {
    if (exceededLimits.has(name)) {
      return;
    }
    exceededLimits.add(name);
    incompleteReasons.add("limit-exceeded");
    soundValidationComplete = false;
    diagnostics.push({
      severity: "error",
      code: "resourcepack-validation-limit-exceeded",
      path: file.normalizedPath,
      reference: name,
      source: "sounds.json",
      message: `Sound validation stopped processing '${name}' after reaching its applied limit of ${options.limits[name]}.`,
    });
  };

  const addInvalidDefinitionField = (
    file: SoundProjectFile,
    eventId: string,
    eventFingerprint: string | undefined,
    eventIdentity: string,
    field: string,
  ): void => {
    const displayedEventId = boundedDiagnosticValue(
      eventId,
      options.limits.maxDiagnosticTextLength,
      eventFingerprint,
    );
    diagnostics.push({
      severity: "error",
      code: "invalid-sound-definition",
      path: file.normalizedPath,
      reference: diagnosticLocation(eventId, `.${field}`, eventFingerprint),
      message: `Sound event '${displayedEventId}' has an invalid '${field}' field.`,
      dedupeIdentity: `${eventIdentity}:${field}`,
    });
  };

  for (const file of definitionFiles) {
    const namespace = soundDefinitionPathPattern.exec(file.normalizedPath)?.[1];
    if (!namespace) {
      continue;
    }
    const parsed = parseProjectJson(file);
    if ("error" in parsed) {
      diagnostics.push({
        severity: "error",
        code: "invalid-json",
        path: file.normalizedPath,
        reference: null,
        message: parsed.error,
      });
      continue;
    }
    if ("unavailable" in parsed) {
      soundValidationComplete = false;
      incompleteReasons.add("definition-content-unavailable");
      diagnostics.push({
        severity: "error",
        code: "json-content-unavailable",
        path: file.normalizedPath,
        reference: null,
        message: "JSON content is required to validate sound references.",
      });
      continue;
    }
    parsedJsonFiles += 1;

    for (const eventPath of Object.keys(parsed.json).sort()) {
      const eventIdentity = `sound-event:${soundEventOccurrences}`;
      soundEventOccurrences += 1;
      const eventId = `${namespace}:${eventPath}`;
      if (!resourceLocation(eventId)) {
        const displayedEventPath = diagnosticValue(eventPath);
        diagnostics.push({
          severity: "error",
          code: "invalid-sound-event-id",
          path: file.normalizedPath,
          reference: eventPath,
          message: `Sound event key '${displayedEventPath}' is not a lowercase resource-location path.`,
          dedupeIdentity: eventIdentity,
        });
        continue;
      }
      const eventFingerprint =
        eventId.length > maxDiagnosticLocationLength ? diagnosticFingerprint(eventId) : undefined;
      const displayedEventId = boundedDiagnosticValue(
        eventId,
        options.limits.maxDiagnosticTextLength,
        eventFingerprint,
      );
      if (!events.has(eventId) && events.size >= options.limits.maxSoundEvents) {
        soundEventLimitReached = true;
        addLimitDiagnostic(file, "maxSoundEvents");
        break;
      }
      const value = parsed.json[eventPath];
      if (!isJsonObject(value)) {
        diagnostics.push({
          severity: "error",
          code: "invalid-sound-definition",
          path: file.normalizedPath,
          reference: eventId,
          message: `Sound event '${displayedEventId}' must be an object.`,
          dedupeIdentity: eventIdentity,
        });
        continue;
      }
      for (const field of invalidOptionalFields(value)) {
        addInvalidDefinitionField(file, eventId, eventFingerprint, eventIdentity, field);
      }
      const parsedEvent: ParsedSoundEvent = { id: eventId, file, references: [] };
      events.set(eventId, parsedEvent);
      if (value.sounds === undefined) {
        continue;
      }
      if (!Array.isArray(value.sounds)) {
        addInvalidDefinitionField(file, eventId, eventFingerprint, eventIdentity, "sounds");
        continue;
      }
      if (soundEntryLimitReached) {
        continue;
      }

      for (const [index, entry] of value.sounds.entries()) {
        if (soundEntries >= options.limits.maxSoundEntries) {
          soundEntryLimitReached = true;
          addLimitDiagnostic(file, "maxSoundEntries");
          break;
        }
        soundEntries += 1;
        const entrySuffix = `.sounds[${index}]`;
        const entryReference = diagnosticLocation(eventId, entrySuffix, eventFingerprint);
        const entryIdentity = `${eventIdentity}:entry:${index}`;
        let raw: string | null = null;
        let type: "file" | "event" = "file";
        if (typeof entry === "string") {
          raw = entry;
        } else if (isJsonObject(entry)) {
          if (typeof entry.name !== "string") {
            diagnostics.push({
              severity: "error",
              code: "invalid-sound-entry",
              path: file.normalizedPath,
              reference: diagnosticLocation(eventId, `${entrySuffix}.name`, eventFingerprint),
              message: `Sound entry '${entryReference}' must have a string 'name'.`,
              dedupeIdentity: `${entryIdentity}:name`,
            });
          } else {
            raw = entry.name;
          }
          if (entry.type !== undefined && entry.type !== "file" && entry.type !== "event") {
            diagnostics.push({
              severity: "error",
              code: "invalid-sound-type",
              path: file.normalizedPath,
              reference: diagnosticLocation(eventId, `${entrySuffix}.type`, eventFingerprint),
              message: `Sound entry '${entryReference}' type must be 'file' or 'event'.`,
              dedupeIdentity: `${entryIdentity}:type`,
            });
            raw = null;
          } else if (entry.type === "event") {
            type = "event";
          }
          for (const field of invalidSoundEntryFields(entry)) {
            diagnostics.push({
              severity: "error",
              code: "invalid-sound-entry",
              path: file.normalizedPath,
              reference: diagnosticLocation(eventId, `${entrySuffix}.${field}`, eventFingerprint),
              message: `Sound entry '${entryReference}' has an invalid '${field}' field.`,
              dedupeIdentity: `${entryIdentity}:${field}`,
            });
          }
        } else {
          diagnostics.push({
            severity: "error",
            code: "invalid-sound-entry",
            path: file.normalizedPath,
            reference: entryReference,
            message: `Sound entry '${entryReference}' must be a resource-location string or object.`,
            dedupeIdentity: entryIdentity,
          });
        }
        if (raw === null) {
          continue;
        }
        checkedReferences += 1;
        if (type === "file" && /\.ogg$/i.test(raw)) {
          const displayedRaw = diagnosticValue(raw);
          diagnostics.push({
            severity: "error",
            code: "invalid-sound-reference",
            path: file.normalizedPath,
            reference: raw,
            source: entryReference,
            message: `Sound file reference '${displayedRaw}' must omit the automatically appended '.ogg' extension.`,
            dedupeIdentity: entryIdentity,
          });
          continue;
        }
        const location = resourceLocation(raw);
        if (!location) {
          const displayedRaw = diagnosticValue(raw);
          diagnostics.push({
            severity: "error",
            code: "invalid-sound-reference",
            path: file.normalizedPath,
            reference: raw,
            source: entryReference,
            message: `Sound reference '${displayedRaw}' is not a valid resource location.`,
            dedupeIdentity: entryIdentity,
          });
          continue;
        }
        if (type === "file") {
          soundFileReferences += 1;
        } else {
          soundEventReferences += 1;
        }
        parsedEvent.references.push({
          sourceEventId: eventId,
          sourceNamespace: namespace,
          sourcePath: file.normalizedPath,
          sourceReference: entryReference,
          sourceIdentity: entryIdentity,
          raw,
          targetId: `${location.namespace}:${location.path}`,
          targetNamespace: location.namespace,
          targetPath: location.path,
          type,
          unqualified: !raw.includes(":"),
        });
      }
    }
    if (soundEventLimitReached) {
      break;
    }
  }

  const eventEdges = new Map<string, Set<string>>();
  for (const event of [...events.values()].sort((left, right) => left.id.localeCompare(right.id))) {
    for (const reference of event.references) {
      const ownerTargetId = `${reference.sourceNamespace}:${reference.targetPath}`;
      const displayedRaw = diagnosticValue(reference.raw);
      const displayedTargetId = diagnosticValue(reference.targetId);
      const displayedOwnerTargetId = diagnosticValue(ownerTargetId);
      if (reference.type === "file") {
        const target = `assets/${reference.targetNamespace}/sounds/${reference.targetPath}.ogg`;
        const ownerTarget = `assets/${reference.sourceNamespace}/sounds/${reference.targetPath}.ogg`;
        if (options.localPaths.has(target)) {
          continue;
        }
        if (
          reference.unqualified &&
          reference.sourceNamespace !== "minecraft" &&
          options.localPaths.has(ownerTarget)
        ) {
          diagnostics.push({
            severity: "error",
            code: "unqualified-local-sound-reference",
            path: reference.sourcePath,
            reference: reference.raw,
            source: reference.sourceReference,
            message: `Unqualified sound '${displayedRaw}' resolves to the minecraft namespace; use '${displayedOwnerTargetId}' for the matching local file.`,
            dedupeIdentity: reference.sourceIdentity,
          });
        } else if (
          reference.targetNamespace !== "minecraft" &&
          soundNamespaces.has(reference.targetNamespace)
        ) {
          diagnostics.push({
            severity: "error",
            code: "missing-sound-file",
            path: reference.sourcePath,
            reference: reference.targetId,
            source: reference.sourceReference,
            message: `Sound file '${diagnosticValue(target)}' was not found in the resource-pack project.`,
            dedupeIdentity: reference.sourceIdentity,
          });
        } else {
          soundValidationComplete = false;
          incompleteReasons.add("reference-unverified");
          diagnostics.push({
            severity: "warning",
            code: "unverified-external-sound-reference",
            path: reference.sourcePath,
            reference: reference.targetId,
            source: reference.sourceReference,
            message: `Sound file reference '${displayedTargetId}' could not be verified against local project files or bundled vanilla assets.`,
            dedupeIdentity: reference.sourceIdentity,
          });
        }
        continue;
      }

      if (events.has(reference.targetId)) {
        const targets = eventEdges.get(reference.sourceEventId) ?? new Set<string>();
        targets.add(reference.targetId);
        eventEdges.set(reference.sourceEventId, targets);
      } else if (
        reference.unqualified &&
        reference.sourceNamespace !== "minecraft" &&
        events.has(ownerTargetId)
      ) {
        diagnostics.push({
          severity: "error",
          code: "unqualified-local-sound-reference",
          path: reference.sourcePath,
          reference: reference.raw,
          source: reference.sourceReference,
          message: `Unqualified sound event '${displayedRaw}' resolves to the minecraft namespace; use '${displayedOwnerTargetId}' for the matching local event.`,
          dedupeIdentity: reference.sourceIdentity,
        });
      } else if (
        reference.targetNamespace !== "minecraft" &&
        soundNamespaces.has(reference.targetNamespace)
      ) {
        diagnostics.push({
          severity: "error",
          code: "missing-sound-event",
          path: reference.sourcePath,
          reference: reference.targetId,
          source: reference.sourceReference,
          message: `Referenced sound event '${displayedTargetId}' was not found in local sounds.json files.`,
          dedupeIdentity: reference.sourceIdentity,
        });
      } else {
        soundValidationComplete = false;
        incompleteReasons.add("reference-unverified");
        diagnostics.push({
          severity: "warning",
          code: "unverified-external-sound-reference",
          path: reference.sourcePath,
          reference: reference.targetId,
          source: reference.sourceReference,
          message: `Sound event reference '${displayedTargetId}' could not be verified against local sounds.json files or bundled vanilla assets.`,
          dedupeIdentity: reference.sourceIdentity,
        });
      }
    }
  }

  const boundedCycleReference = (cycle: readonly string[]): string => {
    let result = "";
    for (let index = 0; index <= cycle.length; index += 1) {
      const eventId = cycle[index % cycle.length] ?? "";
      const separator = index === 0 ? "" : " -> ";
      if (
        result.length + separator.length + eventId.length <=
        options.limits.maxDiagnosticTextLength
      ) {
        result += `${separator}${eventId}`;
        continue;
      }
      const omitted = cycle.length - index + 1;
      const suffix = ` -> … (${omitted} event${omitted === 1 ? "" : "s"} omitted)`;
      return `${result.slice(
        0,
        Math.max(0, options.limits.maxDiagnosticTextLength - suffix.length),
      )}${suffix}`;
    }
    return result;
  };
  type VisitFrame = { eventId: string; nextTarget: number; targets: string[] };
  const sortedEventEdges = new Map(
    [...events.keys()].map((eventId) => [eventId, [...(eventEdges.get(eventId) ?? [])].sort()]),
  );
  const reverseEdgeSets = new Map<string, Set<string>>();
  for (const [source, targets] of sortedEventEdges) {
    for (const target of targets) {
      const sources = reverseEdgeSets.get(target) ?? new Set<string>();
      sources.add(source);
      reverseEdgeSets.set(target, sources);
    }
  }
  const sortedReverseEdges = new Map(
    [...events.keys()].map((eventId) => [
      eventId,
      [...(reverseEdgeSets.get(eventId) ?? [])].sort(),
    ]),
  );
  const visitedEvents = new Set<string>();
  const finishOrder: string[] = [];
  for (const rootEventId of [...events.keys()].sort()) {
    if (visitedEvents.has(rootEventId)) {
      continue;
    }
    const frames: VisitFrame[] = [
      {
        eventId: rootEventId,
        nextTarget: 0,
        targets: sortedEventEdges.get(rootEventId) ?? [],
      },
    ];
    visitedEvents.add(rootEventId);

    while (frames.length > 0) {
      const frame = frames.at(-1);
      if (!frame) {
        break;
      }
      const target = frame.targets[frame.nextTarget];
      if (target === undefined) {
        finishOrder.push(frame.eventId);
        frames.pop();
        continue;
      }
      frame.nextTarget += 1;
      if (visitedEvents.has(target)) {
        continue;
      }
      visitedEvents.add(target);
      frames.push({
        eventId: target,
        nextTarget: 0,
        targets: sortedEventEdges.get(target) ?? [],
      });
    }
  }

  const assignedEvents = new Set<string>();
  let cyclicComponentCount = 0;
  for (let index = finishOrder.length - 1; index >= 0; index -= 1) {
    const rootEventId = finishOrder[index];
    if (!rootEventId || assignedEvents.has(rootEventId)) {
      continue;
    }
    const component: string[] = [];
    const pending = [rootEventId];
    assignedEvents.add(rootEventId);
    while (pending.length > 0) {
      const eventId = pending.pop();
      if (!eventId) {
        continue;
      }
      component.push(eventId);
      const sources = sortedReverseEdges.get(eventId) ?? [];
      for (let sourceIndex = sources.length - 1; sourceIndex >= 0; sourceIndex -= 1) {
        const source = sources[sourceIndex];
        if (source && !assignedEvents.has(source)) {
          assignedEvents.add(source);
          pending.push(source);
        }
      }
    }
    component.sort();
    const firstComponentEvent = component[0];
    const cyclic =
      component.length > 1 ||
      (firstComponentEvent !== undefined &&
        (sortedEventEdges.get(firstComponentEvent) ?? []).includes(firstComponentEvent));
    if (!cyclic || !firstComponentEvent) {
      continue;
    }
    const cycleIdentity = `sound-cycle:${cyclicComponentCount}`;
    cyclicComponentCount += 1;

    const componentEvents = new Set(component);
    const walk: string[] = [];
    const walkIndex = new Map<string, number>();
    let current = firstComponentEvent;
    while (!walkIndex.has(current)) {
      walkIndex.set(current, walk.length);
      walk.push(current);
      const next = (sortedEventEdges.get(current) ?? []).find((target) =>
        componentEvents.has(target),
      );
      if (!next) {
        break;
      }
      current = next;
    }
    const cycleStart = walkIndex.get(current);
    if (cycleStart === undefined) {
      continue;
    }
    const cycle = canonicalCycle(walk.slice(cycleStart));
    const first = cycle[0];
    const firstEvent = first ? events.get(first) : undefined;
    if (first && firstEvent) {
      const reference = boundedCycleReference(cycle);
      diagnostics.push({
        severity: "error",
        code: "sound-event-cycle",
        path: firstEvent.file.normalizedPath,
        reference,
        source: first,
        message: `Sound event references form a cyclic component; one cycle is: ${reference}.`,
        dedupeIdentity: cycleIdentity,
      });
    }
  }

  for (const file of soundFiles) {
    if (!(file.content instanceof Uint8Array)) {
      soundValidationComplete = false;
      incompleteReasons.add("sound-header-unavailable");
      diagnostics.push({
        severity: "warning",
        code: "sound-header-unavailable",
        path: file.normalizedPath,
        reference: null,
        message: `Provide the first ${vorbisIdentificationPageBytes} bytes to validate this Ogg/Vorbis sound header.`,
      });
      continue;
    }
    inspectedSoundFiles += 1;
    const inspected = inspectVorbisIdentificationPage(file.content);
    if (!inspected.valid) {
      diagnostics.push({
        severity: "error",
        code: inspected.code,
        path: file.normalizedPath,
        reference: null,
        message: inspected.message,
      });
    } else if (inspected.channels > 2) {
      diagnostics.push({
        severity: "error",
        code: "unsupported-sound-channel-count",
        path: file.normalizedPath,
        reference: String(inspected.channels),
        message:
          "Minecraft's OpenAL sound-buffer upload path supports only mono or stereo Vorbis audio.",
      });
    } else if (inspected.channels === 2) {
      diagnostics.push({
        severity: "warning",
        code: "multichannel-sound-no-attenuation",
        path: file.normalizedPath,
        reference: String(inspected.channels),
        message:
          "Multichannel resource-pack sounds do not attenuate positionally; use mono audio when positional playback is required.",
      });
    }
  }

  return {
    soundDefinitionFiles: definitionFiles.length,
    soundEvents: events.size,
    soundFileReferences,
    soundEventReferences,
    soundFiles: soundFiles.length,
    inspectedSoundFiles,
    soundValidationComplete,
    incompleteReasons: [...incompleteReasons].sort(),
    parsedJsonFiles,
    checkedReferences,
    exceededLimits: [...exceededLimits].sort(),
  };
}

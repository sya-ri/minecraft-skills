import { types as utilTypes } from "node:util";

/** A zero-based source rectangle expressed with width and height. */
export type PlayerSkinSourceRectangleInput = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Optional source rectangles a caller intends to use for a player face. */
export type PlayerSkinRequestedSourceRectangles = {
  base?: PlayerSkinSourceRectangleInput;
  hat?: PlayerSkinSourceRectangleInput;
};

/** Structured input for Java player-skin layout validation. */
export type PlayerSkinLayoutValidationInput = {
  width: number;
  height: number;
  sourceRects?: PlayerSkinRequestedSourceRectangles;
};

/** Non-configurable bounds applied to the closed structured input. */
export type PlayerSkinLayoutValidationLimits = {
  maxObjectDepth: 3;
  maxObjectNodes: 4;
  maxOwnPropertiesPerObject: 4;
  maxCoordinate: 16_384;
  maxDiagnostics: 16;
};

/** Fixed bounds for the small structured player-skin layout input. */
export const playerSkinLayoutValidationLimits: Readonly<PlayerSkinLayoutValidationLimits> =
  Object.freeze({
    maxObjectDepth: 3,
    maxObjectNodes: 4,
    maxOwnPropertiesPerObject: 4,
    maxCoordinate: 16_384,
    maxDiagnostics: 16,
  });

/** One retained validation error without echoing caller-supplied values or unknown property names. */
export type PlayerSkinLayoutDiagnostic = {
  severity: "error";
  code: string;
  field: string;
  message: string;
};

/** Canonical half-open rectangle including its derived exclusive endpoints. */
export type PlayerSkinCanonicalRectangle = PlayerSkinSourceRectangleInput & {
  xEndExclusive: number;
  yEndExclusive: number;
};

/** Bounded Java player-skin layout evidence and diagnostics. */
export type PlayerSkinLayoutValidationResult = {
  schemaVersion: 1;
  edition: "java";
  validationStrength: "layout";
  valid: boolean;
  inputAccepted: boolean;
  layoutStatus: "current" | "legacy" | "invalid" | "not-checked";
  sourceDimensions: { width: number; height: number } | null;
  acceptedSourceDimensions: Array<{ width: 64; height: 64 | 32; kind: "current" | "legacy" }>;
  normalizedDimensions: { width: 64; height: 64 } | null;
  normalization: "not-needed" | "client-converts-legacy-to-64x64" | "not-applicable";
  faceLayout: {
    textureDimensions: { width: 64; height: 64 };
    coordinateConvention: "zero-based-half-open";
    base: PlayerSkinCanonicalRectangle;
    hat: PlayerSkinCanonicalRectangle;
    compositionOrder: ["base", "hat"];
  };
  requestedSourceRectChecks: {
    base: "not-supplied" | "matches" | "mismatch" | "not-checked";
    hat: "not-supplied" | "matches" | "mismatch" | "not-checked";
  };
  modelEvidence: {
    headUvDependsOnModel: false;
    legacyServiceMetadata: { slim: "slim"; wide: "default" };
    missingOrUnknownMetadata: "wide";
    modelInferredFromPixels: false;
  };
  sourceEvidence: {
    minecraftVersion: "26.2";
    versionMetadataUrl: string;
    clientArtifactUrl: string;
    clientSha1: "2dc72797acbc1b63fc16a11c4ac393605f453754";
    classes: readonly [
      "net.minecraft.client.renderer.texture.SkinTextureDownloader",
      "net.minecraft.client.gui.components.PlayerFaceExtractor",
      "net.minecraft.client.resources.SkinManager",
      "net.minecraft.client.resources.SkinManager$TextureCache",
      "net.minecraft.world.entity.player.PlayerModelType",
    ];
  };
  errorCount: number;
  diagnosticTotal: number;
  retainedDiagnosticCount: number;
  omittedDiagnosticCount: number;
  diagnosticsTruncated: boolean;
  appliedLimits: PlayerSkinLayoutValidationLimits;
  diagnostics: PlayerSkinLayoutDiagnostic[];
  notes: string[];
  privacy: {
    acceptsPlayerIdentity: false;
    acceptsImagePixels: false;
    returnsFilesystemPaths: false;
  };
};

type DataProperties = Record<string, unknown>;

type DiagnosticCollector = {
  add: (code: string, field: string, message: string) => void;
  finish: () => {
    diagnostics: PlayerSkinLayoutDiagnostic[];
    diagnosticTotal: number;
    inputDiagnosticTotal: number;
  };
};

const canonicalBase = Object.freeze({
  x: 8,
  y: 8,
  width: 8,
  height: 8,
  xEndExclusive: 16,
  yEndExclusive: 16,
}) satisfies Readonly<PlayerSkinCanonicalRectangle>;

const canonicalHat = Object.freeze({
  x: 40,
  y: 8,
  width: 8,
  height: 8,
  xEndExclusive: 48,
  yEndExclusive: 16,
}) satisfies Readonly<PlayerSkinCanonicalRectangle>;

const knownClientClasses = Object.freeze([
  "net.minecraft.client.renderer.texture.SkinTextureDownloader",
  "net.minecraft.client.gui.components.PlayerFaceExtractor",
  "net.minecraft.client.resources.SkinManager",
  "net.minecraft.client.resources.SkinManager$TextureCache",
  "net.minecraft.world.entity.player.PlayerModelType",
] as const);

const knownClientSource = Object.freeze({
  minecraftVersion: "26.2",
  versionMetadataUrl:
    "https://piston-meta.mojang.com/v1/packages/c75d82e7fa6eca5a043dab0c6cf77cb8317644f4/26.2.json",
  clientArtifactUrl:
    "https://piston-data.mojang.com/v1/objects/2dc72797acbc1b63fc16a11c4ac393605f453754/client.jar",
  clientSha1: "2dc72797acbc1b63fc16a11c4ac393605f453754",
  classes: knownClientClasses,
}) satisfies Readonly<PlayerSkinLayoutValidationResult["sourceEvidence"]>;

function createDiagnosticCollector(maxDiagnostics: number): DiagnosticCollector {
  const diagnostics: PlayerSkinLayoutDiagnostic[] = [];
  let diagnosticTotal = 0;
  let inputDiagnosticTotal = 0;
  return {
    add: (code, field, message) => {
      diagnosticTotal += 1;
      if (code.startsWith("input.")) inputDiagnosticTotal += 1;
      if (diagnostics.length < maxDiagnostics) {
        diagnostics.push({ severity: "error", code, field, message });
      }
    },
    finish: () => ({ diagnostics, diagnosticTotal, inputDiagnosticTotal }),
  };
}

function readDataProperties(
  value: unknown,
  field: string,
  allowedKeys: ReadonlySet<string>,
  collector: DiagnosticCollector,
): DataProperties | null {
  if (typeof value !== "object" || value === null) {
    collector.add(
      "input.object-required",
      field,
      `${field} must be a plain object with enumerable data properties.`,
    );
    return null;
  }
  if (utilTypes.isProxy(value)) {
    collector.add("input.proxy-not-accepted", field, `${field} must not be a Proxy object.`);
    return null;
  }
  if (Array.isArray(value)) {
    collector.add(
      "input.object-required",
      field,
      `${field} must be a plain object with enumerable data properties.`,
    );
    return null;
  }

  let prototype: object | null;
  let ownKeys: Array<string | symbol>;
  let descriptors: PropertyDescriptorMap;
  try {
    prototype = Object.getPrototypeOf(value);
    ownKeys = Reflect.ownKeys(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    collector.add(
      "input.object-inspection-failed",
      field,
      `${field} could not be inspected without executing user code.`,
    );
    return null;
  }
  if (prototype !== Object.prototype && prototype !== null) {
    collector.add(
      "input.plain-object-required",
      field,
      `${field} must use Object.prototype or a null prototype.`,
    );
    return null;
  }
  if (playerSkinLayoutValidationLimits.maxOwnPropertiesPerObject < ownKeys.length) {
    collector.add(
      "input.property-limit-exceeded",
      field,
      `${field} exceeds the fixed own-property limit.`,
    );
    return null;
  }

  const result: DataProperties = Object.create(null) as DataProperties;
  for (const key of ownKeys) {
    if (typeof key !== "string") {
      collector.add(
        "input.symbol-property-not-accepted",
        field,
        `${field} must not contain symbol properties.`,
      );
      continue;
    }
    const descriptor = descriptors[key];
    if (!descriptor) {
      collector.add(
        "input.object-inspection-failed",
        field,
        `${field} changed while its properties were inspected.`,
      );
      continue;
    }
    const propertyField = allowedKeys.has(key) ? `${field}.${key}` : field;
    if (!descriptor.enumerable) {
      collector.add(
        "input.non-enumerable-property-not-accepted",
        propertyField,
        `${field} must not contain non-enumerable properties.`,
      );
      continue;
    }
    if (!("value" in descriptor)) {
      collector.add(
        "input.accessor-property-not-accepted",
        propertyField,
        `${field} must contain data properties only; accessors are not executed.`,
      );
      continue;
    }
    if (!allowedKeys.has(key)) {
      collector.add("input.unknown-property", field, `${field} contains an unsupported property.`);
      continue;
    }
    result[key] = descriptor.value;
  }
  return result;
}

function requiredBoundedInteger(
  properties: DataProperties,
  key: string,
  field: string,
  minimum: number,
  collector: DiagnosticCollector,
): number | null {
  if (!(key in properties)) {
    collector.add("input.required-property-missing", field, `${field} is required.`);
    return null;
  }
  const value = properties[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    collector.add("input.safe-integer-required", field, `${field} must be a safe integer.`);
    return null;
  }
  if (value < minimum || playerSkinLayoutValidationLimits.maxCoordinate < value) {
    collector.add(
      "input.integer-out-of-range",
      field,
      `${field} is outside the fixed safe coordinate range.`,
    );
    return null;
  }
  return value;
}

function readRectangle(
  value: unknown,
  field: string,
  collector: DiagnosticCollector,
): PlayerSkinSourceRectangleInput | null {
  const properties = readDataProperties(
    value,
    field,
    new Set(["x", "y", "width", "height"]),
    collector,
  );
  if (!properties) return null;
  const x = requiredBoundedInteger(properties, "x", `${field}.x`, 0, collector);
  const y = requiredBoundedInteger(properties, "y", `${field}.y`, 0, collector);
  const width = requiredBoundedInteger(properties, "width", `${field}.width`, 1, collector);
  const height = requiredBoundedInteger(properties, "height", `${field}.height`, 1, collector);
  return x === null || y === null || width === null || height === null
    ? null
    : { x, y, width, height };
}

function matchesRectangle(
  actual: PlayerSkinSourceRectangleInput,
  expected: PlayerSkinCanonicalRectangle,
): boolean {
  return (
    actual.x === expected.x &&
    actual.y === expected.y &&
    actual.width === expected.width &&
    actual.height === expected.height
  );
}

function rectangleCheck(
  key: "base" | "hat",
  sourceRects: DataProperties | null,
  expected: PlayerSkinCanonicalRectangle,
  collector: DiagnosticCollector,
): "not-supplied" | "matches" | "mismatch" | "not-checked" {
  if (!sourceRects) return "not-checked";
  if (!(key in sourceRects)) return "not-supplied";
  const rectangle = readRectangle(sourceRects[key], `input.sourceRects.${key}`, collector);
  if (!rectangle) return "not-checked";
  if (matchesRectangle(rectangle, expected)) return "matches";
  collector.add(
    `skin.face-${key}-rect-mismatch`,
    `input.sourceRects.${key}`,
    `The requested ${key} source rectangle does not match the canonical zero-based half-open player-skin face rectangle.`,
  );
  return "mismatch";
}

/**
 * Validates Java player-skin dimensions and optional face/hat source rectangles.
 *
 * This is a layout validator. It does not accept image bytes, decode pixels, or validate GUI output.
 */
export function validatePlayerSkinLayout(input: unknown): PlayerSkinLayoutValidationResult {
  const collector = createDiagnosticCollector(playerSkinLayoutValidationLimits.maxDiagnostics);
  const properties = readDataProperties(
    input,
    "input",
    new Set(["width", "height", "sourceRects"]),
    collector,
  );

  let width: number | null = null;
  let height: number | null = null;
  let sourceRects: DataProperties | null = Object.create(null) as DataProperties;
  if (properties) {
    width = requiredBoundedInteger(properties, "width", "input.width", 1, collector);
    height = requiredBoundedInteger(properties, "height", "input.height", 1, collector);
    if ("sourceRects" in properties) {
      sourceRects = readDataProperties(
        properties.sourceRects,
        "input.sourceRects",
        new Set(["base", "hat"]),
        collector,
      );
    }
  } else {
    sourceRects = null;
  }

  let layoutStatus: PlayerSkinLayoutValidationResult["layoutStatus"] = "not-checked";
  if (width !== null && height !== null) {
    if (width === 64 && height === 64) layoutStatus = "current";
    else if (width === 64 && height === 32) layoutStatus = "legacy";
    else {
      layoutStatus = "invalid";
      collector.add(
        "skin.unsupported-dimensions",
        "input",
        "Java player skins processed by the audited client must be 64x64 or legacy 64x32.",
      );
    }
  }

  const baseCheck = rectangleCheck("base", sourceRects, canonicalBase, collector);
  const hatCheck = rectangleCheck("hat", sourceRects, canonicalHat, collector);
  const summary = collector.finish();
  const inputAccepted = summary.inputDiagnosticTotal === 0;
  const sourceDimensions = width === null || height === null ? null : { width, height };
  const recognizedLayout = layoutStatus === "current" || layoutStatus === "legacy";
  return {
    schemaVersion: 1,
    edition: "java",
    validationStrength: "layout",
    valid: inputAccepted && recognizedLayout && summary.diagnosticTotal === 0,
    inputAccepted,
    layoutStatus,
    sourceDimensions,
    acceptedSourceDimensions: [
      { width: 64, height: 64, kind: "current" },
      { width: 64, height: 32, kind: "legacy" },
    ],
    normalizedDimensions: recognizedLayout ? { width: 64, height: 64 } : null,
    normalization:
      layoutStatus === "current"
        ? "not-needed"
        : layoutStatus === "legacy"
          ? "client-converts-legacy-to-64x64"
          : "not-applicable",
    faceLayout: {
      textureDimensions: { width: 64, height: 64 },
      coordinateConvention: "zero-based-half-open",
      base: { ...canonicalBase },
      hat: { ...canonicalHat },
      compositionOrder: ["base", "hat"],
    },
    requestedSourceRectChecks: { base: baseCheck, hat: hatCheck },
    modelEvidence: {
      headUvDependsOnModel: false,
      legacyServiceMetadata: { slim: "slim", wide: "default" },
      missingOrUnknownMetadata: "wide",
      modelInferredFromPixels: false,
    },
    sourceEvidence: {
      ...knownClientSource,
      classes: knownClientSource.classes,
    },
    errorCount: summary.diagnosticTotal,
    diagnosticTotal: summary.diagnosticTotal,
    retainedDiagnosticCount: summary.diagnostics.length,
    omittedDiagnosticCount: summary.diagnosticTotal - summary.diagnostics.length,
    diagnosticsTruncated: summary.diagnosticTotal > summary.diagnostics.length,
    appliedLimits: { ...playerSkinLayoutValidationLimits },
    diagnostics: summary.diagnostics,
    notes: [
      "Base and hat coordinates are zero-based half-open source rectangles from the audited Minecraft Java 26.2 PlayerFaceExtractor; the hat is composited after the base face.",
      "Legacy 64x32 skins are accepted because the audited SkinTextureDownloader promotes them to 64x64; this validator does not simulate or prove the copied pixel or alpha result.",
      "Slim versus wide is profile metadata used for the player model. It does not change these head UVs, and this validator does not infer a model from pixels.",
      "The closed input shape follows only input -> sourceRects -> base/hat, so the applied depth-three and four-object-node limits are structural rather than caller-configurable traversal limits.",
      "Image bytes, PNG structure, IDAT decoding, pixel alpha, skin signatures, URLs, player identity, network retrieval, display scaling, texture filtering, blending, GUI clipping, and scissor state are not checked.",
    ],
    privacy: {
      acceptsPlayerIdentity: false,
      acceptsImagePixels: false,
      returnsFilesystemPaths: false,
    },
  };
}

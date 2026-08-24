import { types as nodeTypes } from "node:util";
import { inflateSync } from "node:zlib";
import {
  defaultResourcepackPngValidationLimits,
  inspectResourcepackPng,
  type ResourcepackPngValidationLimits,
  type ResourcepackPngValidationResult,
  resolveResourcepackPngValidationLimits,
} from "./resourcepackPng.js";

/** Resource limits for static PNG alpha inspection. Callers may only lower these defaults. */
export type ResourcepackPngAlphaBoundsLimits = ResourcepackPngValidationLimits & {
  /** Maximum exact filtered-image byte count accepted before zlib inflation. */
  maxInflatedBytes: number;
};

/** Limits used when callers do not provide lower values. */
export const defaultResourcepackPngAlphaBoundsLimits: Readonly<ResourcepackPngAlphaBoundsLimits> =
  Object.freeze({
    ...defaultResourcepackPngValidationLimits,
    maxInflatedBytes: 64 * 1_024 * 1_024,
  });

/** Optional caller policy evaluated after complete static-alpha inspection. */
export type ResourcepackPngAlphaBoundsRequirements = {
  /** Caller policy: require at least one pixel whose alpha sample is nonzero. */
  nonEmpty?: boolean;
  /** Caller policy: require this many fully transparent pixels on every content-box side. */
  minimumTransparentMarginPixels?: number;
};

/** Caller policy and lower-only resource limits for alpha inspection. */
export type ResourcepackPngAlphaBoundsOptions = {
  requirements?: ResourcepackPngAlphaBoundsRequirements;
  limits?: Partial<ResourcepackPngAlphaBoundsLimits>;
};

/** Bounded alpha-inspection diagnostic separate from nested structural PNG diagnostics. */
export type ResourcepackPngAlphaBoundsDiagnostic = {
  severity: "error" | "warning";
  code: string;
  message: string;
};

/** Zero-based half-open rectangle containing every pixel whose decoded alpha is nonzero. */
export type ResourcepackPngContentBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  xEndExclusive: number;
  yEndExclusive: number;
};

/** Transparent distance from a nonempty content box to each static-image edge. */
export type ResourcepackPngTransparentMargins = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  minimum: number;
};

/** PNG mechanism from which decoded alpha facts were derived. */
export type ResourcepackPngAlphaTransparencySource =
  | "alpha-channel"
  | "trns-palette"
  | "trns-color-key"
  | "implicit-opaque";

/** Completion state for pixel inspection, independent of nested structural validation. */
export type ResourcepackPngAlphaInspectionStatus = "complete" | "invalid" | "indeterminate";

/** Stable reason explaining why pixel inspection was not complete. */
export type ResourcepackPngAlphaInspectionReason =
  | "png-structure-invalid"
  | "expected-byte-count-overflow"
  | "inflated-byte-limit-exceeded"
  | "zlib-decompression-failed"
  | "compressed-byte-consumption-unavailable"
  | "inflated-byte-length-mismatch"
  | "invalid-filter-type"
  | "palette-index-out-of-range"
  | "pixel-count-mismatch";

/** Caller-policy failure produced only after complete pixel inspection. */
export type ResourcepackPngAlphaRequirementFailure = "content-empty" | "minimum-transparent-margin";

/** Resolved caller policy and its evaluation state. */
export type ResourcepackPngAlphaRequirementsResult = {
  inputValid: boolean;
  nonEmpty: boolean;
  minimumTransparentMarginPixels: number | null;
  status: "met" | "not-met" | "not-requested" | "not-checked";
  failures: ResourcepackPngAlphaRequirementFailure[];
};

/** Bounded result for the static image represented by PNG IDAT chunks. */
export type ResourcepackPngAlphaBoundsResult = {
  schemaVersion: 1;
  specification: "PNG";
  specificationUrl: "https://www.w3.org/TR/png-3/";
  inspectionStrength: "static-alpha";
  png: ResourcepackPngValidationResult;
  pixelInspectionStatus: ResourcepackPngAlphaInspectionStatus;
  pixelInspectionComplete: boolean;
  pixelDataValid: boolean | null;
  pixelInspectionReason: ResourcepackPngAlphaInspectionReason | null;
  transparencySource: ResourcepackPngAlphaTransparencySource | null;
  totalPixels: number | null;
  transparentPixelCount: number | null;
  partiallyTransparentPixelCount: number | null;
  fullyOpaquePixelCount: number | null;
  nonzeroAlphaPixelCount: number | null;
  content: "empty" | "nonempty" | null;
  contentBounds: ResourcepackPngContentBounds | null;
  transparentMargins: ResourcepackPngTransparentMargins | null;
  compressedBytes: number | null;
  consumedCompressedBytes: number | null;
  trailingCompressedBytes: number | null;
  expectedInflatedBytes: number | null;
  inflatedBytes: number | null;
  requirements: ResourcepackPngAlphaRequirementsResult;
  appliedLimits: ResourcepackPngAlphaBoundsLimits;
  exceededLimits: Array<keyof ResourcepackPngAlphaBoundsLimits>;
  diagnosticTotal: number;
  retainedDiagnosticCount: number;
  omittedDiagnosticCount: number;
  diagnosticsTruncated: boolean;
  diagnostics: ResourcepackPngAlphaBoundsDiagnostic[];
  notes: string[];
};

type Pass = {
  xStart: number;
  yStart: number;
  xStep: number;
  yStep: number;
  width: number;
  height: number;
};

type PixelSummary = {
  transparentPixelCount: number;
  partiallyTransparentPixelCount: number;
  fullyOpaquePixelCount: number;
  nonzeroAlphaPixelCount: number;
  contentBounds: ResourcepackPngContentBounds | null;
  transparentMargins: ResourcepackPngTransparentMargins | null;
};

type InflateInfo = {
  buffer: Buffer;
  engine: {
    bytesWritten: number;
  };
};

type PreflightResult = {
  options: ResourcepackPngAlphaBoundsOptions;
  requirementsInputValid: boolean;
  diagnostics: ResourcepackPngAlphaBoundsDiagnostic[];
};

type ByteSnapshot =
  | { status: "ready"; bytes: Uint8Array; inputBytes: number }
  | { status: "limit-exceeded"; inputBytes: number }
  | { status: "invalid"; inputBytes: 0; message: string };

const maximumMinimumTransparentMarginPixels = 16_384;
const adam7Geometry = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2],
] as const;
const optionKeys = new Set(["limits", "requirements"]);
const limitKeys = new Set<keyof ResourcepackPngAlphaBoundsLimits>([
  "maxInputBytes",
  "maxWidth",
  "maxHeight",
  "maxPixels",
  "maxChunks",
  "maxDiagnostics",
  "maxInflatedBytes",
]);
const requirementKeys = new Set<keyof ResourcepackPngAlphaBoundsRequirements>([
  "nonEmpty",
  "minimumTransparentMarginPixels",
]);
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype) as object;
const typedArrayByteLength = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  "byteLength",
)?.get;
const typedArrayByteOffset = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  "byteOffset",
)?.get;
const typedArrayBuffer = Object.getOwnPropertyDescriptor(typedArrayPrototype, "buffer")?.get;

class PixelDataError extends Error {
  constructor(
    readonly reason: Extract<
      ResourcepackPngAlphaInspectionReason,
      "invalid-filter-type" | "palette-index-out-of-range" | "pixel-count-mismatch"
    >,
    message: string,
  ) {
    super(message);
  }
}

function normalizeLimit(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) && 0 < value
    ? Math.min(value, fallback)
    : fallback;
}

function readDataRecord(
  value: unknown,
  keys: ReadonlySet<string>,
  label: string,
  diagnostics: ResourcepackPngAlphaBoundsDiagnostic[],
): Record<string, unknown> | null {
  if (value === undefined) {
    return {};
  }
  if (typeof value !== "object" || value === null || nodeTypes.isProxy(value)) {
    diagnostics.push({
      severity: "error",
      code: `png-alpha.invalid-${label}-object`,
      message: `${label} must be a non-proxy plain data object when provided.`,
    });
    return null;
  }
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      diagnostics.push({
        severity: "error",
        code: `png-alpha.invalid-${label}-object`,
        message: `${label} must be a plain data object when provided.`,
      });
      return null;
    }
    const ownKeys = Reflect.ownKeys(value);
    if (
      keys.size < ownKeys.length ||
      ownKeys.some((key) => typeof key !== "string" || !keys.has(key))
    ) {
      diagnostics.push({
        severity: "error",
        code: `png-alpha.invalid-${label}-property`,
        message: `${label} contains an unknown or symbol property; only documented string data properties are accepted.`,
      });
      return null;
    }
    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of ownKeys) {
      if (typeof key !== "string") {
        continue;
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !("value" in descriptor)) {
        diagnostics.push({
          severity: "error",
          code: `png-alpha.invalid-${label}-property`,
          message: `${label} properties must be enumerable own data properties; accessors are not read.`,
        });
        return null;
      }
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    diagnostics.push({
      severity: "error",
      code: `png-alpha.invalid-${label}-object`,
      message: `${label} could not be inspected safely as a plain data object.`,
    });
    return null;
  }
}

function preflightOptions(value: unknown): PreflightResult {
  const diagnostics: ResourcepackPngAlphaBoundsDiagnostic[] = [];
  const optionsRecord = readDataRecord(value, optionKeys, "options", diagnostics);
  if (optionsRecord === null) {
    return { options: {}, requirementsInputValid: false, diagnostics };
  }
  const limitsRecord = readDataRecord(optionsRecord.limits, limitKeys, "limits", diagnostics);
  const requirementsRecord = readDataRecord(
    optionsRecord.requirements,
    requirementKeys,
    "requirements",
    diagnostics,
  );
  return {
    options: {
      ...(limitsRecord === null
        ? {}
        : { limits: limitsRecord as Partial<ResourcepackPngAlphaBoundsLimits> }),
      ...(requirementsRecord === null
        ? {}
        : { requirements: requirementsRecord as ResourcepackPngAlphaBoundsRequirements }),
    },
    requirementsInputValid: requirementsRecord !== null,
    diagnostics,
  };
}

function snapshotBytes(value: unknown, maxInputBytes: number): ByteSnapshot {
  if (
    typeof value !== "object" ||
    value === null ||
    nodeTypes.isProxy(value) ||
    !ArrayBuffer.isView(value)
  ) {
    return {
      status: "invalid",
      inputBytes: 0,
      message: "bytes must be a non-proxy Uint8Array or Buffer instance.",
    };
  }
  try {
    if (!(value instanceof Uint8Array)) {
      return {
        status: "invalid",
        inputBytes: 0,
        message: "bytes must be a Uint8Array or Buffer instance, not another array-buffer view.",
      };
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Uint8Array.prototype && prototype !== Buffer.prototype) {
      return {
        status: "invalid",
        inputBytes: 0,
        message: "bytes must be a direct Uint8Array or Buffer instance, not a subclass.",
      };
    }
    if (!typedArrayByteLength || !typedArrayByteOffset || !typedArrayBuffer) {
      return {
        status: "invalid",
        inputBytes: 0,
        message: "The runtime does not expose the standard Uint8Array intrinsic accessors.",
      };
    }
    const byteLength = typedArrayByteLength.call(value) as unknown;
    if (!Number.isSafeInteger(byteLength) || typeof byteLength !== "number" || byteLength < 0) {
      return {
        status: "invalid",
        inputBytes: 0,
        message: "bytes does not expose a safe Uint8Array byte length.",
      };
    }
    if (maxInputBytes < byteLength) {
      return { status: "limit-exceeded", inputBytes: byteLength };
    }
    const byteOffset = typedArrayByteOffset.call(value) as unknown;
    const buffer = typedArrayBuffer.call(value) as unknown;
    if (
      !Number.isSafeInteger(byteOffset) ||
      typeof byteOffset !== "number" ||
      byteOffset < 0 ||
      (!(buffer instanceof ArrayBuffer) && !(buffer instanceof SharedArrayBuffer))
    ) {
      return {
        status: "invalid",
        inputBytes: 0,
        message: "bytes does not expose a stable Uint8Array backing range.",
      };
    }
    const view = new Uint8Array(buffer, byteOffset, byteLength);
    return {
      status: "ready",
      bytes: Uint8Array.prototype.slice.call(view) as Uint8Array,
      inputBytes: byteLength,
    };
  } catch {
    return {
      status: "invalid",
      inputBytes: 0,
      message: "bytes could not be copied into a stable bounded Uint8Array snapshot.",
    };
  }
}

function unavailablePngResult(
  limits: ResourcepackPngValidationLimits,
  inputBytes: number,
  code: string,
  message: string,
  exceededLimits: Array<keyof ResourcepackPngValidationLimits> = [],
): ResourcepackPngValidationResult {
  return {
    schemaVersion: 1,
    specification: "PNG",
    specificationUrl: "https://www.w3.org/TR/png-3/",
    validationStrength: "structure",
    valid: false,
    validationComplete: false,
    inputBytes,
    scannedBytes: 0,
    width: null,
    height: null,
    bitDepth: null,
    colorType: null,
    compressionMethod: null,
    filterMethod: null,
    interlaceMethod: null,
    chunkCount: 0,
    idatChunkCount: 0,
    crcCheckedChunkCount: 0,
    errorCount: 1,
    warningCount: 0,
    diagnosticTotal: 1,
    retainedDiagnosticCount: 1,
    omittedDiagnosticCount: 0,
    diagnosticsTruncated: false,
    appliedLimits: limits,
    exceededLimits,
    diagnostics: [{ severity: "error", code, offset: 0, chunkType: null, message }],
    notes: [
      "Structural PNG validation was not attempted because the byte input failed bounded preflight.",
      "IDAT payloads and pixels were not inspected.",
    ],
  };
}

/** Resolves caller limits without allowing them to exceed the conservative defaults. */
export function resolveResourcepackPngAlphaBoundsLimits(
  limits: Partial<ResourcepackPngAlphaBoundsLimits> | undefined,
): ResourcepackPngAlphaBoundsLimits {
  const safeLimits = readDataRecord(
    limits,
    limitKeys,
    "limits",
    [],
  ) as Partial<ResourcepackPngAlphaBoundsLimits> | null;
  const values = safeLimits ?? {};
  return {
    ...resolveResourcepackPngValidationLimits(values),
    maxInflatedBytes: normalizeLimit(
      values.maxInflatedBytes,
      defaultResourcepackPngAlphaBoundsLimits.maxInflatedBytes,
    ),
  };
}

function checkedAdd(left: number, right: number): number | null {
  return Number.isSafeInteger(left) &&
    Number.isSafeInteger(right) &&
    left <= Number.MAX_SAFE_INTEGER - right
    ? left + right
    : null;
}

function checkedMultiply(left: number, right: number): number | null {
  if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right) || left < 0 || right < 0) {
    return null;
  }
  if (left !== 0 && Math.floor(Number.MAX_SAFE_INTEGER / left) < right) {
    return null;
  }
  return left * right;
}

function passSize(fullSize: number, start: number, step: number): number {
  return fullSize <= start ? 0 : Math.floor((fullSize - start + step - 1) / step);
}

function passes(width: number, height: number, interlaceMethod: number): Pass[] {
  if (interlaceMethod === 0) {
    return [{ xStart: 0, yStart: 0, xStep: 1, yStep: 1, width, height }];
  }
  return adam7Geometry.map(([xStart, yStart, xStep, yStep]) => ({
    xStart,
    yStart,
    xStep,
    yStep,
    width: passSize(width, xStart, xStep),
    height: passSize(height, yStart, yStep),
  }));
}

function channelCount(colorType: number): number {
  if (colorType === 0 || colorType === 3) {
    return 1;
  }
  if (colorType === 2) {
    return 3;
  }
  if (colorType === 4) {
    return 2;
  }
  return 4;
}

function expectedFilteredByteCount(imagePasses: Pass[], bitsPerPixel: number): number | null {
  let total = 0;
  for (const pass of imagePasses) {
    if (pass.width === 0 || pass.height === 0) {
      continue;
    }
    const rowBits = checkedMultiply(pass.width, bitsPerPixel);
    if (rowBits === null) {
      return null;
    }
    const roundedRowBits = checkedAdd(rowBits, 7);
    if (roundedRowBits === null) {
      return null;
    }
    const rowBytes = Math.floor(roundedRowBits / 8);
    const filteredRowBytes = checkedAdd(rowBytes, 1);
    if (filteredRowBytes === null) {
      return null;
    }
    const passBytes = checkedMultiply(filteredRowBytes, pass.height);
    if (passBytes === null) {
      return null;
    }
    const nextTotal = checkedAdd(total, passBytes);
    if (nextTotal === null) {
      return null;
    }
    total = nextTotal;
  }
  return total;
}

function paethPredictor(left: number, above: number, upperLeft: number): number {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) {
    return left;
  }
  return aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function unfilterRow(
  encoded: Uint8Array,
  previous: Uint8Array,
  filterType: number,
  bytesPerPixel: number,
): Uint8Array {
  const row = new Uint8Array(encoded.byteLength);
  for (let index = 0; index < encoded.byteLength; index += 1) {
    const left = index < bytesPerPixel ? 0 : (row[index - bytesPerPixel] ?? 0);
    const above = previous[index] ?? 0;
    const upperLeft = index < bytesPerPixel ? 0 : (previous[index - bytesPerPixel] ?? 0);
    let predictor = 0;
    if (filterType === 1) {
      predictor = left;
    } else if (filterType === 2) {
      predictor = above;
    } else if (filterType === 3) {
      predictor = Math.floor((left + above) / 2);
    } else if (filterType === 4) {
      predictor = paethPredictor(left, above, upperLeft);
    }
    row[index] = ((encoded[index] ?? 0) + predictor) & 0xff;
  }
  return row;
}

function sampleAt(
  row: Uint8Array,
  pixelIndex: number,
  channelIndex: number,
  channels: number,
  bitDepth: number,
): number {
  const sampleIndex = pixelIndex * channels + channelIndex;
  if (bitDepth < 8) {
    const bitOffset = sampleIndex * bitDepth;
    const shift = 8 - bitDepth - (bitOffset % 8);
    return ((row[Math.floor(bitOffset / 8)] ?? 0) >>> shift) & (2 ** bitDepth - 1);
  }
  if (bitDepth === 8) {
    return row[sampleIndex] ?? 0;
  }
  const byteOffset = sampleIndex * 2;
  return ((row[byteOffset] ?? 0) << 8) | (row[byteOffset + 1] ?? 0);
}

function readTwoByteSample(bytes: Uint8Array, offset: number, bitDepth: number): number {
  const value = ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
  return value & (bitDepth === 16 ? 0xffff : 2 ** bitDepth - 1);
}

function alphaForPixel(
  row: Uint8Array,
  pixelIndex: number,
  channels: number,
  bitDepth: number,
  colorType: number,
  paletteEntryCount: number,
  transparency: Uint8Array | null,
): { alpha: number; maximum: number } {
  if (colorType === 4 || colorType === 6) {
    return {
      alpha: sampleAt(row, pixelIndex, colorType === 4 ? 1 : 3, channels, bitDepth),
      maximum: bitDepth === 16 ? 0xffff : 0xff,
    };
  }
  if (colorType === 3) {
    const paletteIndex = sampleAt(row, pixelIndex, 0, channels, bitDepth);
    if (paletteEntryCount <= paletteIndex) {
      throw new PixelDataError(
        "palette-index-out-of-range",
        "Indexed pixel data references an entry beyond the validated PLTE chunk.",
      );
    }
    return { alpha: transparency?.[paletteIndex] ?? 0xff, maximum: 0xff };
  }
  if (transparency) {
    if (colorType === 0) {
      const sample = sampleAt(row, pixelIndex, 0, channels, bitDepth);
      return {
        alpha: sample === readTwoByteSample(transparency, 0, bitDepth) ? 0 : 1,
        maximum: 1,
      };
    }
    const red = sampleAt(row, pixelIndex, 0, channels, bitDepth);
    const green = sampleAt(row, pixelIndex, 1, channels, bitDepth);
    const blue = sampleAt(row, pixelIndex, 2, channels, bitDepth);
    const transparent =
      red === readTwoByteSample(transparency, 0, bitDepth) &&
      green === readTwoByteSample(transparency, 2, bitDepth) &&
      blue === readTwoByteSample(transparency, 4, bitDepth);
    return { alpha: transparent ? 0 : 1, maximum: 1 };
  }
  return { alpha: 1, maximum: 1 };
}

function scanPixels(
  inflated: Uint8Array,
  width: number,
  height: number,
  bitDepth: number,
  colorType: number,
  imagePasses: Pass[],
  paletteEntryCount: number,
  transparency: Uint8Array | null,
): PixelSummary {
  const channels = channelCount(colorType);
  const bitsPerPixel = channels * bitDepth;
  const bytesPerPixel = Math.max(1, Math.ceil(bitsPerPixel / 8));
  let inflatedOffset = 0;
  let scannedPixels = 0;
  let transparentPixelCount = 0;
  let partiallyTransparentPixelCount = 0;
  let fullyOpaquePixelCount = 0;
  let nonzeroAlphaPixelCount = 0;
  let minimumX = width;
  let minimumY = height;
  let maximumX = -1;
  let maximumY = -1;

  for (const pass of imagePasses) {
    if (pass.width === 0 || pass.height === 0) {
      continue;
    }
    const rowBytes = Math.ceil((pass.width * bitsPerPixel) / 8);
    let previous: Uint8Array = new Uint8Array(rowBytes);
    for (let passY = 0; passY < pass.height; passY += 1) {
      const filterType = inflated[inflatedOffset] ?? -1;
      inflatedOffset += 1;
      if (filterType < 0 || 4 < filterType) {
        throw new PixelDataError(
          "invalid-filter-type",
          "Filtered PNG image data contains a row filter outside the defined 0-4 range.",
        );
      }
      const encoded = inflated.subarray(inflatedOffset, inflatedOffset + rowBytes);
      inflatedOffset += rowBytes;
      const row = unfilterRow(encoded, previous, filterType, bytesPerPixel);
      for (let passX = 0; passX < pass.width; passX += 1) {
        const { alpha, maximum } = alphaForPixel(
          row,
          passX,
          channels,
          bitDepth,
          colorType,
          paletteEntryCount,
          transparency,
        );
        const x = pass.xStart + passX * pass.xStep;
        const y = pass.yStart + passY * pass.yStep;
        scannedPixels += 1;
        if (alpha === 0) {
          transparentPixelCount += 1;
        } else {
          nonzeroAlphaPixelCount += 1;
          minimumX = Math.min(minimumX, x);
          minimumY = Math.min(minimumY, y);
          maximumX = Math.max(maximumX, x);
          maximumY = Math.max(maximumY, y);
          if (alpha === maximum) {
            fullyOpaquePixelCount += 1;
          } else {
            partiallyTransparentPixelCount += 1;
          }
        }
      }
      previous = row;
    }
  }

  if (scannedPixels !== width * height) {
    throw new PixelDataError(
      "pixel-count-mismatch",
      "Decoded pass geometry did not cover every static-image pixel exactly once.",
    );
  }
  if (nonzeroAlphaPixelCount === 0) {
    return {
      transparentPixelCount,
      partiallyTransparentPixelCount,
      fullyOpaquePixelCount,
      nonzeroAlphaPixelCount,
      contentBounds: null,
      transparentMargins: null,
    };
  }
  const xEndExclusive = maximumX + 1;
  const yEndExclusive = maximumY + 1;
  const contentBounds = {
    x: minimumX,
    y: minimumY,
    width: xEndExclusive - minimumX,
    height: yEndExclusive - minimumY,
    xEndExclusive,
    yEndExclusive,
  };
  const top = minimumY;
  const right = width - xEndExclusive;
  const bottom = height - yEndExclusive;
  const left = minimumX;
  return {
    transparentPixelCount,
    partiallyTransparentPixelCount,
    fullyOpaquePixelCount,
    nonzeroAlphaPixelCount,
    contentBounds,
    transparentMargins: { top, right, bottom, left, minimum: Math.min(top, right, bottom, left) },
  };
}

function transparencySource(
  colorType: number,
  transparency: Uint8Array | null,
): ResourcepackPngAlphaTransparencySource {
  if (colorType === 4 || colorType === 6) {
    return "alpha-channel";
  }
  if (transparency) {
    return colorType === 3 ? "trns-palette" : "trns-color-key";
  }
  return "implicit-opaque";
}

function resolveRequirements(
  value: ResourcepackPngAlphaBoundsRequirements | undefined,
  preflightInputValid: boolean,
  addDiagnostic: (diagnostic: ResourcepackPngAlphaBoundsDiagnostic) => void,
): Pick<
  ResourcepackPngAlphaRequirementsResult,
  "inputValid" | "nonEmpty" | "minimumTransparentMarginPixels"
> {
  let inputValid = preflightInputValid;
  const nonEmpty = value?.nonEmpty === true;
  if (value?.nonEmpty !== undefined && typeof value.nonEmpty !== "boolean") {
    inputValid = false;
    addDiagnostic({
      severity: "error",
      code: "png-alpha.invalid-non-empty-requirement",
      message: "The nonEmpty caller requirement must be boolean when provided.",
    });
  }
  const requestedMargin = value?.minimumTransparentMarginPixels;
  let minimumTransparentMarginPixels: number | null = null;
  if (requestedMargin !== undefined) {
    if (
      !Number.isSafeInteger(requestedMargin) ||
      requestedMargin < 0 ||
      maximumMinimumTransparentMarginPixels < requestedMargin
    ) {
      inputValid = false;
      addDiagnostic({
        severity: "error",
        code: "png-alpha.invalid-minimum-transparent-margin",
        message: `minimumTransparentMarginPixels must be an integer from 0 to ${maximumMinimumTransparentMarginPixels}.`,
      });
    } else {
      minimumTransparentMarginPixels = requestedMargin;
    }
  }
  return { inputValid, nonEmpty, minimumTransparentMarginPixels };
}

function evaluateRequirements(
  resolved: Pick<
    ResourcepackPngAlphaRequirementsResult,
    "inputValid" | "nonEmpty" | "minimumTransparentMarginPixels"
  >,
  pixelInspectionComplete: boolean,
  content: "empty" | "nonempty" | null,
  margins: ResourcepackPngTransparentMargins | null,
): ResourcepackPngAlphaRequirementsResult {
  const requested = resolved.nonEmpty || resolved.minimumTransparentMarginPixels !== null;
  if (!requested) {
    return {
      ...resolved,
      status: resolved.inputValid ? "not-requested" : "not-checked",
      failures: [],
    };
  }
  if (!resolved.inputValid || !pixelInspectionComplete || content === null) {
    return { ...resolved, status: "not-checked", failures: [] };
  }
  const failures = new Set<ResourcepackPngAlphaRequirementFailure>();
  if (resolved.nonEmpty && content === "empty") {
    failures.add("content-empty");
  }
  if (resolved.minimumTransparentMarginPixels !== null) {
    if (content === "empty" || margins === null) {
      failures.add("content-empty");
    } else if (margins.minimum < resolved.minimumTransparentMarginPixels) {
      failures.add("minimum-transparent-margin");
    }
  }
  return {
    ...resolved,
    status: failures.size === 0 ? "met" : "not-met",
    failures: [...failures],
  };
}

/**
 * Inspects static PNG alpha samples without changing or cropping the input.
 *
 * Content is defined exactly as alpha != 0. Bounds are zero-based and half-open.
 */
export function inspectResourcepackPngAlphaBounds(
  bytes: Uint8Array,
  options: ResourcepackPngAlphaBoundsOptions = {},
): ResourcepackPngAlphaBoundsResult {
  const preflight = preflightOptions(options);
  const limits = resolveResourcepackPngAlphaBoundsLimits(preflight.options.limits);
  const diagnostics: ResourcepackPngAlphaBoundsDiagnostic[] = [];
  let diagnosticTotal = 0;
  const addDiagnostic = (diagnostic: ResourcepackPngAlphaBoundsDiagnostic): void => {
    diagnosticTotal += 1;
    if (diagnostics.length < limits.maxDiagnostics) {
      diagnostics.push(diagnostic);
    }
  };
  for (const diagnostic of preflight.diagnostics) {
    addDiagnostic(diagnostic);
  }
  const resolvedRequirements = resolveRequirements(
    preflight.options.requirements,
    preflight.requirementsInputValid,
    addDiagnostic,
  );
  const observed = {
    idatParts: [] as Uint8Array[],
    paletteEntryCount: 0,
    transparency: null as Uint8Array | null,
  };
  const snapshot = snapshotBytes(bytes, limits.maxInputBytes);
  const pngLimits = resolveResourcepackPngValidationLimits(limits);
  let png: ResourcepackPngValidationResult;
  if (snapshot.status === "ready") {
    png = inspectResourcepackPng(snapshot.bytes, {
      limits,
      onChunk: (chunk) => {
        if (chunk.type === "IDAT") {
          observed.idatParts.push(chunk.data);
        } else if (chunk.type === "PLTE" && observed.paletteEntryCount === 0) {
          observed.paletteEntryCount = chunk.data.byteLength / 3;
        } else if (chunk.type === "tRNS" && observed.transparency === null) {
          observed.transparency = chunk.data;
        }
      },
    });
  } else if (snapshot.status === "limit-exceeded") {
    png = unavailablePngResult(
      pngLimits,
      snapshot.inputBytes,
      "png.input-byte-limit-exceeded",
      `PNG input contains at least ${snapshot.inputBytes} bytes, exceeding the applied ${limits.maxInputBytes}-byte limit; validation did not scan the datastream.`,
      ["maxInputBytes"],
    );
  } else {
    png = unavailablePngResult(
      pngLimits,
      snapshot.inputBytes,
      "png.invalid-byte-input",
      snapshot.message,
    );
    addDiagnostic({
      severity: "error",
      code: "png-alpha.invalid-byte-input",
      message: snapshot.message,
    });
  }

  let pixelInspectionStatus: ResourcepackPngAlphaInspectionStatus = "indeterminate";
  let pixelInspectionReason: ResourcepackPngAlphaInspectionReason | null = "png-structure-invalid";
  let source: ResourcepackPngAlphaTransparencySource | null = null;
  let totalPixels: number | null = null;
  let summary: PixelSummary | null = null;
  let compressedBytes: number | null = null;
  let consumedCompressedBytes: number | null = null;
  let trailingCompressedBytes: number | null = null;
  let expectedInflatedBytes: number | null = null;
  let inflatedBytes: number | null = null;
  const exceededLimits = new Set<keyof ResourcepackPngAlphaBoundsLimits>(png.exceededLimits);

  if (
    png.valid &&
    png.width !== null &&
    png.height !== null &&
    png.bitDepth !== null &&
    png.colorType !== null &&
    png.interlaceMethod !== null
  ) {
    const width = png.width;
    const height = png.height;
    const bitDepth = png.bitDepth;
    const colorType = png.colorType;
    const imagePasses = passes(width, height, png.interlaceMethod);
    const bitsPerPixel = channelCount(colorType) * bitDepth;
    totalPixels = width * height;
    source = transparencySource(colorType, observed.transparency);
    expectedInflatedBytes = expectedFilteredByteCount(imagePasses, bitsPerPixel);
    compressedBytes = observed.idatParts.reduce((total, part) => total + part.byteLength, 0);

    if (expectedInflatedBytes === null) {
      pixelInspectionReason = "expected-byte-count-overflow";
      addDiagnostic({
        severity: "warning",
        code: "png-alpha.expected-byte-count-overflow",
        message:
          "The expected filtered-image byte count is not a safe integer, so pixel inspection was not attempted.",
      });
    } else if (limits.maxInflatedBytes < expectedInflatedBytes) {
      exceededLimits.add("maxInflatedBytes");
      pixelInspectionReason = "inflated-byte-limit-exceeded";
      addDiagnostic({
        severity: "warning",
        code: "png-alpha.inflated-byte-limit-exceeded",
        message: `The static image requires ${expectedInflatedBytes} filtered bytes, exceeding the applied ${limits.maxInflatedBytes}-byte inspection limit.`,
      });
    } else {
      const compressed = Buffer.concat(
        observed.idatParts.map((part) =>
          Buffer.from(part.buffer, part.byteOffset, part.byteLength),
        ),
        compressedBytes,
      );
      try {
        const inflated = inflateSync(compressed, {
          info: true,
          maxOutputLength: expectedInflatedBytes,
        }) as unknown as InflateInfo;
        inflatedBytes = inflated.buffer.byteLength;
        const consumed = inflated.engine.bytesWritten;
        if (!Number.isSafeInteger(consumed) || consumed < 0 || compressedBytes < consumed) {
          pixelInspectionReason = "compressed-byte-consumption-unavailable";
          addDiagnostic({
            severity: "warning",
            code: "png-alpha.compressed-byte-consumption-unavailable",
            message:
              "The zlib engine did not provide a trustworthy consumed-input byte count, so inspection completeness is indeterminate.",
          });
        } else {
          consumedCompressedBytes = consumed;
          trailingCompressedBytes = compressedBytes - consumed;
          if (inflatedBytes !== expectedInflatedBytes) {
            pixelInspectionStatus = "invalid";
            pixelInspectionReason = "inflated-byte-length-mismatch";
            addDiagnostic({
              severity: "error",
              code: "png-alpha.inflated-byte-length-mismatch",
              message: `The zlib stream produced ${inflatedBytes} filtered bytes; exactly ${expectedInflatedBytes} are required by IHDR and interlace geometry.`,
            });
          } else {
            try {
              summary = scanPixels(
                inflated.buffer,
                width,
                height,
                bitDepth,
                colorType,
                imagePasses,
                observed.paletteEntryCount,
                observed.transparency,
              );
              pixelInspectionStatus = "complete";
              pixelInspectionReason = null;
              if (0 < trailingCompressedBytes) {
                addDiagnostic({
                  severity: "warning",
                  code: "png-alpha.trailing-compressed-bytes-ignored",
                  message: `${trailingCompressedBytes} trailing IDAT byte(s) remain after the complete zlib stream and were ignored consistently with the PNG decoder recommendation.`,
                });
              }
            } catch (error) {
              if (!(error instanceof PixelDataError)) {
                throw error;
              }
              pixelInspectionStatus = "invalid";
              pixelInspectionReason = error.reason;
              addDiagnostic({
                severity: "error",
                code: `png-alpha.${error.reason}`,
                message: error.message,
              });
            }
          }
        }
      } catch (error) {
        if (error instanceof PixelDataError) {
          throw error;
        }
        pixelInspectionStatus = "invalid";
        pixelInspectionReason = "zlib-decompression-failed";
        addDiagnostic({
          severity: "error",
          code: "png-alpha.zlib-decompression-failed",
          message:
            "The concatenated IDAT payload is not a complete zlib stream within the exact expected output bound.",
        });
      }
    }
  }

  const pixelInspectionComplete = pixelInspectionStatus === "complete";
  const content =
    summary === null ? null : summary.nonzeroAlphaPixelCount === 0 ? "empty" : "nonempty";
  const requirements = evaluateRequirements(
    resolvedRequirements,
    pixelInspectionComplete,
    content,
    summary?.transparentMargins ?? null,
  );
  if (diagnostics.length < diagnosticTotal) {
    exceededLimits.add("maxDiagnostics");
  }
  return {
    schemaVersion: 1,
    specification: "PNG",
    specificationUrl: "https://www.w3.org/TR/png-3/",
    inspectionStrength: "static-alpha",
    png,
    pixelInspectionStatus,
    pixelInspectionComplete,
    pixelDataValid:
      pixelInspectionStatus === "complete"
        ? true
        : pixelInspectionStatus === "invalid"
          ? false
          : null,
    pixelInspectionReason,
    transparencySource: source,
    totalPixels,
    transparentPixelCount: summary?.transparentPixelCount ?? null,
    partiallyTransparentPixelCount: summary?.partiallyTransparentPixelCount ?? null,
    fullyOpaquePixelCount: summary?.fullyOpaquePixelCount ?? null,
    nonzeroAlphaPixelCount: summary?.nonzeroAlphaPixelCount ?? null,
    content,
    contentBounds: summary?.contentBounds ?? null,
    transparentMargins: summary?.transparentMargins ?? null,
    compressedBytes,
    consumedCompressedBytes,
    trailingCompressedBytes,
    expectedInflatedBytes,
    inflatedBytes,
    requirements,
    appliedLimits: limits,
    exceededLimits: [...exceededLimits].sort(),
    diagnosticTotal,
    retainedDiagnosticCount: diagnostics.length,
    omittedDiagnosticCount: diagnosticTotal - diagnostics.length,
    diagnosticsTruncated: diagnostics.length < diagnosticTotal,
    diagnostics,
    notes: [
      "Content means a static-image pixel whose decoded alpha is not zero; no color, luminance, or configurable alpha threshold is applied.",
      "contentBounds are zero-based and half-open. Empty images have null bounds and margins because there is no content box.",
      "The function does not crop, rewrite, render, or return pixels, RGB samples, file paths, APNG animation frames, or .mcmeta animation frames.",
      "Empty content and transparent margins are reported as facts; only explicitly requested caller requirements can fail policy evaluation.",
      "PNG permits decoders to ignore unused bytes after the complete zlib stream in the final IDAT payload; consumed and trailing byte counts are reported separately.",
    ],
  };
}

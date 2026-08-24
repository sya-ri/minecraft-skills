/** Conservative resource limits for structural PNG validation. */
export type ResourcepackPngValidationLimits = {
  maxInputBytes: number;
  maxWidth: number;
  maxHeight: number;
  maxPixels: number;
  maxChunks: number;
  maxDiagnostics: number;
};

/** Limits used when callers do not provide lower values. */
export const defaultResourcepackPngValidationLimits: Readonly<ResourcepackPngValidationLimits> =
  Object.freeze({
    maxInputBytes: 16 * 1_024 * 1_024,
    maxWidth: 16_384,
    maxHeight: 16_384,
    maxPixels: 67_108_864,
    maxChunks: 100_000,
    maxDiagnostics: 100,
  });

export type ResourcepackPngValidationOptions = {
  limits?: Partial<ResourcepackPngValidationLimits>;
};

type ResourcepackPngInspectionOptions = ResourcepackPngValidationOptions & {
  onDiagnostic?: (diagnostic: ResourcepackPngDiagnostic) => void;
  onChunk?: (chunk: ResourcepackPngChunkObservation) => void;
};

/** CRC-verified chunk view emitted by the shared bounded PNG walk. */
export type ResourcepackPngChunkObservation = {
  type: string;
  offset: number;
  dataOffset: number;
  data: Uint8Array;
};

export type ResourcepackPngDiagnostic = {
  severity: "error" | "warning";
  code: string;
  offset: number;
  chunkType: string | null;
  message: string;
};

/** Result of bounded PNG container and header validation. */
export type ResourcepackPngValidationResult = {
  schemaVersion: 1;
  specification: "PNG";
  specificationUrl: "https://www.w3.org/TR/png-3/";
  validationStrength: "structure";
  valid: boolean;
  validationComplete: boolean;
  inputBytes: number;
  scannedBytes: number;
  width: number | null;
  height: number | null;
  bitDepth: number | null;
  colorType: number | null;
  compressionMethod: number | null;
  filterMethod: number | null;
  interlaceMethod: number | null;
  chunkCount: number;
  idatChunkCount: number;
  crcCheckedChunkCount: number;
  errorCount: number;
  warningCount: number;
  diagnosticTotal: number;
  retainedDiagnosticCount: number;
  omittedDiagnosticCount: number;
  diagnosticsTruncated: boolean;
  appliedLimits: ResourcepackPngValidationLimits;
  exceededLimits: Array<keyof ResourcepackPngValidationLimits>;
  diagnostics: ResourcepackPngDiagnostic[];
  notes: string[];
};

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const maximumPngFourByteInteger = 0x7fff_ffff;
const knownCriticalChunks = new Set(["IHDR", "PLTE", "IDAT", "IEND"]);
const allowedBitDepths = new Map<number, ReadonlySet<number>>([
  [0, new Set([1, 2, 4, 8, 16])],
  [2, new Set([8, 16])],
  [3, new Set([1, 2, 4, 8])],
  [4, new Set([8, 16])],
  [6, new Set([8, 16])],
]);

const crcTable = new Uint32Array(256);
for (let index = 0; index < crcTable.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb8_8320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[index] = value >>> 0;
}

function normalizeLimit(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) && 0 < value
    ? Math.min(value, fallback)
    : fallback;
}

/** Resolves user limits without allowing them to exceed the conservative defaults. */
export function resolveResourcepackPngValidationLimits(
  limits: Partial<ResourcepackPngValidationLimits> | undefined,
): ResourcepackPngValidationLimits {
  return {
    maxInputBytes: normalizeLimit(
      limits?.maxInputBytes,
      defaultResourcepackPngValidationLimits.maxInputBytes,
    ),
    maxWidth: normalizeLimit(limits?.maxWidth, defaultResourcepackPngValidationLimits.maxWidth),
    maxHeight: normalizeLimit(limits?.maxHeight, defaultResourcepackPngValidationLimits.maxHeight),
    maxPixels: normalizeLimit(limits?.maxPixels, defaultResourcepackPngValidationLimits.maxPixels),
    maxChunks: normalizeLimit(limits?.maxChunks, defaultResourcepackPngValidationLimits.maxChunks),
    maxDiagnostics: normalizeLimit(
      limits?.maxDiagnostics,
      defaultResourcepackPngValidationLimits.maxDiagnostics,
    ),
  };
}

function readUint32BigEndian(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] ?? 0) * 0x01_00_00_00 +
    ((bytes[offset + 1] ?? 0) << 16) +
    ((bytes[offset + 2] ?? 0) << 8) +
    (bytes[offset + 3] ?? 0)
  );
}

function crc32Range(bytes: Uint8Array, start: number, end: number): number {
  let value = 0xffff_ffff;
  for (let index = start; index < end; index += 1) {
    value = (crcTable[(value ^ (bytes[index] ?? 0)) & 0xff] ?? 0) ^ (value >>> 8);
  }
  return (value ^ 0xffff_ffff) >>> 0;
}

function matchesSignature(bytes: Uint8Array): boolean {
  return pngSignature.every((value, index) => bytes[index] === value);
}

function isAsciiLetter(value: number): boolean {
  return (0x41 <= value && value <= 0x5a) || (0x61 <= value && value <= 0x7a);
}

function chunkTypeAt(bytes: Uint8Array, offset: number): { name: string; valid: boolean } {
  const values = [
    bytes[offset] ?? 0,
    bytes[offset + 1] ?? 0,
    bytes[offset + 2] ?? 0,
    bytes[offset + 3] ?? 0,
  ];
  if (values.every(isAsciiLetter)) {
    return { name: String.fromCharCode(...values), valid: true };
  }
  return {
    name: `0x${values.map((value) => value.toString(16).padStart(2, "0")).join("")}`,
    valid: false,
  };
}

type DiagnosticCollector = {
  add: (diagnostic: ResourcepackPngDiagnostic) => void;
  finish: () => {
    diagnostics: ResourcepackPngDiagnostic[];
    errorCount: number;
    warningCount: number;
    diagnosticTotal: number;
  };
};

function createDiagnosticCollector(
  maxDiagnostics: number,
  onDiagnostic: ((diagnostic: ResourcepackPngDiagnostic) => void) | undefined,
): DiagnosticCollector {
  const keys = new Set<string>();
  const diagnostics: ResourcepackPngDiagnostic[] = [];
  let diagnosticCallback = onDiagnostic;
  let errorCount = 0;
  let warningCount = 0;
  return {
    add: (diagnostic) => {
      const key = [
        diagnostic.severity,
        diagnostic.code,
        diagnostic.offset,
        diagnostic.chunkType,
      ].join("\0");
      if (keys.has(key)) {
        return;
      }
      keys.add(key);
      if (diagnosticCallback) {
        try {
          diagnosticCallback(diagnostic);
        } catch {
          diagnosticCallback = undefined;
        }
      }
      if (diagnostic.severity === "error") {
        errorCount += 1;
      } else {
        warningCount += 1;
      }
      if (diagnostics.length < maxDiagnostics) {
        diagnostics.push(diagnostic);
      }
    },
    finish: () => ({
      diagnostics,
      errorCount,
      warningCount,
      diagnosticTotal: errorCount + warningCount,
    }),
  };
}

/** Internal diagnostic-streaming entrypoint shared with resource-pack project validation. */
export function inspectResourcepackPng(
  bytes: Uint8Array,
  options: ResourcepackPngInspectionOptions = {},
): ResourcepackPngValidationResult {
  const limits = resolveResourcepackPngValidationLimits(options.limits);
  const collector = createDiagnosticCollector(limits.maxDiagnostics, options.onDiagnostic);
  const add = (code: string, offset: number, chunkType: string | null, message: string): void =>
    collector.add({ severity: "error", code, offset, chunkType, message });

  let width: number | null = null;
  let height: number | null = null;
  let bitDepth: number | null = null;
  let colorType: number | null = null;
  let compressionMethod: number | null = null;
  let filterMethod: number | null = null;
  let interlaceMethod: number | null = null;
  let chunkCount = 0;
  let idatChunkCount = 0;
  let crcCheckedChunkCount = 0;
  let ihdrCount = 0;
  let iendCount = 0;
  let plteCount = 0;
  let plteEntryCount: number | null = null;
  let trnsCount = 0;
  let indexedTrnsEntryCount: number | null = null;
  let scannedBytes = 0;
  let signatureValidated = false;
  let trustworthyChunkWalk = false;
  let idatSequenceEnded = false;
  let chunkCallback = options.onChunk;
  const exceededLimits = new Set<keyof ResourcepackPngValidationLimits>();

  if (limits.maxInputBytes < bytes.byteLength) {
    exceededLimits.add("maxInputBytes");
    add(
      "png.input-byte-limit-exceeded",
      0,
      null,
      `PNG input contains at least ${bytes.byteLength} bytes, exceeding the applied ${limits.maxInputBytes}-byte limit; validation did not scan the datastream.`,
    );
  } else if (bytes.byteLength < pngSignature.length) {
    add(
      "png.truncated-signature",
      0,
      null,
      `PNG input is truncated before the complete ${pngSignature.length}-byte signature.`,
    );
    scannedBytes = bytes.byteLength;
  } else if (!matchesSignature(bytes)) {
    add("png.invalid-signature", 0, null, "PNG input does not begin with the exact PNG signature.");
    scannedBytes = pngSignature.length;
  } else {
    signatureValidated = true;
    trustworthyChunkWalk = true;
    let offset: number = pngSignature.length;
    scannedBytes = offset;
    while (offset < bytes.byteLength) {
      if (iendCount > 0) {
        add(
          "png.post-iend-data",
          offset,
          null,
          `${bytes.byteLength - offset} byte(s) follow the first IEND chunk.`,
        );
        if (12 <= bytes.byteLength - offset) {
          const trailingLength = readUint32BigEndian(bytes, offset);
          const trailingType = chunkTypeAt(bytes, offset + 4);
          if (trailingLength === 0 && trailingType.valid && trailingType.name === "IEND") {
            chunkCount += 1;
            const expectedCrc = readUint32BigEndian(bytes, offset + 8);
            const actualCrc = crc32Range(bytes, offset + 4, offset + 8);
            crcCheckedChunkCount += 1;
            if (actualCrc !== expectedCrc) {
              add(
                "png.crc-mismatch",
                offset,
                "IEND",
                "IEND chunk CRC does not match its type and data bytes.",
              );
            } else {
              iendCount += 1;
              add(
                "png.duplicate-iend",
                offset,
                "IEND",
                "PNG input contains more than one IEND chunk.",
              );
            }
            scannedBytes = offset + 12;
          }
        }
        break;
      }
      if (limits.maxChunks <= chunkCount) {
        exceededLimits.add("maxChunks");
        add(
          "png.chunk-limit-exceeded",
          offset,
          null,
          `PNG validation stopped after the applied limit of ${limits.maxChunks} chunks.`,
        );
        trustworthyChunkWalk = false;
        break;
      }
      const remaining = bytes.byteLength - offset;
      if (remaining < 8) {
        add(
          "png.truncated-chunk-header",
          offset,
          null,
          "PNG input ends before a complete chunk length and type header.",
        );
        trustworthyChunkWalk = false;
        scannedBytes = bytes.byteLength;
        break;
      }

      const chunkLength = readUint32BigEndian(bytes, offset);
      const chunkType = chunkTypeAt(bytes, offset + 4);
      if (maximumPngFourByteInteger < chunkLength) {
        add(
          "png.chunk-length-out-of-range",
          offset,
          chunkType.name,
          "PNG chunk data length exceeds the 31-bit PNG integer range.",
        );
        trustworthyChunkWalk = false;
        scannedBytes = offset + 8;
        break;
      }

      const dataOffset = offset + 8;
      const availableAfterHeader = bytes.byteLength - dataOffset;
      if (availableAfterHeader < 4 || availableAfterHeader - 4 < chunkLength) {
        add(
          "png.truncated-chunk",
          offset,
          chunkType.name,
          `PNG chunk declares ${chunkLength} data byte(s), but its complete data and CRC are not available.`,
        );
        trustworthyChunkWalk = false;
        scannedBytes = bytes.byteLength;
        break;
      }

      const crcOffset = dataOffset + chunkLength;
      const nextOffset = crcOffset + 4;
      const expectedCrc = readUint32BigEndian(bytes, crcOffset);
      const actualCrc = crc32Range(bytes, offset + 4, crcOffset);
      chunkCount += 1;
      crcCheckedChunkCount += 1;
      scannedBytes = nextOffset;
      if (actualCrc !== expectedCrc) {
        add(
          "png.crc-mismatch",
          offset,
          chunkType.name,
          `${chunkType.name} chunk CRC does not match its type and data bytes.`,
        );
        trustworthyChunkWalk = false;
        break;
      }

      if (chunkCallback) {
        try {
          chunkCallback({
            type: chunkType.name,
            offset,
            dataOffset,
            data: bytes.subarray(dataOffset, crcOffset),
          });
        } catch {
          chunkCallback = undefined;
        }
      }

      if (!chunkType.valid) {
        add(
          "png.invalid-chunk-type",
          offset,
          chunkType.name,
          "PNG chunk type bytes must contain only ASCII letters.",
        );
      } else if ((bytes[offset + 6] ?? 0) >= 0x61) {
        add(
          "png.invalid-reserved-bit",
          offset,
          chunkType.name,
          "PNG chunk types must keep the reserved third letter uppercase.",
        );
      }

      if (chunkCount === 1 && chunkType.name !== "IHDR") {
        add(
          "png.ihdr-not-first",
          offset,
          chunkType.name,
          "IHDR must be the first chunk immediately after the PNG signature.",
        );
      }
      if (
        chunkType.valid &&
        0x41 <= (bytes[offset + 4] ?? 0) &&
        (bytes[offset + 4] ?? 0) <= 0x5a &&
        !knownCriticalChunks.has(chunkType.name)
      ) {
        add(
          "png.unknown-critical-chunk",
          offset,
          chunkType.name,
          `PNG contains unsupported critical chunk ${chunkType.name}.`,
        );
      }

      if (idatChunkCount > 0 && chunkType.name !== "IDAT") {
        idatSequenceEnded = true;
      }
      if (chunkType.name === "IHDR") {
        ihdrCount += 1;
        if (1 < ihdrCount) {
          add("png.duplicate-ihdr", offset, "IHDR", "PNG input contains more than one IHDR chunk.");
        }
        if (chunkLength !== 13) {
          add(
            "png.invalid-ihdr-length",
            offset,
            "IHDR",
            "IHDR chunk data length must be exactly 13 bytes.",
          );
        } else if (ihdrCount === 1) {
          width = readUint32BigEndian(bytes, dataOffset);
          height = readUint32BigEndian(bytes, dataOffset + 4);
          bitDepth = bytes[dataOffset + 8] ?? 0;
          colorType = bytes[dataOffset + 9] ?? 0;
          compressionMethod = bytes[dataOffset + 10] ?? 0;
          filterMethod = bytes[dataOffset + 11] ?? 0;
          interlaceMethod = bytes[dataOffset + 12] ?? 0;

          if (width === 0 || maximumPngFourByteInteger < width) {
            add(
              "png.invalid-width",
              dataOffset,
              "IHDR",
              "IHDR width must be a positive 31-bit PNG integer.",
            );
          } else if (limits.maxWidth < width) {
            exceededLimits.add("maxWidth");
            add(
              "png.width-limit-exceeded",
              dataOffset,
              "IHDR",
              `IHDR width ${width} exceeds the applied ${limits.maxWidth}-pixel limit.`,
            );
          }
          if (height === 0 || maximumPngFourByteInteger < height) {
            add(
              "png.invalid-height",
              dataOffset + 4,
              "IHDR",
              "IHDR height must be a positive 31-bit PNG integer.",
            );
          } else if (limits.maxHeight < height) {
            exceededLimits.add("maxHeight");
            add(
              "png.height-limit-exceeded",
              dataOffset + 4,
              "IHDR",
              `IHDR height ${height} exceeds the applied ${limits.maxHeight}-pixel limit.`,
            );
          }
          if (
            0 < width &&
            width <= maximumPngFourByteInteger &&
            0 < height &&
            height <= maximumPngFourByteInteger &&
            Math.floor(limits.maxPixels / height) < width
          ) {
            exceededLimits.add("maxPixels");
            add(
              "png.pixel-limit-exceeded",
              dataOffset,
              "IHDR",
              `IHDR dimensions ${width}x${height} exceed the applied ${limits.maxPixels}-pixel limit.`,
            );
          }
          if (!allowedBitDepths.get(colorType)?.has(bitDepth)) {
            add(
              "png.invalid-bit-depth-color-type",
              dataOffset + 8,
              "IHDR",
              `IHDR bit depth ${bitDepth} is not allowed for color type ${colorType}.`,
            );
          }
          if (compressionMethod !== 0) {
            add(
              "png.invalid-compression-method",
              dataOffset + 10,
              "IHDR",
              "IHDR compression method must be 0.",
            );
          }
          if (filterMethod !== 0) {
            add(
              "png.invalid-filter-method",
              dataOffset + 11,
              "IHDR",
              "IHDR filter method must be 0.",
            );
          }
          if (interlaceMethod !== 0 && interlaceMethod !== 1) {
            add(
              "png.invalid-interlace-method",
              dataOffset + 12,
              "IHDR",
              "IHDR interlace method must be 0 or 1.",
            );
          }
        }
      } else if (chunkType.name === "PLTE") {
        plteCount += 1;
        if (1 < plteCount) {
          add("png.duplicate-plte", offset, "PLTE", "PNG input contains more than one PLTE chunk.");
        }
        if (0 < idatChunkCount) {
          add(
            "png.plte-after-idat",
            offset,
            "PLTE",
            "PLTE must appear before the first IDAT chunk.",
          );
        }
        if (0 < trnsCount) {
          add(
            "png.plte-after-trns",
            offset,
            "PLTE",
            "PLTE must appear before tRNS when both chunks are present.",
          );
        }
        if (chunkLength === 0 || 768 < chunkLength || chunkLength % 3 !== 0) {
          add(
            "png.invalid-plte-length",
            offset,
            "PLTE",
            "PLTE must contain between 1 and 256 three-byte palette entries.",
          );
        } else if (plteCount === 1) {
          plteEntryCount = chunkLength / 3;
          if (indexedTrnsEntryCount !== null && plteEntryCount < indexedTrnsEntryCount) {
            add(
              "png.trns-too-many-entries",
              offset,
              "PLTE",
              "Indexed-color tRNS must not contain more alpha values than PLTE has entries.",
            );
          }
        }
        if (colorType === 0 || colorType === 4) {
          add(
            "png.plte-forbidden",
            offset,
            "PLTE",
            `PLTE is not allowed for PNG color type ${colorType}.`,
          );
        }
        if (
          colorType === 3 &&
          bitDepth !== null &&
          0 < chunkLength &&
          2 ** bitDepth < chunkLength / 3
        ) {
          add(
            "png.plte-too-many-entries",
            offset,
            "PLTE",
            `PLTE has more entries than indexed color bit depth ${bitDepth} can address.`,
          );
        }
      } else if (chunkType.name === "tRNS") {
        trnsCount += 1;
        if (1 < trnsCount) {
          add("png.duplicate-trns", offset, "tRNS", "PNG input contains more than one tRNS chunk.");
        }
        if (0 < idatChunkCount) {
          add(
            "png.trns-after-idat",
            offset,
            "tRNS",
            "tRNS must appear before the first IDAT chunk.",
          );
        }
        if (colorType === 0) {
          if (chunkLength !== 2) {
            add(
              "png.invalid-trns-length",
              offset,
              "tRNS",
              "tRNS for greyscale PNG input must contain exactly one two-byte sample key.",
            );
          }
        } else if (colorType === 2) {
          if (chunkLength !== 6) {
            add(
              "png.invalid-trns-length",
              offset,
              "tRNS",
              "tRNS for truecolor PNG input must contain exactly three two-byte sample keys.",
            );
          }
        } else if (colorType === 3) {
          if (trnsCount === 1) {
            indexedTrnsEntryCount = chunkLength;
          }
          if (plteCount === 0) {
            add(
              "png.trns-before-plte",
              offset,
              "tRNS",
              "tRNS for indexed-color PNG input must appear after PLTE.",
            );
          }
          if (plteEntryCount !== null && plteEntryCount < chunkLength) {
            add(
              "png.trns-too-many-entries",
              offset,
              "tRNS",
              "Indexed-color tRNS must not contain more alpha values than PLTE has entries.",
            );
          }
        } else if (colorType === 4 || colorType === 6) {
          add(
            "png.trns-forbidden",
            offset,
            "tRNS",
            `tRNS is not allowed for PNG color type ${colorType}, which already contains an alpha channel.`,
          );
        } else {
          add(
            "png.trns-without-supported-color-type",
            offset,
            "tRNS",
            "tRNS cannot be interpreted without a supported IHDR color type.",
          );
        }
      } else if (chunkType.name === "IDAT") {
        if (idatSequenceEnded) {
          add(
            "png.nonconsecutive-idat",
            offset,
            "IDAT",
            "Multiple IDAT chunks must be consecutive.",
          );
        }
        idatChunkCount += 1;
      } else if (chunkType.name === "IEND") {
        iendCount += 1;
        if (chunkLength !== 0) {
          add("png.invalid-iend-length", offset, "IEND", "IEND chunk data must be empty.");
        }
      }

      offset = nextOffset;
    }
  }

  if (signatureValidated && trustworthyChunkWalk) {
    if (ihdrCount === 0) {
      add("png.missing-ihdr", scannedBytes, null, "PNG input does not contain an IHDR chunk.");
    }
    if (idatChunkCount === 0) {
      add("png.missing-idat", scannedBytes, null, "PNG input does not contain an IDAT chunk.");
    }
    if (colorType === 3 && plteCount === 0) {
      add(
        "png.missing-plte",
        scannedBytes,
        null,
        "Indexed-color PNG input does not contain the required PLTE chunk.",
      );
    }
    if (iendCount === 0) {
      add("png.missing-iend", scannedBytes, null, "PNG input does not contain an IEND chunk.");
    }
  }

  const summary = collector.finish();
  if (summary.diagnosticTotal > summary.diagnostics.length) {
    exceededLimits.add("maxDiagnostics");
  }
  const validationComplete = signatureValidated && trustworthyChunkWalk && 0 < iendCount;
  return {
    schemaVersion: 1,
    specification: "PNG",
    specificationUrl: "https://www.w3.org/TR/png-3/",
    validationStrength: "structure",
    valid: validationComplete && summary.errorCount === 0,
    validationComplete,
    inputBytes: bytes.byteLength,
    scannedBytes,
    width,
    height,
    bitDepth,
    colorType,
    compressionMethod,
    filterMethod,
    interlaceMethod,
    chunkCount,
    idatChunkCount,
    crcCheckedChunkCount,
    errorCount: summary.errorCount,
    warningCount: summary.warningCount,
    diagnosticTotal: summary.diagnosticTotal,
    retainedDiagnosticCount: summary.diagnostics.length,
    omittedDiagnosticCount: summary.diagnosticTotal - summary.diagnostics.length,
    diagnosticsTruncated: summary.diagnosticTotal > summary.diagnostics.length,
    appliedLimits: limits,
    exceededLimits: [...exceededLimits].sort(),
    diagnostics: summary.diagnostics,
    notes: [
      "Validation covers the PNG signature, bounded chunk framing, scanned chunk CRCs, critical chunk structure, IHDR fields, and PLTE/tRNS placement and lengths.",
      "IDAT payloads are not decompressed; pixel data, rendered texture appearance, APNG ancillary-chunk semantics, and animation .mcmeta frame semantics are not validated.",
      "The valid field means no error was detected within this structural scope and its applied safety limits; it is not a full decoder result.",
      "PNG validity does not require square or power-of-two dimensions, and this validator does not impose a fixed pack.png size.",
    ],
  };
}

/**
 * Validates bounded PNG container structure and IHDR fields directly from bytes.
 *
 * IDAT payloads are not decompressed, so this does not prove that pixels can be rendered.
 */
export function validateResourcepackPng(
  bytes: Uint8Array,
  options: ResourcepackPngValidationOptions = {},
): ResourcepackPngValidationResult {
  return inspectResourcepackPng(bytes, options);
}

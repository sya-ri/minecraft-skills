import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  defaultResourcepackPngAlphaBoundsLimits,
  inspectResourcepackPngAlphaBounds,
  resolveResourcepackPngAlphaBoundsLimits,
} from "./resourcepackPngAlpha.js";

const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const adam7Geometry = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2],
] as const;

type BuildPngOptions = {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  interlaceMethod?: 0 | 1;
  pixel: (x: number, y: number) => number[];
  filters?: number[];
  palette?: Uint8Array;
  transparency?: Uint8Array;
  compressedSuffix?: Uint8Array;
  splitIdatAt?: number;
};

function crc32(value: Uint8Array): number {
  let crc = 0xffff_ffff;
  for (const byte of value) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb8_8320 : 0);
    }
  }
  return (crc ^ 0xffff_ffff) >>> 0;
}

function chunk(type: string, data: Uint8Array = new Uint8Array()): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const result = Buffer.alloc(12 + data.byteLength);
  result.writeUInt32BE(data.byteLength, 0);
  typeBytes.copy(result, 4);
  Buffer.from(data).copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([typeBytes, Buffer.from(data)])), 8 + data.byteLength);
  return result;
}

function ihdr(options: BuildPngOptions): Buffer {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(options.width, 0);
  data.writeUInt32BE(options.height, 4);
  data[8] = options.bitDepth;
  data[9] = options.colorType;
  data[10] = 0;
  data[11] = 0;
  data[12] = options.interlaceMethod ?? 0;
  return chunk("IHDR", data);
}

function png(...chunks: Uint8Array[]): Buffer {
  return Buffer.concat([signature, ...chunks.map((value) => Buffer.from(value))]);
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

function passSize(fullSize: number, start: number, step: number): number {
  return fullSize <= start ? 0 : Math.floor((fullSize - start + step - 1) / step);
}

function packSamples(samples: number[], bitDepth: number): Buffer {
  if (bitDepth < 8) {
    const result = Buffer.alloc(Math.ceil((samples.length * bitDepth) / 8));
    for (let index = 0; index < samples.length; index += 1) {
      const bitOffset = index * bitDepth;
      const shift = 8 - bitDepth - (bitOffset % 8);
      result[Math.floor(bitOffset / 8)] =
        (result[Math.floor(bitOffset / 8)] ?? 0) | ((samples[index] ?? 0) << shift);
    }
    return result;
  }
  if (bitDepth === 8) {
    return Buffer.from(samples);
  }
  const result = Buffer.alloc(samples.length * 2);
  samples.forEach((sample, index) => {
    result.writeUInt16BE(sample, index * 2);
  });
  return result;
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

function filterRow(
  raw: Uint8Array,
  previous: Uint8Array,
  filterType: number,
  bytesPerPixel: number,
): Buffer {
  const result = Buffer.alloc(raw.byteLength);
  for (let index = 0; index < raw.byteLength; index += 1) {
    const left = index < bytesPerPixel ? 0 : (raw[index - bytesPerPixel] ?? 0);
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
    result[index] = ((raw[index] ?? 0) - predictor) & 0xff;
  }
  return result;
}

function filteredImage(options: BuildPngOptions): Buffer {
  const channels = channelCount(options.colorType);
  const bitsPerPixel = channels * options.bitDepth;
  const bytesPerPixel = Math.max(1, Math.ceil(bitsPerPixel / 8));
  const geometry = options.interlaceMethod === 1 ? adam7Geometry : ([[0, 0, 1, 1]] as const);
  const rows: Buffer[] = [];
  let rowIndex = 0;
  for (const [xStart, yStart, xStep, yStep] of geometry) {
    const passWidth = passSize(options.width, xStart, xStep);
    const passHeight = passSize(options.height, yStart, yStep);
    if (passWidth === 0 || passHeight === 0) {
      continue;
    }
    let previous: Uint8Array = Buffer.alloc(Math.ceil((passWidth * bitsPerPixel) / 8));
    for (let passY = 0; passY < passHeight; passY += 1) {
      const samples: number[] = [];
      for (let passX = 0; passX < passWidth; passX += 1) {
        samples.push(...options.pixel(xStart + passX * xStep, yStart + passY * yStep));
      }
      const raw = packSamples(samples, options.bitDepth);
      const filterType = options.filters?.[rowIndex % options.filters.length] ?? 0;
      rows.push(Buffer.from([filterType]), filterRow(raw, previous, filterType, bytesPerPixel));
      previous = raw;
      rowIndex += 1;
    }
  }
  return Buffer.concat(rows);
}

function buildPng(options: BuildPngOptions): Buffer {
  const compressed = Buffer.concat([
    deflateSync(filteredImage(options)),
    Buffer.from(options.compressedSuffix ?? new Uint8Array()),
  ]);
  const chunks = [ihdr(options)];
  if (options.palette) {
    chunks.push(chunk("PLTE", options.palette));
  }
  if (options.transparency !== undefined) {
    chunks.push(chunk("tRNS", options.transparency));
  }
  if (
    options.splitIdatAt !== undefined &&
    0 < options.splitIdatAt &&
    options.splitIdatAt < compressed.byteLength
  ) {
    chunks.push(
      chunk("IDAT", compressed.subarray(0, options.splitIdatAt)),
      chunk("IDAT", compressed.subarray(options.splitIdatAt)),
    );
  } else {
    chunks.push(chunk("IDAT", compressed));
  }
  chunks.push(chunk("IEND"));
  return png(...chunks);
}

function pngFromFiltered(options: BuildPngOptions, filtered: Uint8Array): Buffer {
  const chunks = [ihdr(options)];
  if (options.palette) {
    chunks.push(chunk("PLTE", options.palette));
  }
  if (options.transparency !== undefined) {
    chunks.push(chunk("tRNS", options.transparency));
  }
  chunks.push(chunk("IDAT", deflateSync(filtered)), chunk("IEND"));
  return png(...chunks);
}

const legalFormats = [
  { colorType: 0, bitDepth: 1, pixel: [1], source: "implicit-opaque" },
  { colorType: 0, bitDepth: 2, pixel: [3], source: "implicit-opaque" },
  { colorType: 0, bitDepth: 4, pixel: [15], source: "implicit-opaque" },
  { colorType: 0, bitDepth: 8, pixel: [255], source: "implicit-opaque" },
  { colorType: 0, bitDepth: 16, pixel: [65_535], source: "implicit-opaque" },
  { colorType: 2, bitDepth: 8, pixel: [1, 2, 3], source: "implicit-opaque" },
  { colorType: 2, bitDepth: 16, pixel: [1, 2, 3], source: "implicit-opaque" },
  { colorType: 3, bitDepth: 1, pixel: [0], source: "trns-palette" },
  { colorType: 3, bitDepth: 2, pixel: [0], source: "trns-palette" },
  { colorType: 3, bitDepth: 4, pixel: [0], source: "trns-palette" },
  { colorType: 3, bitDepth: 8, pixel: [0], source: "trns-palette" },
  { colorType: 4, bitDepth: 8, pixel: [7, 255], source: "alpha-channel" },
  { colorType: 4, bitDepth: 16, pixel: [7, 65_535], source: "alpha-channel" },
  { colorType: 6, bitDepth: 8, pixel: [1, 2, 3, 255], source: "alpha-channel" },
  { colorType: 6, bitDepth: 16, pixel: [1, 2, 3, 65_535], source: "alpha-channel" },
] as const;

describe("inspectResourcepackPngAlphaBounds", () => {
  it.each(legalFormats)("inspects legal color type $colorType at bit depth $bitDepth", ({
    colorType,
    bitDepth,
    pixel,
    source,
  }) => {
    const indexed = colorType === 3;
    const result = inspectResourcepackPngAlphaBounds(
      buildPng({
        width: 1,
        height: 1,
        colorType,
        bitDepth,
        pixel: () => [...pixel],
        ...(indexed
          ? {
              palette: Buffer.from([1, 2, 3]),
              transparency: Buffer.from([255]),
            }
          : {}),
      }),
    );

    expect(result).toMatchObject({
      pixelInspectionStatus: "complete",
      pixelInspectionComplete: true,
      pixelDataValid: true,
      transparencySource: source,
      totalPixels: 1,
      transparentPixelCount: 0,
      partiallyTransparentPixelCount: 0,
      fullyOpaquePixelCount: 1,
      nonzeroAlphaPixelCount: 1,
      content: "nonempty",
      contentBounds: {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        xEndExclusive: 1,
        yEndExclusive: 1,
      },
    });
  });

  it("decodes filters 0-4 and reports exact half-open bounds, margins, and alpha counts", () => {
    const value = buildPng({
      width: 5,
      height: 5,
      colorType: 6,
      bitDepth: 8,
      filters: [0, 1, 2, 3, 4],
      splitIdatAt: 5,
      pixel: (x, y) => [
        x * 17,
        y * 23,
        (x + y) * 11,
        x === 2 && 1 <= y && y <= 3 ? (y === 2 ? 128 : 255) : 0,
      ],
    });
    const result = inspectResourcepackPngAlphaBounds(value, {
      requirements: { nonEmpty: true, minimumTransparentMarginPixels: 1 },
    });

    expect(result).toMatchObject({
      pixelInspectionStatus: "complete",
      transparentPixelCount: 22,
      partiallyTransparentPixelCount: 1,
      fullyOpaquePixelCount: 2,
      nonzeroAlphaPixelCount: 3,
      contentBounds: {
        x: 2,
        y: 1,
        width: 1,
        height: 3,
        xEndExclusive: 3,
        yEndExclusive: 4,
      },
      transparentMargins: { top: 1, right: 2, bottom: 1, left: 2, minimum: 1 },
      requirements: { status: "met", failures: [] },
    });
    expect(result.compressedBytes).toBeGreaterThan(0);
    expect(result.consumedCompressedBytes).toBe(result.compressedBytes);
    expect(result.trailingCompressedBytes).toBe(0);

    const insufficientMargin = inspectResourcepackPngAlphaBounds(value, {
      requirements: { minimumTransparentMarginPixels: 2 },
    });
    expect(insufficientMargin.requirements).toMatchObject({
      status: "not-met",
      failures: ["minimum-transparent-margin"],
    });
  });

  it("uses exact 16-bit alpha samples without reducing their precision", () => {
    const result = inspectResourcepackPngAlphaBounds(
      buildPng({
        width: 3,
        height: 1,
        colorType: 4,
        bitDepth: 16,
        pixel: (x) => [0x1234, x === 0 ? 0 : x === 1 ? 1 : 0xffff],
      }),
    );

    expect(result).toMatchObject({
      transparentPixelCount: 1,
      partiallyTransparentPixelCount: 1,
      fullyOpaquePixelCount: 1,
      nonzeroAlphaPixelCount: 2,
      contentBounds: { x: 1, xEndExclusive: 3 },
    });
  });

  it("unpacks sub-byte greyscale samples and masks unused tRNS key bits", () => {
    const result = inspectResourcepackPngAlphaBounds(
      buildPng({
        width: 4,
        height: 1,
        colorType: 0,
        bitDepth: 2,
        pixel: (x) => [x],
        transparency: Buffer.from([0xf0, 0x02]),
      }),
    );

    expect(result).toMatchObject({
      transparencySource: "trns-color-key",
      transparentPixelCount: 1,
      partiallyTransparentPixelCount: 0,
      fullyOpaquePixelCount: 3,
      nonzeroAlphaPixelCount: 3,
      contentBounds: { x: 0, width: 4, xEndExclusive: 4 },
    });
  });

  it("compares all truecolor tRNS key samples after required precision masking", () => {
    const maskedEightBit = inspectResourcepackPngAlphaBounds(
      buildPng({
        width: 2,
        height: 1,
        colorType: 2,
        bitDepth: 8,
        pixel: (x) => (x === 0 ? [1, 2, 3] : [1, 2, 4]),
        transparency: Buffer.from([0xf0, 1, 0xa0, 2, 0x10, 3]),
      }),
    );
    expect(maskedEightBit).toMatchObject({
      transparentPixelCount: 1,
      fullyOpaquePixelCount: 1,
      contentBounds: { x: 1, xEndExclusive: 2 },
    });

    const exactSixteenBit = inspectResourcepackPngAlphaBounds(
      buildPng({
        width: 2,
        height: 1,
        colorType: 2,
        bitDepth: 16,
        pixel: (x) => (x === 0 ? [0x1234, 0xabcd, 1] : [0x1234, 0xabcd, 2]),
        transparency: Buffer.from([0x12, 0x34, 0xab, 0xcd, 0, 1]),
      }),
    );
    expect(exactSixteenBit).toMatchObject({
      transparentPixelCount: 1,
      fullyOpaquePixelCount: 1,
      contentBounds: { x: 1, xEndExclusive: 2 },
    });
  });

  it("applies indexed tRNS alpha values and rejects out-of-range palette indices", () => {
    const palette = Buffer.from([0, 0, 0, 255, 255, 255]);
    const valid = inspectResourcepackPngAlphaBounds(
      buildPng({
        width: 4,
        height: 1,
        colorType: 3,
        bitDepth: 1,
        pixel: (x) => [x % 2],
        palette,
        transparency: Buffer.from([0, 128]),
      }),
    );
    expect(valid).toMatchObject({
      transparentPixelCount: 2,
      partiallyTransparentPixelCount: 2,
      fullyOpaquePixelCount: 0,
      contentBounds: { x: 1, xEndExclusive: 4 },
    });

    const emptyTransparencyTable = inspectResourcepackPngAlphaBounds(
      buildPng({
        width: 1,
        height: 1,
        colorType: 3,
        bitDepth: 1,
        pixel: () => [0],
        palette: Buffer.from([0, 0, 0]),
        transparency: Buffer.alloc(0),
      }),
    );
    expect(emptyTransparencyTable).toMatchObject({
      png: { valid: true },
      transparencySource: "trns-palette",
      fullyOpaquePixelCount: 1,
    });

    const invalid = inspectResourcepackPngAlphaBounds(
      buildPng({
        width: 1,
        height: 1,
        colorType: 3,
        bitDepth: 2,
        pixel: () => [3],
        palette,
      }),
    );
    expect(invalid).toMatchObject({
      png: { valid: true },
      pixelInspectionStatus: "invalid",
      pixelDataValid: false,
      pixelInspectionReason: "palette-index-out-of-range",
      contentBounds: null,
    });
  });

  it("decodes Adam7 at the one-pixel boundary and across all seven passes", () => {
    const onePixel = inspectResourcepackPngAlphaBounds(
      buildPng({
        width: 1,
        height: 1,
        colorType: 6,
        bitDepth: 8,
        interlaceMethod: 1,
        pixel: () => [0, 0, 0, 255],
      }),
    );
    expect(onePixel).toMatchObject({
      pixelInspectionStatus: "complete",
      totalPixels: 1,
      nonzeroAlphaPixelCount: 1,
    });

    const contentCoordinates = new Set(["0,0", "4,0", "0,4", "2,0", "0,2", "1,0", "0,1", "8,8"]);
    const allPasses = inspectResourcepackPngAlphaBounds(
      buildPng({
        width: 9,
        height: 9,
        colorType: 6,
        bitDepth: 8,
        interlaceMethod: 1,
        filters: [0, 1, 2, 3, 4],
        pixel: (x, y) => [x, y, 0, contentCoordinates.has(`${x},${y}`) ? 255 : 0],
      }),
    );
    expect(allPasses).toMatchObject({
      pixelInspectionStatus: "complete",
      totalPixels: 81,
      transparentPixelCount: 73,
      fullyOpaquePixelCount: 8,
      nonzeroAlphaPixelCount: 8,
      contentBounds: {
        x: 0,
        y: 0,
        width: 9,
        height: 9,
        xEndExclusive: 9,
        yEndExclusive: 9,
      },
    });
  });

  it("keeps structurally valid PNG status while bounding pixel inspection before inflate", () => {
    const value = buildPng({
      width: 100,
      height: 100,
      colorType: 6,
      bitDepth: 8,
      pixel: () => [0, 0, 0, 0],
    });
    const result = inspectResourcepackPngAlphaBounds(value, {
      limits: { maxInflatedBytes: 100 },
    });

    expect(result).toMatchObject({
      png: { valid: true },
      pixelInspectionStatus: "indeterminate",
      pixelDataValid: null,
      pixelInspectionReason: "inflated-byte-limit-exceeded",
      expectedInflatedBytes: 40_100,
      inflatedBytes: null,
      exceededLimits: ["maxInflatedBytes"],
    });
  });

  it("unions structural input, dimension, and pixel limits into top-level exceededLimits", () => {
    const value = buildPng({
      width: 100,
      height: 100,
      colorType: 6,
      bitDepth: 8,
      pixel: () => [0, 0, 0, 0],
    });
    const inputLimited = inspectResourcepackPngAlphaBounds(value, {
      limits: { maxInputBytes: value.byteLength - 1 },
    });
    expect(inputLimited).toMatchObject({
      png: { exceededLimits: ["maxInputBytes"] },
      exceededLimits: ["maxInputBytes"],
      pixelInspectionStatus: "indeterminate",
    });

    const geometryLimited = inspectResourcepackPngAlphaBounds(value, {
      limits: { maxWidth: 50, maxPixels: 5_000 },
    });
    expect(geometryLimited.png.exceededLimits).toEqual(["maxPixels", "maxWidth"]);
    expect(geometryLimited.exceededLimits).toEqual(["maxPixels", "maxWidth"]);
    expect(geometryLimited.pixelInspectionStatus).toBe("indeterminate");
  });

  it("uses consumed-byte evidence and accepts spec-defined trailing IDAT bytes", () => {
    const result = inspectResourcepackPngAlphaBounds(
      buildPng({
        width: 1,
        height: 1,
        colorType: 6,
        bitDepth: 8,
        pixel: () => [0, 0, 0, 255],
        compressedSuffix: Buffer.from([1, 2, 3]),
      }),
    );

    expect(result.pixelInspectionStatus).toBe("complete");
    expect(result.trailingCompressedBytes).toBe(3);
    expect(result.compressedBytes).toBe((result.consumedCompressedBytes ?? 0) + 3);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "png-alpha.trailing-compressed-bytes-ignored",
    );
  });

  it("reports malformed zlib, exact-length mismatch, and invalid row filters as pixel-data errors", () => {
    const base = {
      width: 1,
      height: 1,
      colorType: 6,
      bitDepth: 8,
      pixel: () => [0, 0, 0, 255],
    } satisfies BuildPngOptions;
    const malformed = png(ihdr(base), chunk("IDAT", Buffer.from([1, 2, 3])), chunk("IEND"));
    expect(inspectResourcepackPngAlphaBounds(malformed)).toMatchObject({
      png: { valid: true },
      pixelInspectionStatus: "invalid",
      pixelInspectionReason: "zlib-decompression-failed",
    });

    expect(
      inspectResourcepackPngAlphaBounds(pngFromFiltered(base, Buffer.from([0, 0, 0, 0]))),
    ).toMatchObject({
      pixelInspectionStatus: "invalid",
      pixelInspectionReason: "inflated-byte-length-mismatch",
    });
    expect(
      inspectResourcepackPngAlphaBounds(pngFromFiltered(base, Buffer.from([5, 0, 0, 0, 255]))),
    ).toMatchObject({
      pixelInspectionStatus: "invalid",
      pixelInspectionReason: "invalid-filter-type",
    });
  });

  it("reports empty content without declaring it invalid and applies only caller policy", () => {
    const value = buildPng({
      width: 3,
      height: 3,
      colorType: 6,
      bitDepth: 8,
      pixel: () => [1, 2, 3, 0],
    });
    const factual = inspectResourcepackPngAlphaBounds(value);
    expect(factual).toMatchObject({
      pixelDataValid: true,
      content: "empty",
      contentBounds: null,
      transparentMargins: null,
      requirements: { status: "not-requested", failures: [] },
    });

    const required = inspectResourcepackPngAlphaBounds(value, {
      requirements: { nonEmpty: true, minimumTransparentMarginPixels: 0 },
    });
    expect(required.requirements).toMatchObject({
      status: "not-met",
      failures: ["content-empty"],
    });
  });

  it("does not mutate input, caps alpha diagnostics, and clamps caller limits", () => {
    const value = buildPng({
      width: 1,
      height: 1,
      colorType: 6,
      bitDepth: 8,
      pixel: () => [0, 0, 0, 255],
      compressedSuffix: Buffer.from([1]),
    });
    const before = Buffer.from(value);
    const result = inspectResourcepackPngAlphaBounds(value, {
      requirements: { nonEmpty: "yes" } as never,
      limits: { maxDiagnostics: 1 },
    });
    expect(value).toEqual(before);
    expect(result.diagnosticTotal).toBe(2);
    expect(result).toMatchObject({
      retainedDiagnosticCount: 1,
      omittedDiagnosticCount: 1,
      diagnosticsTruncated: true,
      exceededLimits: ["maxDiagnostics"],
      requirements: { inputValid: false, status: "not-checked" },
    });

    expect(
      resolveResourcepackPngAlphaBoundsLimits({
        maxInflatedBytes: Number.MAX_SAFE_INTEGER,
        maxPixels: 0,
      }),
    ).toMatchObject({
      maxInflatedBytes: defaultResourcepackPngAlphaBoundsLimits.maxInflatedBytes,
      maxPixels: defaultResourcepackPngAlphaBoundsLimits.maxPixels,
    });

    const revokedLimits = Proxy.revocable({}, {});
    revokedLimits.revoke();
    expect(resolveResourcepackPngAlphaBoundsLimits(revokedLimits.proxy as never)).toEqual(
      defaultResourcepackPngAlphaBoundsLimits,
    );
  });

  it("preflights revoked proxies and accessors without invoking traps or throwing", () => {
    const value = buildPng({
      width: 1,
      height: 1,
      colorType: 6,
      bitDepth: 8,
      pixel: () => [0, 0, 0, 255],
    });

    const revokedBytes = Proxy.revocable(value, {});
    revokedBytes.revoke();
    const invalidBytes = inspectResourcepackPngAlphaBounds(
      revokedBytes.proxy as unknown as Uint8Array,
    );
    expect(invalidBytes).toMatchObject({
      png: { valid: false, diagnostics: [{ code: "png.invalid-byte-input" }] },
      pixelInspectionStatus: "indeterminate",
      pixelInspectionReason: "png-structure-invalid",
    });

    let accessorCalls = 0;
    const accessorOptions = {};
    Object.defineProperty(accessorOptions, "requirements", {
      enumerable: true,
      get: () => {
        accessorCalls += 1;
        throw new Error("must not run");
      },
    });
    const accessorResult = inspectResourcepackPngAlphaBounds(value, accessorOptions as never);
    expect(accessorCalls).toBe(0);
    expect(accessorResult.pixelInspectionStatus).toBe("complete");
    expect(accessorResult.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "png-alpha.invalid-options-property",
    );

    const liveOptions = new Proxy(
      {},
      {
        get: () => {
          throw new Error("must not run");
        },
      },
    );
    expect(inspectResourcepackPngAlphaBounds(value, liveOptions)).toMatchObject({
      pixelInspectionStatus: "complete",
      requirements: { inputValid: false, status: "not-checked" },
      diagnostics: [{ code: "png-alpha.invalid-options-object" }],
    });

    const limitAccessor = {};
    Object.defineProperty(limitAccessor, "maxInflatedBytes", {
      enumerable: true,
      get: () => {
        accessorCalls += 1;
        throw new Error("must not run");
      },
    });
    const invalidLimits = inspectResourcepackPngAlphaBounds(value, {
      limits: limitAccessor,
    } as never);
    expect(accessorCalls).toBe(0);
    expect(invalidLimits.pixelInspectionStatus).toBe("complete");
    expect(invalidLimits.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "png-alpha.invalid-limits-property",
    );

    const revokedRequirements = Proxy.revocable({}, {});
    revokedRequirements.revoke();
    const invalidRequirements = inspectResourcepackPngAlphaBounds(value, {
      requirements: revokedRequirements.proxy,
    } as never);
    expect(invalidRequirements).toMatchObject({
      pixelInspectionStatus: "complete",
      requirements: { inputValid: false, status: "not-checked" },
    });
    expect(invalidRequirements.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "png-alpha.invalid-requirements-object",
    );

    const nonEnumerableRequirements = {};
    Object.defineProperty(nonEnumerableRequirements, "nonEmpty", {
      enumerable: false,
      value: true,
    });
    const symbolLimits = { [Symbol("limit")]: 1 };
    class OptionsClass {}
    const hostileOptions: Array<[unknown, string]> = [
      [null, "png-alpha.invalid-options-object"],
      [[], "png-alpha.invalid-options-object"],
      [new OptionsClass(), "png-alpha.invalid-options-object"],
      [{ unknown: true }, "png-alpha.invalid-options-property"],
      [{ [Symbol("option")]: true }, "png-alpha.invalid-options-property"],
      [{ limits: symbolLimits }, "png-alpha.invalid-limits-property"],
      [{ requirements: nonEnumerableRequirements }, "png-alpha.invalid-requirements-property"],
    ];
    for (const [hostile, code] of hostileOptions) {
      const result = inspectResourcepackPngAlphaBounds(value, hostile as never);
      expect(result.pixelInspectionStatus).toBe("complete");
      expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(code);
    }

    const shared = new Uint8Array(new SharedArrayBuffer(value.byteLength));
    shared.set(value);
    const sharedResult = inspectResourcepackPngAlphaBounds(shared);
    shared.fill(0);
    expect(sharedResult).toMatchObject({
      pixelInspectionStatus: "complete",
      content: "nonempty",
      nonzeroAlphaPixelCount: 1,
    });

    class ByteSubclass extends Uint8Array {}
    for (const hostileBytes of [
      null,
      [],
      new DataView(new ArrayBuffer(1)),
      new ByteSubclass(value),
    ]) {
      expect(
        inspectResourcepackPngAlphaBounds(hostileBytes as unknown as Uint8Array),
      ).toMatchObject({
        png: { valid: false },
        pixelInspectionStatus: "indeterminate",
      });
    }
  });
});

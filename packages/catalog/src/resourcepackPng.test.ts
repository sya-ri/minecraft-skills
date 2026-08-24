import { describe, expect, it } from "vitest";
import {
  defaultResourcepackPngValidationLimits,
  resolveResourcepackPngValidationLimits,
  validateResourcepackPng,
} from "./resourcepackPng.js";

const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

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

function ihdr(
  options: {
    width?: number;
    height?: number;
    bitDepth?: number;
    colorType?: number;
    compressionMethod?: number;
    filterMethod?: number;
    interlaceMethod?: number;
  } = {},
): Buffer {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(options.width ?? 3, 0);
  data.writeUInt32BE(options.height ?? 5, 4);
  data[8] = options.bitDepth ?? 8;
  data[9] = options.colorType ?? 6;
  data[10] = options.compressionMethod ?? 0;
  data[11] = options.filterMethod ?? 0;
  data[12] = options.interlaceMethod ?? 0;
  return chunk("IHDR", data);
}

function png(...chunks: Uint8Array[]): Buffer {
  return Buffer.concat([signature, ...chunks.map((value) => Buffer.from(value))]);
}

function structurallyValidPng(header: Buffer = ihdr()): Buffer {
  return png(header, chunk("IDAT", Buffer.from([0x78, 0x9c, 0x03, 0x00])), chunk("IEND"));
}

function codes(bytes: Uint8Array): string[] {
  return validateResourcepackPng(bytes).diagnostics.map((diagnostic) => diagnostic.code);
}

describe("validateResourcepackPng", () => {
  it("matches the W3C PNG IEND CRC oracle", () => {
    expect(chunk("IEND").readUInt32BE(8)).toBe(0xae42_6082);
  });

  it("validates a complete non-square, non-power-of-two PNG structure without decoding IDAT", () => {
    const result = validateResourcepackPng(structurallyValidPng());

    expect(result).toMatchObject({
      valid: true,
      validationComplete: true,
      width: 3,
      height: 5,
      bitDepth: 8,
      colorType: 6,
      chunkCount: 3,
      idatChunkCount: 1,
      crcCheckedChunkCount: 3,
      errorCount: 0,
      diagnostics: [],
    });
    expect(result.scannedBytes).toBe(result.inputBytes);
    expect(result.notes.join("\n")).toContain("IDAT payloads are not decompressed");
    expect(result.notes.join("\n")).toContain("power-of-two");
  });

  it("requires the exact complete PNG signature", () => {
    const truncated = validateResourcepackPng(signature.subarray(0, 7));
    const wrong = Buffer.from(structurallyValidPng());
    wrong[1] = 0;

    expect(truncated.validationComplete).toBe(false);
    expect(truncated.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "png.truncated-signature",
    ]);
    expect(codes(wrong)).toContain("png.invalid-signature");
  });

  it("requires one first 13-byte IHDR and one IEND", () => {
    const wrongOrder = png(chunk("IDAT"), ihdr(), ihdr(), chunk("IEND", Buffer.from([1])));
    const wrongOrderCodes = codes(wrongOrder);

    expect(wrongOrderCodes).toContain("png.ihdr-not-first");
    expect(wrongOrderCodes).toContain("png.duplicate-ihdr");
    expect(wrongOrderCodes).toContain("png.invalid-iend-length");
    expect(codes(png(chunk("IHDR"), chunk("IDAT"), chunk("IEND")))).toContain(
      "png.invalid-ihdr-length",
    );
    expect(codes(png(chunk("IDAT"), chunk("IEND")))).toContain("png.missing-ihdr");
    expect(codes(png(ihdr(), chunk("IDAT")))).toContain("png.missing-iend");
  });

  it("checks positive 31-bit dimensions and configured dimension and pixel caps without multiplication", () => {
    const invalid = validateResourcepackPng(
      structurallyValidPng(ihdr({ width: 0, height: 0x8000_0000 })),
    );
    expect(invalid.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["png.invalid-width", "png.invalid-height"]),
    );

    const exact = validateResourcepackPng(structurallyValidPng(), {
      limits: { maxWidth: 3, maxHeight: 5, maxPixels: 15 },
    });
    expect(exact.valid).toBe(true);

    const limited = validateResourcepackPng(structurallyValidPng(), {
      limits: { maxWidth: 2, maxHeight: 4, maxPixels: 14 },
    });
    expect(limited.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        "png.width-limit-exceeded",
        "png.height-limit-exceeded",
        "png.pixel-limit-exceeded",
      ]),
    );
  });

  it.each([
    [{ bitDepth: 4, colorType: 2 }, "png.invalid-bit-depth-color-type"],
    [{ compressionMethod: 1 }, "png.invalid-compression-method"],
    [{ filterMethod: 1 }, "png.invalid-filter-method"],
    [{ interlaceMethod: 2 }, "png.invalid-interlace-method"],
  ] as const)("rejects invalid IHDR method or color combinations %#", (header, code) => {
    expect(codes(structurallyValidPng(ihdr(header)))).toContain(code);
  });

  it.each([
    [0, 1],
    [0, 2],
    [0, 4],
    [0, 8],
    [0, 16],
    [2, 8],
    [2, 16],
    [3, 1],
    [3, 2],
    [3, 4],
    [3, 8],
    [4, 8],
    [4, 16],
    [6, 8],
    [6, 16],
  ])("accepts PNG color type %i with bit depth %i", (colorType, bitDepth) => {
    const chunks = [ihdr({ colorType, bitDepth })];
    if (colorType === 3) {
      chunks.push(chunk("PLTE", Buffer.from([0, 0, 0])));
    }
    chunks.push(chunk("IDAT"), chunk("IEND"));
    expect(validateResourcepackPng(png(...chunks)).valid).toBe(true);
  });

  it("bounds chunk arithmetic and reports truncated chunks explicitly", () => {
    const hugeChunkHeader = Buffer.alloc(8);
    hugeChunkHeader.writeUInt32BE(0x8000_0000, 0);
    hugeChunkHeader.write("IDAT", 4, "ascii");
    const outOfRange = validateResourcepackPng(png(ihdr(), hugeChunkHeader));
    expect(outOfRange.validationComplete).toBe(false);
    expect(outOfRange.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "png.chunk-length-out-of-range",
    );

    const maximumChunkHeader = Buffer.alloc(8);
    maximumChunkHeader.writeUInt32BE(0x7fff_ffff, 0);
    maximumChunkHeader.write("IDAT", 4, "ascii");
    expect(
      validateResourcepackPng(png(ihdr(), maximumChunkHeader)).diagnostics.map(
        (diagnostic) => diagnostic.code,
      ),
    ).toEqual(expect.arrayContaining(["png.truncated-chunk"]));

    const truncatedHeader = Buffer.alloc(8);
    truncatedHeader.writeUInt32BE(100, 0);
    truncatedHeader.write("IDAT", 4, "ascii");
    const truncated = validateResourcepackPng(png(ihdr(), truncatedHeader, Buffer.from([1, 2])));
    expect(truncated.validationComplete).toBe(false);
    expect(truncated.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "png.truncated-chunk",
    );

    const truncatedChunkHeader = validateResourcepackPng(
      png(ihdr(), Buffer.from([0, 0, 0, 1, 0x49, 0x44, 0x41])),
    );
    expect(truncatedChunkHeader.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "png.truncated-chunk-header",
    ]);

    const missingCrcByte = chunk("IDAT", Buffer.from([1])).subarray(0, -1);
    const truncatedCrc = validateResourcepackPng(png(ihdr(), missingCrcByte));
    expect(truncatedCrc.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "png.truncated-chunk",
    ]);
  });

  it("checks every completely scanned chunk CRC", () => {
    const bytes = structurallyValidPng();
    const corrupted = Buffer.from(bytes);
    corrupted[corrupted.length - 1] = (corrupted[corrupted.length - 1] ?? 0) ^ 0xff;
    const result = validateResourcepackPng(corrupted);

    expect(result.crcCheckedChunkCount).toBe(3);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "png.crc-mismatch", chunkType: "IEND" }),
    );
    expect(result.validationComplete).toBe(false);
  });

  it("does not trust IHDR fields after an IHDR CRC mismatch", () => {
    const corrupted = Buffer.from(structurallyValidPng());
    corrupted[32] = (corrupted[32] ?? 0) ^ 0xff;
    const result = validateResourcepackPng(corrupted);

    expect(result).toMatchObject({
      valid: false,
      validationComplete: false,
      width: null,
      height: null,
      bitDepth: null,
      colorType: null,
    });
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(["png.crc-mismatch"]);
  });

  it("rejects post-IEND bytes and recognizes an immediately duplicated IEND", () => {
    const trailing = validateResourcepackPng(
      Buffer.concat([structurallyValidPng(), Buffer.from([1, 2, 3])]),
    );
    expect(trailing.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "png.post-iend-data",
    );

    const duplicate = validateResourcepackPng(
      Buffer.concat([structurallyValidPng(), chunk("IEND")]),
    );
    expect(duplicate.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["png.post-iend-data", "png.duplicate-iend"]),
    );
    expect(duplicate.crcCheckedChunkCount).toBe(4);

    const corruptedTrailingIend = chunk("IEND");
    corruptedTrailingIend[11] = (corruptedTrailingIend[11] ?? 0) ^ 0xff;
    const untrustedDuplicate = validateResourcepackPng(
      Buffer.concat([structurallyValidPng(), corruptedTrailingIend]),
    );
    expect(untrustedDuplicate.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "png.crc-mismatch",
    );
    expect(untrustedDuplicate.diagnostics.map((diagnostic) => diagnostic.code)).not.toContain(
      "png.duplicate-iend",
    );
  });

  it("checks IDAT and palette presence, ordering, and bounded static structure", () => {
    expect(codes(png(ihdr(), chunk("IEND")))).toContain("png.missing-idat");
    expect(
      codes(png(ihdr(), chunk("IDAT"), chunk("tEXt"), chunk("IDAT"), chunk("IEND"))),
    ).toContain("png.nonconsecutive-idat");
    expect(codes(png(ihdr({ colorType: 3 }), chunk("IDAT"), chunk("IEND")))).toContain(
      "png.missing-plte",
    );
    expect(
      codes(
        png(
          ihdr({ colorType: 3, bitDepth: 1 }),
          chunk("PLTE", Buffer.alloc(9)),
          chunk("IDAT"),
          chunk("IEND"),
        ),
      ),
    ).toContain("png.plte-too-many-entries");

    const paletteProblems = codes(
      png(
        ihdr({ colorType: 0 }),
        chunk("IDAT"),
        chunk("PLTE", Buffer.from([0, 0])),
        chunk("PLTE", Buffer.from([0, 0, 0])),
        chunk("IEND"),
      ),
    );
    expect(paletteProblems).toEqual(
      expect.arrayContaining([
        "png.plte-after-idat",
        "png.invalid-plte-length",
        "png.plte-forbidden",
        "png.duplicate-plte",
      ]),
    );
  });

  it("validates tRNS length, multiplicity, ordering, and color-type rules", () => {
    expect(
      validateResourcepackPng(
        png(
          ihdr({ colorType: 0, bitDepth: 4 }),
          chunk("tRNS", Buffer.from([0xf0, 0x03])),
          chunk("IDAT"),
          chunk("IEND"),
        ),
      ).valid,
    ).toBe(true);
    expect(
      validateResourcepackPng(
        png(ihdr({ colorType: 2 }), chunk("tRNS", Buffer.alloc(6)), chunk("IDAT"), chunk("IEND")),
      ).valid,
    ).toBe(true);
    expect(
      validateResourcepackPng(
        png(
          ihdr({ colorType: 3, bitDepth: 1 }),
          chunk("PLTE", Buffer.alloc(6)),
          chunk("tRNS", Buffer.from([0])),
          chunk("IDAT"),
          chunk("IEND"),
        ),
      ).valid,
    ).toBe(true);
    expect(
      validateResourcepackPng(
        png(
          ihdr({ colorType: 3, bitDepth: 1 }),
          chunk("PLTE", Buffer.alloc(3)),
          chunk("tRNS"),
          chunk("IDAT"),
          chunk("IEND"),
        ),
      ).valid,
    ).toBe(true);

    expect(
      codes(
        png(
          ihdr({ colorType: 0 }),
          chunk("tRNS", Buffer.from([0])),
          chunk("tRNS", Buffer.alloc(2)),
          chunk("IDAT"),
          chunk("IEND"),
        ),
      ),
    ).toEqual(expect.arrayContaining(["png.invalid-trns-length", "png.duplicate-trns"]));
    expect(
      codes(
        png(ihdr({ colorType: 2 }), chunk("tRNS", Buffer.alloc(2)), chunk("IDAT"), chunk("IEND")),
      ),
    ).toContain("png.invalid-trns-length");
    expect(
      codes(
        png(ihdr({ colorType: 6 }), chunk("tRNS", Buffer.alloc(6)), chunk("IDAT"), chunk("IEND")),
      ),
    ).toContain("png.trns-forbidden");

    const indexedOrdering = codes(
      png(
        ihdr({ colorType: 3 }),
        chunk("tRNS", Buffer.from([0, 255])),
        chunk("PLTE", Buffer.alloc(3)),
        chunk("IDAT"),
        chunk("IEND"),
      ),
    );
    expect(indexedOrdering).toEqual(
      expect.arrayContaining([
        "png.trns-before-plte",
        "png.plte-after-trns",
        "png.trns-too-many-entries",
      ]),
    );
    expect(
      codes(
        png(ihdr({ colorType: 0 }), chunk("IDAT"), chunk("tRNS", Buffer.alloc(2)), chunk("IEND")),
      ),
    ).toContain("png.trns-after-idat");
  });

  it("distinguishes unknown critical, unknown ancillary, and invalid reserved-bit chunks", () => {
    const unknownCritical = codes(png(ihdr(), chunk("ABCD"), chunk("IDAT"), chunk("IEND")));
    expect(unknownCritical).toContain("png.unknown-critical-chunk");

    const unknownAncillary = validateResourcepackPng(
      png(ihdr(), chunk("aBCD"), chunk("IDAT"), chunk("IEND")),
    );
    expect(unknownAncillary.valid).toBe(true);

    const reserved = codes(png(ihdr(), chunk("abcD"), chunk("IDAT"), chunk("IEND")));
    expect(reserved).toContain("png.invalid-reserved-bit");

    const invalidType = codes(png(ihdr(), chunk("AB1D"), chunk("IDAT"), chunk("IEND")));
    expect(invalidType).toContain("png.invalid-chunk-type");
  });

  it("validates Uint8Array views with a nonzero byte offset", () => {
    const value = structurallyValidPng();
    const container = Buffer.concat([Buffer.from([1, 2, 3]), value, Buffer.from([4, 5])]);
    expect(validateResourcepackPng(container.subarray(3, 3 + value.byteLength)).valid).toBe(true);
  });

  it("caps input, chunks, retained diagnostics, and requested limits", () => {
    const value = structurallyValidPng();
    const exactInputLimit = validateResourcepackPng(value, {
      limits: { maxInputBytes: value.byteLength },
    });
    expect(exactInputLimit.valid).toBe(true);
    const inputLimited = validateResourcepackPng(value, {
      limits: { maxInputBytes: value.byteLength - 1 },
    });
    expect(inputLimited).toMatchObject({
      valid: false,
      validationComplete: false,
      scannedBytes: 0,
    });
    expect(inputLimited.diagnostics[0]?.code).toBe("png.input-byte-limit-exceeded");
    expect(inputLimited.exceededLimits).toContain("maxInputBytes");

    const chunksAtLimit = validateResourcepackPng(structurallyValidPng(), {
      limits: { maxChunks: 3 },
    });
    expect(chunksAtLimit.valid).toBe(true);

    const chunksLimited = validateResourcepackPng(structurallyValidPng(), {
      limits: { maxChunks: 2 },
    });
    expect(chunksLimited.validationComplete).toBe(false);
    expect(chunksLimited.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "png.chunk-limit-exceeded",
    );

    const diagnosticsLimited = validateResourcepackPng(png(chunk("IEND")), {
      limits: { maxDiagnostics: 1 },
    });
    expect(diagnosticsLimited.diagnosticTotal).toBeGreaterThan(1);
    expect(diagnosticsLimited).toMatchObject({
      retainedDiagnosticCount: 1,
      diagnosticsTruncated: true,
    });
    expect(diagnosticsLimited.exceededLimits).toContain("maxDiagnostics");

    const postIendAtChunkLimit = validateResourcepackPng(Buffer.concat([value, Buffer.from([1])]), {
      limits: { maxChunks: 3 },
    });
    expect(postIendAtChunkLimit.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "png.post-iend-data",
    );
    expect(postIendAtChunkLimit.diagnostics.map((diagnostic) => diagnostic.code)).not.toContain(
      "png.chunk-limit-exceeded",
    );

    expect(
      resolveResourcepackPngValidationLimits({
        maxInputBytes: Number.MAX_SAFE_INTEGER,
        maxWidth: 0,
      }),
    ).toMatchObject({
      maxInputBytes: defaultResourcepackPngValidationLimits.maxInputBytes,
      maxWidth: defaultResourcepackPngValidationLimits.maxWidth,
    });
  });
});

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { inspectWaveAudio, waveAudioInspectionLimits } from "./waveAudio.js";

type FormatOptions = {
  tag?: number;
  channels?: number;
  sampleRate?: number;
  bits?: number;
  blockAlign?: number;
  byteRate?: number;
};

function ascii(value: string): Uint8Array {
  return Uint8Array.from([...value].map((character) => character.charCodeAt(0)));
}

function concatenate(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function uint16(value: number): Uint8Array {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function uint32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
}

function chunk(id: string, data: Uint8Array, includePadding = true): Uint8Array {
  return concatenate(
    ascii(id),
    uint32(data.length),
    data,
    ...(includePadding && data.length % 2 === 1 ? [Uint8Array.of(0)] : []),
  );
}

function riff(...chunks: Uint8Array[]): Uint8Array {
  const body = concatenate(ascii("WAVE"), ...chunks);
  return concatenate(ascii("RIFF"), uint32(body.length), body);
}

function classicFormat(options: FormatOptions = {}): Uint8Array {
  const tag = options.tag ?? 1;
  const channels = options.channels ?? 1;
  const sampleRate = options.sampleRate ?? 48_000;
  const bits = options.bits ?? 16;
  const blockAlign = options.blockAlign ?? channels * (bits / 8);
  const byteRate = options.byteRate ?? sampleRate * blockAlign;
  return concatenate(
    uint16(tag),
    uint16(channels),
    uint32(sampleRate),
    uint32(byteRate),
    uint16(blockAlign),
    uint16(bits),
  );
}

const pcmGuid = Uint8Array.of(
  0x01,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x10,
  0x00,
  0x80,
  0x00,
  0x00,
  0xaa,
  0x00,
  0x38,
  0x9b,
  0x71,
);

const floatGuid = Uint8Array.of(
  0x03,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x10,
  0x00,
  0x80,
  0x00,
  0x00,
  0xaa,
  0x00,
  0x38,
  0x9b,
  0x71,
);

function extensibleFormat(options: {
  codec: "pcm" | "float";
  channels?: number;
  sampleRate?: number;
  bits: number;
  validBits: number;
}): Uint8Array {
  const channels = options.channels ?? 1;
  const sampleRate = options.sampleRate ?? 48_000;
  const blockAlign = channels * (options.bits / 8);
  return concatenate(
    classicFormat({
      tag: 0xfffe,
      channels,
      sampleRate,
      bits: options.bits,
      blockAlign,
      byteRate: sampleRate * blockAlign,
    }),
    uint16(22),
    uint16(options.validBits),
    uint32(0),
    options.codec === "pcm" ? pcmGuid : floatGuid,
  );
}

function pcmSamples(bits: 16 | 24 | 32, values: number[]): Uint8Array {
  const bytesPerSample = bits / 8;
  const bytes = new Uint8Array(values.length * bytesPerSample);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => {
    const offset = index * bytesPerSample;
    if (bits === 16) {
      view.setInt16(offset, value, true);
    } else if (bits === 24) {
      const unsigned = value < 0 ? value + 0x100_0000 : value;
      view.setUint8(offset, unsigned & 0xff);
      view.setUint8(offset + 1, (unsigned >>> 8) & 0xff);
      view.setUint8(offset + 2, (unsigned >>> 16) & 0xff);
    } else {
      view.setInt32(offset, value, true);
    }
  });
  return bytes;
}

function floatSamples(bits: 32 | 64, values: number[]): Uint8Array {
  const bytesPerSample = bits / 8;
  const bytes = new Uint8Array(values.length * bytesPerSample);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => {
    if (bits === 32) {
      view.setFloat32(index * bytesPerSample, value, true);
    } else {
      view.setFloat64(index * bytesPerSample, value, true);
    }
  });
  return bytes;
}

function wave(format: Uint8Array, data: Uint8Array): Uint8Array {
  return riff(chunk("fmt ", format), chunk("data", data));
}

function diagnosticCodes(bytes: Uint8Array): string[] {
  return inspectWaveAudio(bytes).diagnostics.map((diagnostic) => diagnostic.code);
}

describe("inspectWaveAudio", () => {
  it("publishes immutable fixed bounds and snapshots content for SHA-256", () => {
    expect(Object.isFrozen(waveAudioInspectionLimits)).toBe(true);
    const bytes = wave(classicFormat(), pcmSamples(16, [0, 1]));
    const expectedHash = createHash("sha256").update(bytes).digest("hex");

    const result = inspectWaveAudio(bytes);
    bytes.fill(0);

    expect(result.contentSha256).toBe(expectedHash);
    expect(result.valid).toBe(true);
    expect(result.inspectionComplete).toBe(true);
    expect(result.inputBytes).toBe(48);
  });

  it("normalizes unsigned 8-bit PCM and counts both integer full-scale endpoints", () => {
    const result = inspectWaveAudio(wave(classicFormat({ bits: 8 }), Uint8Array.of(0, 128, 255)));
    const expectedRms = Math.sqrt((1 + (127 / 128) ** 2) / 3);

    expect(result.valid).toBe(true);
    expect(result.codec).toBe("pcm");
    expect(result.signalState).toBe("signal");
    expect(result.peakDbfs).toBeCloseTo(0, 12);
    expect(result.rmsDbfs).toBeCloseTo(20 * Math.log10(expectedRms), 10);
    expect(result.atOrBeyondFullScaleSampleCount).toBe(2);
    expect(result.notes.join(" ")).toContain("does not prove waveform clipping");
    expect(result.frameCount).toBe(3);
  });

  it.each([
    { bits: 16 as const, minimum: -0x8000, maximum: 0x7fff },
    { bits: 24 as const, minimum: -0x80_0000, maximum: 0x7f_ffff },
    { bits: 32 as const, minimum: -0x8000_0000, maximum: 0x7fff_ffff },
  ])("normalizes signed $bits-bit PCM", ({ bits, minimum, maximum }) => {
    const result = inspectWaveAudio(
      wave(classicFormat({ bits }), pcmSamples(bits, [minimum, 0, maximum])),
    );

    expect(result.valid).toBe(true);
    expect(result.peakDbfs).toBeCloseTo(0, 12);
    expect(result.atOrBeyondFullScaleSampleCount).toBe(2);
    expect(result.sampleCount).toBe(3);
  });

  it.each([
    { bits: 32 as const, values: [-1, 0.5], fullScaleCount: 1 },
    { bits: 64 as const, values: [2, 0], fullScaleCount: 1 },
  ])("inspects finite $bits-bit IEEE float samples", ({ bits, values, fullScaleCount }) => {
    const result = inspectWaveAudio(
      wave(classicFormat({ tag: 3, bits }), floatSamples(bits, values)),
    );

    expect(result.valid).toBe(true);
    expect(result.codec).toBe("ieee-float");
    expect(result.peakDbfs).toBeCloseTo(20 * Math.log10(Math.max(...values.map(Math.abs))), 10);
    expect(result.atOrBeyondFullScaleSampleCount).toBe(fullScaleCount);
  });

  it("supports left-aligned WAVE_FORMAT_EXTENSIBLE PCM valid bits", () => {
    const minimum = -0x80_000;
    const maximum = 0x7f_fff;
    const result = inspectWaveAudio(
      wave(
        extensibleFormat({ codec: "pcm", bits: 24, validBits: 20 }),
        pcmSamples(24, [minimum * 16, maximum * 16]),
      ),
    );

    expect(result.valid).toBe(true);
    expect(result.extensible).toBe(true);
    expect(result.containerBitsPerSample).toBe(24);
    expect(result.validBitsPerSample).toBe(20);
    expect(result.channelMask).toBe(0);
    expect(result.warningCount).toBe(0);
    expect(result.atOrBeyondFullScaleSampleCount).toBe(2);
    expect(result.peakDbfs).toBeCloseTo(0, 12);
  });

  it("rejects nonzero low padding bits in extensible PCM without publishing metrics", () => {
    const result = inspectWaveAudio(
      wave(extensibleFormat({ codec: "pcm", bits: 24, validBits: 20 }), pcmSamples(24, [16_001])),
    );

    expect(result.valid).toBe(false);
    expect(result.inspectionComplete).toBe(true);
    expect(result.signalState).toBe("invalid");
    expect(result.peakDbfs).toBeNull();
    expect(result.rmsDbfs).toBeNull();
    expect(result.atOrBeyondFullScaleSampleCount).toBeNull();
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "wave.nonzero-padding-bits" })]),
    );
  });

  it("reports silence explicitly with JSON-safe null dBFS metrics", () => {
    const result = inspectWaveAudio(wave(classicFormat(), pcmSamples(16, [0, 0, 0, 0])));

    expect(result.valid).toBe(true);
    expect(result.signalState).toBe("silence");
    expect(result.peakDbfs).toBeNull();
    expect(result.rmsDbfs).toBeNull();
    expect(result.atOrBeyondFullScaleSampleCount).toBe(0);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it("reports empty audio explicitly with JSON-safe null dBFS metrics", () => {
    const result = inspectWaveAudio(wave(classicFormat(), new Uint8Array(0)));

    expect(result.valid).toBe(true);
    expect(result.inspectionComplete).toBe(true);
    expect(result.frameCount).toBe(0);
    expect(result.sampleCount).toBe(0);
    expect(result.durationSeconds).toBe(0);
    expect(result.signalState).toBe("empty");
    expect(result.peakDbfs).toBeNull();
    expect(result.rmsDbfs).toBeNull();
    expect(result.atOrBeyondFullScaleSampleCount).toBe(0);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it("aggregates non-finite float samples and keeps every numeric output JSON-safe", () => {
    const result = inspectWaveAudio(
      wave(classicFormat({ tag: 3, bits: 64 }), floatSamples(64, [Number.NaN, Infinity, 0.5])),
    );

    expect(result.valid).toBe(false);
    expect(result.inspectionComplete).toBe(true);
    expect(result.signalState).toBe("invalid");
    expect(result.peakDbfs).toBeNull();
    expect(result.rmsDbfs).toBeNull();
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "wave.non-finite-float-samples",
          message: "2 IEEE float sample(s) are NaN or infinite.",
        }),
      ]),
    );
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it("reports stereo and arbitrary positive sample rates without compatibility errors", () => {
    const result = inspectWaveAudio(
      wave(classicFormat({ channels: 2, sampleRate: 12_345 }), pcmSamples(16, [1, -1, 2, -2])),
    );

    expect(result.valid).toBe(true);
    expect(result.channels).toBe(2);
    expect(result.sampleRate).toBe(12_345);
    expect(result.frameCount).toBe(2);
    expect(result.durationSeconds).toBeCloseTo(2 / 12_345, 12);
    expect(result.diagnostics).toEqual([]);
  });

  it.each([
    classicFormat({ bits: 24 }),
    classicFormat({ tag: 3, bits: 64 }),
    classicFormat({ channels: 3, bits: 16 }),
  ])("warns when legacy non-extensible format metadata is ambiguous", (format) => {
    const bytesPerFrame = new DataView(
      format.buffer,
      format.byteOffset,
      format.byteLength,
    ).getUint16(12, true);
    const result = inspectWaveAudio(wave(format, new Uint8Array(bytesPerFrame)));

    expect(result.valid).toBe(true);
    expect(result.warningCount).toBeGreaterThanOrEqual(1);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "wave.nonextensible-format-ambiguity",
    );
  });

  it("reports extensible channel masks and warns, but does not fail, on count mismatch", () => {
    const format = extensibleFormat({ codec: "float", bits: 32, validBits: 32, channels: 2 });
    new DataView(format.buffer).setUint32(20, 0x0000_0004, true);
    const result = inspectWaveAudio(wave(format, floatSamples(32, [0, 0])));

    expect(result.valid).toBe(true);
    expect(result.channelMask).toBe(0x0000_0004);
    expect(result.diagnostics[0]?.code).toBe("wave.channel-mask-count-mismatch");
  });

  it("rejects unsupported codecs without repeating Ogg inspection", () => {
    const result = inspectWaveAudio(
      wave(classicFormat({ tag: 0x0006, bits: 8 }), Uint8Array.of(128)),
    );

    expect(result.valid).toBe(false);
    expect(result.inspectionComplete).toBe(false);
    expect(result.codec).toBeNull();
    expect(result.signalState).toBe("not-analyzed");
    expect(
      diagnosticCodes(wave(classicFormat({ tag: 0x0006, bits: 8 }), Uint8Array.of(128))),
    ).toContain("wave.unsupported-codec");
    expect(result.notes.join(" ")).toContain("Ogg Vorbis");
  });

  it("diagnoses data alignment and format arithmetic independently", () => {
    const result = inspectWaveAudio(
      wave(
        classicFormat({ channels: 2, bits: 16, blockAlign: 4, byteRate: 1 }),
        pcmSamples(16, [1]),
      ),
    );

    expect(result.valid).toBe(false);
    expect(result.inspectionComplete).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["wave.invalid-byte-rate", "wave.data-not-frame-aligned"]),
    );
  });

  it("diagnoses duplicate and missing required chunks", () => {
    const duplicate = inspectWaveAudio(
      riff(
        chunk("fmt ", classicFormat()),
        chunk("fmt ", classicFormat()),
        chunk("data", pcmSamples(16, [0])),
        chunk("data", pcmSamples(16, [0])),
      ),
    );
    const missing = inspectWaveAudio(riff(chunk("JUNK", new Uint8Array(0))));

    expect(duplicate.valid).toBe(false);
    expect(duplicate.inspectionComplete).toBe(false);
    expect(duplicate.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["wave.duplicate-format-chunk", "wave.duplicate-data-chunk"]),
    );
    expect(missing.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["wave.missing-format-chunk", "wave.missing-data-chunk"]),
    );
  });

  it("accepts fmt and data in any order with an odd-sized padded unknown chunk", () => {
    const result = inspectWaveAudio(
      riff(
        chunk("data", pcmSamples(16, [0, 1])),
        chunk("JUNK", Uint8Array.of(1, 2, 3)),
        chunk("fmt ", classicFormat()),
      ),
    );

    expect(result.valid).toBe(true);
    expect(result.inspectionComplete).toBe(true);
    expect(result.chunkCount).toBe(3);
    expect(result.frameCount).toBe(2);
    expect(result.diagnostics).toEqual([]);
  });

  it("warns when fmt bytes remain outside cbSize", () => {
    const formatWithUnreportedBytes = concatenate(classicFormat(), uint16(0), Uint8Array.of(1, 2));
    const result = inspectWaveAudio(wave(formatWithUnreportedBytes, pcmSamples(16, [0])));

    expect(result.valid).toBe(true);
    expect(result.inspectionComplete).toBe(true);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "wave.unreported-format-extension-bytes" }),
      ]),
    );
  });

  it("diagnoses RIFF declared-size truncation, trailing bytes, and missing odd-chunk padding", () => {
    const valid = wave(classicFormat(), pcmSamples(16, [0]));
    const truncatedDeclaration = valid.slice();
    new DataView(truncatedDeclaration.buffer).setUint32(4, valid.length + 20, true);
    const trailing = concatenate(valid, Uint8Array.of(0xaa));
    const missingPaddingBody = concatenate(ascii("WAVE"), chunk("JUNK", Uint8Array.of(1), false));
    const missingPadding = concatenate(
      ascii("RIFF"),
      uint32(missingPaddingBody.length),
      missingPaddingBody,
    );

    expect(diagnosticCodes(truncatedDeclaration)).toContain("wave.truncated-riff");
    expect(diagnosticCodes(trailing)).toContain("wave.trailing-data");
    expect(diagnosticCodes(missingPadding)).toContain("wave.missing-chunk-padding");
  });

  it("stops before parsing chunks or samples beyond fixed limits", () => {
    const junkChunks = Array.from({ length: waveAudioInspectionLimits.maxChunks + 1 }, () =>
      chunk("JUNK", new Uint8Array(0)),
    );
    const chunkLimited = inspectWaveAudio(riff(...junkChunks));
    const oversized = Buffer.allocUnsafe(waveAudioInspectionLimits.maxInputBytes + 1);
    const byteLimited = inspectWaveAudio(oversized);

    expect(chunkLimited.exceededLimits).toContain("maxChunks");
    expect(chunkLimited.chunkCount).toBe(waveAudioInspectionLimits.maxChunks);
    expect(chunkLimited.inspectionComplete).toBe(false);
    expect(byteLimited.exceededLimits).toEqual(["maxInputBytes"]);
    expect(byteLimited.contentSha256).toBeNull();
    expect(byteLimited.inputBytes).toBe(waveAudioInspectionLimits.maxInputBytes + 1);
  });

  it("reports the sample limit before iterating an oversized sample payload", () => {
    const data = new Uint8Array(waveAudioInspectionLimits.maxSamples + 1);
    const result = inspectWaveAudio(wave(classicFormat({ bits: 8 }), data));

    expect(result.valid).toBe(false);
    expect(result.inspectionComplete).toBe(false);
    expect(result.sampleCount).toBe(waveAudioInspectionLimits.maxSamples + 1);
    expect(result.signalState).toBe("not-analyzed");
    expect(result.exceededLimits).toContain("maxSamples");
  });

  it("caps duplicate diagnostics and reports the omitted total", () => {
    const duplicates = Array.from({ length: waveAudioInspectionLimits.maxDiagnostics + 2 }, () =>
      chunk("fmt ", classicFormat()),
    );
    const result = inspectWaveAudio(riff(...duplicates, chunk("data", new Uint8Array(0))));

    expect(result.diagnostics).toHaveLength(waveAudioInspectionLimits.maxDiagnostics);
    expect(result.diagnosticsTruncated).toBe(true);
    expect(result.omittedDiagnosticCount).toBeGreaterThan(0);
    expect(result.exceededLimits).toContain("maxDiagnostics");
  });

  it("rejects proxy, subclass, modified-view, shared, and non-byte inputs", () => {
    class ByteSubclass extends Uint8Array {}
    const modified = new Uint8Array(0);
    Object.defineProperty(modified, "byteLength", {
      configurable: true,
      get: () => {
        throw new Error("must not invoke hostile accessors");
      },
    });
    const inputs: unknown[] = [
      new Proxy(new Uint8Array(0), {}),
      new ByteSubclass(0),
      modified,
      new Uint8Array(new SharedArrayBuffer(0)),
      [],
      "RIFF",
      null,
    ];

    for (const input of inputs) {
      const result = inspectWaveAudio(input);
      expect(result.valid).toBe(false);
      expect(result.inspectionComplete).toBe(false);
      expect(result.contentSha256).toBeNull();
      expect(result.diagnostics[0]?.code).toMatch(/^wave\.(invalid|shared)-byte-input$/);
    }
  });
});

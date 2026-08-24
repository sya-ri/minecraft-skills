import { createHash } from "node:crypto";
import { types as nodeTypes } from "node:util";

/** Fixed resource bounds for the non-mutating WAVE inspector. */
export const waveAudioInspectionLimits = Object.freeze({
  maxInputBytes: 64 * 1024 * 1024,
  maxChunks: 4_096,
  maxDiagnostics: 64,
  maxSamples: 32_000_000,
} as const);

export type WaveAudioInspectionLimitName = keyof typeof waveAudioInspectionLimits;
export type WaveAudioCodec = "pcm" | "ieee-float";
export type WaveAudioSignalState = "not-analyzed" | "empty" | "silence" | "signal" | "invalid";

export type WaveAudioDiagnostic = {
  severity: "error" | "warning";
  code: string;
  offset: number | null;
  chunkId: "RIFF" | "fmt " | "data" | null;
  message: string;
};

/**
 * A deterministic inspection of one in-memory RIFF/WAVE source file.
 *
 * `peakDbfs` and `rmsDbfs` are sample peak and unweighted sample RMS. They are
 * deliberately not described as LUFS, SPL, normalization gain, or perceived loudness.
 */
export type WaveAudioInspectionResult = {
  schemaVersion: 1;
  scope: "pre-conversion-wave-source";
  specification: "RIFF/WAVE";
  specificationUrls: {
    riff: string;
    waveFormatEx: string;
    waveFormatExtensible: string;
  };
  valid: boolean;
  inspectionComplete: boolean;
  inputBytes: number | null;
  contentSha256: string | null;
  codec: WaveAudioCodec | null;
  formatTag: number | null;
  extensible: boolean | null;
  channels: number | null;
  sampleRate: number | null;
  containerBitsPerSample: number | null;
  validBitsPerSample: number | null;
  channelMask: number | null;
  blockAlign: number | null;
  byteRate: number | null;
  dataBytes: number | null;
  frameCount: number | null;
  sampleCount: number | null;
  durationSeconds: number | null;
  signalState: WaveAudioSignalState;
  peakDbfs: number | null;
  rmsDbfs: number | null;
  atOrBeyondFullScaleSampleCount: number | null;
  chunkCount: number;
  errorCount: number;
  warningCount: number;
  diagnosticsTruncated: boolean;
  omittedDiagnosticCount: number;
  exceededLimits: WaveAudioInspectionLimitName[];
  diagnostics: WaveAudioDiagnostic[];
  notes: string[];
};

type WaveChunk = {
  headerOffset: number;
  dataOffset: number;
  size: number;
};

type ParsedWaveFormat = {
  codec: WaveAudioCodec | null;
  formatTag: number;
  extensible: boolean;
  channels: number;
  sampleRate: number;
  containerBitsPerSample: number;
  validBitsPerSample: number | null;
  channelMask: number | null;
  blockAlign: number;
  byteRate: number;
  usableForSamples: boolean;
};

type WaveSignalMetrics = {
  state: WaveAudioSignalState;
  peakDbfs: number | null;
  rmsDbfs: number | null;
  atOrBeyondFullScaleSampleCount: number | null;
};

const riffSpecificationUrl =
  "https://learn.microsoft.com/en-us/windows/win32/xaudio2/resource-interchange-file-format--riff-";
const waveFormatExSpecificationUrl =
  "https://learn.microsoft.com/en-us/windows/win32/api/mmreg/ns-mmreg-waveformatex";
const waveFormatExtensibleSpecificationUrl =
  "https://learn.microsoft.com/en-us/windows/win32/api/mmreg/ns-mmreg-waveformatextensible";

const waveInspectionNotes = Object.freeze([
  "This inspects a pre-conversion WAVE source. Minecraft Java resource-pack sound assets remain Ogg Vorbis and are checked by resourcepack project validation.",
  "The inspector does not convert, write, normalize, or measure LUFS, SPL, or perceived loudness.",
  "atOrBeyondFullScaleSampleCount reports sample values at integer endpoints or float magnitudes of at least 1.0; it does not prove waveform clipping.",
  "Sample rate and channel count are reported as authored; stereo and arbitrary positive sample rates are not rejected by policy.",
  "A successful result proves only the bounded RIFF/WAVE structure and sample representations inspected here, not playback compatibility in every decoder.",
] as const);

const pcmSubformatGuid = Object.freeze([
  0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x80, 0x00, 0x00, 0xaa, 0x00, 0x38, 0x9b, 0x71,
]);
const ieeeFloatSubformatGuid = Object.freeze([
  0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x80, 0x00, 0x00, 0xaa, 0x00, 0x38, 0x9b, 0x71,
]);

const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype) as object;
const typedArrayByteLengthGetter = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  "byteLength",
)?.get as (this: Uint8Array) => number;
const typedArrayBufferGetter = Object.getOwnPropertyDescriptor(typedArrayPrototype, "buffer")
  ?.get as (this: Uint8Array) => ArrayBufferLike;
const typedArraySet = Uint8Array.prototype.set;

class WaveDiagnosticCollector {
  readonly diagnostics: WaveAudioDiagnostic[] = [];
  readonly exceededLimits = new Set<WaveAudioInspectionLimitName>();
  errorCount = 0;
  warningCount = 0;
  omittedDiagnosticCount = 0;

  add(
    severity: WaveAudioDiagnostic["severity"],
    code: string,
    offset: number | null,
    chunkId: WaveAudioDiagnostic["chunkId"],
    message: string,
  ): void {
    if (severity === "error") {
      this.errorCount += 1;
    } else {
      this.warningCount += 1;
    }
    if (this.diagnostics.length >= waveAudioInspectionLimits.maxDiagnostics) {
      this.omittedDiagnosticCount += 1;
      this.exceededLimits.add("maxDiagnostics");
      return;
    }
    this.diagnostics.push({ severity, code, offset, chunkId, message });
  }

  exceed(
    limit: WaveAudioInspectionLimitName,
    code: string,
    offset: number | null,
    chunkId: WaveAudioDiagnostic["chunkId"],
    message: string,
  ): void {
    this.exceededLimits.add(limit);
    this.add("error", code, offset, chunkId, message);
  }
}

function emptyResult(collector: WaveDiagnosticCollector): WaveAudioInspectionResult {
  return {
    schemaVersion: 1,
    scope: "pre-conversion-wave-source",
    specification: "RIFF/WAVE",
    specificationUrls: {
      riff: riffSpecificationUrl,
      waveFormatEx: waveFormatExSpecificationUrl,
      waveFormatExtensible: waveFormatExtensibleSpecificationUrl,
    },
    valid: false,
    inspectionComplete: false,
    inputBytes: null,
    contentSha256: null,
    codec: null,
    formatTag: null,
    extensible: null,
    channels: null,
    sampleRate: null,
    containerBitsPerSample: null,
    validBitsPerSample: null,
    channelMask: null,
    blockAlign: null,
    byteRate: null,
    dataBytes: null,
    frameCount: null,
    sampleCount: null,
    durationSeconds: null,
    signalState: "not-analyzed",
    peakDbfs: null,
    rmsDbfs: null,
    atOrBeyondFullScaleSampleCount: null,
    chunkCount: 0,
    errorCount: collector.errorCount,
    warningCount: collector.warningCount,
    diagnosticsTruncated: collector.omittedDiagnosticCount > 0,
    omittedDiagnosticCount: collector.omittedDiagnosticCount,
    exceededLimits: orderedExceededLimits(collector.exceededLimits),
    diagnostics: collector.diagnostics,
    notes: [...waveInspectionNotes],
  };
}

function orderedExceededLimits(
  limits: ReadonlySet<WaveAudioInspectionLimitName>,
): WaveAudioInspectionLimitName[] {
  return (Object.keys(waveAudioInspectionLimits) as WaveAudioInspectionLimitName[]).filter((name) =>
    limits.has(name),
  );
}

function hasOwnCriticalViewProperty(value: object): boolean {
  return ["byteLength", "byteOffset", "buffer"].some(
    (name) => Object.getOwnPropertyDescriptor(value, name) !== undefined,
  );
}

function snapshotBytes(
  input: unknown,
  collector: WaveDiagnosticCollector,
): { bytes: Uint8Array; inputBytes: number } | null {
  if (typeof input !== "object" || input === null || nodeTypes.isProxy(input)) {
    collector.add(
      "error",
      "wave.invalid-byte-input",
      null,
      null,
      "Input must be a direct Uint8Array or Buffer instance.",
    );
    return null;
  }

  try {
    const prototype = Object.getPrototypeOf(input);
    if (
      (prototype !== Uint8Array.prototype && prototype !== Buffer.prototype) ||
      hasOwnCriticalViewProperty(input)
    ) {
      collector.add(
        "error",
        "wave.invalid-byte-input",
        null,
        null,
        "Input must be a direct, unmodified Uint8Array or Buffer view.",
      );
      return null;
    }

    const byteLength = Reflect.apply(typedArrayByteLengthGetter, input, []) as number;
    if (byteLength > waveAudioInspectionLimits.maxInputBytes) {
      collector.exceed(
        "maxInputBytes",
        "wave.input-byte-limit-exceeded",
        null,
        null,
        `Input contains ${byteLength} bytes; the fixed limit is ${waveAudioInspectionLimits.maxInputBytes}.`,
      );
      return { bytes: new Uint8Array(0), inputBytes: byteLength };
    }

    const backingBuffer = Reflect.apply(typedArrayBufferGetter, input, []) as ArrayBufferLike;
    if (nodeTypes.isSharedArrayBuffer(backingBuffer)) {
      collector.add(
        "error",
        "wave.shared-byte-input",
        null,
        null,
        "SharedArrayBuffer-backed input is rejected because it cannot provide a stable snapshot.",
      );
      return null;
    }

    const snapshot = new Uint8Array(byteLength);
    Reflect.apply(typedArraySet, snapshot, [input]);
    return { bytes: snapshot, inputBytes: byteLength };
  } catch {
    collector.add(
      "error",
      "wave.invalid-byte-input",
      null,
      null,
      "Input could not be safely snapshotted as bytes.",
    );
    return null;
  }
}

function bytesMatch(bytes: Uint8Array, offset: number, expected: readonly number[]): boolean {
  return expected.every((value, index) => bytes[offset + index] === value);
}

function chunkIdMatches(bytes: Uint8Array, offset: number, id: string): boolean {
  return (
    bytes[offset] === id.charCodeAt(0) &&
    bytes[offset + 1] === id.charCodeAt(1) &&
    bytes[offset + 2] === id.charCodeAt(2) &&
    bytes[offset + 3] === id.charCodeAt(3)
  );
}

function parseWaveFormat(
  view: DataView,
  bytes: Uint8Array,
  chunk: WaveChunk,
  collector: WaveDiagnosticCollector,
): ParsedWaveFormat | null {
  if (chunk.size < 16) {
    collector.add(
      "error",
      "wave.format-chunk-too-small",
      chunk.headerOffset,
      "fmt ",
      "The fmt chunk must contain at least the 16-byte base WAVE format.",
    );
    return null;
  }

  const offset = chunk.dataOffset;
  const formatTag = view.getUint16(offset, true);
  const channels = view.getUint16(offset + 2, true);
  const sampleRate = view.getUint32(offset + 4, true);
  const byteRate = view.getUint32(offset + 8, true);
  const blockAlign = view.getUint16(offset + 12, true);
  const containerBitsPerSample = view.getUint16(offset + 14, true);
  let codec: WaveAudioCodec | null =
    formatTag === 0x0001 ? "pcm" : formatTag === 0x0003 ? "ieee-float" : null;
  const extensible = formatTag === 0xfffe;
  let validBitsPerSample: number | null = containerBitsPerSample;
  let channelMask: number | null = null;
  let usableForSamples = true;

  if (chunk.size === 17) {
    collector.add(
      "error",
      "wave.truncated-format-extension",
      chunk.headerOffset,
      "fmt ",
      "A fmt extension must include its complete 2-byte size field.",
    );
    usableForSamples = false;
  } else if (chunk.size >= 18) {
    const extensionSize = view.getUint16(offset + 16, true);
    if (extensionSize > chunk.size - 18) {
      collector.add(
        "error",
        "wave.truncated-format-extension",
        chunk.headerOffset,
        "fmt ",
        "The fmt extension size exceeds the bytes present in the chunk.",
      );
      usableForSamples = false;
    } else if (extensionSize < chunk.size - 18) {
      collector.add(
        "warning",
        "wave.unreported-format-extension-bytes",
        chunk.headerOffset,
        "fmt ",
        `${chunk.size - 18 - extensionSize} fmt chunk byte(s) remain outside the declared extension.`,
      );
    }
  } else if (formatTag === 0x0003) {
    collector.add(
      "warning",
      "wave.legacy-float-format",
      chunk.headerOffset,
      "fmt ",
      "IEEE float audio uses a 16-byte legacy fmt chunk without a WAVEFORMATEX extension size.",
    );
  }

  if (extensible) {
    if (chunk.size < 40) {
      collector.add(
        "error",
        "wave.extensible-format-too-small",
        chunk.headerOffset,
        "fmt ",
        "WAVE_FORMAT_EXTENSIBLE requires a 40-byte fmt chunk.",
      );
      codec = null;
      validBitsPerSample = null;
      usableForSamples = false;
    } else {
      const extensionSize = view.getUint16(offset + 16, true);
      validBitsPerSample = view.getUint16(offset + 18, true);
      channelMask = view.getUint32(offset + 20, true);
      if (extensionSize < 22) {
        collector.add(
          "error",
          "wave.extensible-extension-too-small",
          chunk.headerOffset,
          "fmt ",
          "WAVE_FORMAT_EXTENSIBLE requires at least 22 extension bytes.",
        );
        usableForSamples = false;
      }
      if (channelMask !== 0 && countSetBits(channelMask) !== channels) {
        collector.add(
          "warning",
          "wave.channel-mask-count-mismatch",
          chunk.headerOffset,
          "fmt ",
          "The nonzero extensible channel mask does not identify exactly one speaker position per channel.",
        );
      }
      if (bytesMatch(bytes, offset + 24, pcmSubformatGuid)) {
        codec = "pcm";
      } else if (bytesMatch(bytes, offset + 24, ieeeFloatSubformatGuid)) {
        codec = "ieee-float";
      } else {
        collector.add(
          "error",
          "wave.unsupported-extensible-subformat",
          chunk.headerOffset,
          "fmt ",
          "Only PCM and IEEE float WAVE_FORMAT_EXTENSIBLE subformats are supported.",
        );
        codec = null;
        usableForSamples = false;
      }
    }
  } else if (codec === null) {
    collector.add(
      "error",
      "wave.unsupported-codec",
      chunk.headerOffset,
      "fmt ",
      `WAVE format tag 0x${formatTag.toString(16).padStart(4, "0")} is not supported; only PCM, IEEE float, and their extensible subformats are inspected.`,
    );
    usableForSamples = false;
  }

  if (!extensible) {
    const ambiguityReasons: string[] = [];
    if (channels > 2) {
      ambiguityReasons.push("more than two channels");
    }
    if (codec === "pcm" && containerBitsPerSample > 16) {
      ambiguityReasons.push("PCM containers wider than 16 bits");
    }
    if (codec === "ieee-float" && containerBitsPerSample === 64) {
      ambiguityReasons.push("64-bit IEEE float samples");
    }
    if (ambiguityReasons.length > 0) {
      collector.add(
        "warning",
        "wave.nonextensible-format-ambiguity",
        chunk.headerOffset,
        "fmt ",
        `A non-extensible fmt chunk cannot unambiguously describe ${ambiguityReasons.join(" and ")}; WAVE_FORMAT_EXTENSIBLE carries valid-bit, channel-mask, and subformat metadata.`,
      );
    }
  }

  if (channels === 0) {
    collector.add(
      "error",
      "wave.invalid-channels",
      chunk.headerOffset,
      "fmt ",
      "Channel count must be greater than zero.",
    );
    usableForSamples = false;
  }
  if (sampleRate === 0) {
    collector.add(
      "error",
      "wave.invalid-sample-rate",
      chunk.headerOffset,
      "fmt ",
      "Sample rate must be greater than zero.",
    );
    usableForSamples = false;
  }

  const supportedBits =
    codec === "pcm"
      ? [8, 16, 24, 32].includes(containerBitsPerSample)
      : codec === "ieee-float"
        ? containerBitsPerSample === 32 || containerBitsPerSample === 64
        : null;
  if (supportedBits === false) {
    collector.add(
      "error",
      "wave.unsupported-container-bits",
      chunk.headerOffset,
      "fmt ",
      codec === "ieee-float"
        ? "IEEE float samples must use 32-bit or 64-bit containers."
        : "PCM samples must use 8-bit, 16-bit, 24-bit, or 32-bit containers.",
    );
    usableForSamples = false;
  }

  if (
    validBitsPerSample === null ||
    validBitsPerSample === 0 ||
    validBitsPerSample > containerBitsPerSample
  ) {
    collector.add(
      "error",
      "wave.invalid-valid-bits",
      chunk.headerOffset,
      "fmt ",
      "Valid bits per sample must be greater than zero and no larger than the container size.",
    );
    usableForSamples = false;
  } else if (codec === "ieee-float" && validBitsPerSample !== containerBitsPerSample) {
    collector.add(
      "error",
      "wave.invalid-float-valid-bits",
      chunk.headerOffset,
      "fmt ",
      "IEEE float valid bits must equal the container size.",
    );
    usableForSamples = false;
  }

  const bytesPerSample = containerBitsPerSample / 8;
  const expectedBlockAlign = channels * bytesPerSample;
  if (
    !Number.isInteger(bytesPerSample) ||
    bytesPerSample <= 0 ||
    expectedBlockAlign > 0xffff ||
    blockAlign !== expectedBlockAlign
  ) {
    collector.add(
      "error",
      "wave.invalid-block-align",
      chunk.headerOffset,
      "fmt ",
      "Block alignment must equal channels multiplied by container bytes per sample.",
    );
    usableForSamples = false;
  }

  const expectedByteRate = sampleRate * blockAlign;
  if (expectedByteRate > 0xffff_ffff || byteRate !== expectedByteRate) {
    collector.add(
      "error",
      "wave.invalid-byte-rate",
      chunk.headerOffset,
      "fmt ",
      "Byte rate must equal sample rate multiplied by block alignment.",
    );
  }

  return {
    codec,
    formatTag,
    extensible,
    channels,
    sampleRate,
    containerBitsPerSample,
    validBitsPerSample,
    channelMask,
    blockAlign,
    byteRate,
    usableForSamples,
  };
}

function countSetBits(input: number): number {
  let value = input >>> 0;
  let count = 0;
  while (value !== 0) {
    value = (value & (value - 1)) >>> 0;
    count += 1;
  }
  return count;
}

function readSignedPcm(view: DataView, offset: number, bits: number): number {
  if (bits === 16) {
    return view.getInt16(offset, true);
  }
  if (bits === 24) {
    const unsigned =
      view.getUint8(offset) | (view.getUint8(offset + 1) << 8) | (view.getUint8(offset + 2) << 16);
    return unsigned >= 0x80_0000 ? unsigned - 0x100_0000 : unsigned;
  }
  return view.getInt32(offset, true);
}

function readUnsignedPcm(view: DataView, offset: number, bits: number): number {
  if (bits === 8) {
    return view.getUint8(offset);
  }
  if (bits === 16) {
    return view.getUint16(offset, true);
  }
  if (bits === 24) {
    return (
      view.getUint8(offset) | (view.getUint8(offset + 1) << 8) | (view.getUint8(offset + 2) << 16)
    );
  }
  return view.getUint32(offset, true);
}

function inspectWaveSamples(
  view: DataView,
  chunk: WaveChunk,
  format: ParsedWaveFormat,
  sampleCount: number,
  collector: WaveDiagnosticCollector,
): WaveSignalMetrics {
  if (sampleCount === 0) {
    return {
      state: "empty",
      peakDbfs: null,
      rmsDbfs: null,
      atOrBeyondFullScaleSampleCount: 0,
    };
  }

  const codec = format.codec;
  const validBits = format.validBitsPerSample;
  if (codec === null || validBits === null) {
    return {
      state: "not-analyzed",
      peakDbfs: null,
      rmsDbfs: null,
      atOrBeyondFullScaleSampleCount: null,
    };
  }

  const bytesPerSample = format.containerBitsPerSample / 8;
  const paddingBits = format.containerBitsPerSample - validBits;
  const paddingDivisor = 2 ** paddingBits;
  const signedScale = 2 ** (validBits - 1);
  let peak = 0;
  let squareScale = 0;
  let scaledSquareSum = 1;
  let atOrBeyondFullScaleSampleCount = 0;
  let nonFiniteSampleCount = 0;
  let firstNonFiniteOffset: number | null = null;
  let nonzeroPaddingSampleCount = 0;
  let firstNonzeroPaddingOffset: number | null = null;

  for (let index = 0; index < sampleCount; index += 1) {
    const sampleOffset = chunk.dataOffset + index * bytesPerSample;
    let sample: number;
    if (codec === "ieee-float") {
      sample =
        format.containerBitsPerSample === 32
          ? view.getFloat32(sampleOffset, true)
          : view.getFloat64(sampleOffset, true);
      if (!Number.isFinite(sample)) {
        nonFiniteSampleCount += 1;
        firstNonFiniteOffset ??= sampleOffset;
        continue;
      }
      if (Math.abs(sample) >= 1) {
        atOrBeyondFullScaleSampleCount += 1;
      }
    } else if (format.containerBitsPerSample === 8) {
      const raw = view.getUint8(sampleOffset);
      if (paddingBits > 0 && raw % paddingDivisor !== 0) {
        nonzeroPaddingSampleCount += 1;
        firstNonzeroPaddingOffset ??= sampleOffset;
      }
      const validUnsigned = Math.floor(raw / paddingDivisor);
      const centered = validUnsigned - signedScale;
      sample = centered / signedScale;
      if (centered === -signedScale || centered === signedScale - 1) {
        atOrBeyondFullScaleSampleCount += 1;
      }
    } else {
      const rawUnsigned = readUnsignedPcm(view, sampleOffset, format.containerBitsPerSample);
      if (paddingBits > 0 && rawUnsigned % paddingDivisor !== 0) {
        nonzeroPaddingSampleCount += 1;
        firstNonzeroPaddingOffset ??= sampleOffset;
      }
      const rawSigned = readSignedPcm(view, sampleOffset, format.containerBitsPerSample);
      const validSigned = Math.floor(rawSigned / paddingDivisor);
      sample = validSigned / signedScale;
      if (validSigned === -signedScale || validSigned === signedScale - 1) {
        atOrBeyondFullScaleSampleCount += 1;
      }
    }

    const absolute = Math.abs(sample);
    peak = Math.max(peak, absolute);
    if (absolute === 0) {
      continue;
    }
    if (squareScale < absolute) {
      const ratio = squareScale / absolute;
      scaledSquareSum = 1 + scaledSquareSum * ratio * ratio;
      squareScale = absolute;
    } else {
      const ratio = absolute / squareScale;
      scaledSquareSum += ratio * ratio;
    }
  }

  if (nonFiniteSampleCount > 0) {
    collector.add(
      "error",
      "wave.non-finite-float-samples",
      firstNonFiniteOffset,
      "data",
      `${nonFiniteSampleCount} IEEE float sample(s) are NaN or infinite.`,
    );
  }
  if (nonzeroPaddingSampleCount > 0) {
    collector.add(
      "error",
      "wave.nonzero-padding-bits",
      firstNonzeroPaddingOffset,
      "data",
      `${nonzeroPaddingSampleCount} extensible PCM sample(s) use nonzero low padding bits.`,
    );
  }
  if (nonFiniteSampleCount > 0 || nonzeroPaddingSampleCount > 0) {
    return {
      state: "invalid",
      peakDbfs: null,
      rmsDbfs: null,
      atOrBeyondFullScaleSampleCount: null,
    };
  }
  if (peak === 0) {
    return {
      state: "silence",
      peakDbfs: null,
      rmsDbfs: null,
      atOrBeyondFullScaleSampleCount: 0,
    };
  }

  const rms = squareScale * Math.sqrt(scaledSquareSum / sampleCount);
  return {
    state: "signal",
    peakDbfs: 20 * Math.log10(peak),
    rmsDbfs: 20 * Math.log10(rms),
    atOrBeyondFullScaleSampleCount,
  };
}

/**
 * Inspects PCM or IEEE-float RIFF/WAVE bytes without reading files or mutating input.
 *
 * The byte view is validated, bounded, and copied before parsing. The fixed limits are exported as
 * `waveAudioInspectionLimits`; callers cannot relax them per invocation.
 */
export function inspectWaveAudio(input: unknown): WaveAudioInspectionResult {
  const collector = new WaveDiagnosticCollector();
  const snapshotted = snapshotBytes(input, collector);
  if (snapshotted === null) {
    return emptyResult(collector);
  }

  const result = emptyResult(collector);
  result.inputBytes = snapshotted.inputBytes;
  if (collector.exceededLimits.has("maxInputBytes")) {
    result.errorCount = collector.errorCount;
    result.exceededLimits = orderedExceededLimits(collector.exceededLimits);
    result.diagnostics = collector.diagnostics;
    return result;
  }

  const bytes = snapshotted.bytes;
  result.contentSha256 = createHash("sha256").update(bytes).digest("hex");
  if (bytes.length < 12) {
    collector.add(
      "error",
      "wave.truncated-riff-header",
      0,
      "RIFF",
      "A RIFF/WAVE file requires a 12-byte RIFF form header.",
    );
    return finalizeResult(result, collector, false);
  }
  if (!chunkIdMatches(bytes, 0, "RIFF")) {
    collector.add(
      "error",
      "wave.invalid-riff-signature",
      0,
      "RIFF",
      "The file does not begin with the RIFF signature.",
    );
    return finalizeResult(result, collector, false);
  }
  if (!chunkIdMatches(bytes, 8, "WAVE")) {
    collector.add(
      "error",
      "wave.invalid-wave-form-type",
      8,
      "RIFF",
      "The RIFF form type is not WAVE.",
    );
    return finalizeResult(result, collector, false);
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riffSize = view.getUint32(4, true);
  const declaredEnd = 8 + riffSize;
  let scanComplete = true;
  if (riffSize < 4) {
    collector.add(
      "error",
      "wave.invalid-riff-size",
      4,
      "RIFF",
      "RIFF size must include the 4-byte WAVE form type.",
    );
    scanComplete = false;
  }
  if (declaredEnd > bytes.length) {
    collector.add(
      "error",
      "wave.truncated-riff",
      4,
      "RIFF",
      `RIFF declares ${declaredEnd} total bytes, but only ${bytes.length} are present.`,
    );
    scanComplete = false;
  } else if (declaredEnd < bytes.length) {
    collector.add(
      "error",
      "wave.trailing-data",
      declaredEnd,
      "RIFF",
      `${bytes.length - declaredEnd} byte(s) follow the declared RIFF form.`,
    );
  }

  const scanEnd = Math.min(bytes.length, Math.max(12, declaredEnd));
  let offset = 12;
  let formatChunk: WaveChunk | null = null;
  let dataChunk: WaveChunk | null = null;
  let duplicateFormat = false;
  let duplicateData = false;

  while (offset < scanEnd) {
    if (result.chunkCount >= waveAudioInspectionLimits.maxChunks) {
      collector.exceed(
        "maxChunks",
        "wave.chunk-limit-exceeded",
        offset,
        null,
        `RIFF contains more than ${waveAudioInspectionLimits.maxChunks} chunks.`,
      );
      scanComplete = false;
      break;
    }
    if (scanEnd - offset < 8) {
      collector.add(
        "error",
        "wave.truncated-chunk-header",
        offset,
        null,
        "Bytes remain in RIFF but do not form a complete 8-byte chunk header.",
      );
      scanComplete = false;
      break;
    }

    const size = view.getUint32(offset + 4, true);
    const dataOffset = offset + 8;
    const dataEnd = dataOffset + size;
    result.chunkCount += 1;
    const knownChunkId = chunkIdMatches(bytes, offset, "fmt ")
      ? "fmt "
      : chunkIdMatches(bytes, offset, "data")
        ? "data"
        : null;
    if (dataEnd > scanEnd) {
      collector.add(
        "error",
        "wave.truncated-chunk",
        offset,
        knownChunkId,
        `Chunk declares ${size} data bytes, but only ${Math.max(0, scanEnd - dataOffset)} remain.`,
      );
      scanComplete = false;
      break;
    }

    const chunk = { headerOffset: offset, dataOffset, size };
    if (knownChunkId === "fmt ") {
      if (formatChunk === null) {
        formatChunk = chunk;
      } else {
        duplicateFormat = true;
        collector.add(
          "error",
          "wave.duplicate-format-chunk",
          offset,
          "fmt ",
          "RIFF/WAVE must contain exactly one fmt chunk.",
        );
      }
    } else if (knownChunkId === "data") {
      if (dataChunk === null) {
        dataChunk = chunk;
      } else {
        duplicateData = true;
        collector.add(
          "error",
          "wave.duplicate-data-chunk",
          offset,
          "data",
          "This inspector requires exactly one data chunk for unambiguous whole-file metrics.",
        );
      }
    }

    const paddedEnd = dataEnd + (size & 1);
    if (paddedEnd > scanEnd) {
      collector.add(
        "error",
        "wave.missing-chunk-padding",
        dataEnd,
        knownChunkId,
        "An odd-sized RIFF chunk is missing its required WORD-alignment padding byte.",
      );
      scanComplete = false;
      break;
    }
    offset = paddedEnd;
  }

  if (formatChunk === null) {
    collector.add(
      "error",
      "wave.missing-format-chunk",
      null,
      "fmt ",
      "RIFF/WAVE must contain a fmt chunk.",
    );
  }
  if (dataChunk === null) {
    collector.add(
      "error",
      "wave.missing-data-chunk",
      null,
      "data",
      "RIFF/WAVE must contain a data chunk.",
    );
  }

  const format = formatChunk === null ? null : parseWaveFormat(view, bytes, formatChunk, collector);
  if (format !== null) {
    result.codec = format.codec;
    result.formatTag = format.formatTag;
    result.extensible = format.extensible;
    result.channels = format.channels;
    result.sampleRate = format.sampleRate;
    result.containerBitsPerSample = format.containerBitsPerSample;
    result.validBitsPerSample = format.validBitsPerSample;
    result.channelMask = format.channelMask;
    result.blockAlign = format.blockAlign;
    result.byteRate = format.byteRate;
  }
  if (dataChunk !== null) {
    result.dataBytes = dataChunk.size;
  }

  let samplesInspected = false;
  if (
    format !== null &&
    dataChunk !== null &&
    !duplicateFormat &&
    !duplicateData &&
    format.usableForSamples
  ) {
    if (dataChunk.size % format.blockAlign !== 0) {
      collector.add(
        "error",
        "wave.data-not-frame-aligned",
        dataChunk.headerOffset,
        "data",
        "The data chunk size must be an exact multiple of block alignment.",
      );
    } else {
      const frameCount = dataChunk.size / format.blockAlign;
      const sampleCount = frameCount * format.channels;
      result.frameCount = frameCount;
      result.sampleCount = sampleCount;
      result.durationSeconds = frameCount / format.sampleRate;
      if (sampleCount > waveAudioInspectionLimits.maxSamples) {
        collector.exceed(
          "maxSamples",
          "wave.sample-limit-exceeded",
          dataChunk.headerOffset,
          "data",
          `Audio contains ${sampleCount} samples; the fixed limit is ${waveAudioInspectionLimits.maxSamples}.`,
        );
      } else {
        const metrics = inspectWaveSamples(view, dataChunk, format, sampleCount, collector);
        result.signalState = metrics.state;
        result.peakDbfs = metrics.peakDbfs;
        result.rmsDbfs = metrics.rmsDbfs;
        result.atOrBeyondFullScaleSampleCount = metrics.atOrBeyondFullScaleSampleCount;
        samplesInspected = true;
      }
    }
  }

  const inspectionComplete =
    scanComplete &&
    format !== null &&
    dataChunk !== null &&
    !duplicateFormat &&
    !duplicateData &&
    samplesInspected &&
    collector.exceededLimits.size === 0;
  return finalizeResult(result, collector, inspectionComplete);
}

function finalizeResult(
  result: WaveAudioInspectionResult,
  collector: WaveDiagnosticCollector,
  inspectionComplete: boolean,
): WaveAudioInspectionResult {
  result.valid = collector.errorCount === 0;
  result.inspectionComplete = inspectionComplete;
  result.errorCount = collector.errorCount;
  result.warningCount = collector.warningCount;
  result.diagnosticsTruncated = collector.omittedDiagnosticCount > 0;
  result.omittedDiagnosticCount = collector.omittedDiagnosticCount;
  result.exceededLimits = orderedExceededLimits(collector.exceededLimits);
  result.diagnostics = collector.diagnostics;
  return result;
}

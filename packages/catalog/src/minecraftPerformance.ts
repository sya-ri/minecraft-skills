import { types as nodeTypes } from "node:util";

export const minecraftPerformanceMetricNames = [
  "tps",
  "mspt",
  "cpuPercent",
  "heapUsedBytes",
  "loadedChunks",
  "entities",
  "players",
  "gcPauseMs",
] as const;

export type MinecraftPerformanceMetric = (typeof minecraftPerformanceMetricNames)[number];

export type MinecraftPerformanceSample = {
  timestamp: string;
  tps?: number;
  mspt?: number;
  cpuPercent?: number;
  heapUsedBytes?: number;
  loadedChunks?: number;
  entities?: number;
  players?: number;
  gcPauseMs?: number;
};

export type MinecraftPerformanceThreshold =
  | { minimum: number; maximum?: number }
  | { minimum?: number; maximum: number };

export type MinecraftPerformanceThresholds = Partial<
  Record<MinecraftPerformanceMetric, MinecraftPerformanceThreshold>
>;

export type MinecraftPerformanceAnalysisInput = {
  samples: MinecraftPerformanceSample[];
  thresholds?: MinecraftPerformanceThresholds;
  expectedIntervalSeconds?: number;
  comparison?: {
    splitAt: string;
  };
};

export type MinecraftPerformanceAnalysisLimits = {
  maxInputBytes: number;
  maxInputCharacters: number;
  maxSamples: number;
  maxDiagnostics: number;
  maxViolationIntervalsPerSeries: number;
  maxWindowDurationMs: number;
};

export type MinecraftPerformanceAnalysisLimitName = keyof MinecraftPerformanceAnalysisLimits;

export const defaultMinecraftPerformanceAnalysisLimits: Readonly<MinecraftPerformanceAnalysisLimits> =
  Object.freeze({
    maxInputBytes: 4 * 1_024 * 1_024,
    maxInputCharacters: 4 * 1_024 * 1_024,
    maxSamples: 10_000,
    maxDiagnostics: 500,
    maxViolationIntervalsPerSeries: 100,
    maxWindowDurationMs: 366 * 24 * 60 * 60 * 1_000,
  });

export const minecraftPerformanceAnalysisRules = Object.freeze({
  minimumSamples: 2,
  minimumTrendSamples: 3,
  minimumComparisonSamplesPerSide: 3,
  minimumCorrelationSamples: 10,
  minimumExpectedIntervalSeconds: 0.001,
  maximumExpectedIntervalSeconds: 86_400,
  metricSeriesLimit: minecraftPerformanceMetricNames.length,
});

export type MinecraftPerformanceDiagnostic = {
  severity: "error" | "warning";
  code: string;
  path: string;
  message: string;
};

export type MinecraftPerformanceStatistics = {
  sampleCount: number;
  min: number;
  p50: number;
  p95: number;
  max: number;
};

export type MinecraftPerformanceAppliedThreshold = {
  minimum: { value: number; source: "paper-default" | "input" } | null;
  maximum: { value: number; source: "paper-default" | "input" } | null;
};

export type MinecraftPerformanceViolationInterval = {
  start: string;
  end: string;
  durationMs: number;
  samples: number;
};

export type MinecraftPerformanceSeriesResult = {
  metric: MinecraftPerformanceMetric;
  availableSamples: number;
  missingSamples: number;
  coveragePercent: number;
  statistics: MinecraftPerformanceStatistics | null;
  trend: {
    status: "computed" | "insufficient-samples";
    sampleCount: number;
    slopePerHour: number | null;
  };
  threshold: MinecraftPerformanceAppliedThreshold | null;
  violations: {
    observedSamples: number;
    samples: number;
    belowMinimumSamples: number;
    aboveMaximumSamples: number;
    intervalTotal: number;
    retainedIntervalCount: number;
    omittedIntervalCount: number;
    longestConsecutiveSamples: number;
    longestDurationMs: number;
    intervals: MinecraftPerformanceViolationInterval[];
  } | null;
};

export type MinecraftPerformanceComparisonSeries = {
  metric: MinecraftPerformanceMetric;
  status: "computed" | "insufficient-samples";
  before: MinecraftPerformanceStatistics | null;
  after: MinecraftPerformanceStatistics | null;
  p50Delta: number | null;
  p50DeltaPercent: number | null;
  beforeViolationRatePercent: number | null;
  afterViolationRatePercent: number | null;
  violationRateDeltaPercentagePoints: number | null;
};

export type MinecraftPerformanceCorrelation = {
  kind: "association";
  candidateMetric: Exclude<MinecraftPerformanceMetric, "mspt">;
  status: "computed" | "insufficient-samples" | "constant-series";
  alignedSamples: number;
  coefficient: number | null;
};

export type MinecraftPerformanceAnalysisResult = {
  schemaVersion: 1;
  inputValid: boolean;
  analysisComplete: boolean;
  outcome: "analyzed" | "insufficient-data" | "invalid-input" | "limit-exceeded";
  thresholdStatus: "within-thresholds" | "violations-detected" | "not-observed" | null;
  inputBytes: number | null;
  inputCharacters: number | null;
  sampleCount: number | null;
  seriesWithData: number;
  window: {
    start: string;
    end: string;
    durationMs: number;
  } | null;
  cadence: {
    expectedIntervalSeconds: number | null;
    observedIntervals: MinecraftPerformanceStatistics | null;
    gapCount: number | null;
    estimatedMissingSamples: number | null;
    temporalCoveragePercent: number | null;
  } | null;
  appliedThresholds: Partial<
    Record<MinecraftPerformanceMetric, MinecraftPerformanceAppliedThreshold>
  >;
  series: MinecraftPerformanceSeriesResult[];
  comparison: {
    splitAt: string;
    beforeSamples: number;
    afterSamples: number;
    series: MinecraftPerformanceComparisonSeries[];
  } | null;
  correlations: MinecraftPerformanceCorrelation[];
  nextSteps: Array<{
    kind: "scoped-spark-profile";
    reason: "threshold-violations-detected";
    guidance: string;
    documentation: string;
  }>;
  appliedLimits: MinecraftPerformanceAnalysisLimits;
  exceededLimits: MinecraftPerformanceAnalysisLimitName[];
  errorCount: number;
  warningCount: number;
  diagnosticTotal: number;
  retainedDiagnosticCount: number;
  omittedDiagnosticCount: number;
  diagnostics: MinecraftPerformanceDiagnostic[];
  sourceEvidence: Array<{
    title: string;
    url: string;
  }>;
  notes: string[];
};

type SafeDataRecord = Record<string, unknown>;

type NormalizedSample = {
  timestamp: string;
  epochMs: number;
  values: Partial<Record<MinecraftPerformanceMetric, number>>;
};

type DiagnosticCollector = {
  add: (diagnostic: MinecraftPerformanceDiagnostic) => void;
  errorCount: () => number;
  finish: () => {
    diagnostics: MinecraftPerformanceDiagnostic[];
    errorCount: number;
    warningCount: number;
    diagnosticTotal: number;
    omittedDiagnosticCount: number;
  };
};

const limitNames = Object.keys(
  defaultMinecraftPerformanceAnalysisLimits,
) as MinecraftPerformanceAnalysisLimitName[];
const limitNameSet = new Set<MinecraftPerformanceAnalysisLimitName>(limitNames);
const metricNameSet = new Set<MinecraftPerformanceMetric>(minecraftPerformanceMetricNames);
const sampleFieldSet = new Set<string>(["timestamp", ...minecraftPerformanceMetricNames]);
const outerFieldSet = new Set(["samples", "thresholds", "expectedIntervalSeconds", "comparison"]);
const thresholdFieldSet = new Set(["minimum", "maximum"]);
const comparisonFieldSet = new Set(["splitAt"]);
const countMetrics = new Set<MinecraftPerformanceMetric>([
  "heapUsedBytes",
  "loadedChunks",
  "entities",
  "players",
]);
const canonicalTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const sourceEvidence = [
  {
    title: "Paper commands: TPS and MSPT",
    url: "https://docs.papermc.io/paper/reference/commands/",
  },
  {
    title: "Paper profiling guidance",
    url: "https://docs.papermc.io/paper/profiling/",
  },
  {
    title: "Paper basic troubleshooting",
    url: "https://docs.papermc.io/paper/basic-troubleshooting/",
  },
] as const;

function createDiagnosticCollector(maxDiagnostics: number): DiagnosticCollector {
  const diagnostics: MinecraftPerformanceDiagnostic[] = [];
  let errors = 0;
  let warnings = 0;
  let total = 0;
  return {
    add(diagnostic) {
      total += 1;
      if (diagnostic.severity === "error") {
        errors += 1;
      } else {
        warnings += 1;
      }
      if (diagnostics.length < maxDiagnostics) {
        diagnostics.push(diagnostic);
      }
    },
    errorCount() {
      return errors;
    },
    finish() {
      return {
        diagnostics,
        errorCount: errors,
        warningCount: warnings,
        diagnosticTotal: total,
        omittedDiagnosticCount: total - diagnostics.length,
      };
    },
  };
}

export function resolveMinecraftPerformanceAnalysisLimits(
  requested: Partial<MinecraftPerformanceAnalysisLimits> | undefined,
): MinecraftPerformanceAnalysisLimits {
  const resolved = { ...defaultMinecraftPerformanceAnalysisLimits };
  if (requested === undefined) {
    return resolved;
  }
  if (typeof requested !== "object" || requested === null) {
    throw new Error("Minecraft performance limits must be a plain data object");
  }
  if (nodeTypes.isProxy(requested)) {
    throw new Error("Minecraft performance limits must not use proxy objects");
  }
  if (Array.isArray(requested)) {
    throw new Error("Minecraft performance limits must be a plain data object");
  }

  let keys: (string | symbol)[];
  let prototype: object | null;
  try {
    keys = Reflect.ownKeys(requested);
    prototype = Object.getPrototypeOf(requested) as object | null;
  } catch {
    throw new Error("Minecraft performance limits could not be inspected safely");
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error("Minecraft performance limits must be a plain data object");
  }

  for (const key of keys) {
    if (
      typeof key !== "string" ||
      !limitNameSet.has(key as MinecraftPerformanceAnalysisLimitName)
    ) {
      throw new Error("Minecraft performance limits contain an unknown field");
    }
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(requested, key);
    } catch {
      throw new Error("Minecraft performance limits could not be inspected safely");
    }
    if (!descriptor || !("value" in descriptor)) {
      throw new Error("Minecraft performance limits must not use accessors");
    }
    if (descriptor.enumerable !== true) {
      throw new Error("Minecraft performance limits must use enumerable data fields");
    }
    const name = key as MinecraftPerformanceAnalysisLimitName;
    const value = descriptor.value as unknown;
    if (
      typeof value !== "number" ||
      !Number.isSafeInteger(value) ||
      value < 1 ||
      defaultMinecraftPerformanceAnalysisLimits[name] < value
    ) {
      throw new Error(
        "Minecraft performance limits must be safe positive integers within their published ceilings",
      );
    }
    resolved[name] = value;
  }
  return resolved;
}

function inspectDataObject(
  value: unknown,
  allowedFields: ReadonlySet<string>,
  path: string,
  diagnostics: DiagnosticCollector,
): SafeDataRecord | null {
  if (typeof value !== "object" || value === null) {
    diagnostics.add({
      severity: "error",
      code: "invalid-object",
      path,
      message: "The value must be a plain JSON data object.",
    });
    return null;
  }
  if (nodeTypes.isProxy(value)) {
    diagnostics.add({
      severity: "error",
      code: "unsafe-object",
      path,
      message: "Proxy objects are not accepted as plain JSON data.",
    });
    return null;
  }
  if (Array.isArray(value)) {
    diagnostics.add({
      severity: "error",
      code: "invalid-object",
      path,
      message: "The value must be a plain JSON data object.",
    });
    return null;
  }

  let keys: (string | symbol)[];
  let prototype: object | null;
  try {
    keys = Reflect.ownKeys(value);
    prototype = Object.getPrototypeOf(value) as object | null;
  } catch {
    diagnostics.add({
      severity: "error",
      code: "unsafe-object",
      path,
      message: "The data object could not be inspected safely.",
    });
    return null;
  }
  if (prototype !== Object.prototype && prototype !== null) {
    diagnostics.add({
      severity: "error",
      code: "invalid-object-prototype",
      path,
      message: "The value must use a plain JSON object prototype.",
    });
    return null;
  }

  const result = Object.create(null) as SafeDataRecord;
  let usable = true;
  for (const key of keys) {
    if (typeof key !== "string" || !allowedFields.has(key)) {
      diagnostics.add({
        severity: "error",
        code: "unknown-field",
        path,
        message: "The object contains an unsupported field.",
      });
      usable = false;
      continue;
    }
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      diagnostics.add({
        severity: "error",
        code: "unsafe-field",
        path,
        message: "An object field could not be inspected safely.",
      });
      usable = false;
      continue;
    }
    if (!descriptor || !("value" in descriptor)) {
      diagnostics.add({
        severity: "error",
        code: "accessor-field",
        path,
        message: "Input objects must not use accessor properties.",
      });
      usable = false;
      continue;
    }
    if (descriptor.enumerable !== true) {
      diagnostics.add({
        severity: "error",
        code: "non-enumerable-field",
        path,
        message: "Input objects must use own enumerable data properties.",
      });
      usable = false;
      continue;
    }
    result[key] = descriptor.value as unknown;
  }
  return usable ? result : null;
}

function inspectDenseDataArray(
  value: unknown,
  path: string,
  maximumLength: number,
  diagnostics: DiagnosticCollector,
  exceededLimits: MinecraftPerformanceAnalysisLimitName[],
): { values: unknown[]; total: number | null } | null {
  if (nodeTypes.isProxy(value)) {
    diagnostics.add({
      severity: "error",
      code: "unsafe-samples-array",
      path,
      message: "Proxy arrays are not accepted as plain JSON data.",
    });
    return null;
  }
  if (!Array.isArray(value)) {
    diagnostics.add({
      severity: "error",
      code: "invalid-samples",
      path,
      message: "Performance samples must be provided as a JSON array.",
    });
    return null;
  }

  let prototype: object | null;
  let lengthDescriptor: PropertyDescriptor | undefined;
  try {
    prototype = Object.getPrototypeOf(value) as object | null;
    lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  } catch {
    diagnostics.add({
      severity: "error",
      code: "unsafe-samples-array",
      path,
      message: "The samples array could not be inspected safely.",
    });
    return null;
  }
  if (prototype !== Array.prototype || !lengthDescriptor || !("value" in lengthDescriptor)) {
    diagnostics.add({
      severity: "error",
      code: "invalid-samples-array",
      path,
      message: "Performance samples must use a plain dense JSON array.",
    });
    return null;
  }
  const length = lengthDescriptor.value as unknown;
  if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0) {
    diagnostics.add({
      severity: "error",
      code: "invalid-samples-array",
      path,
      message: "The samples array length is invalid.",
    });
    return null;
  }
  if (maximumLength < length) {
    if (!exceededLimits.includes("maxSamples")) {
      exceededLimits.push("maxSamples");
    }
    diagnostics.add({
      severity: "error",
      code: "sample-limit-exceeded",
      path,
      message: "The performance input exceeds the applied sample limit.",
    });
    return { values: [], total: length };
  }

  let keys: (string | symbol)[];
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    diagnostics.add({
      severity: "error",
      code: "unsafe-samples-array",
      path,
      message: "The samples array could not be inspected safely.",
    });
    return null;
  }
  if (keys.length !== length + 1 || keys.some((key) => typeof key !== "string")) {
    diagnostics.add({
      severity: "error",
      code: "non-dense-samples-array",
      path,
      message: "The samples array must not contain holes, symbols, or extra properties.",
    });
    return null;
  }

  const values: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    } catch {
      diagnostics.add({
        severity: "error",
        code: "unsafe-sample",
        path,
        message: "A sample array entry could not be inspected safely.",
      });
      return null;
    }
    if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
      diagnostics.add({
        severity: "error",
        code: "non-dense-samples-array",
        path,
        message: "Every sample must be an own enumerable data array entry.",
      });
      return null;
    }
    values.push(descriptor.value as unknown);
  }
  return { values, total: length };
}

function parseCanonicalTimestamp(value: unknown): { text: string; epochMs: number } | null {
  if (typeof value !== "string" || value.length !== 24 || !canonicalTimestampPattern.test(value)) {
    return null;
  }
  const epochMs = Date.parse(value);
  if (!Number.isFinite(epochMs) || new Date(epochMs).toISOString() !== value) {
    return null;
  }
  return { text: value, epochMs };
}

function isValidMetricValue(metric: MinecraftPerformanceMetric, value: unknown): value is number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    Number.MAX_SAFE_INTEGER < value
  ) {
    return false;
  }
  if (metric === "cpuPercent" && 100 < value) {
    return false;
  }
  return !countMetrics.has(metric) || Number.isSafeInteger(value);
}

function roundDerived(value: number, digits = 6): number {
  const scale = 10 ** digits;
  const rounded = Math.round((value + Number.EPSILON) * scale) / scale;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function coveragePercent(available: number, total: number): number {
  return total === 0 ? 0 : roundDerived((available / total) * 100, 3);
}

function quantile(sorted: readonly number[], percentile: number): number {
  if (sorted.length === 1) {
    return sorted[0] ?? 0;
  }
  const position = (sorted.length - 1) * percentile;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lower = sorted[lowerIndex] ?? 0;
  const upper = sorted[upperIndex] ?? lower;
  return lower + (upper - lower) * (position - lowerIndex);
}

function summarize(values: readonly number[]): MinecraftPerformanceStatistics | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  return {
    sampleCount: sorted.length,
    min: sorted[0] ?? 0,
    p50: roundDerived(quantile(sorted, 0.5)),
    p95: roundDerived(quantile(sorted, 0.95)),
    max: sorted.at(-1) ?? 0,
  };
}

function normalizeSamples(
  rawSamples: unknown,
  limits: MinecraftPerformanceAnalysisLimits,
  diagnostics: DiagnosticCollector,
  exceededLimits: MinecraftPerformanceAnalysisLimitName[],
): { samples: NormalizedSample[]; total: number | null } {
  const inspected = inspectDenseDataArray(
    rawSamples,
    "$.samples",
    limits.maxSamples,
    diagnostics,
    exceededLimits,
  );
  if (inspected === null) {
    return { samples: [], total: null };
  }
  const rawValues = inspected.values;
  const total = inspected.total;
  if (rawValues.length === 0 && total !== 0) {
    return { samples: [], total };
  }
  if (rawValues.length < minecraftPerformanceAnalysisRules.minimumSamples) {
    diagnostics.add({
      severity: "error",
      code: "too-few-samples",
      path: "$.samples",
      message: "Performance analysis requires at least two timestamped samples.",
    });
  }
  const samples: NormalizedSample[] = [];
  const timestampEpochs = new Set<number>();
  let previousEpoch: number | null = null;
  for (let index = 0; index < rawValues.length; index += 1) {
    const path = `$.samples[${index}]`;
    const object = inspectDataObject(rawValues[index], sampleFieldSet, path, diagnostics);
    if (object === null) {
      continue;
    }
    const timestamp = parseCanonicalTimestamp(object.timestamp);
    if (timestamp === null) {
      diagnostics.add({
        severity: "error",
        code: "invalid-timestamp",
        path: `${path}.timestamp`,
        message: "The timestamp must be a canonical UTC instant with millisecond precision.",
      });
    } else {
      if (timestampEpochs.has(timestamp.epochMs)) {
        diagnostics.add({
          severity: "error",
          code: "duplicate-timestamp",
          path: `${path}.timestamp`,
          message: "Each performance sample timestamp must be unique.",
        });
      }
      timestampEpochs.add(timestamp.epochMs);
      if (previousEpoch !== null && timestamp.epochMs < previousEpoch) {
        diagnostics.add({
          severity: "error",
          code: "out-of-order-timestamp",
          path: `${path}.timestamp`,
          message: "Performance samples must be ordered by strictly increasing timestamp.",
        });
      }
      previousEpoch = timestamp.epochMs;
    }

    const values: Partial<Record<MinecraftPerformanceMetric, number>> = {};
    for (const metric of minecraftPerformanceMetricNames) {
      if (!Object.hasOwn(object, metric)) {
        continue;
      }
      const value = object[metric];
      if (!isValidMetricValue(metric, value)) {
        diagnostics.add({
          severity: "error",
          code: "invalid-metric-value",
          path: `${path}.${metric}`,
          message:
            metric === "cpuPercent"
              ? "The metric must be a finite number from 0 through 100."
              : countMetrics.has(metric)
                ? "The metric must be a non-negative safe integer."
                : "The metric must be a finite non-negative number within the safe numeric range.",
        });
        continue;
      }
      values[metric] = value;
    }
    if (Object.keys(values).length === 0) {
      diagnostics.add({
        severity: "warning",
        code: "sample-without-metrics",
        path,
        message: "The timestamped sample contains no usable performance metrics.",
      });
    }
    if (timestamp !== null) {
      samples.push({ timestamp: timestamp.text, epochMs: timestamp.epochMs, values });
    }
  }

  if (samples.length === rawValues.length && 1 < samples.length) {
    const duration = (samples.at(-1)?.epochMs ?? 0) - (samples[0]?.epochMs ?? 0);
    if (limits.maxWindowDurationMs < duration) {
      exceededLimits.push("maxWindowDurationMs");
      diagnostics.add({
        severity: "error",
        code: "time-window-limit-exceeded",
        path: "$.samples",
        message: "The performance time window exceeds the applied duration limit.",
      });
    }
  }
  return { samples, total };
}

type NormalizedThresholdInput = MinecraftPerformanceThresholds;

function normalizeThresholds(
  rawThresholds: unknown,
  diagnostics: DiagnosticCollector,
): {
  input: NormalizedThresholdInput;
  applied: Partial<Record<MinecraftPerformanceMetric, MinecraftPerformanceAppliedThreshold>>;
} {
  const applied: Partial<Record<MinecraftPerformanceMetric, MinecraftPerformanceAppliedThreshold>> =
    {
      tps: {
        minimum: { value: 20, source: "paper-default" },
        maximum: null,
      },
      mspt: {
        minimum: null,
        maximum: { value: 50, source: "paper-default" },
      },
    };
  const input: NormalizedThresholdInput = {};
  if (rawThresholds === undefined) {
    return { input, applied };
  }
  const outer = inspectDataObject(rawThresholds, metricNameSet, "$.thresholds", diagnostics);
  if (outer === null) {
    return { input, applied };
  }

  for (const metric of minecraftPerformanceMetricNames) {
    if (!Object.hasOwn(outer, metric)) {
      continue;
    }
    const threshold = inspectDataObject(
      outer[metric],
      thresholdFieldSet,
      `$.thresholds.${metric}`,
      diagnostics,
    );
    if (threshold === null) {
      continue;
    }
    if (!Object.hasOwn(threshold, "minimum") && !Object.hasOwn(threshold, "maximum")) {
      diagnostics.add({
        severity: "error",
        code: "empty-threshold",
        path: `$.thresholds.${metric}`,
        message: "A threshold must define a minimum, a maximum, or both.",
      });
      continue;
    }
    const normalized: { minimum?: number; maximum?: number } = {};
    for (const bound of ["minimum", "maximum"] as const) {
      if (!Object.hasOwn(threshold, bound)) {
        continue;
      }
      const value = threshold[bound];
      if (!isValidMetricValue(metric, value)) {
        diagnostics.add({
          severity: "error",
          code: "invalid-threshold",
          path: `$.thresholds.${metric}.${bound}`,
          message: "Threshold bounds must be finite non-negative values valid for the metric.",
        });
        continue;
      }
      normalized[bound] = value;
    }
    let normalizedThreshold: MinecraftPerformanceThreshold;
    if (normalized.minimum !== undefined) {
      normalizedThreshold = {
        minimum: normalized.minimum,
        ...(normalized.maximum !== undefined ? { maximum: normalized.maximum } : {}),
      };
    } else if (normalized.maximum !== undefined) {
      normalizedThreshold = { maximum: normalized.maximum };
    } else {
      continue;
    }
    input[metric] = normalizedThreshold;
    const current = applied[metric] ?? { minimum: null, maximum: null };
    applied[metric] = {
      minimum:
        normalizedThreshold.minimum !== undefined
          ? { value: normalizedThreshold.minimum, source: "input" }
          : current.minimum,
      maximum:
        normalizedThreshold.maximum !== undefined
          ? { value: normalizedThreshold.maximum, source: "input" }
          : current.maximum,
    };
    const finalThreshold = applied[metric];
    if (
      finalThreshold !== undefined &&
      finalThreshold.minimum !== null &&
      finalThreshold.maximum !== null &&
      finalThreshold.maximum.value < finalThreshold.minimum.value
    ) {
      diagnostics.add({
        severity: "error",
        code: "inverted-threshold",
        path: `$.thresholds.${metric}`,
        message: "A threshold minimum must not exceed its maximum after defaults are applied.",
      });
    }
  }
  return { input, applied };
}

function normalizeExpectedInterval(
  value: unknown,
  diagnostics: DiagnosticCollector,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < minecraftPerformanceAnalysisRules.minimumExpectedIntervalSeconds ||
    minecraftPerformanceAnalysisRules.maximumExpectedIntervalSeconds < value
  ) {
    diagnostics.add({
      severity: "error",
      code: "invalid-expected-interval",
      path: "$.expectedIntervalSeconds",
      message: "The expected interval must be a finite duration within the published bounds.",
    });
    return undefined;
  }
  return value;
}

function normalizeComparison(
  rawComparison: unknown,
  samples: readonly NormalizedSample[],
  diagnostics: DiagnosticCollector,
): { splitAt: string; splitEpochMs: number } | undefined {
  if (rawComparison === undefined) {
    return undefined;
  }
  const comparison = inspectDataObject(
    rawComparison,
    comparisonFieldSet,
    "$.comparison",
    diagnostics,
  );
  if (comparison === null) {
    return undefined;
  }
  const split = parseCanonicalTimestamp(comparison.splitAt);
  if (split === null) {
    diagnostics.add({
      severity: "error",
      code: "invalid-comparison-split",
      path: "$.comparison.splitAt",
      message: "The comparison split must be a canonical UTC instant with millisecond precision.",
    });
    return undefined;
  }
  const start = samples[0]?.epochMs;
  const end = samples.at(-1)?.epochMs;
  if (start === undefined || end === undefined || split.epochMs <= start || end < split.epochMs) {
    diagnostics.add({
      severity: "error",
      code: "comparison-split-outside-window",
      path: "$.comparison.splitAt",
      message: "The comparison split must leave observations on both sides of the time window.",
    });
    return undefined;
  }
  return { splitAt: split.text, splitEpochMs: split.epochMs };
}

function calculateTrend(
  observations: readonly { epochMs: number; value: number }[],
): MinecraftPerformanceSeriesResult["trend"] {
  if (observations.length < minecraftPerformanceAnalysisRules.minimumTrendSamples) {
    return { status: "insufficient-samples", sampleCount: observations.length, slopePerHour: null };
  }
  const origin = observations[0]?.epochMs ?? 0;
  const points = observations.map((observation) => ({
    x: (observation.epochMs - origin) / 3_600_000,
    y: observation.value,
  }));
  const meanX = points.reduce((total, point) => total + point.x, 0) / points.length;
  const meanY = points.reduce((total, point) => total + point.y, 0) / points.length;
  let covariance = 0;
  let varianceX = 0;
  for (const point of points) {
    const deltaX = point.x - meanX;
    covariance += deltaX * (point.y - meanY);
    varianceX += deltaX * deltaX;
  }
  return {
    status: "computed",
    sampleCount: observations.length,
    slopePerHour: varianceX === 0 ? 0 : roundDerived(covariance / varianceX),
  };
}

function thresholdViolation(
  value: number,
  threshold: MinecraftPerformanceAppliedThreshold,
): "below" | "above" | null {
  if (threshold.minimum !== null && value < threshold.minimum.value) {
    return "below";
  }
  if (threshold.maximum !== null && threshold.maximum.value < value) {
    return "above";
  }
  return null;
}

function analyzeViolations(
  metric: MinecraftPerformanceMetric,
  samples: readonly NormalizedSample[],
  threshold: MinecraftPerformanceAppliedThreshold,
  expectedIntervalSeconds: number | undefined,
  maxIntervals: number,
): NonNullable<MinecraftPerformanceSeriesResult["violations"]> {
  type Run = {
    start: NormalizedSample;
    end: NormalizedSample;
    samples: number;
  };
  const intervals: MinecraftPerformanceViolationInterval[] = [];
  let intervalTotal = 0;
  let observedSamples = 0;
  let violationSamples = 0;
  let belowMinimumSamples = 0;
  let aboveMaximumSamples = 0;
  let longestConsecutiveSamples = 0;
  let longestDurationMs = 0;
  let run: Run | null = null;
  const maximumGapMs =
    expectedIntervalSeconds === undefined ? null : expectedIntervalSeconds * 1_000 * 1.5;

  const finishRun = (): void => {
    if (run === null) {
      return;
    }
    const durationMs = run.end.epochMs - run.start.epochMs;
    intervalTotal += 1;
    longestConsecutiveSamples = Math.max(longestConsecutiveSamples, run.samples);
    longestDurationMs = Math.max(longestDurationMs, durationMs);
    if (intervals.length < maxIntervals) {
      intervals.push({
        start: run.start.timestamp,
        end: run.end.timestamp,
        durationMs,
        samples: run.samples,
      });
    }
    run = null;
  };

  for (const sample of samples) {
    const value = sample.values[metric];
    if (value !== undefined) {
      observedSamples += 1;
    }
    const violation = value === undefined ? null : thresholdViolation(value, threshold);
    if (violation === null) {
      finishRun();
      continue;
    }
    violationSamples += 1;
    if (violation === "below") {
      belowMinimumSamples += 1;
    } else {
      aboveMaximumSamples += 1;
    }
    if (run !== null && maximumGapMs !== null && maximumGapMs < sample.epochMs - run.end.epochMs) {
      finishRun();
    }
    if (run === null) {
      run = { start: sample, end: sample, samples: 1 };
    } else {
      run.end = sample;
      run.samples += 1;
    }
  }
  finishRun();

  return {
    observedSamples,
    samples: violationSamples,
    belowMinimumSamples,
    aboveMaximumSamples,
    intervalTotal,
    retainedIntervalCount: intervals.length,
    omittedIntervalCount: intervalTotal - intervals.length,
    longestConsecutiveSamples,
    longestDurationMs,
    intervals,
  };
}

function analyzeCadence(
  samples: readonly NormalizedSample[],
  expectedIntervalSeconds: number | undefined,
): NonNullable<MinecraftPerformanceAnalysisResult["cadence"]> {
  const intervals: number[] = [];
  let gapCount = 0;
  let estimatedMissingSamples = 0;
  const expectedIntervalMs =
    expectedIntervalSeconds === undefined ? undefined : expectedIntervalSeconds * 1_000;
  for (let index = 1; index < samples.length; index += 1) {
    const interval = (samples[index]?.epochMs ?? 0) - (samples[index - 1]?.epochMs ?? 0);
    intervals.push(interval);
    if (expectedIntervalMs !== undefined && expectedIntervalMs * 1.5 < interval) {
      gapCount += 1;
      estimatedMissingSamples += Math.max(0, Math.round(interval / expectedIntervalMs) - 1);
    }
  }
  return {
    expectedIntervalSeconds: expectedIntervalSeconds ?? null,
    observedIntervals: summarize(intervals),
    gapCount: expectedIntervalMs === undefined ? null : gapCount,
    estimatedMissingSamples: expectedIntervalMs === undefined ? null : estimatedMissingSamples,
    temporalCoveragePercent:
      expectedIntervalMs === undefined
        ? null
        : coveragePercent(samples.length, samples.length + estimatedMissingSamples),
  };
}

function violationRate(
  values: readonly number[],
  threshold: MinecraftPerformanceAppliedThreshold | undefined,
): number | null {
  if (threshold === undefined || values.length === 0) {
    return null;
  }
  const violations = values.filter((value) => thresholdViolation(value, threshold) !== null).length;
  return coveragePercent(violations, values.length);
}

function analyzeComparison(
  samples: readonly NormalizedSample[],
  split: { splitAt: string; splitEpochMs: number } | undefined,
  thresholds: Partial<Record<MinecraftPerformanceMetric, MinecraftPerformanceAppliedThreshold>>,
): MinecraftPerformanceAnalysisResult["comparison"] {
  if (split === undefined) {
    return null;
  }
  const beforeSamples = samples.filter((sample) => sample.epochMs < split.splitEpochMs);
  const afterSamples = samples.filter((sample) => split.splitEpochMs <= sample.epochMs);
  const series = minecraftPerformanceMetricNames.map(
    (metric): MinecraftPerformanceComparisonSeries => {
      const beforeValues = beforeSamples.flatMap((sample) => {
        const value = sample.values[metric];
        return value === undefined ? [] : [value];
      });
      const afterValues = afterSamples.flatMap((sample) => {
        const value = sample.values[metric];
        return value === undefined ? [] : [value];
      });
      const before = summarize(beforeValues);
      const after = summarize(afterValues);
      const computed =
        minecraftPerformanceAnalysisRules.minimumComparisonSamplesPerSide <= beforeValues.length &&
        minecraftPerformanceAnalysisRules.minimumComparisonSamplesPerSide <= afterValues.length;
      const beforeRate = computed ? violationRate(beforeValues, thresholds[metric]) : null;
      const afterRate = computed ? violationRate(afterValues, thresholds[metric]) : null;
      const delta = computed && before !== null && after !== null ? after.p50 - before.p50 : null;
      return {
        metric,
        status: computed ? "computed" : "insufficient-samples",
        before,
        after,
        p50Delta: delta === null ? null : roundDerived(delta),
        p50DeltaPercent:
          delta === null || before === null || before.p50 === 0
            ? null
            : roundDerived((delta / before.p50) * 100, 3),
        beforeViolationRatePercent: beforeRate,
        afterViolationRatePercent: afterRate,
        violationRateDeltaPercentagePoints:
          beforeRate === null || afterRate === null
            ? null
            : roundDerived(afterRate - beforeRate, 3),
      };
    },
  );
  return {
    splitAt: split.splitAt,
    beforeSamples: beforeSamples.length,
    afterSamples: afterSamples.length,
    series,
  };
}

function pearsonCoefficient(pairs: readonly { left: number; right: number }[]): number | null {
  const meanLeft = pairs.reduce((total, pair) => total + pair.left, 0) / pairs.length;
  const meanRight = pairs.reduce((total, pair) => total + pair.right, 0) / pairs.length;
  let covariance = 0;
  let varianceLeft = 0;
  let varianceRight = 0;
  for (const pair of pairs) {
    const left = pair.left - meanLeft;
    const right = pair.right - meanRight;
    covariance += left * right;
    varianceLeft += left * left;
    varianceRight += right * right;
  }
  if (varianceLeft === 0 || varianceRight === 0) {
    return null;
  }
  return Math.max(-1, Math.min(1, covariance / Math.sqrt(varianceLeft * varianceRight)));
}

function analyzeCorrelations(
  samples: readonly NormalizedSample[],
): MinecraftPerformanceCorrelation[] {
  return minecraftPerformanceMetricNames
    .filter((metric): metric is Exclude<MinecraftPerformanceMetric, "mspt"> => metric !== "mspt")
    .map((metric) => {
      const pairs = samples.flatMap((sample) => {
        const mspt = sample.values.mspt;
        const candidate = sample.values[metric];
        return mspt === undefined || candidate === undefined
          ? []
          : [{ left: mspt, right: candidate }];
      });
      if (pairs.length < minecraftPerformanceAnalysisRules.minimumCorrelationSamples) {
        return {
          kind: "association" as const,
          candidateMetric: metric,
          status: "insufficient-samples" as const,
          alignedSamples: pairs.length,
          coefficient: null,
        };
      }
      const coefficient = pearsonCoefficient(pairs);
      if (coefficient === null) {
        return {
          kind: "association" as const,
          candidateMetric: metric,
          status: "constant-series" as const,
          alignedSamples: pairs.length,
          coefficient: null,
        };
      }
      return {
        kind: "association" as const,
        candidateMetric: metric,
        status: "computed" as const,
        alignedSamples: pairs.length,
        coefficient: roundDerived(coefficient),
      };
    });
}

export function analyzeMinecraftPerformance(
  input: unknown,
  limitOverrides?: Partial<MinecraftPerformanceAnalysisLimits>,
): MinecraftPerformanceAnalysisResult {
  const limits = resolveMinecraftPerformanceAnalysisLimits(limitOverrides);
  const diagnostics = createDiagnosticCollector(limits.maxDiagnostics);
  const exceededLimits: MinecraftPerformanceAnalysisLimitName[] = [];
  const exceed = (name: MinecraftPerformanceAnalysisLimitName): void => {
    if (!exceededLimits.includes(name)) {
      exceededLimits.push(name);
    }
  };
  let inputBytes: number | null = null;
  let inputCharacters: number | null = null;
  let sampleCount: number | null = null;
  let seriesWithData = 0;
  let window: MinecraftPerformanceAnalysisResult["window"] = null;
  let cadence: MinecraftPerformanceAnalysisResult["cadence"] = null;
  let appliedThresholds: MinecraftPerformanceAnalysisResult["appliedThresholds"] = {
    tps: { minimum: { value: 20, source: "paper-default" }, maximum: null },
    mspt: { minimum: null, maximum: { value: 50, source: "paper-default" } },
  };
  let series: MinecraftPerformanceSeriesResult[] = [];
  let comparison: MinecraftPerformanceAnalysisResult["comparison"] = null;
  let correlations: MinecraftPerformanceCorrelation[] = [];
  let thresholdStatus: MinecraftPerformanceAnalysisResult["thresholdStatus"] = null;
  let nextSteps: MinecraftPerformanceAnalysisResult["nextSteps"] = [];

  const finish = (): MinecraftPerformanceAnalysisResult => {
    const collected = diagnostics.finish();
    const inputValid = collected.errorCount === 0;
    const analysisComplete =
      inputValid && seriesWithData > 0 && series.length === minecraftPerformanceMetricNames.length;
    return {
      schemaVersion: 1,
      inputValid,
      analysisComplete,
      outcome: inputValid
        ? analysisComplete
          ? "analyzed"
          : "insufficient-data"
        : exceededLimits.length > 0
          ? "limit-exceeded"
          : "invalid-input",
      thresholdStatus,
      inputBytes,
      inputCharacters,
      sampleCount,
      seriesWithData,
      window,
      cadence,
      appliedThresholds,
      series,
      comparison,
      correlations,
      nextSteps,
      appliedLimits: limits,
      exceededLimits,
      errorCount: collected.errorCount,
      warningCount: collected.warningCount,
      diagnosticTotal: collected.diagnosticTotal,
      retainedDiagnosticCount: collected.diagnostics.length,
      omittedDiagnosticCount: collected.omittedDiagnosticCount,
      diagnostics: collected.diagnostics,
      sourceEvidence: [...sourceEvidence],
      notes: [
        "Paper documents a target of 20 TPS and a 50 ms tick budget; only those TPS/MSPT defaults are applied automatically.",
        "CPU, heap, chunk, entity, player, and GC pause thresholds are evaluated only when the caller supplies them explicitly.",
        "analysisComplete means the input was valid and at least one metric was observed; per-series coverage and association statuses still determine evidence sufficiency.",
        "Missing metric values are not interpolated; coverage and cadence evidence remain separate from observed values.",
        "Violation intervals join consecutive violating observations and do not prove behavior between timestamps.",
        "Aligned correlations are descriptive associations and candidate signals only; they do not identify a root cause.",
        "A before/after delta or trend is descriptive, is not a significance test, and must not be treated as causal evidence.",
        "When threshold violations occur, capture a scoped spark profile while the issue is actively occurring before drawing a root-cause conclusion.",
        "Catalog and MCP inputs are already-parsed objects, so source-level duplicate JSON keys cannot be detected there; the JSON file CLI rejects duplicates before parsing.",
      ],
    };
  };

  const root = inspectDataObject(input, outerFieldSet, "$", diagnostics);
  if (root === null) {
    return finish();
  }

  const normalized = normalizeSamples(root.samples, limits, diagnostics, exceededLimits);
  sampleCount = normalized.total;
  const thresholdResult = normalizeThresholds(root.thresholds, diagnostics);
  appliedThresholds = thresholdResult.applied;
  const expectedIntervalSeconds = normalizeExpectedInterval(
    root.expectedIntervalSeconds,
    diagnostics,
  );
  const comparisonSplit =
    diagnostics.errorCount() === 0
      ? normalizeComparison(root.comparison, normalized.samples, diagnostics)
      : undefined;
  if (diagnostics.errorCount() > 0) {
    return finish();
  }

  const normalizedForSize: MinecraftPerformanceAnalysisInput = {
    samples: normalized.samples.map((sample) => ({
      timestamp: sample.timestamp,
      ...sample.values,
    })),
    ...(Object.keys(thresholdResult.input).length > 0 ? { thresholds: thresholdResult.input } : {}),
    ...(expectedIntervalSeconds !== undefined ? { expectedIntervalSeconds } : {}),
    ...(comparisonSplit !== undefined ? { comparison: { splitAt: comparisonSplit.splitAt } } : {}),
  };
  const serializedInput = JSON.stringify(normalizedForSize);
  inputCharacters = serializedInput.length;
  if (limits.maxInputCharacters < inputCharacters) {
    exceed("maxInputCharacters");
    diagnostics.add({
      severity: "error",
      code: "input-character-limit-exceeded",
      path: "$",
      message: "The normalized performance request exceeds the applied character limit.",
    });
    return finish();
  }
  inputBytes = Buffer.byteLength(serializedInput, "utf8");
  if (limits.maxInputBytes < inputBytes) {
    exceed("maxInputBytes");
    diagnostics.add({
      severity: "error",
      code: "input-byte-limit-exceeded",
      path: "$",
      message: "The normalized performance request exceeds the applied byte limit.",
    });
    return finish();
  }

  const first = normalized.samples[0];
  const last = normalized.samples.at(-1);
  if (!first || !last) {
    return finish();
  }
  window = {
    start: first.timestamp,
    end: last.timestamp,
    durationMs: last.epochMs - first.epochMs,
  };
  cadence = analyzeCadence(normalized.samples, expectedIntervalSeconds);

  let hasThresholdViolations = false;
  let observedThresholdSamples = 0;
  series = minecraftPerformanceMetricNames.map((metric): MinecraftPerformanceSeriesResult => {
    const observations = normalized.samples.flatMap((sample) => {
      const value = sample.values[metric];
      return value === undefined ? [] : [{ epochMs: sample.epochMs, value }];
    });
    const values = observations.map((observation) => observation.value);
    if (values.length > 0) {
      seriesWithData += 1;
    }
    const threshold = appliedThresholds[metric] ?? null;
    const violations =
      threshold === null
        ? null
        : analyzeViolations(
            metric,
            normalized.samples,
            threshold,
            expectedIntervalSeconds,
            limits.maxViolationIntervalsPerSeries,
          );
    if (violations !== null && violations.samples > 0) {
      hasThresholdViolations = true;
    }
    if (violations !== null) {
      observedThresholdSamples += violations.observedSamples;
    }
    return {
      metric,
      availableSamples: values.length,
      missingSamples: normalized.samples.length - values.length,
      coveragePercent: coveragePercent(values.length, normalized.samples.length),
      statistics: summarize(values),
      trend: calculateTrend(observations),
      threshold,
      violations,
    };
  });
  thresholdStatus =
    observedThresholdSamples === 0
      ? "not-observed"
      : hasThresholdViolations
        ? "violations-detected"
        : "within-thresholds";
  comparison = analyzeComparison(normalized.samples, comparisonSplit, appliedThresholds);
  correlations = analyzeCorrelations(normalized.samples);
  if (hasThresholdViolations) {
    nextSteps = [
      {
        kind: "scoped-spark-profile",
        reason: "threshold-violations-detected",
        guidance:
          "Capture a time-bounded spark profile while the issue is occurring; for spikes, scope collection to slow ticks.",
        documentation: "https://docs.papermc.io/paper/profiling/",
      },
    ];
  }
  return finish();
}

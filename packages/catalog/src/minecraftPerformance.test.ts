import { afterEach, describe, expect, it, vi } from "vitest";
import { searchAll, suggestMinecraftLookups } from "./index.js";
import {
  analyzeMinecraftPerformance,
  defaultMinecraftPerformanceAnalysisLimits,
  resolveMinecraftPerformanceAnalysisLimits,
} from "./minecraftPerformance.js";

function timestamp(minutes: number): string {
  return new Date(Date.UTC(2026, 7, 25, 0, minutes)).toISOString();
}

function seriesResult(result: ReturnType<typeof analyzeMinecraftPerformance>, metric: string) {
  return result.series.find((series) => series.metric === metric);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Minecraft performance analysis", () => {
  it("summarizes coverage, thresholds, violations, trends, comparison, and associations", () => {
    const samples = Array.from({ length: 12 }, (_, index) => ({
      timestamp: timestamp(index),
      tps: index === 4 || index === 5 ? 19.5 : 20,
      mspt: 40 + index,
      cpuPercent: 50,
      heapUsedBytes: 1_000_000 + index * 10_000,
      loadedChunks: 500 + index,
      entities: 100 + index * 2,
      ...(index % 2 === 0 ? { players: 10 + index } : {}),
      gcPauseMs: index,
    }));
    const result = analyzeMinecraftPerformance({
      samples,
      thresholds: { entities: { maximum: 115 } },
      expectedIntervalSeconds: 60,
      comparison: { splitAt: timestamp(6) },
    });

    expect(result).toMatchObject({
      inputValid: true,
      analysisComplete: true,
      outcome: "analyzed",
      thresholdStatus: "violations-detected",
      sampleCount: 12,
      seriesWithData: 8,
      window: { start: timestamp(0), end: timestamp(11), durationMs: 11 * 60_000 },
      cadence: {
        expectedIntervalSeconds: 60,
        gapCount: 0,
        estimatedMissingSamples: 0,
        temporalCoveragePercent: 100,
      },
    });
    expect(result.appliedThresholds).toMatchObject({
      tps: { minimum: { value: 20, source: "paper-default" } },
      mspt: { maximum: { value: 50, source: "paper-default" } },
      entities: { maximum: { value: 115, source: "input" } },
    });
    expect(seriesResult(result, "mspt")).toMatchObject({
      coveragePercent: 100,
      statistics: { min: 40, p50: 45.5, p95: 50.45, max: 51 },
      trend: { status: "computed", slopePerHour: 60 },
      violations: { observedSamples: 12, samples: 1, intervalTotal: 1 },
    });
    expect(seriesResult(result, "players")).toMatchObject({
      availableSamples: 6,
      missingSamples: 6,
      coveragePercent: 50,
    });
    expect(seriesResult(result, "entities")?.violations).toMatchObject({
      samples: 4,
      longestConsecutiveSamples: 4,
    });
    expect(result.comparison).toMatchObject({
      splitAt: timestamp(6),
      beforeSamples: 6,
      afterSamples: 6,
    });
    expect(result.comparison?.series.find((series) => series.metric === "mspt")).toMatchObject({
      status: "computed",
      p50Delta: 6,
      beforeViolationRatePercent: 0,
    });
    expect(result.correlations.find((entry) => entry.candidateMetric === "entities")).toEqual({
      kind: "association",
      candidateMetric: "entities",
      status: "computed",
      alignedSamples: 12,
      coefficient: 1,
    });
    expect(
      result.correlations.find((entry) => entry.candidateMetric === "cpuPercent"),
    ).toMatchObject({ status: "constant-series", coefficient: null });
    expect(result.nextSteps).toEqual([expect.objectContaining({ kind: "scoped-spark-profile" })]);
  });

  it("reports missing metric coverage and cadence gaps without interpolation", () => {
    const result = analyzeMinecraftPerformance({
      samples: [
        { timestamp: timestamp(0), tps: 20 },
        { timestamp: timestamp(1) },
        { timestamp: timestamp(3), tps: 20 },
      ],
      expectedIntervalSeconds: 60,
    });

    expect(result.inputValid).toBe(true);
    expect(result.cadence).toMatchObject({
      gapCount: 1,
      estimatedMissingSamples: 1,
      temporalCoveragePercent: 75,
    });
    expect(seriesResult(result, "tps")).toMatchObject({
      availableSamples: 2,
      missingSamples: 1,
      coveragePercent: 66.667,
      trend: { status: "insufficient-samples" },
    });
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "sample-without-metrics", path: "$.samples[1]" }),
    );
  });

  it("applies no CPU, heap, count, or GC threshold unless explicitly supplied", () => {
    const samples = [
      { timestamp: timestamp(0), cpuPercent: 99, heapUsedBytes: 9_000_000, gcPauseMs: 500 },
      { timestamp: timestamp(1), cpuPercent: 100, heapUsedBytes: 10_000_000, gcPauseMs: 700 },
    ];
    const defaultResult = analyzeMinecraftPerformance({ samples });
    const explicitResult = analyzeMinecraftPerformance({
      samples,
      thresholds: { cpuPercent: { maximum: 90 }, gcPauseMs: { maximum: 600 } },
    });

    expect(seriesResult(defaultResult, "cpuPercent")?.threshold).toBeNull();
    expect(seriesResult(defaultResult, "heapUsedBytes")?.threshold).toBeNull();
    expect(defaultResult.thresholdStatus).toBe("not-observed");
    expect(seriesResult(explicitResult, "cpuPercent")?.violations?.samples).toBe(2);
    expect(seriesResult(explicitResult, "gcPauseMs")?.violations?.samples).toBe(1);
  });

  it("does not report complete or within-thresholds when every metric is missing", () => {
    const result = analyzeMinecraftPerformance({
      samples: [{ timestamp: timestamp(0) }, { timestamp: timestamp(1) }],
    });

    expect(result).toMatchObject({
      inputValid: true,
      analysisComplete: false,
      outcome: "insufficient-data",
      thresholdStatus: "not-observed",
      seriesWithData: 0,
    });
    expect(seriesResult(result, "tps")?.violations).toMatchObject({ observedSamples: 0 });
    expect(seriesResult(result, "mspt")?.violations).toMatchObject({ observedSamples: 0 });
  });

  it("requires ordered unique canonical timestamps and finite normalized metrics", () => {
    const result = analyzeMinecraftPerformance({
      samples: [
        { timestamp: timestamp(1), mspt: 40, entities: 1 },
        { timestamp: timestamp(1), mspt: Number.NaN, entities: 1.5 },
        { timestamp: timestamp(0), cpuPercent: 101 },
      ],
    });
    const codes = result.diagnostics.map((diagnostic) => diagnostic.code);

    expect(result.inputValid).toBe(false);
    expect(result.analysisComplete).toBe(false);
    expect(codes).toContain("duplicate-timestamp");
    expect(codes).toContain("out-of-order-timestamp");
    expect(codes).toContain("invalid-metric-value");
    expect(result.series).toEqual([]);
  });

  it("rejects unsupported identity and source fields without returning their names or values", () => {
    const secretField = "private-host-label";
    const secretValue = "internal.example.invalid";
    const result = analyzeMinecraftPerformance({
      samples: [
        { timestamp: timestamp(0), mspt: 40 },
        { timestamp: timestamp(1), mspt: 45 },
      ],
      [secretField]: secretValue,
    });
    const serialized = JSON.stringify(result);

    expect(result.inputValid).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "unknown-field", path: "$" }),
    );
    expect(serialized).not.toContain(secretField);
    expect(serialized).not.toContain(secretValue);
  });

  it("rejects proxy, sparse, accessor, symbol, and inherited sample arrays without reading them", () => {
    const valid = [
      { timestamp: timestamp(0), mspt: 40 },
      { timestamp: timestamp(1), mspt: 41 },
    ];
    let proxyRead = false;
    const proxy = new Proxy(valid, {
      get(target, property, receiver) {
        proxyRead = true;
        return Reflect.get(target, property, receiver) as unknown;
      },
    });
    expect(analyzeMinecraftPerformance({ samples: proxy }).inputValid).toBe(false);
    expect(proxyRead).toBe(false);

    const revokedArray = Proxy.revocable(valid, {});
    revokedArray.revoke();
    expect(analyzeMinecraftPerformance({ samples: revokedArray.proxy }).inputValid).toBe(false);

    let accessorRead = false;
    const accessor = [...valid];
    Object.defineProperty(accessor, "1", {
      enumerable: true,
      configurable: true,
      get() {
        accessorRead = true;
        return valid[1];
      },
    });
    expect(analyzeMinecraftPerformance({ samples: accessor }).inputValid).toBe(false);
    expect(accessorRead).toBe(false);

    const sparse = new Array(2) as unknown[];
    sparse[0] = valid[0];
    expect(analyzeMinecraftPerformance({ samples: sparse }).inputValid).toBe(false);

    const withSymbol = [...valid] as unknown[] & { [key: symbol]: boolean };
    withSymbol[Symbol("hidden")] = true;
    expect(analyzeMinecraftPerformance({ samples: withSymbol }).inputValid).toBe(false);

    let inheritedRead = false;
    const inherited = new Array(2) as unknown[];
    const inheritedPrototype = Object.create(Array.prototype) as Record<number, unknown>;
    Object.defineProperty(inheritedPrototype, "0", {
      get() {
        inheritedRead = true;
        return valid[0];
      },
    });
    Object.setPrototypeOf(inherited, inheritedPrototype);
    inherited[1] = valid[1];
    expect(analyzeMinecraftPerformance({ samples: inherited }).inputValid).toBe(false);
    expect(inheritedRead).toBe(false);
  });

  it("rejects caller thresholds that invert a Paper default after composition", () => {
    const samples = [
      { timestamp: timestamp(0), tps: 20, mspt: 40 },
      { timestamp: timestamp(1), tps: 20, mspt: 40 },
    ];
    const tps = analyzeMinecraftPerformance({ samples, thresholds: { tps: { maximum: 10 } } });
    const mspt = analyzeMinecraftPerformance({ samples, thresholds: { mspt: { minimum: 60 } } });

    expect(tps.diagnostics).toContainEqual(
      expect.objectContaining({ code: "inverted-threshold", path: "$.thresholds.tps" }),
    );
    expect(mspt.diagnostics).toContainEqual(
      expect.objectContaining({ code: "inverted-threshold", path: "$.thresholds.mspt" }),
    );
    expect(tps.inputValid).toBe(false);
    expect(mspt.inputValid).toBe(false);
  });

  it("rejects empty threshold objects instead of claiming an observed metric is within bounds", () => {
    const result = analyzeMinecraftPerformance({
      samples: [
        { timestamp: timestamp(0), cpuPercent: 90 },
        { timestamp: timestamp(1), cpuPercent: 95 },
      ],
      thresholds: { cpuPercent: {} },
    });

    expect(result.inputValid).toBe(false);
    expect(result.thresholdStatus).toBeNull();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "empty-threshold", path: "$.thresholds.cpuPercent" }),
    );
  });

  it("computes MSPT correlation only with enough aligned nonconstant samples", () => {
    const insufficient = analyzeMinecraftPerformance({
      samples: Array.from({ length: 9 }, (_, index) => ({
        timestamp: timestamp(index),
        mspt: 30 + index,
        entities: 100 + index,
      })),
    });
    const constant = analyzeMinecraftPerformance({
      samples: Array.from({ length: 10 }, (_, index) => ({
        timestamp: timestamp(index),
        mspt: 40,
        entities: 100 + index,
      })),
    });

    expect(
      insufficient.correlations.find((entry) => entry.candidateMetric === "entities"),
    ).toMatchObject({ status: "insufficient-samples", alignedSamples: 9, coefficient: null });
    expect(
      constant.correlations.find((entry) => entry.candidateMetric === "entities"),
    ).toMatchObject({ status: "constant-series", alignedSamples: 10, coefficient: null });
  });

  it("keeps sparse before/after comparisons explicitly insufficient", () => {
    const result = analyzeMinecraftPerformance({
      samples: Array.from({ length: 5 }, (_, index) => ({
        timestamp: timestamp(index),
        mspt: 40 + index,
      })),
      comparison: { splitAt: timestamp(2) },
    });
    expect(result.comparison?.series.find((series) => series.metric === "mspt")).toMatchObject({
      status: "insufficient-samples",
      p50Delta: null,
      violationRateDeltaPercentagePoints: null,
    });
  });

  it("bounds samples, normalized characters and bytes, windows, intervals, and diagnostics", () => {
    const samples = Array.from({ length: 3 }, (_, index) => ({
      timestamp: timestamp(index),
      tps: 19,
    }));
    const sampleLimited = analyzeMinecraftPerformance({ samples }, { maxSamples: 2 });
    expect(sampleLimited.exceededLimits).toContain("maxSamples");

    const characterLimited = analyzeMinecraftPerformance({ samples }, { maxInputCharacters: 100 });
    expect(characterLimited.exceededLimits).toContain("maxInputCharacters");
    expect(characterLimited.inputBytes).toBeNull();

    const byteLimited = analyzeMinecraftPerformance({ samples }, { maxInputBytes: 100 });
    expect(byteLimited.exceededLimits).toContain("maxInputBytes");
    expect(byteLimited.inputBytes).toBeGreaterThan(100);

    const windowLimited = analyzeMinecraftPerformance({ samples }, { maxWindowDurationMs: 60_000 });
    expect(windowLimited.exceededLimits).toContain("maxWindowDurationMs");

    const intervalsLimited = analyzeMinecraftPerformance(
      {
        samples: Array.from({ length: 7 }, (_, index) => ({
          timestamp: timestamp(index),
          tps: index % 2 === 0 ? 19 : 20,
        })),
      },
      { maxViolationIntervalsPerSeries: 1 },
    );
    expect(seriesResult(intervalsLimited, "tps")?.violations).toMatchObject({
      intervalTotal: 4,
      retainedIntervalCount: 1,
      omittedIntervalCount: 3,
    });

    const diagnosticsLimited = analyzeMinecraftPerformance(
      { samples: [{}, {}, {}] },
      { maxDiagnostics: 1 },
    );
    expect(diagnosticsLimited.retainedDiagnosticCount).toBe(1);
    expect(diagnosticsLimited.omittedDiagnosticCount).toBeGreaterThan(0);
  });

  it("rejects unsafe limit overrides instead of silently widening or defaulting them", () => {
    expect(resolveMinecraftPerformanceAnalysisLimits({ maxSamples: 2 }).maxSamples).toBe(2);
    for (const value of [
      0,
      -1,
      1.5,
      Number.NaN,
      Number.MAX_SAFE_INTEGER + 1,
      defaultMinecraftPerformanceAnalysisLimits.maxSamples + 1,
    ]) {
      expect(() => resolveMinecraftPerformanceAnalysisLimits({ maxSamples: value })).toThrow(
        "safe positive integers",
      );
    }
    expect(() => resolveMinecraftPerformanceAnalysisLimits({ unknown: 1 } as never)).toThrow(
      "unknown field",
    );
    let called = false;
    const accessor = {} as { maxSamples?: number };
    Object.defineProperty(accessor, "maxSamples", {
      get() {
        called = true;
        return 2;
      },
    });
    expect(() => resolveMinecraftPerformanceAnalysisLimits(accessor)).toThrow("accessors");
    expect(called).toBe(false);

    const nonEnumerable = {} as { maxSamples?: number };
    Object.defineProperty(nonEnumerable, "maxSamples", { value: 2 });
    expect(() => resolveMinecraftPerformanceAnalysisLimits(nonEnumerable)).toThrow("enumerable");

    let proxyTrapCalled = false;
    const proxy = new Proxy(
      {},
      {
        ownKeys() {
          proxyTrapCalled = true;
          return [];
        },
      },
    );
    expect(() => resolveMinecraftPerformanceAnalysisLimits(proxy)).toThrow("proxy objects");
    expect(proxyTrapCalled).toBe(false);

    const revokedLimits = Proxy.revocable({}, {});
    revokedLimits.revoke();
    expect(() => resolveMinecraftPerformanceAnalysisLimits(revokedLimits.proxy)).toThrow(
      "proxy objects",
    );
  });

  it("rejects non-enumerable object fields as non-JSON data", () => {
    const first = { timestamp: timestamp(0), mspt: 40 };
    const second = { timestamp: timestamp(1) } as { timestamp: string; mspt?: number };
    Object.defineProperty(second, "mspt", { value: 41 });

    const result = analyzeMinecraftPerformance({ samples: [first, second] });
    expect(result.inputValid).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "non-enumerable-field", path: "$.samples[1]" }),
    );
  });

  it("returns a bounded diagnostic for a revoked root proxy", () => {
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();

    const result = analyzeMinecraftPerformance(revoked.proxy);
    expect(result.inputValid).toBe(false);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "unsafe-object" }));
  });

  it("is deterministic and does not consult the current clock", () => {
    vi.spyOn(Date, "now").mockImplementation(() => {
      throw new Error("Date.now must not be called");
    });
    const input = {
      samples: [
        { timestamp: timestamp(0), tps: 20, mspt: 40 },
        { timestamp: timestamp(1), tps: 20, mspt: 45 },
      ],
    };

    expect(analyzeMinecraftPerformance(input)).toEqual(analyzeMinecraftPerformance(input));
  });

  it("routes English performance time-series requests without generic optimization matches", () => {
    const suggestions = suggestMinecraftLookups({
      version: "26.2",
      task: "analyze the TPS and MSPT performance regression time series",
    });
    expect(suggestions.suggestedTools.map((entry) => entry.tool)).toContain(
      "minecraft analyze-performance <file>",
    );

    const search = searchAll({
      version: "26.2",
      query: "compare Minecraft server MSPT before and after deployment",
    });
    expect(search.results).toContainEqual(
      expect.objectContaining({
        surface: "performance-analysis-tools",
        kind: "offline-analyzer",
      }),
    );

    const unrelated = suggestMinecraftLookups({
      version: "26.2",
      task: "write a Paper plugin optimization guide",
    });
    expect(
      unrelated.suggestedTools.some((entry) => entry.tool.includes("analyze-performance")),
    ).toBe(false);
  }, 15_000);
});

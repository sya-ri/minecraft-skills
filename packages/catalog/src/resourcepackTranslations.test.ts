import { describe, expect, it } from "vitest";
import {
  type ResourcepackTranslationValidationOptions,
  validateResourcepackTranslations,
} from "./index.js";

function validatePair(
  reference: Record<string, string> | string,
  target: Record<string, string> | string,
  options: Partial<ResourcepackTranslationValidationOptions> = {},
) {
  return validateResourcepackTranslations({
    version: "26.2",
    referenceLocale: "en_us",
    requiredLocales: ["ja_jp"],
    files: [
      {
        path: "assets/example/lang/en_us.json",
        content: typeof reference === "string" ? reference : JSON.stringify(reference),
      },
      {
        path: "assets/example/lang/ja_jp.json",
        content: typeof target === "string" ? target : JSON.stringify(target),
      },
    ],
    ...options,
  });
}

describe("validateResourcepackTranslations", () => {
  it("uses the current Mojang Language d/f normalization before comparing references", () => {
    const result = validatePair(
      { value: "%1$s %2$s %2$s" },
      { value: "%d %.2f %2$.2f" },
      { argumentCounts: { value: 2 } },
    );

    expect(result.source.clientVersion).toBe("26.2");
    expect(result.comparisons[0]).toMatchObject({
      comparedKeyCount: 1,
      placeholderMismatchCount: 0,
      runtimeFallbackCount: 0,
    });
    expect(result.diagnostics).not.toContainEqual(
      expect.objectContaining({ code: "placeholder-reference-mismatch" }),
    );
  });

  it("allows indexed placeholders to reorder arguments", () => {
    const result = validatePair(
      { value: "%1$s %2$s" },
      { value: "%2$s %1$s" },
      { argumentCounts: { value: 2 } },
    );

    expect(result.comparisons[0]?.placeholderMismatchCount).toBe(0);
  });

  it("compares placeholder reference multisets so repetition and loss warn", () => {
    const result = validatePair(
      { value: "%1$s" },
      { value: "%1$s %1$s" },
      { argumentCounts: { value: 1 } },
    );

    expect(result.valid).toBe(true);
    expect(result.validationComplete).toBe(false);
    expect(result.comparisons[0]?.placeholderMismatchCount).toBe(1);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "placeholder-reference-mismatch", key: "value" }),
    );
  });

  it("treats percent escapes as literals without argument references", () => {
    const result = validatePair(
      { value: "100%% %s" },
      { value: "100%% %s" },
      {
        argumentCounts: { value: 1 },
      },
    );

    expect(result.comparisons[0]).toMatchObject({
      placeholderMismatchCount: 0,
      runtimeFallbackCount: 0,
    });
  });

  it("reports unsupported TranslatableContents conversions as literal fallback", () => {
    const result = validatePair(
      { value: "%1$s" },
      { value: "%x" },
      { argumentCounts: { value: 1 } },
    );

    expect(result.comparisons[0]?.runtimeFallbackCount).toBe(1);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "runtime-format-fallback", key: "value" }),
    );
  });

  it("does not advance the implicit counter for explicit placeholders", () => {
    const result = validatePair(
      { value: "%1$s %2$s" },
      { value: "%2$s %s" },
      { argumentCounts: { value: 2 } },
    );

    expect(result.comparisons[0]?.placeholderMismatchCount).toBe(0);
  });

  it("accepts Java integer indices with arbitrarily many leading zeroes", () => {
    const result = validatePair(
      { value: "%1$s" },
      { value: "%00000000001$s" },
      { argumentCounts: { value: 1 } },
    );

    expect(result.comparisons[0]).toMatchObject({
      placeholderMismatchCount: 0,
      runtimeFallbackCount: 0,
    });
  });

  it("reports zero, known out-of-range, and Java integer-overflow indices as literal fallback", () => {
    const result = validatePair(
      {
        overflow: "%1$s",
        out_of_range: "%1$s",
        zero: "%1$s",
      },
      {
        overflow: "%999999999999$s",
        out_of_range: "%2$s",
        zero: "%0$s",
      },
      {
        argumentCounts: {
          overflow: 1,
          out_of_range: 1,
          zero: 1,
        },
      },
    );

    expect(result.comparisons[0]?.runtimeFallbackCount).toBe(3);
    expect(
      result.diagnostics.filter((diagnostic) => diagnostic.code === "runtime-format-fallback"),
    ).toHaveLength(3);
  });

  it("keeps unknown argument bounds separate when call-site counts are not supplied", () => {
    const result = validatePair({ value: "%1$s" }, { value: "%999$s" });

    expect(result.valid).toBe(true);
    expect(result.incompleteReasons).toContain("argument-count-evidence-unavailable");
    expect(result.diagnostics).not.toContainEqual(
      expect.objectContaining({ code: "runtime-format-fallback" }),
    );
  });

  it("detects duplicate raw JSON keys without retaining translation values", () => {
    const result = validateResourcepackTranslations({
      version: "26.2",
      files: [
        {
          path: "assets/example/lang/en_us.json",
          content: '{"example.key":"private-one","example.key":"private-two"}',
        },
      ],
    });
    const serialized = JSON.stringify(result);

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "duplicate-source-key", key: "example.key" }),
    );
    expect(serialized).not.toContain("private-one");
    expect(serialized).not.toContain("private-two");
  });

  it("deduplicates diagnostics before bounding displayed key text", () => {
    const reference = Object.fromEntries(
      Array.from({ length: 20 }, (_, index) => [`long-translation-key-${index}`, "value"]),
    );
    const result = validatePair(
      reference,
      {},
      {
        limits: { maxDiagnosticTextLength: 1 },
      },
    );

    expect(result.warningCount).toBe(20);
    expect(
      result.diagnostics.filter((diagnostic) => diagnostic.code === "translation-key-missing"),
    ).toHaveLength(20);
    expect(result.diagnostics.every((diagnostic) => (diagnostic.key?.length ?? 0) <= 1)).toBe(true);
  });

  it("parses escaped raw JSON strings without losing placeholder evidence", () => {
    const result = validatePair('{"value":"line\\n%1$s"}', '{"value":"line\\n%1$s"}', {
      argumentCounts: { value: 1 },
    });

    expect(result.valid).toBe(true);
    expect(result.comparisons[0]?.placeholderMismatchCount).toBe(0);
  });

  it("counts every raw duplicate occurrence against entry and content work budgets", () => {
    const contentLimited = validateResourcepackTranslations({
      version: "26.2",
      files: [
        {
          path: "assets/example/lang/en_us.json",
          content: '{"k":"123","k":"456"}',
        },
        {
          path: "assets/example/lang/ja_jp.json",
          content: '{"later":"must-not-be-processed"}',
        },
      ],
      limits: { maxContentCharactersTotal: 7 },
    });
    const entryLimited = validateResourcepackTranslations({
      version: "26.2",
      files: [
        {
          path: "assets/example/lang/en_us.json",
          content: '{"k":"1","k":"2"}',
        },
      ],
      limits: { maxEntriesTotal: 1 },
    });

    expect(contentLimited.processedFiles).toBe(0);
    expect(contentLimited.exceededLimits).toContain("maxContentCharactersTotal");
    expect(contentLimited.diagnostics).not.toContainEqual(
      expect.objectContaining({ fileIndex: 1 }),
    );
    expect(entryLimited.processedFiles).toBe(0);
    expect(entryLimited.exceededLimits).toContain("maxEntriesTotal");
  });

  it("parses many flat entries with indexed scanning", () => {
    const entries = Array.from({ length: 5_000 }, (_, index) => `"key.${index}":"v"`).join(",");
    const result = validateResourcepackTranslations({
      version: "26.2",
      files: [
        {
          path: "assets/example/lang/en_us.json",
          content: `{${entries}}`,
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.totalEntries).toBe(5_000);
  });

  it("marks parsed-object source-key uniqueness as unproven", () => {
    const result = validateResourcepackTranslations({
      version: "26.2",
      files: [
        {
          path: "assets/example/lang/en_us.json",
          content: { "example.key": "value" },
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.validationComplete).toBe(false);
    expect(result.incompleteReasons).toContain("parsed-source-key-uniqueness-unavailable");
  });

  it("aggregates locale keys globally and reports unknown cross-file override order", () => {
    const result = validateResourcepackTranslations({
      version: "26.2",
      files: [
        {
          path: "assets/first/lang/en_us.json",
          content: '{"shared.key":"first"}',
        },
        {
          path: "assets/second/lang/en_us.json",
          content: '{"shared.key":"second"}',
        },
      ],
    });

    expect(result.locales).toEqual([
      {
        locale: "en_us",
        fileCount: 2,
        entryCount: 2,
        uniqueKeyCount: 1,
        ambiguousKeyCount: 1,
      },
    ]);
    expect(result.incompleteReasons).toContain("pack-order-unavailable");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "global-key-override-order-unknown" }),
    );
  });

  it("counts repeated logical paths as separate supplied files", () => {
    const result = validateResourcepackTranslations({
      version: "26.2",
      files: [
        { path: "assets/example/lang/en_us.json", content: '{"first":"one"}' },
        { path: "assets/example/lang/en_us.json", content: '{"second":"two"}' },
      ],
    });

    expect(result.locales[0]?.fileCount).toBe(2);
  });

  it("rejects dot-segment namespace paths without returning the supplied path", () => {
    const result = validateResourcepackTranslations({
      version: "26.2",
      files: [{ path: "assets/../lang/en_us.json", content: "{}" }],
    });

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "invalid-translation-path", path: null }),
    );
  });

  it("compares only explicitly selected required locales", () => {
    const result = validateResourcepackTranslations({
      version: "26.2",
      files: [
        { path: "assets/example/lang/en_us.json", content: '{"key":"value"}' },
        { path: "assets/example/lang/ja_jp.json", content: "{}" },
      ],
    });

    expect(result.requiredLocales).toEqual([]);
    expect(result.comparisons).toEqual([]);
    expect(result.diagnostics).not.toContainEqual(
      expect.objectContaining({ code: "translation-key-missing" }),
    );
  });

  it("reports supplied-subset missing and extra keys as warnings rather than loader errors", () => {
    const result = validatePair({ missing: "value" }, { extra: "value" });

    expect(result.valid).toBe(true);
    expect(result.validationComplete).toBe(false);
    expect(result.comparisons[0]).toMatchObject({ missingKeyCount: 1, extraKeyCount: 1 });
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "translation-key-missing", severity: "warning" }),
        expect.objectContaining({ code: "translation-key-extra", severity: "warning" }),
      ]),
    );
  });

  it("stops multi-locale key comparison at the aggregate operation bound", () => {
    const result = validateResourcepackTranslations({
      version: "26.2",
      referenceLocale: "en_us",
      requiredLocales: ["ja_jp", "fr_fr"],
      files: [
        { path: "assets/example/lang/en_us.json", content: '{"a":"one","b":"two"}' },
        { path: "assets/example/lang/ja_jp.json", content: '{"a":"one","b":"two"}' },
        { path: "assets/example/lang/fr_fr.json", content: '{"a":"one","b":"two"}' },
      ],
      limits: { maxComparisonOperations: 1 },
    });

    expect(result.comparisonOperations).toBe(1);
    expect(result.exceededLimits).toContain("maxComparisonOperations");
    expect(result.comparisons).toHaveLength(2);
    expect(result.comparisons.every((comparison) => !comparison.comparisonComplete)).toBe(true);
  });

  it("bounds aggregate parsed-object content before placeholder analysis", () => {
    const result = validateResourcepackTranslations({
      version: "26.2",
      files: [
        {
          path: "assets/example/lang/en_us.json",
          content: { abc: "de" },
        },
      ],
      limits: { maxContentCharactersTotal: 4 },
    });

    expect(result.valid).toBe(false);
    expect(result.processedFiles).toBe(0);
    expect(result.exceededLimits).toContain("maxContentCharactersTotal");
  });

  it("counts oversized invalid keys and strings toward aggregate content bounds", () => {
    const result = validateResourcepackTranslations({
      version: "26.2",
      files: [
        {
          path: "assets/example/lang/en_us.json",
          content: { oversized_key: "oversized-value" },
        },
      ],
      limits: {
        maxKeyLength: 2,
        maxValueCharacters: 2,
        maxContentCharactersTotal: 4,
      },
    });

    expect(result.valid).toBe(false);
    expect(result.processedFiles).toBe(0);
    expect(result.exceededLimits).toContain("maxContentCharactersTotal");
  });

  it("rejects non-finite numbers that cannot originate from parsed JSON", () => {
    const result = validateResourcepackTranslations({
      version: "26.2",
      files: [
        {
          path: "assets/example/lang/en_us.json",
          content: { infinite: Number.POSITIVE_INFINITY },
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "invalid-translation-value", key: "infinite" }),
    );
  });

  it("does not let structured objects forge the internal raw-number representation", () => {
    const forged = Object.create(null) as Record<string, unknown>;
    forged.rawJsonNumber = "1";
    const result = validateResourcepackTranslations({
      version: "26.2",
      files: [
        {
          path: "assets/example/lang/en_us.json",
          content: { forged },
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "invalid-translation-value", key: "forged" }),
    );
  });

  it("rejects nested raw JSON with the bounded flat-object parser", () => {
    const result = validateResourcepackTranslations({
      version: "26.2",
      files: [
        {
          path: "assets/example/lang/en_us.json",
          content: '{"key":{"nested":"value"}}',
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "invalid-translation-content" }),
    );
  });

  it("does not invoke accessors or proxy traps at Catalog boundaries", () => {
    let accessorInvoked = false;
    const file = {} as Record<string, unknown>;
    Object.defineProperty(file, "path", {
      enumerable: true,
      get: () => {
        accessorInvoked = true;
        return "assets/example/lang/en_us.json";
      },
    });
    Object.defineProperty(file, "content", { enumerable: true, value: {} });
    const accessorResult = validateResourcepackTranslations({
      version: "26.2",
      files: [file as never],
    });
    let proxyTrapInvoked = false;
    const proxy = new Proxy([], {
      ownKeys: () => {
        proxyTrapInvoked = true;
        throw new Error("must not run");
      },
    });

    expect(accessorResult.valid).toBe(false);
    expect(accessorInvoked).toBe(false);
    expect(() => validateResourcepackTranslations({ files: proxy as never })).toThrow(
      "dense data array",
    );
    expect(proxyTrapInvoked).toBe(false);
  });

  it("rejects sparse arrays and unknown limit fields during preflight", () => {
    const sparse = new Array(1) as ResourcepackTranslationValidationOptions["files"];
    expect(() => validateResourcepackTranslations({ files: sparse })).toThrow("dense data array");
    expect(() =>
      validateResourcepackTranslations({
        files: [],
        limits: { unknown: 1 } as never,
      }),
    ).toThrow("unknown field");
  });

  it("rejects invalid, accessor, proxy, and non-enumerable limit fields without invoking code", () => {
    for (const invalid of [0, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER]) {
      expect(() =>
        validateResourcepackTranslations({
          files: [],
          limits: { maxFiles: invalid },
        }),
      ).toThrow("positive safe integer");
    }

    let accessorInvoked = false;
    const accessorLimits = {} as Record<string, unknown>;
    Object.defineProperty(accessorLimits, "maxFiles", {
      enumerable: true,
      get: () => {
        accessorInvoked = true;
        return 1;
      },
    });
    expect(() =>
      validateResourcepackTranslations({ files: [], limits: accessorLimits as never }),
    ).toThrow("plain data object");
    expect(accessorInvoked).toBe(false);

    const nonEnumerableLimits = {} as Record<string, unknown>;
    Object.defineProperty(nonEnumerableLimits, "maxFiles", {
      enumerable: false,
      value: 1,
    });
    expect(() =>
      validateResourcepackTranslations({ files: [], limits: nonEnumerableLimits as never }),
    ).toThrow("plain data object");

    let proxyTrapInvoked = false;
    const proxyLimits = new Proxy(
      {},
      {
        ownKeys: () => {
          proxyTrapInvoked = true;
          throw new Error("must not run");
        },
      },
    );
    expect(() => validateResourcepackTranslations({ files: [], limits: proxyLimits })).toThrow(
      "plain data object",
    );
    expect(proxyTrapInvoked).toBe(false);
  });

  it("requires bounded target identifiers and a strict diagnostic limit", () => {
    for (const limit of [0, 1.5, 1_001, Number.NaN]) {
      expect(() => validateResourcepackTranslations({ files: [], limit })).toThrow(
        "positive safe integer",
      );
    }
    expect(() => validateResourcepackTranslations({ files: [], edition: "x".repeat(17) })).toThrow(
      "at most 16",
    );
    expect(() => validateResourcepackTranslations({ files: [], version: "x".repeat(65) })).toThrow(
      "at most 64",
    );
  });

  it("keeps unverified target-version runtime claims unknown", () => {
    const result = validateResourcepackTranslations({ version: "1.21.10", files: [] });

    expect(result.valid).toBe(true);
    expect(result.validationComplete).toBe(false);
    expect(result.incompleteReasons).toContain("runtime-placeholder-version-unverified");
  });
});

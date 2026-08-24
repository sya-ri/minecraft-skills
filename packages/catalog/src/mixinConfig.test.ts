import { describe, expect, it } from "vitest";
import { mixinConfigValidationLimits, validateMixinConfig } from "./mixinConfig.js";

function codes(result: ReturnType<typeof validateMixinConfig>): string[] {
  return result.diagnostics.map((diagnostic) => diagnostic.code);
}

describe("Mixin configuration validation", () => {
  it("maps current core fields to bounded local archive evidence", () => {
    const config = JSON.stringify({
      parent: "parent.mixins.json",
      minVersion: "0.8.7",
      compatibilityLevel: "JAVA_21",
      package: "example.mixin",
      mixins: ["Common"],
      client: ["SideOnly"],
      server: ["SideOnly"],
      refmap: "example.refmap.json",
      refmapWrapper: "Wrapper",
      plugin: "example.Plugin",
      injectors: {
        defaultRequire: 1,
        maxShiftBy: 3,
        injectionPoints: ["example.CustomPoint"],
        dynamicSelectors: ["example.CustomSelector"],
      },
      overwrites: { conformVisibility: true, requireAnnotations: true },
    });
    const archiveEntries = [
      "parent.mixins.json",
      "example.refmap.json",
      "example/mixin/Common.class",
      "example/mixin/SideOnly.class",
      "example/mixin/Wrapper.class",
      "example/Plugin.class",
      "example/CustomPoint.class",
      "example/CustomSelector.class",
    ];

    const result = validateMixinConfig({
      config,
      archiveEntries,
      archiveEntriesComplete: true,
    });

    expect(result.valid).toBe(true);
    expect(result.outcome).toBe("valid");
    expect(result.validationComplete).toBe(true);
    expect(result.source).toEqual({
      inputKind: "text",
      jsonParsed: true,
      duplicateKeys: "checked-unique",
    });
    expect(result.summary).toMatchObject({
      commonMixins: 1,
      clientMixins: 1,
      serverMixins: 1,
      uniqueDeclaredMixins: 2,
      duplicateDeclarations: 0,
      references: 8,
    });
    expect(result.archiveEvidence).toMatchObject({
      provided: true,
      entriesInspected: archiveEntries.length,
      entryListDeclaredComplete: true,
      entryListUsableComplete: true,
      observedReferences: 8,
      notObservedReferences: 0,
    });
    expect(new Set(result.references.map((reference) => reference.kind))).toEqual(
      new Set([
        "mixin-class",
        "parent-config-resource",
        "refmap-resource",
        "plugin-class",
        "refmap-wrapper-class",
        "injection-point-class",
        "dynamic-selector-class",
      ]),
    );
    expect(result.specification).toMatchObject({
      auditedCommit: "4053421aa10aaac6127d969028a29c94fe3054f6",
      auditedDate: "2026-08-25",
      compatibilityLevelsCurrentThrough: "JAVA_21",
      auditedGsonVersion: "2.2.4",
    });
    expect(result.specification.configLoader).toContain(result.specification.auditedCommit);
  });

  it("reports raw duplicate keys as last-wins source evidence without rejecting the config", () => {
    const result = validateMixinConfig({
      config: '{"minVersion":"0.8.7","package":"first","package":"second","mixins":[]}',
    });

    expect(result.valid).toBe(true);
    expect(result.outcome).toBe("valid");
    expect(result.source.duplicateKeys).toBe("observed");
    expect(codes(result)).toContain("config.duplicate-key");
  });

  it("keeps parsed-object source uniqueness unknown and does not claim JSON parsing", () => {
    const result = validateMixinConfig({
      config: { minVersion: "0.8.7", package: "example.mixin", mixins: [] },
    });

    expect(result.valid).toBe(true);
    expect(result.outcome).toBe("indeterminate");
    expect(result.validationComplete).toBe(false);
    expect(result.source).toEqual({
      inputKind: "object",
      jsonParsed: false,
      duplicateKeys: "unknown",
    });
    expect(codes(result)).toContain("config.source-keys-unchecked");
  });

  it("distinguishes successful JSON parsing from root and bounded-data validation", () => {
    const invalidRoot = validateMixinConfig({ config: "[]" });
    const invalidJson = validateMixinConfig({ config: "{" });

    expect(invalidRoot.valid).toBe(false);
    expect(invalidRoot.source.jsonParsed).toBe(true);
    expect(codes(invalidRoot)).toContain("config.invalid-root");
    expect(invalidJson.valid).toBe(false);
    expect(invalidJson.source.jsonParsed).toBe(false);
    expect(codes(invalidJson)).toContain("config.invalid-json");
  });

  it("treats empty parent and package strings as absent where current core does", () => {
    const result = validateMixinConfig({
      config: JSON.stringify({ parent: "", package: "", mixins: ["Example"] }),
    });

    expect(result.valid).toBe(false);
    expect(codes(result)).toContain("config.missing-package");
    expect(codes(result)).toContain("config.version-guard-missing");
    expect(result.references.some((reference) => reference.kind === "parent-config-resource")).toBe(
      false,
    );
  });

  it("uses current VersionNumber syntax and signed 16-bit component bounds", () => {
    const accepted = validateMixinConfig({
      config: '{"minVersion":"1.2.3.4-preview_1","package":"example","mixins":[]}',
    });
    const unparsed = validateMixinConfig({
      config: '{"minVersion":"1.2.3+build","package":"example","mixins":[]}',
    });
    const outOfRange = validateMixinConfig({
      config: '{"minVersion":"32768.1","package":"example","mixins":[]}',
    });

    expect(codes(accepted)).not.toContain("config.min-version-unparsed");
    expect(codes(unparsed)).toContain("config.min-version-unparsed");
    expect(unparsed.valid).toBe(true);
    expect(codes(outOfRange)).toContain("config.min-version-out-of-range");
    expect(outOfRange.valid).toBe(false);
  });

  it("warns only for duplicate declarations which can overlap in one environment", () => {
    const sidedOnly = validateMixinConfig({
      config: JSON.stringify({
        minVersion: "0.8.7",
        package: "example",
        client: ["Side"],
        server: ["Side"],
      }),
    });
    const overlapping = validateMixinConfig({
      config: JSON.stringify({
        minVersion: "0.8.7",
        package: "example",
        mixins: ["Shared"],
        client: ["Shared"],
        server: ["Repeated", "Repeated"],
      }),
    });

    expect(sidedOnly.summary.duplicateDeclarations).toBe(0);
    expect(codes(sidedOnly)).not.toContain("config.duplicate-mixin-declaration");
    expect(overlapping.summary.duplicateDeclarations).toBe(2);
    expect(codes(overlapping)).toContain("config.duplicate-mixin-declaration");
  });

  it("reports local absence from a complete supplied archive only as unknown evidence", () => {
    const result = validateMixinConfig({
      config: '{"minVersion":"0.8.7","package":"example","mixins":["Missing"]}',
      archiveEntries: [],
      archiveEntriesComplete: true,
    });

    expect(result.valid).toBe(true);
    expect(result.outcome).toBe("indeterminate");
    expect(result.references).toEqual([
      expect.objectContaining({
        logicalName: "example.Missing",
        archivePath: "example/Missing.class",
        suppliedArchive: "not-observed",
      }),
    ]);
    expect(codes(result)).toContain("archive.reference-not-observed");
  });

  it("does not infer absence from an explicitly incomplete entry list", () => {
    const result = validateMixinConfig({
      config: '{"minVersion":"0.8.7","package":"example","mixins":["External"]}',
      archiveEntries: [],
      archiveEntriesComplete: false,
    });

    expect(result.valid).toBe(true);
    expect(result.outcome).toBe("valid");
    expect(result.validationComplete).toBe(false);
    expect(result.references[0]?.suppliedArchive).toBe("not-checked");
    expect(codes(result)).not.toContain("archive.reference-not-observed");
  });

  it("enforces current Gson scalar shapes and signed 32-bit integer bounds", () => {
    const result = validateMixinConfig({
      config: JSON.stringify({
        minVersion: { nested: true },
        package: "example",
        mixins: ["Okay", { bad: true }],
        priority: 2_147_483_648,
        mixinPriority: true,
        injectors: { defaultRequire: -2_147_483_649, maxShiftBy: 1.5 },
      }),
    });

    expect(result.valid).toBe(false);
    expect(codes(result)).toContain("config.invalid-string");
    expect(codes(result)).toContain("config.invalid-list-entry");
    expect(codes(result).filter((code) => code === "config.invalid-integer")).toHaveLength(4);
  });

  it("handles null requiredFeatures as no feature guard", () => {
    const result = validateMixinConfig({
      config: '{"requiredFeatures":null,"package":"example","mixins":[]}',
    });

    expect(result.valid).toBe(true);
    expect(codes(result)).toContain("config.version-guard-missing");
  });

  it("rejects null list entries which current core does not safely dereference", () => {
    const result = validateMixinConfig({
      config: JSON.stringify({
        minVersion: "0.8.7",
        package: "example",
        requiredFeatures: [null],
        mixins: [null],
        injectors: { injectionPoints: [null] },
      }),
    });

    expect(result.valid).toBe(false);
    expect(codes(result).filter((code) => code === "config.invalid-null-list-entry")).toHaveLength(
      3,
    );
  });

  it("accepts only bounded integer strings through the audited Gson coercion path", () => {
    const accepted = validateMixinConfig({
      config: JSON.stringify({
        minVersion: "0.8.7",
        package: "example",
        priority: "+12",
        injectors: { maxShiftBy: "6" },
      }),
    });
    const rejected = validateMixinConfig({
      config: JSON.stringify({ minVersion: "0.8.7", package: "example", priority: "1.5" }),
    });

    expect(accepted.valid).toBe(true);
    expect(codes(accepted).filter((code) => code === "config.noncanonical-scalar")).toHaveLength(2);
    expect(codes(accepted)).toContain("config.max-shift-clamped");
    expect(rejected.valid).toBe(false);
    expect(codes(rejected)).toContain("config.invalid-integer");
  });

  it("rejects proxies and accessors without invoking their traps or getters", () => {
    let trapCalls = 0;
    const proxy = new Proxy(
      {},
      {
        get() {
          trapCalls += 1;
          throw new Error("must not run");
        },
        getOwnPropertyDescriptor() {
          trapCalls += 1;
          throw new Error("must not run");
        },
        getPrototypeOf() {
          trapCalls += 1;
          throw new Error("must not run");
        },
        ownKeys() {
          trapCalls += 1;
          throw new Error("must not run");
        },
      },
    );
    let getterCalls = 0;
    const accessorInput = {} as { config: unknown };
    Object.defineProperty(accessorInput, "config", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return {};
      },
    });

    expect(validateMixinConfig(proxy).valid).toBe(false);
    expect(validateMixinConfig({ config: proxy }).valid).toBe(false);
    expect(validateMixinConfig(accessorInput).valid).toBe(false);
    expect(trapCalls).toBe(0);
    expect(getterCalls).toBe(0);
  });

  it("rejects symbol, non-enumerable, and sparse structured boundaries", () => {
    const symbolInput = { config: "{}", [Symbol("extra")]: true };
    const nonEnumerableInput = {} as { config: string };
    Object.defineProperty(nonEnumerableInput, "config", { value: "{}", enumerable: false });
    const sparseEntries = Array<string>(1);

    expect(codes(validateMixinConfig(symbolInput))).toContain("input.unknown-field");
    expect(codes(validateMixinConfig(nonEnumerableInput))).toContain("input.unsafe-field");
    expect(
      codes(
        validateMixinConfig({
          config: '{"minVersion":"0.8.7","package":"example"}',
          archiveEntries: sparseEntries,
        }),
      ),
    ).toContain("archive.invalid-entries");
    expect(
      codes(
        validateMixinConfig({
          config: { minVersion: "0.8.7", package: "example", mixins: Array<string>(1) },
        }),
      ),
    ).toContain("config.unbounded-data");
  });

  it("bounds option fields, archive metadata bytes, and retained diagnostics", () => {
    const manyFields = Object.fromEntries(
      Array.from({ length: 100 }, (_, index) => [`unknown${index}`, index]),
    );
    const fieldResult = validateMixinConfig(manyFields);
    expect(fieldResult.diagnostics).toHaveLength(1);
    expect(codes(fieldResult)).toEqual(["input.field-limit"]);

    const fourBytePath = "😀".repeat(mixinConfigValidationLimits.maxEntryPathCharacters / 2);
    const archiveEntries = Array.from({ length: 16_385 }, () => fourBytePath);
    const metadataResult = validateMixinConfig({
      config: '{"minVersion":"0.8.7","package":"example","mixins":[]}',
      archiveEntries,
      archiveEntriesComplete: true,
    });
    expect(codes(metadataResult)).toContain("archive.metadata-limit");
    expect(metadataResult.archiveEvidence.entryListUsableComplete).toBe(false);

    const noisyMixins = Array.from({ length: 250 }, (_, index) => `bad/name${index}`);
    const noisyResult = validateMixinConfig({
      config: JSON.stringify({ minVersion: "0.8.7", package: "example", mixins: noisyMixins }),
    });
    expect(noisyResult.valid).toBe(true);
    expect(noisyResult.outcome).toBe("indeterminate");
    expect(noisyResult.validationComplete).toBe(false);
    expect(noisyResult.diagnosticsTruncated).toBe(true);
    expect(noisyResult.diagnostics).toHaveLength(mixinConfigValidationLimits.maxDiagnostics);
  });

  it("keeps forward compatibility fields indeterminate instead of rejecting them", () => {
    const result = validateMixinConfig({
      config: JSON.stringify({
        minVersion: "0.8.7",
        compatibilityLevel: "JAVA_25",
        package: "example",
        futureForkField: true,
      }),
    });

    expect(result.valid).toBe(true);
    expect(result.outcome).toBe("indeterminate");
    expect(codes(result)).toContain("config.compatibility-runtime-dependent");
    expect(codes(result)).toContain("config.unknown-field");
  });
});

import { describe, expect, it } from "vitest";
import {
  defaultServerPropertiesValidationLimits,
  validateServerProperties,
} from "./serverProperties.js";

function diagnosticCodes(content: string): string[] {
  return validateServerProperties({ content }).diagnostics.map((diagnostic) => diagnostic.code);
}

describe("validateServerProperties", () => {
  it("parses Java Properties comments, separators, escapes, and continuations", () => {
    const result = validateServerProperties({
      targetVersion: "1.21.11",
      content: [
        "# generated comment",
        "! another comment",
        "server\\u002dport : 25565",
        "motd Hello\\",
        "  World",
        "online-mode=true",
      ].join("\n"),
    });

    expect(result.targetVersion).toBe("1.21.11");
    expect(result.preflight.accepted).toBe(true);
    expect(result.valid).toBe(true);
    expect(result.syntaxValidationComplete).toBe(true);
    expect(result.counts).toMatchObject({
      physicalLines: 6,
      logicalLines: 3,
      entries: 3,
      effectiveEntries: 3,
    });
    expect(result.coverage).toMatchObject({
      recognizedKeyCount: 3,
      unknownKeyCount: 0,
      officialGeneratedDefaultsAvailable: false,
      exactVersionMembershipValidated: false,
      runtimeEncodingValidated: false,
    });
    expect(result.validationComplete).toBe(false);
    expect(JSON.stringify(result)).not.toContain("HelloWorld");
  });

  it("uses the last duplicate value for cross-property validation", () => {
    const disabled = validateServerProperties({
      content: "enable-rcon=true\nenable-rcon=false\n",
    });
    const enabled = validateServerProperties({
      content: "enable-rcon=false\nenable-rcon=true\n",
    });

    expect(disabled.valid).toBe(true);
    expect(disabled.counts.duplicateEntries).toBe(1);
    expect(disabled.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "property.duplicate-last-wins",
    ]);
    expect(enabled.valid).toBe(false);
    expect(enabled.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "rcon.password-missing",
    );
  });

  it("validates only the effective last duplicate value", () => {
    const repaired = validateServerProperties({
      content: "server-port=invalid\nserver-port=25565",
    });
    const broken = validateServerProperties({ content: "server-port=25565\nserver-port=invalid" });

    expect(repaired.valid).toBe(true);
    expect(repaired.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "property.duplicate-last-wins",
    ]);
    expect(broken.valid).toBe(false);
    expect(broken.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "property.duplicate-last-wins",
      "property.port-invalid",
    ]);
  });

  it("rejects malformed Unicode escapes without echoing their value", () => {
    const result = validateServerProperties({ content: "motd=private\\u12G4value" });

    expect(result.valid).toBe(false);
    expect(result.syntaxValidationComplete).toBe(false);
    expect(result.stableSubsetValidationComplete).toBe(false);
    expect(result.diagnostics).toMatchObject([
      { code: "properties.escape-invalid", line: 1, key: null },
    ]);
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("checks conservative scalar ranges and file-local correlations", () => {
    const result = validateServerProperties({
      content: [
        "server-port=25565",
        "enable-rcon=true",
        "rcon.password=",
        "rcon.port=25565",
        "enable-query=true",
        "query.port=70000",
        "require-resource-pack=true",
        "resource-pack=",
        "resource-pack-sha1=not-a-sha1",
        "resource-pack-id=not-a-uuid",
        "online-mode=false",
      ].join("\n"),
    });
    const codes = result.diagnostics.map((diagnostic) => diagnostic.code);

    expect(result.valid).toBe(false);
    expect(codes).toEqual(
      expect.arrayContaining([
        "property.port-invalid",
        "property.sha1-invalid",
        "property.uuid-invalid",
        "rcon.password-missing",
        "rcon.port-conflicts-with-server-port",
        "resource-pack.required-url-missing",
        "resource-pack.sha1-without-pack",
        "online-mode.disabled",
      ]),
    );
  });

  it("matches documented stable ranges without rejecting supported disabling values", () => {
    const supported = validateServerProperties({
      content: [
        "entity-broadcast-range-percentage=10",
        "view-distance=3",
        "simulation-distance=32",
        "op-permission-level=0",
        "max-chained-neighbor-updates=-2",
        "network-compression-threshold=-2",
        "max-tick-time=-2",
        "difficulty=3",
        "gamemode=1",
      ].join("\n"),
    });
    const outOfRange = validateServerProperties({
      content: [
        "entity-broadcast-range-percentage=9",
        "view-distance=33",
        "simulation-distance=2",
        "op-permission-level=-1",
      ].join("\n"),
    });

    expect(supported.valid).toBe(true);
    expect(supported.diagnostics).toEqual([]);
    expect(outOfRange.valid).toBe(false);
    expect(outOfRange.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "property.integer-invalid",
      "property.integer-invalid",
      "property.integer-invalid",
      "property.integer-invalid",
    ]);
  });

  it("distinguishes Java int settings from the max-tick-time long setting", () => {
    const boundaries = validateServerProperties({
      content: [
        "rate-limit=2147483647",
        "network-compression-threshold=-2147483648",
        "max-tick-time=9223372036854775807",
      ].join("\n"),
    });
    const overflows = validateServerProperties({
      content: [
        "rate-limit=2147483648",
        "max-chained-neighbor-updates=2147483648",
        "network-compression-threshold=2147483648",
        "max-tick-time=9223372036854775808",
      ].join("\n"),
    });
    const lowerBoundary = validateServerProperties({
      content: "max-tick-time=-9223372036854775808",
    });
    const lowerOverflow = validateServerProperties({
      content: "max-tick-time=-9223372036854775809",
    });

    expect(boundaries.valid).toBe(true);
    expect(boundaries.diagnostics).toEqual([]);
    expect(lowerBoundary.valid).toBe(true);
    expect(lowerBoundary.diagnostics).toEqual([]);
    expect(lowerOverflow.valid).toBe(false);
    expect(lowerOverflow.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "property.integer-invalid",
    ]);
    expect(overflows.valid).toBe(false);
    expect(overflows.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "property.integer-invalid",
      "property.integer-invalid",
      "property.integer-invalid",
      "property.integer-invalid",
    ]);
  });

  it("does not guess missing RCON or query port defaults", () => {
    const result = validateServerProperties({
      content: "enable-rcon=true\nrcon.password=present\nenable-query=true\n",
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "rcon.port-default-unverified",
      "query.port-default-unverified",
    ]);
  });

  it("reports unknown keys as unknown evidence instead of invalidating them", () => {
    const result = validateServerProperties({
      content: "server-port=25565\nfork-specific-option=enabled\n",
    });

    expect(result.valid).toBe(true);
    expect(result.validationComplete).toBe(false);
    expect(result.coverage).toMatchObject({
      recognizedKeyCount: 1,
      unknownKeyCount: 1,
      unknownKeysComplete: true,
      unknownKeys: [{ key: "fork-specific-option", line: 2 }],
    });
  });

  it("does not treat Object prototype names as recognized rules", () => {
    const result = validateServerProperties({ content: "__proto__=value\nconstructor=value" });

    expect(result.valid).toBe(true);
    expect(result.coverage).toMatchObject({
      recognizedKeyCount: 0,
      unknownKeyCount: 2,
      unknownKeys: [
        { key: "__proto__", line: 1 },
        { key: "constructor", line: 2 },
      ],
    });
  });

  it("never returns passwords, seeds, URL credentials, queries, or token-like values", () => {
    const secrets = [
      "firstRconSecret",
      "secondRconSecret",
      "privateWorldSeed",
      "urlPassword",
      "queryTokenValue",
      "bearerValue",
    ];
    const result = validateServerProperties({
      content: [
        `rcon.password=${secrets[0]}`,
        `rcon.password=${secrets[1]}`,
        `level-seed=${secrets[2]}`,
        `resource-pack=https://user:${secrets[3]}@example.invalid/pack.zip?token=${secrets[4]}`,
        `custom-header=Bearer ${secrets[5]}`,
      ].join("\n"),
    });
    const serialized = JSON.stringify(result);

    for (const secret of secrets) expect(serialized).not.toContain(secret);
    expect(result.counts.redactedValues).toBe(5);
    expect(result.counts.duplicateEntries).toBe(1);
  });

  it("bounds byte, physical line, and physical line length preflight", () => {
    const bytes = validateServerProperties({
      content: "server-port=25565",
      limits: { maxInputBytes: 4 },
    });
    const lines = validateServerProperties({
      content: "motd=a\npvp=true",
      limits: { maxPhysicalLines: 1 },
    });
    const length = validateServerProperties({
      content: "motd=long",
      limits: { maxPhysicalLineCharacters: 4 },
    });
    const obviousOversize = validateServerProperties({
      content: "a".repeat(defaultServerPropertiesValidationLimits.maxInputBytes + 1),
    });

    expect(bytes.preflight).toMatchObject({ accepted: false, exceededLimits: ["maxInputBytes"] });
    expect(bytes.preflight.inputBytesComplete).toBe(true);
    expect(lines.preflight).toMatchObject({
      accepted: false,
      exceededLimits: ["maxPhysicalLines"],
    });
    expect(length.preflight).toMatchObject({
      accepted: false,
      exceededLimits: ["maxPhysicalLineCharacters"],
    });
    expect(obviousOversize.preflight).toMatchObject({
      accepted: false,
      inputBytes: null,
      inputBytesLowerBound: defaultServerPropertiesValidationLimits.maxInputBytes + 1,
      inputBytesComplete: false,
      exceededLimits: ["maxInputBytes"],
    });
    expect(obviousOversize.coverage.unknownKeysComplete).toBe(false);
  });

  it("bounds continuations, logical lines, logical length, and entry counts", () => {
    const continuations = validateServerProperties({
      content: "motd=a\\\n b\\\n c",
      limits: { maxContinuationLines: 1 },
    });
    const logicalLength = validateServerProperties({
      content: "motd=a\\\n b",
      limits: { maxLogicalLineCharacters: 6 },
    });
    const logicalLines = validateServerProperties({
      content: "motd=a\npvp=true",
      limits: { maxLogicalLines: 1 },
    });
    const entries = validateServerProperties({
      content: "motd=a\npvp=true",
      limits: { maxEntries: 1 },
    });

    expect(continuations.preflight.exceededLimits).toEqual(["maxContinuationLines"]);
    expect(logicalLength.preflight.exceededLimits).toEqual(["maxLogicalLineCharacters"]);
    expect(logicalLines.preflight.exceededLimits).toEqual(["maxLogicalLines"]);
    expect(entries.preflight.exceededLimits).toEqual(["maxEntries"]);
  });

  it("bounds decoded keys, values, unknown evidence, and diagnostics", () => {
    const decoded = validateServerProperties({
      content: "long-key=value\nmotd=long-value",
      limits: { maxKeyCharacters: 4, maxValueCharacters: 4 },
    });
    const unknowns = validateServerProperties({
      content: "custom-a=1\ncustom-b=2",
      limits: { maxUnknownKeys: 1 },
    });
    const diagnostics = validateServerProperties({
      content: "pvp=no\nhardcore=no\nallow-flight=no",
      limits: { maxDiagnostics: 1 },
    });

    expect(decoded.preflight).toMatchObject({
      accepted: false,
      exceededLimits: ["maxKeyCharacters", "maxValueCharacters"],
    });
    expect(decoded.coverage.unknownKeysComplete).toBe(false);
    expect(unknowns.coverage).toMatchObject({
      unknownKeyCount: 2,
      unknownKeysComplete: false,
      unknownKeys: [{ key: "custom-a", line: 1 }],
    });
    expect(diagnostics.diagnostics).toHaveLength(1);
    expect(diagnostics.counts).toMatchObject({ errors: 3, suppressedDiagnostics: 2 });
  });

  it("rejects unpaired transport surrogates and unsafe limit overrides", () => {
    const surrogate = validateServerProperties({ content: "motd=\ud800" });

    expect(surrogate.preflight.accepted).toBe(false);
    expect(surrogate.diagnostics[0]?.code).toBe("input.unpaired-surrogate");
    expect(() =>
      validateServerProperties({
        content: "",
        limits: {
          maxInputBytes: defaultServerPropertiesValidationLimits.maxInputBytes + 1,
        },
      }),
    ).toThrow(/no greater than the default ceiling/);
    expect(() =>
      validateServerProperties({ content: "", targetVersion: "unsafe version value" }),
    ).toThrow(/bounded version identifier/);
    expect(() =>
      validateServerProperties({
        content: "",
        limits: { unsafeLimit: 1 } as never,
      }),
    ).toThrow(/unknown field/);
  });

  it("does not count a trailing line terminator as another physical line", () => {
    expect(validateServerProperties({ content: "pvp=true\n" }).counts.physicalLines).toBe(1);
    expect(validateServerProperties({ content: "\n" }).counts.physicalLines).toBe(1);
    expect(validateServerProperties({ content: "" }).counts.physicalLines).toBe(0);
  });

  it("exposes stable diagnostic codes for direct checks", () => {
    expect(diagnosticCodes("server-port=0")).toContain("property.port-invalid");
    expect(diagnosticCodes("resource-pack-sha1=xyz")).toContain("property.sha1-invalid");
  });
});

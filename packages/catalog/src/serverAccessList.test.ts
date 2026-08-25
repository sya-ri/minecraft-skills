import { describe, expect, it } from "vitest";
import { searchAll, suggestMinecraftLookups } from "./index.js";
import {
  defaultServerAccessListValidationLimits,
  inferServerAccessListKind,
  resolveServerAccessListValidationLimits,
  validateServerAccessList,
} from "./serverAccessList.js";

const firstUuid = "123e4567-e89b-42d3-a456-426614174000";
const secondUuid = "123e4567-e89b-42d3-a456-426614174001";

function banFields(expires: string = "forever") {
  return {
    created: "2026-01-02 03:04:05 +0900",
    source: "Server",
    expires,
    reason: "Policy violation",
  };
}

describe("server access-list validation", () => {
  it("validates each canonical vanilla access-list shape", () => {
    const cases = [
      {
        kind: "whitelist" as const,
        filename: "whitelist.json",
        entry: { uuid: firstUuid, name: "Player_1" },
      },
      {
        kind: "ops" as const,
        filename: "ops.json",
        entry: {
          uuid: firstUuid,
          name: "Player_1",
          level: 4,
          bypassesPlayerLimit: false,
        },
      },
      {
        kind: "banned-players" as const,
        filename: "banned-players.json",
        entry: { uuid: firstUuid, name: "Player_1", ...banFields() },
      },
      {
        kind: "banned-ips" as const,
        filename: "banned-ips.json",
        entry: { ip: "2001:db8::1", ...banFields() },
      },
    ];

    for (const testCase of cases) {
      const result = validateServerAccessList({
        kind: testCase.kind,
        content: JSON.stringify([testCase.entry]),
      });
      expect(result).toMatchObject({
        valid: true,
        parsed: true,
        validationComplete: true,
        totalEntries: 1,
        processedEntries: 1,
        validEntries: 1,
        errorCount: 0,
      });
      expect(result.canonicalFilename).toBe(testCase.filename);
      expect(result.evaluatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it("distinguishes permanent, active, expired, and invalid ban expirations", () => {
    const result = validateServerAccessList({
      kind: "banned-players",
      evaluatedAt: "2026-08-25T00:00:00.000Z",
      content: JSON.stringify([
        { uuid: firstUuid, name: "First", ...banFields("forever") },
        { uuid: secondUuid, name: "Second", ...banFields("2999-01-01 00:00:00 +0000") },
        {
          uuid: "123e4567-e89b-42d3-a456-426614174002",
          name: "Third",
          ...banFields("2000-01-01 00:00:00 +0000"),
        },
        {
          uuid: "123e4567-e89b-42d3-a456-426614174003",
          name: "Fourth",
          ...banFields("not-a-date"),
        },
      ]),
    });

    expect(result.expirations).toEqual({ permanent: 1, active: 1, expired: 1, invalid: 1 });
    expect(result.evaluatedAt).toBe("2026-08-25T00:00:00.000Z");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "expired-ban-entry", path: "$[2].expires" }),
    );
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "invalid-expiration-date", path: "$[3].expires" }),
    );
    expect(result.valid).toBe(false);
  });

  it("rejects year zero as noncanonical serializer output", () => {
    const result = validateServerAccessList({
      kind: "banned-ips",
      content: JSON.stringify([
        {
          ip: "192.0.2.1",
          ...banFields("0000-01-01 00:00:00 +0000"),
          created: "0000-01-01 00:00:00 +0000",
        },
      ]),
    });
    const codes = result.diagnostics.map((entry) => entry.code);

    expect(codes).toContain("invalid-created-date");
    expect(codes).toContain("invalid-expiration-date");
    expect(result.valid).toBe(false);
  });

  it("detects identity duplicates without returning identities or ban text", () => {
    const secretName = "SensitiveName";
    const secretReason = "credential=do-not-return";
    const secretSource = "private-source";
    const secretIp = "203.0.113.91";
    const secretField = "credential-do-not-return";
    const playerResult = validateServerAccessList({
      kind: "banned-players",
      content: JSON.stringify([
        {
          uuid: firstUuid,
          name: secretName,
          ...banFields(),
          reason: secretReason,
          source: secretSource,
          [secretField]: true,
        },
        { uuid: firstUuid, name: "OtherName", ...banFields() },
      ]),
    });
    const ipResult = validateServerAccessList({
      kind: "banned-ips",
      content: JSON.stringify([
        { ip: secretIp, ...banFields() },
        { ip: secretIp, ...banFields() },
      ]),
    });

    expect(playerResult.duplicateIdentityCount).toBe(1);
    expect(ipResult.duplicateIdentityCount).toBe(1);
    expect(JSON.stringify({ playerResult, ipResult })).not.toContain(firstUuid);
    expect(JSON.stringify({ playerResult, ipResult })).not.toContain(secretName);
    expect(JSON.stringify({ playerResult, ipResult })).not.toContain(secretReason);
    expect(JSON.stringify({ playerResult, ipResult })).not.toContain(secretSource);
    expect(JSON.stringify({ playerResult, ipResult })).not.toContain(secretIp);
    expect(JSON.stringify({ playerResult, ipResult })).not.toContain(secretField);
  });

  it("normalizes equivalent IPv6 spellings only for duplicate detection", () => {
    const result = validateServerAccessList({
      kind: "banned-ips",
      content: JSON.stringify([
        { ip: "2001:db8:0:0:0:0:0:1", ...banFields() },
        { ip: "2001:0DB8::1", ...banFields() },
      ]),
    });

    expect(result.duplicateIdentityCount).toBe(1);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "duplicate-ip-address", path: "$[1].ip" }),
    );
  });

  it("accepts scoped IPv6 literals and normalizes only their address portion", () => {
    const result = validateServerAccessList({
      kind: "banned-ips",
      content: JSON.stringify([
        { ip: "fe80:0:0:0:0:0:0:1%3", ...banFields() },
        { ip: "fe80::1%3", ...banFields() },
      ]),
    });

    expect(result.duplicateIdentityCount).toBe(1);
    expect(result.diagnostics).not.toContainEqual(
      expect.objectContaining({ code: "invalid-ip-address" }),
    );
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "duplicate-ip-address", path: "$[1].ip" }),
    );
  });

  it("rejects invalid field types while warning on noncanonical extensions", () => {
    const result = validateServerAccessList({
      kind: "ops",
      content: JSON.stringify([
        {
          uuid: firstUuid.toUpperCase(),
          name: "name with spaces",
          level: 5,
          bypassesPlayerLimit: "yes",
          extension: true,
        },
      ]),
    });
    const codes = result.diagnostics.map((entry) => entry.code);

    expect(result.valid).toBe(false);
    expect(codes).toContain("noncanonical-uuid");
    expect(codes).toContain("noncanonical-player-name");
    expect(codes).toContain("invalid-operator-level");
    expect(codes).toContain("invalid-bypass-flag");
    expect(codes).toContain("unknown-field");
  });

  it("rejects ambiguous duplicate JSON keys without echoing their values", () => {
    const hiddenName = "HiddenName";
    const result = validateServerAccessList({
      kind: "whitelist",
      content: `[{"uuid":"${firstUuid}","name":"First","name":"${hiddenName}"}]`,
    });

    expect(result.duplicateJsonKeyCount).toBe(1);
    expect(result.valid).toBe(false);
    expect(result.validEntries).toBe(0);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "duplicate-json-key", path: "$" }),
    );
    expect(JSON.stringify(result)).not.toContain(hiddenName);
  });

  it("bounds bytes, characters, entries, fields, strings, nodes, depth, and diagnostics", () => {
    const byteLimited = validateServerAccessList({
      kind: "whitelist",
      content: '["雪"]',
      limits: { maxInputBytes: 4 },
    });
    expect(byteLimited.exceededLimits).toContain("maxInputBytes");
    expect(byteLimited.parsed).toBe(false);
    expect(byteLimited.inputBytes).toBe(7);

    const characterLimited = validateServerAccessList({
      kind: "whitelist",
      content: "[]   ",
      limits: { maxInputCharacters: 2 },
    });
    expect(characterLimited.exceededLimits).toContain("maxInputCharacters");
    expect(characterLimited.inputBytes).toBeNull();

    const entriesLimited = validateServerAccessList({
      kind: "whitelist",
      content: JSON.stringify([
        { uuid: firstUuid, name: "First" },
        { uuid: secondUuid, name: "Second" },
      ]),
      limits: { maxEntries: 1 },
    });
    expect(entriesLimited).toMatchObject({ totalEntries: 2, processedEntries: 1 });
    expect(entriesLimited.exceededLimits).toContain("maxEntries");

    const fieldsLimited = validateServerAccessList({
      kind: "whitelist",
      content: JSON.stringify([{ uuid: firstUuid, name: "First" }]),
      limits: { maxFieldsPerEntry: 1 },
    });
    expect(fieldsLimited.exceededLimits).toContain("maxFieldsPerEntry");

    const stringLimited = validateServerAccessList({
      kind: "whitelist",
      content: JSON.stringify([{ uuid: firstUuid, name: "First" }]),
      limits: { maxStringCharacters: 8 },
    });
    expect(stringLimited.exceededLimits).toContain("maxStringCharacters");

    const nodeLimited = validateServerAccessList({
      kind: "whitelist",
      content: JSON.stringify([{ uuid: firstUuid, name: "First" }]),
      limits: { maxNodes: 2 },
    });
    expect(nodeLimited.exceededLimits).toContain("maxNodes");
    expect(nodeLimited.parsed).toBe(false);

    const depthLimited = validateServerAccessList({
      kind: "whitelist",
      content: "[[[[]]]]",
      limits: { maxDepth: 2 },
    });
    expect(depthLimited.exceededLimits).toContain("maxDepth");
    expect(depthLimited.parsed).toBe(false);

    const diagnosticsLimited = validateServerAccessList({
      kind: "whitelist",
      content: "[{},{},{}]",
      limits: { maxDiagnostics: 1 },
    });
    expect(diagnosticsLimited.retainedDiagnosticCount).toBe(1);
    expect(diagnosticsLimited.omittedDiagnosticCount).toBeGreaterThan(0);
    expect(diagnosticsLimited.truncated).toBe(true);
  });

  it("handles BOM and hostile Unicode without reflecting input text", () => {
    const result = validateServerAccessList({
      kind: "whitelist",
      content: `\uFEFF[{"uuid":"${firstUuid}","name":"\\ud800\\u001b"}]`,
    });
    const codes = result.diagnostics.map((entry) => entry.code);

    expect(codes).toContain("utf8-bom");
    expect(codes).toContain("invalid-unicode");
    expect(codes).toContain("control-character");
    expect(JSON.stringify(result)).not.toContain("\\ud800");
    expect(JSON.stringify(result)).not.toContain("\\u001b");
  });

  it("infers kinds only from canonical vanilla filenames", () => {
    expect(inferServerAccessListKind("whitelist.json")).toBe("whitelist");
    expect(inferServerAccessListKind("OPS.JSON")).toBe("ops");
    expect(inferServerAccessListKind("players.json")).toBeNull();
  });

  it("rejects invalid, unknown, accessor, and over-ceiling limit overrides", () => {
    expect(resolveServerAccessListValidationLimits({ maxEntries: 1 }).maxEntries).toBe(1);
    for (const value of [
      0,
      -1,
      1.5,
      Number.NaN,
      Number.MAX_SAFE_INTEGER + 1,
      defaultServerAccessListValidationLimits.maxEntries + 1,
    ]) {
      expect(() => resolveServerAccessListValidationLimits({ maxEntries: value })).toThrow(
        "safe positive integers",
      );
    }

    expect(() => resolveServerAccessListValidationLimits({ unknown: 1 } as never)).toThrow(
      "unknown field",
    );
    expect(() =>
      resolveServerAccessListValidationLimits({ [Symbol("hidden")]: 1 } as never),
    ).toThrow("unknown field");

    let getterCalled = false;
    const accessor = {} as { maxEntries?: number };
    Object.defineProperty(accessor, "maxEntries", {
      get() {
        getterCalled = true;
        return 1;
      },
    });
    expect(() => resolveServerAccessListValidationLimits(accessor)).toThrow(
      "must not use accessors",
    );
    expect(getterCalled).toBe(false);
  });

  it("requires and returns a canonical bounded evaluation instant", () => {
    const evaluatedAt = "2026-08-25T12:34:56.789Z";
    const result = validateServerAccessList({ kind: "whitelist", content: "[]", evaluatedAt });
    expect(result.evaluatedAt).toBe(evaluatedAt);
    expect(() =>
      validateServerAccessList({
        kind: "whitelist",
        content: "[]",
        evaluatedAt: "2026-08-25T21:34:56+09:00",
      }),
    ).toThrow("canonical UTC timestamp");
  });

  it("routes English access-list validation requests without broad ban-command matches", () => {
    const suggestions = suggestMinecraftLookups({
      version: "26.2",
      task: "check my banned-players.json file",
    });
    expect(suggestions.suggestedTools.map((entry) => entry.tool)).toContain(
      "minecraft validate-access-list <file> [--kind whitelist|ops|banned-players|banned-ips]",
    );

    const search = searchAll({ version: "26.2", query: "validate server operator list" });
    expect(search.results).toContainEqual(
      expect.objectContaining({
        surface: "server-access-list-tools",
        kind: "offline-validator",
      }),
    );

    const unrelated = suggestMinecraftLookups({
      version: "26.2",
      task: "create a Paper ban command",
    });
    expect(
      unrelated.suggestedTools.some((entry) => entry.tool.includes("validate-access-list")),
    ).toBe(false);
  });

  it("publishes conservative fixed default limits", () => {
    expect(defaultServerAccessListValidationLimits).toEqual(
      expect.objectContaining({
        maxInputBytes: 2 * 1_024 * 1_024,
        maxEntries: 10_000,
        maxStringCharacters: 2_048,
        maxDiagnostics: 500,
      }),
    );
  });
});

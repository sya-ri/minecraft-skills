import { describe, expect, it } from "vitest";
import { callMinecraftSkillsTool, tools } from "./tools.js";

type MixinToolPayload = {
  valid: boolean;
  outcome: string;
  validationComplete: boolean;
  source: { inputKind: string | null; jsonParsed: boolean; duplicateKeys: string };
  archiveEvidence: {
    entryListDeclaredComplete: boolean;
    observedReferences: number;
    notObservedReferences: number;
  };
  references: Array<{ archivePath: string; suppliedArchive: string }>;
  diagnostics: Array<{ code: string }>;
};

async function validate(input: unknown): Promise<MixinToolPayload> {
  const result = await callMinecraftSkillsTool("validate_mixin_config", input);
  expect(result.isError).not.toBe(true);
  return JSON.parse(result.content[0]?.text ?? "null") as MixinToolPayload;
}

describe("validate_mixin_config MCP tool", () => {
  it("is discoverable as a closed metadata-only tool", () => {
    const tool = tools.find((candidate) => candidate.name === "validate_mixin_config");
    expect(tool).toBeDefined();
    expect(tool?.inputSchema.additionalProperties).toBe(false);
    expect(tool?.inputSchema.required).toEqual(["config"]);
    expect(Object.keys(tool?.inputSchema.properties ?? {})).toEqual([
      "config",
      "archiveEntries",
      "archiveEntriesComplete",
    ]);
    expect(tool?.description).toContain("runtime classpath");
  });

  it("validates raw config text against supplied archive-entry metadata", async () => {
    const result = await validate({
      config: '{"minVersion":"0.8.7","package":"example","mixins":["Feature"]}',
      archiveEntries: ["example/Feature.class"],
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
    expect(result.archiveEvidence.observedReferences).toBe(1);
  });

  it("distinguishes raw duplicate evidence from parsed-object source uncertainty", async () => {
    const raw = await validate({
      config: '{"minVersion":"0.8.7","package":"first","package":"second"}',
    });
    const parsed = await validate({
      config: { minVersion: "0.8.7", package: "second" },
    });

    expect(raw.source.duplicateKeys).toBe("observed");
    expect(raw.outcome).toBe("valid");
    expect(parsed.source).toEqual({
      inputKind: "object",
      jsonParsed: false,
      duplicateKeys: "unknown",
    });
    expect(parsed.outcome).toBe("indeterminate");
    expect(parsed.validationComplete).toBe(false);
  });

  it("keeps missing supplied-archive references unknown rather than loader-invalid", async () => {
    const result = await validate({
      config: '{"minVersion":"0.8.7","package":"example","mixins":["External"]}',
      archiveEntries: [],
      archiveEntriesComplete: true,
    });

    expect(result.valid).toBe(true);
    expect(result.outcome).toBe("indeterminate");
    expect(result.archiveEvidence.notObservedReferences).toBe(1);
    expect(result.references[0]).toMatchObject({
      archivePath: "example/External.class",
      suppliedArchive: "not-observed",
    });
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "archive.reference-not-observed",
    );
  });

  it("rejects a completeness claim without archive-entry metadata", async () => {
    const result = await validate({ config: "{}", archiveEntriesComplete: true });

    expect(result.valid).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "input.missing-archive-entries",
    );
  });

  it("does not invoke proxy traps or accessor getters at the MCP boundary", async () => {
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
    const accessor = {} as { config: unknown };
    Object.defineProperty(accessor, "config", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "{}";
      },
    });

    const proxyResult = await validate(proxy);
    const accessorResult = await validate(accessor);

    expect(proxyResult.valid).toBe(false);
    expect(accessorResult.valid).toBe(false);
    expect(trapCalls).toBe(0);
    expect(getterCalls).toBe(0);
  });

  it("rejects symbol, non-enumerable, and sparse metadata boundaries", async () => {
    const symbolResult = await validate({ config: "{}", [Symbol("extra")]: true });
    const nonEnumerable = {} as { config: string };
    Object.defineProperty(nonEnumerable, "config", { enumerable: false, value: "{}" });
    const nonEnumerableResult = await validate(nonEnumerable);
    const sparseResult = await validate({ config: "{}", archiveEntries: Array<string>(1) });

    expect(symbolResult.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "input.unknown-field",
    );
    expect(nonEnumerableResult.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "input.unsafe-field",
    );
    expect(sparseResult.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "archive.invalid-entries",
    );
  });
});

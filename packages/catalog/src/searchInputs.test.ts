import { Ajv } from "ajv";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  searchCommands,
  searchMinecraftAssets,
  searchPaperMembers,
  searchPaperMembersWithData,
  searchPaperTypes,
  searchRegistryEntries,
  searchResourcepackModelPaths,
} from "./index.js";
import { searchInputJsonSchemas, searchInputs } from "./searchInputs.js";

describe("shared search input validation at package boundaries", () => {
  const searches = {
    searchCommands,
    searchMinecraftAssets,
    searchPaperMembers,
    searchPaperTypes,
    searchRegistryEntries,
    searchResourcepackModelPaths,
  };

  it.each(
    Object.entries(searches),
  )("%s rejects unknown fields before reading data", (_name, search) => {
    expect(() => search({ version: "unavailable-test-version", query: "needle" } as never)).toThrow(
      /query.*(removed|undeclared|unknown|not allowed)/i,
    );
  });

  it.each(
    Object.entries(searches),
  )("%s reports a malformed filter before reading data", (_name, search) => {
    expect(() => search({ version: "unavailable-test-version", contains: 123 } as never)).toThrow(
      /contains.*string/i,
    );
  });

  it("rejects invalid opt-in recovery inputs before version resolution or fetching", async () => {
    await expect(
      searchPaperMembersWithData({
        version: "unavailable-test-version",
        fetchMissing: true,
        query: "needle",
      } as never),
    ).rejects.toThrow(/query.*(removed|undeclared|unknown|not allowed)/i);
  });

  it("normalizes documented defaults into typed values without modifying caller input", () => {
    const raw = { contains: "give" };
    const parsed = searchInputs.commands.assert(raw);
    expect(parsed).toEqual({ edition: "java", version: "latest", contains: "give", limit: 50 });
    expect(raw).toEqual({ contains: "give" });
    expectTypeOf(parsed.edition).toEqualTypeOf<"java">();
    expectTypeOf(parsed.limit).toEqualTypeOf<number>();
    expect(searchInputs.paperMembersWithData.assert({}).fetchMissing).toBe(false);
    expect(searchInputs.resourcepackAssets.assert({})).toMatchObject({
      fetch: false,
      force: false,
    });
  });

  it("keeps runtime validation equivalent to the generated public JSON schemas", () => {
    const ajv = new Ajv({ strict: false });
    const validators = {
      paperTypes: searchInputs.paperTypes,
      paperMembers: searchInputs.paperMembersWithData,
      registryEntries: searchInputs.registryEntries,
      commands: searchInputs.commands,
      resourcepackModels: searchInputs.resourcepackModels,
      resourcepackAssets: searchInputs.resourcepackAssets,
    };
    const examples = [
      {},
      { version: "26.3", contains: "needle", limit: 10 },
      { query: "needle" },
      { contains: 123 },
      { contains: null },
      { limit: 0 },
      { limit: 501 },
      { limit: 1.5 },
      { edition: "bedrock" },
      { kind: "invalid" },
      { fetchMissing: "true" },
    ];
    for (const [name, input] of Object.entries(validators)) {
      const schema = searchInputJsonSchemas[name as keyof typeof searchInputJsonSchemas];
      const validateJson = ajv.compile(schema);
      expect(schema.additionalProperties).toBe(false);
      for (const value of examples) {
        expect(validateJson(value), `${name}: ${JSON.stringify(value)}`).toBe(input.allows(value));
      }
    }
  });
});

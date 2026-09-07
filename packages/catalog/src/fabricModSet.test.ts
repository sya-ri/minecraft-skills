import { describe, expect, it } from "vitest";
import {
  defaultFabricModSetLimits,
  type FabricModSetOptions,
  validateFabricModSet,
} from "./fabricModSet.js";

const metadata = (id: string, extra: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  id,
  version: "1.0.0",
  ...extra,
});
const options = (
  mods: unknown[],
  extra: Partial<FabricModSetOptions> = {},
): FabricModSetOptions => ({
  mods: mods.map((value) => ({ metadata: value })),
  environment: "server",
  selectionComplete: true,
  runtimeVersions: { minecraft: "1.21.1", java: "21", fabricloader: "0.16.10" },
  ...extra,
});

describe("selected Fabric mod set validation", () => {
  it("checks hard dependencies, aliases, runtime versions, cycles, and raw metadata offline", () => {
    const result = validateFabricModSet(
      options([
        JSON.stringify(
          metadata("first", {
            depends: {
              second_alias: ">=2 <3",
              minecraft: ["1.21.1", "1.21.2"],
              java: ">=21",
              fabricloader: ">=0.16",
            },
          }),
        ),
        metadata("second", { version: "2.4", provides: ["second_alias"], depends: { first: "*" } }),
      ]),
    );
    expect(result.status).toBe("satisfied");
    expect(result.dependencies).toMatchObject({ inspected: 5, satisfied: 5 });
    expect(result.coverage.complete).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  it("classifies missing, mismatched, hard incompatible, and soft dependency declarations", () => {
    const result = validateFabricModSet(
      options([
        metadata("consumer", {
          depends: { missing: "*", provider: ">=2" },
          breaks: { provider: "1.x" },
          conflicts: { provider: "*" },
          recommends: { optional: "*" },
          suggests: { suggested: ">=3" },
        }),
        metadata("provider"),
      ]),
    );
    expect(result).toMatchObject({ status: "invalid", errorCount: 3, warningCount: 2 });
    expect(result.dependencies).toMatchObject({
      absent: 2,
      mismatched: 1,
      matchingIncompatibilities: 2,
      informational: 1,
    });
    expect(result.diagnostics.map((item) => item.code)).toEqual([
      "dependency.missing",
      "dependency.version-mismatch",
      "dependency.breaks",
      "dependency.conflicts",
      "dependency.missing",
    ]);
  });

  it("never turns missing data in incomplete sets into definite missing dependencies", () => {
    const result = validateFabricModSet(
      options(
        [
          metadata("consumer", {
            depends: { missing: "*" },
            breaks: { incompatible: "*" },
            recommends: { optional: "*" },
          }),
        ],
        { selectionComplete: false },
      ),
    );
    expect(result).toMatchObject({ status: "incomplete", errorCount: 0, unverifiedCount: 3 });
    expect(result.dependencies.unverified).toBe(3);
    expect(result.diagnostics.every((item) => item.severity === "unverified")).toBe(true);
  });

  it("keeps supplied mismatches and incompatibilities definitive even in an incomplete set", () => {
    const result = validateFabricModSet(
      options(
        [
          metadata("consumer", { depends: { provider: ">2" }, breaks: { provider: "*" } }),
          metadata("provider"),
        ],
        { selectionComplete: false },
      ),
    );
    expect(result).toMatchObject({ status: "invalid", errorCount: 2 });
  });

  it("filters physical environments and applies Loader's schema-v1 positive dependency softening", () => {
    const input = options([
      metadata("consumer", {
        depends: { client_alias: "1.x", other_client: ">=2" },
        recommends: { client_mod: "*" },
      }),
      metadata("client_mod", {
        environment: "client",
        provides: ["client_alias"],
        depends: { absent: "*" },
      }),
      metadata("other_client", { environment: "client" }),
    ]);
    const server = validateFabricModSet(input);
    expect(server.dependencies).toMatchObject({ inspected: 3, environmentSoftened: 1, absent: 2 });
    expect(server.mods[1]?.status).toBe("environment-disabled");
    expect(server.errorCount).toBe(2);
    const client = validateFabricModSet({ ...input, environment: "client" });
    expect(client.dependencies.environmentSoftened).toBe(0);
    expect(client.errorCount).toBe(2);
  });

  it("does not soften against a disabled version when an active provider is present", () => {
    const result = validateFabricModSet(
      options([
        metadata("consumer", { depends: { target: ">=2" } }),
        metadata("target"),
        metadata("disabled", { environment: "client", version: "2", provides: ["target"] }),
      ]),
    );
    expect(result.dependencies).toMatchObject({ environmentSoftened: 0, mismatched: 1 });
  });

  it("keeps potential environment softening unverified for an incomplete selection", () => {
    const result = validateFabricModSet(
      options(
        [
          metadata("consumer", { depends: { target: "*" } }),
          metadata("target", { environment: "client" }),
        ],
        { selectionComplete: false },
      ),
    );
    expect(result.dependencies).toMatchObject({ environmentSoftened: 0, unverified: 1 });
    expect(result.status).toBe("incomplete");
  });

  it.each([
    [metadata("duplicate"), metadata("duplicate")],
    [metadata("first", { provides: ["alias"] }), metadata("second", { provides: ["alias"] })],
    [metadata("first", { provides: ["first"] })],
    [metadata("first", { provides: ["alias", "alias"] })],
    [metadata("first", { provides: ["minecraft"] })],
    [metadata("java")],
  ])("rejects selected ID and alias collisions %#", (...mods) => {
    const result = validateFabricModSet(options(mods));
    expect(result.status).toBe("invalid");
    expect(result.diagnostics.some((item) => item.code === "set.duplicate-provider")).toBe(true);
  });

  it("does not claim a dependency matches when its selected identity is ambiguous", () => {
    const result = validateFabricModSet(
      options([
        metadata("consumer", { depends: { target: ">=2" } }),
        metadata("target"),
        metadata("target", { version: "2" }),
      ]),
    );
    expect(result.diagnostics.some((item) => item.code === "dependency.ambiguous-provider")).toBe(
      true,
    );
  });

  it("reports nested JAR coverage without selecting children or asserting missing nested dependencies", () => {
    const result = validateFabricModSet(
      options([
        metadata("outer", { jars: [{ file: "nested/inner.jar" }], depends: { inner: "*" } }),
      ]),
    );
    expect(result).toMatchObject({ status: "incomplete", errorCount: 0 });
    expect(result.coverage).toMatchObject({
      selectionComplete: true,
      declaredNestedJars: 1,
      nestedSelection: "unverified",
      complete: false,
    });
    expect(result.dependencies.unverified).toBe(1);
    const supplied = validateFabricModSet(
      options([
        metadata("outer", { jars: [{ file: "nested/inner.jar" }], depends: { inner: "*" } }),
        metadata("inner"),
      ]),
    );
    expect(supplied.status).toBe("incomplete");
    expect(supplied.dependencies.satisfied).toBe(1);
    const disabledContainer = validateFabricModSet(
      options([
        metadata("client_only", { environment: "client", jars: [{ file: "nested/inner.jar" }] }),
      ]),
    );
    expect(disabledContainer.coverage.nestedSelection).toBe("unverified");
    expect(disabledContainer.status).toBe("incomplete");
  });

  it("does not normalize launcher snapshot names or coerce nonsemantic versions", () => {
    const input = options([metadata("consumer", { depends: { minecraft: ">=1.21" } })]);
    input.runtimeVersions.minecraft = "24w14a";
    expect(validateFabricModSet(input).dependencies.mismatched).toBe(1);
    input.mods = [{ metadata: metadata("consumer", { depends: { minecraft: "24w14a" } }) }];
    expect(validateFabricModSet(input).status).toBe("satisfied");
  });

  it("accepts empty predicates as any version, empty arrays as no version, and rejects invalid predicates", () => {
    const result = validateFabricModSet(
      options([
        metadata("consumer", { depends: { minecraft: "", java: [], fabricloader: ">snapshot" } }),
      ]),
    );
    expect(result.dependencies).toMatchObject({
      satisfied: 1,
      mismatched: 1,
      invalidPredicates: 1,
    });
    expect(result.errorCount).toBe(2);
    expect(
      result.diagnostics.find((item) => item.code === "dependency.version-mismatch")?.message,
    ).toContain("version '21'");
  });

  it("retains structural metadata diagnostics and never uses invalid metadata as providers", () => {
    const result = validateFabricModSet(
      options([
        metadata("consumer", { depends: { invalid: "*" } }),
        metadata("invalid", { schemaVersion: 0 }),
        "{",
      ]),
    );
    expect(result.status).toBe("invalid");
    expect(result.coverage.metadataComplete).toBe(false);
    expect(result.dependencies.unverified).toBe(1);
    expect(result.mods.slice(1).every((item) => item.status === "invalid")).toBe(true);
  });

  it("enforces lower-only bounds and marks truncated diagnostics without losing failure counts", () => {
    const result = validateFabricModSet(
      options([metadata("consumer", { depends: { one: "*", two: "*", three: "*" } })], {
        limits: { maxDiagnostics: 1 },
      }),
    );
    expect(result).toMatchObject({
      errorCount: 3,
      diagnosticsTruncated: true,
      omittedDiagnosticCount: 2,
    });
    expect(result.diagnostics).toHaveLength(1);
    const edges = validateFabricModSet(
      options([metadata("consumer", { depends: { one: "*", two: "*" } })], {
        limits: { maxDependencyEdges: 1 },
      }),
    );
    expect(edges.coverage.dependencyChecksComplete).toBe(false);
    expect(edges.dependencies.inspected).toBe(1);
    const bytes = validateFabricModSet(
      options([metadata("consumer")], { limits: { maxInputBytes: 1 } }),
    );
    expect(bytes.coverage.metadataComplete).toBe(false);
    expect(bytes.status).toBe("invalid");
    expect(() =>
      validateFabricModSet(
        options([], { limits: { maxMods: defaultFabricModSetLimits.maxMods + 1 } }),
      ),
    ).toThrow(/limits.maxMods/u);
    expect(() =>
      validateFabricModSet(options([metadata("one"), metadata("two")], { limits: { maxMods: 1 } })),
    ).toThrow(/at most 1/u);
  });

  it("handles lower metadata bounds, depth, cycles, getters, and malformed envelope data safely", () => {
    let reads = 0;
    const hostile = {
      schemaVersion: 1,
      get id() {
        reads += 1;
        return "hostile";
      },
      version: "1",
    };
    const cyclic: Record<string, unknown> = metadata("cyclic");
    cyclic.custom = cyclic;
    expect(validateFabricModSet(options([hostile, cyclic])).status).toBe("invalid");
    expect(reads).toBe(0);
    expect(
      validateFabricModSet(options([metadata("consumer")], { limits: { maxMetadataNodes: 1 } }))
        .status,
    ).toBe("invalid");
    for (const extra of [
      { selectionComplete: undefined },
      { environment: "both" },
      { runtimeVersions: { java: "21" } },
      { limits: { maxMods: 0 } },
      { unknown: true },
    ]) {
      expect(() =>
        validateFabricModSet({ ...options([]), ...extra } as FabricModSetOptions),
      ).toThrow();
    }
    const input = options([]);
    Object.defineProperty(input, "mods", {
      get() {
        reads += 1;
        return [];
      },
    });
    expect(() => validateFabricModSet(input)).toThrow();
    expect(reads).toBe(0);
  });
});

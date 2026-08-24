import { describe, expect, it } from "vitest";
import {
  defaultDatapackProjectValidationLimits,
  resolveDatapackProjectValidationLimits,
  suggestMinecraftLookups,
  validateDatapackProject,
} from "./index.js";

const packMetadata = {
  path: "pack.mcmeta",
  content: { pack: { pack_format: 48, description: "Datapack project validation fixture" } },
};

describe("datapack project validation", () => {
  it("validates local functions, tags, registry entries, and advancement parents", () => {
    const result = validateDatapackProject({
      version: "1.21",
      files: [
        packMetadata,
        {
          path: "data/example/function/root.mcfunction",
          content: [
            "function example:child",
            "execute as @a run function #example:loaders",
            "schedule function example:child 1t",
          ].join("\n"),
        },
        { path: "data/example/function/child.mcfunction", content: "say safe" },
        {
          path: "data/example/tags/function/loaders.json",
          content: { values: ["example:child"] },
        },
        {
          path: "data/example/tags/item/tools.json",
          content: { values: ["minecraft:stone"] },
        },
        { path: "data/example/advancement/root.json", content: {} },
        {
          path: "data/example/advancement/child.json",
          content: { parent: "example:root" },
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.validationComplete).toBe(true);
    expect(result.checkedReferences).toBe(6);
    expect(result.resolvedReferences).toBe(6);
    expect(result.missingReferences).toBe(0);
    expect(result.tagFiles).toBe(2);
    expect(result.functionFiles).toBe(2);
    expect(result.advancementFiles).toBe(2);
    expect(result.diagnostics).toEqual([]);
  });

  it("reports missing project metadata and required local or vanilla references", () => {
    const result = validateDatapackProject({
      version: "1.21",
      files: [
        {
          path: "data/example/function/root.mcfunction",
          content: "function example:missing\nfunction #example:missing_tag",
        },
        {
          path: "data/example/advancement/child.json",
          content: { parent: "minecraft:not_a_real_advancement" },
        },
        {
          path: "data/example/tags/item/broken.json",
          content: { values: ["minecraft:not_a_real_item"] },
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.missingReferences).toBe(4);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        "pack-metadata-missing",
        "missing-datapack-reference",
        "missing-registry-entry",
      ]),
    );
  });

  it("distinguishes optional missing entries from unverified external dependencies", () => {
    const result = validateDatapackProject({
      version: "1.21",
      files: [
        packMetadata,
        {
          path: "data/example/tags/function/load.json",
          content: {
            values: [
              { id: "example:missing", required: false },
              { id: "another_pack:optional", required: false },
              "external_pack:startup",
            ],
          },
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.validationComplete).toBe(false);
    expect(result.optionalMissingReferences).toBe(2);
    expect(result.unverifiedReferences).toBe(1);
    expect(result.validationIncompleteReasons).toContain("external-reference");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        code: "external-reference-unverified",
        reference: "external_pack:startup",
      }),
    );
  });

  it("validates tag structure even when the versioned file schema is unavailable", () => {
    const result = validateDatapackProject({
      version: "1.21",
      files: [
        packMetadata,
        {
          path: "data/example/tags/function/load.json",
          content: {
            replace: "yes",
            values: [{ id: "example:startup", required: "no" }],
          },
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.invalidContentFiles).toBe(1);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "invalid-tag-replace", source: "$.replace" }),
    );
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "invalid-tag-entry", source: "$.values[0]" }),
    );
  });

  it("detects tag and advancement parent cycles", () => {
    const result = validateDatapackProject({
      version: "1.21",
      files: [
        packMetadata,
        {
          path: "data/example/tags/function/a.json",
          content: { values: ["#example:b"] },
        },
        {
          path: "data/example/tags/function/b.json",
          content: { values: ["#example:a"] },
        },
        {
          path: "data/example/advancement/a.json",
          content: { parent: "example:b" },
        },
        {
          path: "data/example/advancement/b.json",
          content: { parent: "example:a" },
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.detectedCycles).toBe(2);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["tag-reference-cycle", "advancement-parent-cycle"]),
    );
  });

  it("keeps tag-cycle graphs isolated by registry category", () => {
    const result = validateDatapackProject({
      version: "1.21",
      files: [
        packMetadata,
        {
          path: "data/example/tags/function/a.json",
          content: { values: ["#example:b"] },
        },
        { path: "data/example/tags/function/b.json", content: { values: [] } },
        {
          path: "data/example/tags/item/b.json",
          content: { values: ["#example:a"] },
        },
        { path: "data/example/tags/item/a.json", content: { values: [] } },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.checkedReferences).toBe(2);
    expect(result.detectedCycles).toBe(0);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).not.toContain(
      "tag-reference-cycle",
    );
  });

  it("rejects unsafe and portable duplicate paths", () => {
    const result = validateDatapackProject({
      version: "1.21",
      files: [
        packMetadata,
        { path: "data/example/function/test.mcfunction", content: "say one" },
        { path: "data/example/function/Test.mcfunction", content: "say two" },
        { path: "data/example/function/alias.mcfunction", content: "say modern" },
        { path: "data/example/functions/alias.mcfunction", content: "say legacy" },
        { path: "data\\example\\function\\unsafe.mcfunction", content: "say unsafe" },
        { path: "../outside.json", content: {} },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        "duplicate-file-path",
        "unsafe-file-path",
        "wrong-datapack-directory-layout",
      ]),
    );
  });

  it("gates plural and singular datapack directories by the target version", () => {
    const modern = validateDatapackProject({
      version: "1.21",
      files: [
        packMetadata,
        { path: "data/example/functions/legacy.mcfunction", content: "say ignored" },
        { path: "data/example/tags/functions/legacy.json", content: { values: [] } },
      ],
    });
    expect(modern.valid).toBe(false);
    expect(
      modern.diagnostics.filter(
        (diagnostic) => diagnostic.code === "wrong-datapack-directory-layout",
      ),
    ).toHaveLength(2);

    const legacyMetadata = {
      path: "pack.mcmeta",
      content: { pack: { pack_format: 41, description: "Legacy layout fixture" } },
    };
    const legacy = validateDatapackProject({
      version: "1.20.6",
      files: [
        legacyMetadata,
        { path: "data/example/functions/root.mcfunction", content: "function #example:load" },
        { path: "data/example/functions/child.mcfunction", content: "say child" },
        {
          path: "data/example/tags/functions/load.json",
          content: { values: ["example:child"] },
        },
      ],
    });
    expect(legacy.valid).toBe(true);
    expect(legacy.checkedReferences).toBe(2);

    const wrongLegacy = validateDatapackProject({
      version: "1.20.6",
      files: [
        legacyMetadata,
        { path: "data/example/function/modern.mcfunction", content: "say ignored" },
      ],
    });
    expect(wrongLegacy.valid).toBe(false);
    expect(wrongLegacy.diagnostics).toContainEqual(
      expect.objectContaining({ code: "wrong-datapack-directory-layout" }),
    );
  });

  it("allows explicitly declared merged-namespace dependencies without hiding uncertainty", () => {
    const result = validateDatapackProject({
      version: "1.21",
      assumeLocalNamespacesComplete: false,
      files: [
        packMetadata,
        {
          path: "data/example/function/root.mcfunction",
          content: "function example:shared\nfunction minecraft:custom_dependency",
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.validationComplete).toBe(false);
    expect(result.missingReferences).toBe(0);
    expect(result.unverifiedReferences).toBe(2);
    expect(result.validationIncompleteReasons).toContain("external-reference");
  });

  it("recognizes only command-position references and reports arbitrary command macros", () => {
    const result = validateDatapackProject({
      version: "26.2",
      files: [
        {
          path: "pack.mcmeta",
          content: { pack: { pack_format: 107, description: "Command scanner fixture" } },
        },
        { path: "data/example/function/child.mcfunction", content: "say child" },
        {
          path: "data/example/function/root.mcfunction",
          content: [
            "say function example:missing now",
            'tellraw @a {"text":"run function example:missing now"}',
            "execute as @s run say run function example:missing now",
            "execute store result score run function run say hi",
            "execute store result score run function run function example:child",
            "execute if function example:child run function example:child",
            "debug function example:child",
            "# CR comment\rfunction example:child",
            "$$(command) example:target",
            "$execute as @s run $(tail)",
          ].join("\n"),
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.checkedReferences).toBe(5);
    expect(result.resolvedReferences).toBe(5);
    expect(result.missingReferences).toBe(0);
    expect(result.validationComplete).toBe(false);
    expect(result.validationIncompleteReasons).toContain("dynamic-reference");
    expect(
      result.diagnostics.filter(
        (diagnostic) => diagnostic.code === "dynamic-function-reference-unverified",
      ),
    ).toHaveLength(2);
  });

  it("keeps balanced command arguments together before locating execute redirects", () => {
    const result = validateDatapackProject({
      version: "26.2",
      files: [
        {
          path: "pack.mcmeta",
          content: { pack: { pack_format: 107, description: "Command lexer fixture" } },
        },
        {
          path: "data/example/function/root.mcfunction",
          content:
            'execute if block ~ ~ ~ minecraft:chest{Lock:"", Items:[]} run function example:missing',
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.checkedReferences).toBe(1);
    expect(result.missingReferences).toBe(1);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "missing-datapack-reference",
        reference: "example:missing",
      }),
    );
  });

  it("scans long execute modifier chains without reparsing run-like arguments", () => {
    const repeatedModifiers = "as run summon pig ".repeat(4_000);
    const result = validateDatapackProject({
      version: "26.2",
      files: [
        {
          path: "pack.mcmeta",
          content: { pack: { pack_format: 107, description: "Command complexity fixture" } },
        },
        { path: "data/example/function/child.mcfunction", content: "say child" },
        {
          path: "data/example/function/root.mcfunction",
          content: `execute ${repeatedModifiers}run function example:child`,
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.checkedReferences).toBe(1);
    expect(result.resolvedReferences).toBe(1);
  });

  it("reports fixed limit truncation without retaining unbounded diagnostics", () => {
    const result = validateDatapackProject({
      version: "1.21",
      limit: 1,
      limits: { maxFiles: 2, maxGraphOperations: 1 },
      files: [
        packMetadata,
        { path: "data/example/function/root.mcfunction", content: "function example:a" },
        { path: "data/example/function/a.mcfunction", content: "function example:b" },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.validationComplete).toBe(false);
    expect(result.exceededLimits).toContain("maxFiles");
    expect(result.appliedLimits.maxFiles).toBe(2);
    expect(result.retainedDiagnosticCount).toBe(1);
    expect(result.diagnosticTotal).toBeGreaterThanOrEqual(1);
    expect(result.truncated).toBe(true);
  });

  it("bounds aggregate JSON traversal before running file-schema validation", () => {
    const result = validateDatapackProject({
      version: "1.21",
      limits: { maxContentNodes: 6 },
      files: [
        packMetadata,
        {
          path: "data/example/tags/function/load.json",
          content: { values: ["example:startup"] },
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.validationComplete).toBe(false);
    expect(result.exceededLimits).toContain("maxContentNodes");
    expect(result.invalidContentFiles).toBe(1);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "json-content-limit-exceeded",
        path: "data/example/tags/function/load.json",
        source: "maxContentNodes",
      }),
    );
  });

  it("counts strings inside parsed JSON objects toward the text budget", () => {
    const result = validateDatapackProject({
      version: "1.21",
      limits: { maxTextContentCharacters: 20 },
      files: [
        {
          path: "pack.mcmeta",
          content: { pack: { pack_format: 48, description: "bounded" } },
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.exceededLimits).toContain("maxTextContentCharacters");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "json-content-limit-exceeded",
        path: "pack.mcmeta",
        source: "maxTextContentCharacters",
      }),
    );
  });

  it("keeps unsupported reference graphs explicit instead of claiming completeness", () => {
    const result = validateDatapackProject({
      version: "1.21",
      files: [
        packMetadata,
        {
          path: "data/example/loot_table/reward.json",
          content: { type: "minecraft:empty", pools: [] },
        },
        {
          path: "data/example/advancement/rewarded.json",
          content: { rewards: { function: "example:grant" } },
        },
        { path: "data/example/worldgen/biome/test.json" },
        { path: "data/example/dimension/test.json", content: {} },
        { path: "data/example/enchantment/test.json", content: {} },
        { path: "data/example/enchantment_provider/test.json", content: {} },
        { path: "data/example/trial_spawner/test.json", content: {} },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.validationComplete).toBe(false);
    expect(result.unsupportedReferenceKinds).toEqual([
      "advancement-rewards",
      "dimension",
      "enchantment",
      "enchantment_provider",
      "loot_table",
      "trial_spawner",
      "worldgen/biome",
    ]);
    expect(result.validationIncompleteReasons).toContain("unsupported-reference-kind");
  });

  it("reports pack overlays as unsupported instead of skipping their graphs silently", () => {
    const result = validateDatapackProject({
      version: "1.21",
      files: [
        {
          path: "pack.mcmeta",
          content: {
            pack: { pack_format: 48, description: "Overlay fixture" },
            overlays: {
              entries: [
                {
                  directory: "overlay",
                  formats: { min_inclusive: 48, max_inclusive: 48 },
                },
              ],
            },
          },
        },
        {
          path: "overlay/data/example/function/root.mcfunction",
          content: "function example:missing",
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.validationComplete).toBe(false);
    expect(result.unsupportedReferenceKinds).toContain("pack-overlays");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "pack-overlays-unverified" }),
    );
  });

  it("bounds deep cyclic tag graphs without stack-wide cycle-key work", () => {
    const tagCount = 400;
    const files = Array.from({ length: tagCount }, (_, index) => ({
      path: `data/example/tags/function/tag_${index}.json`,
      content: {
        values: [`#example:tag_${(index + 1) % tagCount}`, "#example:tag_0"],
      },
    }));
    const result = validateDatapackProject({
      version: "1.21",
      limits: { maxGraphOperations: 4_000 },
      files: [packMetadata, ...files],
    });

    expect(result.exceededLimits).not.toContain("maxGraphOperations");
    expect(result.detectedCycles).toBe(tagCount);
    expect(result.validationComplete).toBe(true);
  });

  it("does not claim completeness when a JSON file has no versioned schema", () => {
    const result = validateDatapackProject({
      version: "1.21",
      files: [
        packMetadata,
        { path: "data/example/custom_registry/value.json", content: { custom: true } },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.validationComplete).toBe(false);
    expect(result.validationIncompleteReasons).toContain("file-schema-unavailable");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        code: "pack-file-schema-unavailable",
      }),
    );
  });

  it("only permits callers to lower published limits", () => {
    const resolved = resolveDatapackProjectValidationLimits({
      maxFiles: defaultDatapackProjectValidationLimits.maxFiles + 1,
      maxGraphOperations: 25,
      maxContentDepth: 0,
    });

    expect(resolved.maxFiles).toBe(defaultDatapackProjectValidationLimits.maxFiles);
    expect(resolved.maxGraphOperations).toBe(25);
    expect(resolved.maxContentDepth).toBe(defaultDatapackProjectValidationLimits.maxContentDepth);
  });

  it("routes datapack project validation wording to the new tool", () => {
    for (const task of [
      "validate this datapack project",
      "verify data-pack references",
      "check a missing function tag reference",
      "audit an advancement parent cycle",
    ]) {
      const result = suggestMinecraftLookups({ version: "1.21", task });
      expect(result.suggestedTools).toContainEqual({
        tool: "datapack validate-project 1.21 <directory>",
        reason: "Validate a complete datapack directory, including local and vanilla references.",
      });
    }
  });
});

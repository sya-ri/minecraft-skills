import { describe, expect, it } from "vitest";
import { getVersionDetail, validateResourcepackProject } from "./index.js";

const version = "1.21";
const packMetadata = {
  path: "pack.mcmeta",
  content: {
    pack: {
      pack_format: getVersionDetail("java", version).packFormats.resource,
      description: "Resourcepack coverage fixture",
    },
  },
};
const blockstate = "assets/example/blockstates/widget.json";

describe("resourcepack metadata and blockstate coverage", () => {
  it("validates metadata with the existing target-version schema for object and text input", () => {
    for (const content of [packMetadata.content, JSON.stringify(packMetadata.content)]) {
      expect(
        validateResourcepackProject({ version, files: [{ path: "pack.mcmeta", content }] }),
      ).toMatchObject({
        valid: true,
        validationComplete: true,
        validationIncompleteReasons: [],
        packMetadataFiles: 1,
        parsedJsonFiles: 1,
        diagnostics: [],
      });
    }
    for (const content of ["{", {}, null, { pack: { pack_format: 0, description: "wrong" } }]) {
      const result = validateResourcepackProject({
        version,
        files: [{ path: "pack.mcmeta", content }],
      });
      expect(result.valid).toBe(false);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "invalid-pack-metadata",
          path: "pack.mcmeta",
        }),
      );
    }
  });

  it("allows partial projects while reporting missing metadata as incomplete", () => {
    for (const files of [[], [{ path: "pack.mcmeta" }]]) {
      expect(validateResourcepackProject({ version, files })).toMatchObject({
        valid: true,
        validationComplete: false,
        validationIncompleteReasons: ["pack-metadata-unavailable"],
        diagnostics: [],
      });
    }
  });

  it("checks variants and multipart applications against local and versioned vanilla models", () => {
    const result = validateResourcepackProject({
      version,
      files: [
        packMetadata,
        { path: "assets/example/models/block/widget.json", content: {} },
        {
          path: blockstate,
          content: {
            variants: {
              "": { model: "example:block/widget" },
              "facing=north": [{ model: "minecraft:block/stone" }, { model: "block/dirt" }],
            },
            multipart: [
              { when: { north: "true" }, apply: { model: "example:block/widget" } },
              { apply: [{ model: "minecraft:block/stone" }] },
            ],
          },
        },
      ],
    });
    expect(result).toMatchObject({
      valid: true,
      validationComplete: true,
      blockstateFiles: 1,
      parsedJsonFiles: 3,
      checkedReferences: 5,
      diagnostics: [],
    });

    const files = [
      { path: blockstate, content: { variants: { "": { model: "minecraft:block/crafter" } } } },
    ];
    expect(validateResourcepackProject({ version: "1.21", files }).valid).toBe(true);
    expect(validateResourcepackProject({ version: "1.20.1", files }).diagnostics).toContainEqual(
      expect.objectContaining({ code: "missing-blockstate-model" }),
    );
  });

  it("retains the source of missing references and rejects malformed applications", () => {
    const result = validateResourcepackProject({
      version,
      files: [
        packMetadata,
        {
          path: blockstate,
          content: {
            variants: {
              "facing=north": [{ model: "example:missing" }, { model: "example:../unsafe" }],
              "facing=south": [],
              "facing=east": { model: 7 },
            },
            multipart: [{ apply: { model: "example:missing" } }, {}, null],
          },
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "missing-blockstate-model",
        reference: "example:missing",
        source: '$.variants["facing=north"][0].model',
      }),
    );
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "missing-blockstate-model",
        source: "$.multipart[0].apply.model",
      }),
    );
    expect(
      result.diagnostics.filter((entry) => entry.code === "invalid-blockstate-model"),
    ).toHaveLength(5);
    const containers = validateResourcepackProject({
      version,
      files: [packMetadata, { path: blockstate, content: { variants: [], multipart: {} } }],
    });
    expect(containers.diagnostics.map((entry) => entry.source)).toEqual([
      "$.multipart",
      "$.variants",
    ]);
  });

  it("validates a blockstate-selected parent model in its own texture context", () => {
    const files = [
      packMetadata,
      {
        path: "assets/example/models/block/base.json",
        content: {
          elements: [{ faces: { north: { texture: "#surface" } } }],
        },
      },
      {
        path: "assets/example/models/block/child.json",
        content: {
          parent: "example:block/base",
          textures: { surface: "minecraft:block/stone" },
        },
      },
    ];
    expect(validateResourcepackProject({ version, files }).valid).toBe(true);
    const result = validateResourcepackProject({
      version,
      files: [
        ...files,
        { path: blockstate, content: { variants: { "": { model: "example:block/base" } } } },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "missing-texture-variable",
        path: "assets/example/models/block/base.json",
      }),
    );
  });

  it("reports unsupported asset graphs, overlays, and metadata as completeness gaps", () => {
    const result = validateResourcepackProject({
      version,
      files: [
        {
          path: "pack.mcmeta",
          content: {
            ...packMetadata.content,
            overlays: {
              entries: [{ directory: "overlay", formats: packMetadata.content.pack.pack_format }],
            },
            filter: { block: [{ namespace: "minecraft" }] },
          },
        },
        ...["font", "fonts", "atlases", "particles", "equipment", "shaders", "post_effect"].map(
          (category) => ({
            path: `assets/example/${category}/test.json`,
            content: {},
          }),
        ),
        { path: "assets/example/textures/test.png.mcmeta", content: { animation: {} } },
        { path: "overlay/assets/example/models/block/test.json", content: {} },
      ],
    });
    expect(result.valid).toBe(true);
    expect(result.validationComplete).toBe(false);
    expect(result.validationIncompleteReasons).toEqual(["unsupported-reference-kind"]);
    expect(result.unsupportedReferenceKinds).toEqual([
      "asset-metadata",
      "atlas",
      "equipment",
      "font",
      "pack-filters",
      "pack-overlays",
      "particle",
      "post-effect",
      "shader",
    ]);
    expect(
      validateResourcepackProject({
        version,
        files: [packMetadata, { path: "assets/example/constructor/test.json", content: {} }],
      }).unsupportedReferenceKinds,
    ).toEqual([]);
  });

  it("keeps missing content and unsupported blockstate formats explicit", () => {
    expect(
      validateResourcepackProject({ version, files: [packMetadata, { path: blockstate }] }),
    ).toMatchObject({
      valid: false,
      blockstateFiles: 1,
      validationComplete: false,
      validationIncompleteReasons: ["content-unavailable"],
    });
    expect(
      validateResourcepackProject({
        version,
        files: [packMetadata, { path: blockstate, content: {} }],
      }),
    ).toMatchObject({
      valid: true,
      validationComplete: false,
      unsupportedReferenceKinds: ["blockstate-format"],
    });
    expect(
      validateResourcepackProject({
        version,
        files: [packMetadata, { path: blockstate, content: "{" }],
      }),
    ).toMatchObject({ valid: false, blockstateFiles: 1 });
  });

  it("bounds raw mcmeta parsing and graph work before schema or reference processing", () => {
    const metadata = {
      pack: packMetadata.content.pack,
      filter: { block: [{ extra: { nested: true } }] },
    };
    const depthLimited = validateResourcepackProject({
      version,
      limits: { maxContentDepth: 4 },
      files: [{ path: "pack.mcmeta", content: JSON.stringify(metadata) }],
    });
    expect(depthLimited).toMatchObject({
      valid: false,
      processedFiles: 0,
      validationComplete: false,
      validationIncompleteReasons: ["limit-exceeded"],
      exceededLimits: ["maxContentDepth"],
    });
    const graphLimited = validateResourcepackProject({
      version,
      limits: { maxModelGraphOperations: 4 },
      files: [
        packMetadata,
        {
          path: blockstate,
          content: {
            variants: { "": Array.from({ length: 20 }, () => ({ model: "example:missing" })) },
          },
        },
      ],
    });
    expect(graphLimited.checkedReferences).toBe(2);
    expect(graphLimited.exceededLimits).toEqual(["maxModelGraphOperations"]);
    expect(graphLimited.validationIncompleteReasons).toEqual(["limit-exceeded"]);
    expect(
      graphLimited.diagnostics.filter(
        (entry) => entry.code === "resourcepack-validation-limit-exceeded",
      ),
    ).toHaveLength(1);
  });

  it("bounds diagnostics while retaining occurrence counts and deterministic source order", () => {
    const result = validateResourcepackProject({
      version,
      limit: 2,
      limits: { maxDiagnosticTextLength: 32 },
      files: [
        packMetadata,
        {
          path: blockstate,
          content: {
            multipart: Array.from({ length: 6 }, () => ({
              apply: { model: `example:${"long".repeat(40)}` },
            })),
          },
        },
      ],
    });
    expect(result).toMatchObject({
      errorCount: 6,
      diagnosticTotal: 6,
      retainedDiagnosticCount: 2,
      omittedDiagnosticCount: 4,
      truncated: true,
    });
    for (const diagnostic of result.diagnostics) {
      expect(diagnostic.message.length).toBeLessThanOrEqual(32);
      expect(diagnostic.path.length).toBeLessThanOrEqual(32);
      expect(diagnostic.reference?.length).toBeLessThanOrEqual(32);
    }
  });

  it("rejects unsafe blockstate paths and preserves duplicate-file diagnostics", () => {
    const result = validateResourcepackProject({
      version,
      files: [
        packMetadata,
        { path: "assets/Example/blockstates/test.json", content: { variants: {} } },
        { path: "assets/example/blockstates/../test.json", content: { variants: {} } },
        { path: blockstate, content: { variants: {} } },
        { path: blockstate, content: { variants: {} } },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.diagnostics.map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        "invalid-resource-path",
        "invalid-project-path",
        "duplicate-file-path",
      ]),
    );
  });
});

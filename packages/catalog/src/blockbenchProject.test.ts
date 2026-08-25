import { types as nodeTypes } from "node:util";
import { describe, expect, it, vi } from "vitest";
import {
  blockbenchProjectInspectionLimits,
  inspectBlockbenchProject,
} from "./blockbenchProject.js";

function project(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    meta: { format_version: "5.0", model_format: "free" },
    groups: [{ name: "body" }, { name: "seat" }, { name: "body" }],
    animations: [{ name: "idle" }, { name: "walk" }],
    ...overrides,
  };
}

describe("Blockbench project inspector", () => {
  it("reports exact case-sensitive v5 animation and group name evidence", () => {
    const result = inspectBlockbenchProject({
      project: JSON.stringify(project()),
      requireAnimations: ["walk", "Idle", "missing", "walk"],
      requireGroups: ["seat", "Seat", "body"],
    });

    expect(result.outcome).toBe("inspected");
    expect(result.inspectionComplete).toBe(true);
    expect(result.metadata).toMatchObject({
      format_version: "5.0",
      formatVersionField: "format_version",
      formatVersionRelation: "current",
      model_format: "free",
      effectiveModelFormat: "free",
      modelFormatSupport: "audited-core",
    });
    expect(result.collections.animations).toMatchObject({
      sourceField: "animations",
      declaredEntries: 2,
      inspectedEntries: 2,
      observedNameCount: 2,
      uniqueNameCount: 2,
      duplicateNameCount: 0,
      complete: true,
      names: ["idle", "walk"],
    });
    expect(result.collections.groups).toMatchObject({
      sourceField: "groups",
      observedNameCount: 3,
      uniqueNameCount: 2,
      duplicateNameCount: 1,
      names: ["body", "seat"],
    });
    expect(result.requested.animations).toEqual([
      { name: "Idle", status: "missing" },
      { name: "missing", status: "missing" },
      { name: "walk", status: "present" },
    ]);
    expect(result.requested.groups).toEqual([
      { name: "Seat", status: "missing" },
      { name: "body", status: "present" },
      { name: "seat", status: "present" },
    ]);
    expect(result.nonGuarantees.join(" ")).toContain("does not prove that a model can be mounted");
    expect(result.coverage.notChecked.join(" ")).toContain("ModelEngine");
  });

  it("treats absent v5 arrays as empty for an audited core project", () => {
    const result = inspectBlockbenchProject({
      project: { meta: { format_version: "5.0", model_format: "java_block" } },
      requireAnimations: ["idle"],
      requireGroups: ["seat"],
    });

    expect(result.inspectionComplete).toBe(true);
    expect(result.collections.animations.complete).toBe(true);
    expect(result.collections.groups.complete).toBe(true);
    expect(result.requested.animations[0]?.status).toBe("missing");
    expect(result.requested.groups[0]?.status).toBe("missing");
    expect(result.source.duplicateKeys).toBe("unknown");
  });

  it("uses official legacy outliner group objects before format 5", () => {
    const result = inspectBlockbenchProject({
      project: {
        meta: { format_version: "4.10", model_format: "modded_entity" },
        outliner: [
          "element-uuid",
          {
            name: "root",
            children: [
              { name: "seat", children: [] },
              { name: "effects", content: [{ name: "nested", children: [] }] },
            ],
          },
        ],
        animations: [{ name: "animation.model.idle" }],
      },
      requireAnimations: ["animation.model.idle", "animation.model.walk"],
      requireGroups: ["root", "seat", "nested", "missing"],
    });

    expect(result.metadata.formatVersionRelation).toBe("legacy");
    expect(result.collections.groups.sourceField).toBe("outliner");
    expect(result.collections.groups.names).toEqual(["effects", "nested", "root", "seat"]);
    expect(result.requested.groups.at(-1)).toEqual({ name: "seat", status: "present" });
    expect(result.requested.groups.find((entry) => entry.name === "missing")?.status).toBe(
      "missing",
    );
    expect(result.requested.animations.find((entry) => entry.name.endsWith("walk"))?.status).toBe(
      "missing",
    );
  });

  it("uses the official legacy meta.format and model-format fallback", () => {
    const result = inspectBlockbenchProject({
      project: {
        meta: { format: "4.10", bone_rig: true },
        outliner: [],
      },
      requireGroups: ["seat"],
    });

    expect(result.metadata).toMatchObject({
      format_version: "4.10",
      formatVersionField: "format",
      effectiveModelFormat: "bedrock_old",
      modelFormatSupport: "audited-core",
    });
    expect(result.requested.groups).toEqual([{ name: "seat", status: "missing" }]);
  });

  it("matches Blockbench truthy fallback behavior for legacy version and model-format fields", () => {
    const legacyVersion = inspectBlockbenchProject({
      project: {
        meta: { format_version: "", format: "4.10", model_format: "free" },
        outliner: [],
      },
    });
    expect(legacyVersion.metadata).toMatchObject({
      format_version: "4.10",
      formatVersionField: "format",
      formatVersionRelation: "legacy",
    });

    for (const modelFormat of ["", false, 0]) {
      const result = inspectBlockbenchProject({
        project: {
          meta: { format_version: "5.0", model_format: modelFormat },
          groups: [],
          animations: [],
        },
      });
      expect(result.metadata.effectiveModelFormat).toBe("java_block");
      expect(result.metadata.modelFormatSupport).toBe("audited-core");
      expect(result.inspectionComplete).toBe(true);
    }

    const truthyNonString = inspectBlockbenchProject({
      project: {
        meta: { format_version: "5.0", model_format: true },
        groups: [],
        animations: [],
      },
    });
    expect(truthyNonString.metadata.modelFormatSupport).toBe("unknown");
    expect(truthyNonString.diagnostics.map((entry) => entry.code)).toContain(
      "metadata.unsupported-model-format",
    );
  });

  it("keeps found evidence but reports missing names as unknown for a newer format", () => {
    const result = inspectBlockbenchProject({
      project: project({
        meta: { format_version: "6.0", model_format: "free" },
        groups: [{ name: "seat" }],
        animations: [{ name: "idle" }],
      }),
      requireAnimations: ["idle", "walk"],
      requireGroups: ["seat", "body"],
    });

    expect(result.outcome).toBe("indeterminate");
    expect(result.inspectionComplete).toBe(false);
    expect(result.requested.animations).toEqual([
      { name: "idle", status: "present" },
      { name: "walk", status: "unknown" },
    ]);
    expect(result.requested.groups).toEqual([
      { name: "body", status: "unknown" },
      { name: "seat", status: "present" },
    ]);
    expect(result.diagnostics.map((entry) => entry.code)).toContain("metadata.newer-format");
  });

  it("does not prove absence for an unknown or plugin-defined model format", () => {
    const result = inspectBlockbenchProject({
      project: project({
        meta: { format_version: "5.0", model_format: "example_plugin_format" },
      }),
      requireAnimations: ["idle", "missing"],
      requireGroups: ["seat", "missing"],
    });

    expect(result.metadata.modelFormatSupport).toBe("unknown-or-plugin");
    expect(result.diagnostics.map((entry) => entry.code)).toContain(
      "metadata.unknown-or-plugin-model-format",
    );
    expect(result.requested.animations.find((entry) => entry.name === "idle")?.status).toBe(
      "present",
    );
    expect(result.requested.animations.find((entry) => entry.name === "missing")?.status).toBe(
      "unknown",
    );
    expect(result.requested.groups.find((entry) => entry.name === "missing")?.status).toBe(
      "unknown",
    );
  });

  it("does not prove absence when a target collection has an unsupported shape", () => {
    const result = inspectBlockbenchProject({
      project: project({
        groups: [{ name: "seat" }, null, { missingName: true }],
        animations: "not-an-array",
      }),
      requireAnimations: ["idle"],
      requireGroups: ["seat", "body"],
    });

    expect(result.collections.animations.complete).toBe(false);
    expect(result.collections.groups.complete).toBe(false);
    expect(result.requested.animations[0]?.status).toBe("unknown");
    expect(result.requested.groups).toEqual([
      { name: "body", status: "unknown" },
      { name: "seat", status: "present" },
    ]);
  });

  it("keeps absence evidence scoped to the collection that was completely inspected", () => {
    const result = inspectBlockbenchProject({
      project: project({ groups: null, animations: [{ name: "idle" }] }),
      requireAnimations: ["walk"],
      requireGroups: ["seat"],
    });

    expect(result.inspectionComplete).toBe(false);
    expect(result.requested.animations[0]?.status).toBe("missing");
    expect(result.requested.groups[0]?.status).toBe("unknown");
  });

  it("reports compressed projects as unsupported rather than invalid", () => {
    const result = inspectBlockbenchProject({
      project: "<lz>opaque-data",
      requireAnimations: ["idle"],
      requireGroups: ["seat"],
    });

    expect(result.outcome).toBe("indeterminate");
    expect(result.errorCount).toBe(0);
    expect(result.requested.animations[0]?.status).toBe("unknown");
    expect(result.requested.groups[0]?.status).toBe("unknown");
    expect(result.diagnostics[0]?.code).toBe("project.compressed-unsupported");
  });

  it("distinguishes invalid JSON, invalid roots, and missing metadata", () => {
    const invalidJson = inspectBlockbenchProject({ project: "{" });
    const invalidRoot = inspectBlockbenchProject({ project: "[]" });
    const missingMeta = inspectBlockbenchProject({ project: "{}" });

    expect(invalidJson.outcome).toBe("invalid-input");
    expect(invalidJson.diagnostics[0]?.code).toBe("project.invalid-json");
    expect(invalidRoot.outcome).toBe("invalid-input");
    expect(invalidRoot.diagnostics[0]?.code).toBe("project.invalid-root");
    expect(missingMeta.outcome).toBe("invalid-input");
    expect(missingMeta.diagnostics[0]?.code).toBe("metadata.missing-or-invalid");
  });

  it("checks duplicate keys for raw JSON while declaring parsed-object source uniqueness unknown", () => {
    const raw = inspectBlockbenchProject({
      project:
        '{"meta":{"format_version":"5.0","model_format":"free"},"groups":[],"groups":[{"name":"seat"}]}',
      requireGroups: ["seat"],
    });
    const structured = inspectBlockbenchProject({ project: project() });

    expect(raw.source.duplicateKeys).toBe("observed");
    expect(raw.warningCount).toBe(1);
    expect(raw.requested.groups[0]?.status).toBe("present");
    expect(structured.source.duplicateKeys).toBe("unknown");
    expect(structured.diagnostics.map((entry) => entry.code)).toContain(
      "project.source-key-uniqueness-unknown",
    );
  });

  it("does not retain texture source, editor state, paths, or unrelated project data", () => {
    const result = inspectBlockbenchProject({
      project: project({
        textures: [
          {
            path: "C:/private/model.png",
            source: "data:image/png;base64,PRIVATE_PAYLOAD",
          },
        ],
        editor_state: { save_path: "C:/private/model.bbmodel", selected_groups: ["secret"] },
      }),
    });
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("PRIVATE_PAYLOAD");
    expect(serialized).not.toContain("C:/private");
    expect(serialized).not.toContain("selected_groups");
  });

  it("rejects proxy, accessor, symbol, hidden, class, and sparse structured input", () => {
    const getter = vi.fn(() => project());
    const accessor = {} as Record<string, unknown>;
    Object.defineProperty(accessor, "meta", { enumerable: true, get: getter });
    const hidden = project();
    Object.defineProperty(hidden, "hidden", { enumerable: false, value: true });
    const symbol = project();
    Object.defineProperty(symbol, Symbol("hidden"), { enumerable: true, value: true });
    class ProjectRecord {
      meta = { format_version: "5.0", model_format: "free" };
    }
    const sparse = project({ groups: new Array(2) });
    const proxy = new Proxy(project(), {
      get() {
        throw new Error("must not execute");
      },
      ownKeys() {
        throw new Error("must not execute");
      },
    });

    for (const candidate of [accessor, hidden, symbol, new ProjectRecord(), sparse, proxy]) {
      const result = inspectBlockbenchProject({ project: candidate });
      expect(result.outcome).toBe("invalid-input");
      expect(result.diagnostics.map((entry) => entry.code)).toContain(
        "project.unsafe-or-unbounded-data",
      );
    }
    expect(getter).not.toHaveBeenCalled();
    expect(nodeTypes.isProxy(proxy)).toBe(true);
  });

  it("rejects revoked proxies for root options and required-name arrays without throwing", () => {
    const revokedOptions = Proxy.revocable({ project: project() }, {});
    revokedOptions.revoke();
    const optionsResult = inspectBlockbenchProject(
      revokedOptions.proxy as unknown as Parameters<typeof inspectBlockbenchProject>[0],
    );
    expect(optionsResult.outcome).toBe("invalid-input");
    expect(optionsResult.diagnostics[0]?.code).toBe("input.invalid-options");

    const revokedRequired = Proxy.revocable(["seat"], {});
    revokedRequired.revoke();
    const requiredResult = inspectBlockbenchProject({
      project: project(),
      requireGroups: revokedRequired.proxy,
    });
    expect(requiredResult.outcome).toBe("invalid-input");
    expect(requiredResult.diagnostics[0]?.code).toBe("input.invalid-required-names");
  });

  it("attributes legacy format-version diagnostics to meta.format", () => {
    const result = inspectBlockbenchProject({
      project: { meta: { format: "6.0", model_format: "free" } },
    });
    expect(result.diagnostics.find((entry) => entry.code === "metadata.newer-format")?.path).toBe(
      "/meta/format",
    );
  });

  it("rejects cycles, shared references, excessive depth, and unsupported scalar values", () => {
    const cycle = project();
    cycle.self = cycle;
    const sharedValue = { name: "shared" };
    const shared = project({ groups: [sharedValue, sharedValue] });
    let deep: Record<string, unknown> = {};
    const deepRoot = deep;
    for (let index = 0; index <= blockbenchProjectInspectionLimits.maxJsonDepth; index += 1) {
      const next: Record<string, unknown> = {};
      deep.next = next;
      deep = next;
    }
    const unsupported = project({ value: Number.NaN });

    for (const candidate of [cycle, shared, deepRoot, unsupported]) {
      const result = inspectBlockbenchProject({ project: candidate });
      expect(result.outcome).toBe("invalid-input");
      expect(result.diagnostics.map((entry) => entry.code)).toContain(
        "project.unsafe-or-unbounded-data",
      );
    }
  });

  it("bounds raw characters and UTF-8 bytes before parsing", () => {
    const tooManyCharacters = " ".repeat(
      blockbenchProjectInspectionLimits.maxProjectCharacters + 1,
    );
    const tooManyBytes = "界".repeat(
      Math.floor(blockbenchProjectInspectionLimits.maxProjectBytes / 3) + 1,
    );

    expect(inspectBlockbenchProject({ project: tooManyCharacters }).diagnostics[0]?.code).toBe(
      "project.input-limit",
    );
    expect(inspectBlockbenchProject({ project: tooManyBytes }).diagnostics[0]?.code).toBe(
      "project.input-limit",
    );
  });

  it("bounds, deduplicates, and safely inspects requested names", () => {
    const result = inspectBlockbenchProject({
      project: project(),
      requireAnimations: ["walk", "walk", "idle"],
      requireGroups: ["seat", "seat"],
    });
    expect(result.requested.animations.map((entry) => entry.name)).toEqual(["idle", "walk"]);
    expect(result.requested.groups.map((entry) => entry.name)).toEqual(["seat"]);

    const tooMany = Array.from(
      { length: blockbenchProjectInspectionLimits.maxRequiredNames + 1 },
      (_, index) => `name-${index}`,
    );
    const excessive = inspectBlockbenchProject({ project: project(), requireGroups: tooMany });
    expect(excessive.outcome).toBe("invalid-input");
    expect(excessive.diagnostics[0]?.code).toBe("input.invalid-required-names");

    const accessor: Record<string, unknown> = { project: project() };
    const getter = vi.fn(() => ["seat"]);
    Object.defineProperty(accessor, "requireGroups", { enumerable: true, get: getter });
    const unsafeOptions = inspectBlockbenchProject(
      accessor as unknown as Parameters<typeof inspectBlockbenchProject>[0],
    );
    expect(unsafeOptions.outcome).toBe("invalid-input");
    expect(getter).not.toHaveBeenCalled();
  });

  it("retains the requested diagnostic limit when required names are invalid", () => {
    const result = inspectBlockbenchProject({
      project: project(),
      requireAnimations: [null] as unknown as string[],
      requireGroups: [null] as unknown as string[],
      limit: 1,
    });

    expect(result.outcome).toBe("invalid-input");
    expect(result.limits.appliedDiagnosticLimit).toBe(1);
    expect(result.diagnosticTotal).toBe(2);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnosticsTruncated).toBe(true);
    expect(result.omittedDiagnosticCount).toBe(1);
  });

  it("marks truncated diagnostics and incomplete inspection at the requested fixed limit", () => {
    const result = inspectBlockbenchProject({
      project: project({ groups: Array.from({ length: 5 }, () => null) }),
      requireGroups: ["seat"],
      limit: 2,
    });

    expect(result.limits.appliedDiagnosticLimit).toBe(2);
    expect(result.diagnosticTotal).toBeGreaterThan(2);
    expect(result.diagnostics).toHaveLength(2);
    expect(result.diagnosticsTruncated).toBe(true);
    expect(result.omittedDiagnosticCount).toBe(result.diagnosticTotal - 2);
    expect(result.inspectionComplete).toBe(false);
    expect(result.requested.groups[0]?.status).toBe("unknown");
  });

  it("keeps missing unknown after the named-entry inspection limit while retaining found names", () => {
    const animations = Array.from(
      { length: blockbenchProjectInspectionLimits.maxNamedEntriesInspected + 1 },
      (_, index) => ({ name: `animation-${index}` }),
    );
    const result = inspectBlockbenchProject({
      project: project({ animations }),
      requireAnimations: ["animation-0", "animation-after-limit"],
    });

    expect(result.collections.animations.inspectedEntries).toBe(
      blockbenchProjectInspectionLimits.maxNamedEntriesInspected,
    );
    expect(result.collections.animations.complete).toBe(false);
    expect(result.requested.animations).toEqual([
      { name: "animation-0", status: "present" },
      { name: "animation-after-limit", status: "unknown" },
    ]);
  });

  it("pins the official Blockbench sources and current format evidence", () => {
    const result = inspectBlockbenchProject({ project: project() });

    expect(result.sourceEvidence).toMatchObject({
      kind: "official-source-snapshot",
      blockbenchVersion: "5.1.6",
      auditedCommit: "47e633e4a1338f957ee7baa0acbcf54da11e77df",
      currentFormatVersion: "5.0",
    });
    expect(result.sourceEvidence.formatSourceUrl).toContain(result.sourceEvidence.auditedCommit);
    expect(result.sourceEvidence.animationSourceUrl).toContain("animation.js");
    expect(result.sourceEvidence.groupSourceUrl).toContain("group.js");
  });
});

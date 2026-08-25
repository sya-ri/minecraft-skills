import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  cleanCachedData,
  fetchData,
  fetchMinecraftAssetFile,
  fetchMinecraftAssetsArchive,
  fetchMinecraftAssetsIndex,
  fetchMojangServerJar,
  getCacheDataRoot,
  getCachedDataPath,
  getCachedMinecraftAssetPath,
  getCacheRoot,
  getDataManifest,
  getDataRoot,
  getMinecraftAssetsStatus,
  getMojangServerJarStatus,
  hasBundledDataFile,
  hasCachedDataFile,
  hasCachedMinecraftAssetFile,
  hasDataFile,
  listCachedDataFiles,
  readCachedMinecraftAssetText,
  readDataJson,
  readDataText,
  searchMinecraftAssets,
} from "./index.js";

describe("@minecraft-skills/data", () => {
  const originalCacheDir = process.env.MINECRAFT_SKILLS_CACHE_DIR;

  async function withCacheDir<T>(run: (cacheDir: string) => T | Promise<T>): Promise<T> {
    const cacheDir = mkdtempSync(join(tmpdir(), "minecraft-skills-data-test-"));
    process.env.MINECRAFT_SKILLS_CACHE_DIR = cacheDir;
    try {
      return await run(cacheDir);
    } finally {
      if (originalCacheDir === undefined) {
        delete process.env.MINECRAFT_SKILLS_CACHE_DIR;
      } else {
        process.env.MINECRAFT_SKILLS_CACHE_DIR = originalCacheDir;
      }
      rmSync(cacheDir, { recursive: true, force: true });
    }
  }

  it("loads bundled catalog JSON", () => {
    const catalog = readDataJson<{ latest: { java: string } }>("catalog.json");
    expect(catalog.latest.java).toBe("26.2");
  });

  it("loads bundled authoring checklist JSON", () => {
    const checklists = readDataJson<{ checklists: Array<{ domain: string }> }>(
      "authoring-checklists.json",
    );
    expect(checklists.checklists.map((checklist) => checklist.domain)).toEqual([
      "datapack",
      "resourcepack",
      "paper-plugin",
    ]);
  });

  it("loads bundled authoring recipe JSON", () => {
    const recipes = readDataJson<{ recipes: Array<{ id: string }> }>("authoring-recipes.json");
    expect(recipes.recipes.map((recipe) => recipe.id)).toContain("paper-event-listener");
    expect(recipes.recipes.map((recipe) => recipe.id)).toContain("paper-safe-item-delivery");
    expect(recipes.recipes.map((recipe) => recipe.id)).toContain(
      "paper-inventory-gui-interactions",
    );
    expect(recipes.recipes.map((recipe) => recipe.id)).toContain(
      "paper-administrative-command-operability",
    );
    expect(recipes.recipes.map((recipe) => recipe.id)).toContain("paper-scheduled-task-lifecycle");
    expect(recipes.recipes.map((recipe) => recipe.id)).toContain("paper-plugin-protocol-safety");
    expect(recipes.recipes.map((recipe) => recipe.id)).toContain(
      "paper-display-interaction-contract",
    );
    expect(recipes.recipes.map((recipe) => recipe.id)).toContain(
      "paper-bossbar-audience-lifecycle",
    );
    expect(recipes.recipes.map((recipe) => recipe.id)).toContain(
      "paper-itemstack-semantic-identity",
    );
    expect(recipes.recipes.map((recipe) => recipe.id)).toContain(
      "paper-plugin-configuration-lifecycle",
    );
    expect(recipes.recipes.map((recipe) => recipe.id)).toContain("paper-persistent-data-contract");
    expect(recipes.recipes.map((recipe) => recipe.id)).toContain("paper-plugin-testing-evidence");
    expect(recipes.recipes.map((recipe) => recipe.id)).toContain(
      "paper-custom-recipe-registration",
    );
  });

  it("loads bundled authoring scenario JSON", () => {
    const scenarios = readDataJson<{ scenarios: Array<{ id: string }> }>(
      "authoring-scenarios.json",
    );
    expect(scenarios.scenarios.map((scenario) => scenario.id)).toContain(
      "paper-event-listener-review",
    );
    const scenarioIds = scenarios.scenarios.map((scenario) => scenario.id);
    expect(scenarioIds).toContain("paper-item-delivery-review");
    expect(scenarioIds).toContain("paper-inventory-gui-interaction-review");
    expect(scenarioIds).toContain("paper-administrative-command-operability-review");
    expect(scenarioIds).toContain("paper-scheduled-task-lifecycle-review");
    expect(scenarioIds).toContain("paper-plugin-protocol-safety-review");
    expect(scenarioIds).toContain("paper-display-interaction-contract-review");
    expect(scenarioIds).toContain("paper-bossbar-audience-lifecycle-review");
    expect(scenarioIds).toContain("paper-itemstack-semantic-identity-review");
    expect(scenarioIds).toContain("paper-plugin-configuration-lifecycle-review");
    expect(scenarioIds).toContain("paper-persistent-data-contract-review");
    expect(scenarioIds).toContain("paper-plugin-testing-evidence-review");
    expect(scenarioIds).toContain("paper-custom-recipe-review");
  });

  it("loads bundled intent lookup JSON", () => {
    const intents = readDataJson<{ intents: Array<{ id: string }> }>("intent-lookups.json");
    expect(intents.intents.map((intent) => intent.id)).toContain("verify-paper-type-or-member");
  });

  it("loads bundled authoring guardrail JSON", () => {
    const guardrails = readDataJson<{ guardrails: Array<{ id: string }> }>(
      "authoring-guardrails.json",
    );
    expect(guardrails.guardrails.map((guardrail) => guardrail.id)).toContain(
      "paper-api-surface-limits",
    );
    const guardrailIds = guardrails.guardrails.map((guardrail) => guardrail.id);
    expect(guardrailIds).toContain("paper-inventory-delivery-outcomes");
    expect(guardrailIds).toContain("paper-inventory-gui-interaction-safety");
    expect(guardrailIds).toContain("paper-administrative-command-operability");
    expect(guardrailIds).toContain("paper-scheduled-task-lifecycle-safety");
    expect(guardrailIds).toContain("paper-plugin-protocol-safety");
    expect(guardrailIds).toContain("paper-display-interaction-contract");
    expect(guardrailIds).toContain("paper-bossbar-audience-lifecycle-safety");
    expect(guardrailIds).toContain("paper-itemstack-semantic-identity");
    expect(guardrailIds).toContain("paper-plugin-configuration-lifecycle-safety");
    expect(guardrailIds).toContain("paper-persistent-data-contract");
    expect(guardrailIds).toContain("paper-plugin-testing-evidence");
    expect(guardrailIds).toContain("paper-custom-recipe-ownership");
  });

  it("loads bundled authoring diagnostic JSON", () => {
    const diagnostics = readDataJson<{ diagnostics: Array<{ id: string }> }>(
      "authoring-diagnostics.json",
    );
    expect(diagnostics.diagnostics.map((diagnostic) => diagnostic.id)).toContain(
      "paper-api-member-unverified",
    );
    const diagnosticIds = diagnostics.diagnostics.map((diagnostic) => diagnostic.id);
    expect(diagnosticIds).toContain("paper-inventory-leftovers-unhandled");
    expect(diagnosticIds).toContain("paper-inventory-gui-interaction-unbounded");
    expect(diagnosticIds).toContain("paper-administrative-command-incomplete");
    expect(diagnosticIds).toContain("paper-scheduled-task-lifecycle-unsafe");
    expect(diagnosticIds).toContain("paper-plugin-protocol-unsafe");
    expect(diagnosticIds).toContain("paper-display-interaction-contract-unsafe");
    expect(diagnosticIds).toContain("paper-bossbar-audience-lifecycle-unsafe");
    expect(diagnosticIds).toContain("paper-itemstack-identity-or-state-loss");
    expect(diagnosticIds).toContain("paper-plugin-configuration-lifecycle-unsafe");
    expect(diagnosticIds).toContain("paper-persistent-data-contract-unsafe");
    expect(diagnosticIds).toContain("paper-plugin-test-evidence-gap");
    expect(diagnosticIds).toContain("paper-custom-recipe-registration-unsafe");
  });

  it("bundles Paper event dispatch and listener ownership safety guidance", () => {
    const recipes = readDataJson<{
      recipes: Array<{
        id: string;
        steps: Array<{ id: string; action: string }>;
        finalChecks: string[];
      }>;
    }>("authoring-recipes.json");
    const recipe = recipes.recipes.find((entry) => entry.id === "paper-event-listener");
    expect(recipe?.steps.map((step) => step.id)).toEqual(
      expect.arrayContaining([
        "define-event-dispatch-contract",
        "own-listener-registration-lifecycle",
      ]),
    );
    expect(recipe?.steps.map((step) => step.action).join("\n")).toContain("ignoreCancelled = true");
    expect(recipe?.finalChecks).toContain("paper-event-listener-semantics-safety");

    const checklists = readDataJson<{
      checklists: Array<{ domain: string; steps: Array<{ id: string }> }>;
    }>("authoring-checklists.json");
    expect(
      checklists.checklists
        .find((checklist) => checklist.domain === "paper-plugin")
        ?.steps.map((step) => step.id),
    ).toContain("design-event-dispatch-and-registration");

    const guardrails = readDataJson<{
      guardrails: Array<{ id: string; rules: string[] }>;
    }>("authoring-guardrails.json");
    const guardrail = guardrails.guardrails.find(
      (entry) => entry.id === "paper-event-listener-semantics-safety",
    );
    expect(guardrail?.rules.join("\n")).toContain("MONITOR only to observe");
    expect(guardrail?.rules.join("\n")).toContain("in-flight handler snapshot");

    const diagnostics = readDataJson<{
      diagnostics: Array<{ id: string; failIf: string[] }>;
    }>("authoring-diagnostics.json");
    const diagnostic = diagnostics.diagnostics.find(
      (entry) => entry.id === "paper-event-listener-semantics-unsafe",
    );
    expect(diagnostic?.failIf.join("\n")).toContain("global HandlerList.unregisterAll()");
    expect(diagnostic?.failIf.join("\n")).toContain("in-flight callback");

    expect(readDataText("skills/minecraft-paper-plugins/SKILL.md")).toContain(
      "prior-cancellation behavior",
    );
  });

  it("bundles complete Paper inventory GUI lifecycle safety guidance", () => {
    const recipes = readDataJson<{
      recipes: Array<{
        id: string;
        steps: Array<{ id: string; action: string; stopIfMissing: string }>;
      }>;
    }>("authoring-recipes.json");
    const recipe = recipes.recipes.find((entry) => entry.id === "paper-inventory-gui-interactions");
    expect(recipe?.steps.map((step) => step.id)).toContain("settle-editable-session-exactly-once");
    expect(recipe?.steps.map((step) => step.action).join("\n")).toContain(
      "InventoryCloseEvent handlers",
    );
    expect(recipe?.steps.map((step) => step.stopIfMissing).join("\n")).toContain(
      "deprecated InventoryClickEvent.setCursor",
    );

    const guardrails = readDataJson<{
      guardrails: Array<{ id: string; rules: string[]; requiredEvidence: string[] }>;
    }>("authoring-guardrails.json");
    const guardrail = guardrails.guardrails.find(
      (entry) => entry.id === "paper-inventory-gui-interaction-safety",
    );
    expect(guardrail?.rules.join("\n")).toContain("exactly once");
    expect(guardrail?.rules.join("\n")).toContain("explicit overflow outcome");
    expect(guardrail?.requiredEvidence.join("\n")).toContain("repeated close callbacks");

    const diagnostics = readDataJson<{
      diagnostics: Array<{ id: string; requiredChecks: string[]; failIf: string[] }>;
    }>("authoring-diagnostics.json");
    const diagnostic = diagnostics.diagnostics.find(
      (entry) => entry.id === "paper-inventory-gui-interaction-unbounded",
    );
    expect(diagnostic?.requiredChecks.join("\n")).toContain("inserted and uninserted stacks");
    expect(diagnostic?.failIf.join("\n")).toContain("InventoryCloseEvent handling");
    expect(diagnostic?.failIf.join("\n")).toContain("repeated callbacks");

    const scenarios = readDataJson<{
      scenarios: Array<{ id: string; successCriteria: string[]; mustAvoid: string[] }>;
    }>("authoring-scenarios.json");
    const scenario = scenarios.scenarios.find(
      (entry) => entry.id === "paper-inventory-gui-interaction-review",
    );
    expect(scenario?.successCriteria.join("\n")).toContain("exactly once");
    expect(scenario?.mustAvoid.join("\n")).toContain("deprecated InventoryClickEvent.setCursor");
  });

  it("loads Paper player identity and display guidance", () => {
    const recipes = readDataJson<{
      recipes: Array<{ id: string; steps: Array<{ id: string }>; finalChecks: string[] }>;
    }>("authoring-recipes.json");
    const recipe = recipes.recipes.find(
      (entry) => entry.id === "paper-player-identity-and-display",
    );
    expect(recipe?.steps.map((step) => step.id)).toContain("persist-and-resolve-stable-identity");
    expect(recipe?.finalChecks).toContain("paper-player-identity-and-display");

    const scenarios = readDataJson<{
      scenarios: Array<{
        id: string;
        requiredLookups: { recipes: string[]; diagnostics: string[] };
      }>;
    }>("authoring-scenarios.json");
    const scenario = scenarios.scenarios.find(
      (entry) => entry.id === "paper-player-identity-and-display-review",
    );
    expect(scenario?.requiredLookups.recipes).toEqual(["paper-player-identity-and-display"]);
    expect(scenario?.requiredLookups.diagnostics).toContain(
      "paper-player-identity-display-confusion",
    );

    const guardrails = readDataJson<{ guardrails: Array<{ id: string; rules: string[] }> }>(
      "authoring-guardrails.json",
    );
    expect(
      guardrails.guardrails.find((entry) => entry.id === "paper-player-identity-and-display")
        ?.rules,
    ).toEqual(expect.arrayContaining([expect.stringContaining("stable player identifier")]));

    const diagnostics = readDataJson<{
      diagnostics: Array<{ id: string; severity: string; failIf: string[] }>;
    }>("authoring-diagnostics.json");
    const diagnostic = diagnostics.diagnostics.find(
      (entry) => entry.id === "paper-player-identity-display-confusion",
    );
    expect(diagnostic?.severity).toBe("error");
    expect(diagnostic?.failIf).toEqual(
      expect.arrayContaining([expect.stringContaining("only persistent player key")]),
    );
  });

  it("loads complete Paper persistent data contract guidance", () => {
    const checklists = readDataJson<{
      checklists: Array<{ domain: string; steps: Array<{ id: string; evidence: string[] }> }>;
    }>("authoring-checklists.json");
    const paperChecklist = checklists.checklists.find((entry) => entry.domain === "paper-plugin");
    expect(paperChecklist?.steps.map((step) => step.id)).toContain(
      "define-persistent-data-contract",
    );

    const recipes = readDataJson<{
      recipes: Array<{
        id: string;
        steps: Array<{ id: string; action: string; evidence: string[] }>;
        finalChecks: string[];
      }>;
    }>("authoring-recipes.json");
    const recipe = recipes.recipes.find((entry) => entry.id === "paper-persistent-data-contract");
    expect(recipe?.steps.map((step) => step.id)).toEqual(
      expect.arrayContaining([
        "define-owned-keys-types-and-bounds",
        "match-holder-lifetime-and-publication",
        "migrate-replace-copy-and-remove-safely",
        "test-storage-contract-and-recovery",
      ]),
    );
    const actions = recipe?.steps.map((step) => step.action).join("\n") ?? "";
    expect(actions).toContain("has(key, type), which checks only the stored primitive type");
    expect(actions).toContain("holder snapshot");
    expect(actions).toContain("copyTo copies custom keys");
    expect(actions).toContain("advance the version only after success");
    expect(actions).toContain("ItemStack logical identity");
    expect(recipe?.finalChecks).toContain("paper-persistent-data-contract");

    const scenarios = readDataJson<{
      scenarios: Array<{
        id: string;
        requiredLookups: { recipes: string[]; diagnostics: string[] };
        successCriteria: string[];
        mustAvoid: string[];
      }>;
    }>("authoring-scenarios.json");
    const scenario = scenarios.scenarios.find(
      (entry) => entry.id === "paper-persistent-data-contract-review",
    );
    expect(scenario?.requiredLookups.recipes).toEqual(["paper-persistent-data-contract"]);
    expect(scenario?.requiredLookups.diagnostics).toContain(
      "paper-persistent-data-contract-unsafe",
    );
    expect(scenario?.successCriteria.join("\n")).toContain("unsupported-future");
    expect(scenario?.mustAvoid.join("\n")).toContain("logical identity");

    const guardrails = readDataJson<{
      guardrails: Array<{ id: string; rules: string[]; requiredEvidence: string[] }>;
    }>("authoring-guardrails.json");
    const guardrail = guardrails.guardrails.find(
      (entry) => entry.id === "paper-persistent-data-contract",
    );
    expect(guardrail?.rules.join("\n")).toContain("primitive-type matching only");
    expect(guardrail?.rules.join("\n")).toContain("Use copyTo only");
    expect(guardrail?.rules.join("\n")).toContain("do not describe PDC as transactional");

    const diagnostics = readDataJson<{
      diagnostics: Array<{
        id: string;
        severity: string;
        requiredChecks: string[];
        failIf: string[];
      }>;
    }>("authoring-diagnostics.json");
    const diagnostic = diagnostics.diagnostics.find(
      (entry) => entry.id === "paper-persistent-data-contract-unsafe",
    );
    expect(diagnostic?.severity).toBe("error");
    expect(diagnostic?.requiredChecks.join("\n")).toContain("custom adapter payload lengths");
    expect(diagnostic?.failIf.join("\n")).toContain("set receives null as deletion");
    expect(diagnostic?.failIf.join("\n")).toContain("unsupported-future record");
  });

  it("loads complete Paper ItemStack semantic identity guidance", () => {
    const checklists = readDataJson<{
      checklists: Array<{ domain: string; steps: Array<{ id: string; evidence: string[] }> }>;
    }>("authoring-checklists.json");
    const paperChecklist = checklists.checklists.find((entry) => entry.domain === "paper-plugin");
    expect(paperChecklist?.steps.map((step) => step.id)).toContain(
      "separate-item-identity-presentation-and-migration",
    );

    const recipes = readDataJson<{
      recipes: Array<{
        id: string;
        steps: Array<{ id: string; action: string; evidence: string[] }>;
        finalChecks: string[];
      }>;
    }>("authoring-recipes.json");
    const recipe = recipes.recipes.find(
      (entry) => entry.id === "paper-itemstack-semantic-identity",
    );
    expect(recipe?.steps.map((step) => step.id)).toEqual(
      expect.arrayContaining([
        "define-logical-identity-and-version",
        "refresh-only-owned-presentation",
        "migrate-deterministically-and-idempotently",
      ]),
    );
    expect(recipe?.steps.map((step) => step.action).join("\n")).toContain(
      "unknown items must be returned untouched",
    );
    expect(recipe?.steps.flatMap((step) => step.evidence).join("\n")).toContain(
      "duplicate-lore test",
    );
    expect(recipe?.steps.map((step) => step.action).join("\n")).toContain(
      "whole-field ownership or a persisted structural composition contract",
    );
    expect(recipe?.finalChecks).toContain("paper-itemstack-semantic-identity");

    const scenarios = readDataJson<{
      scenarios: Array<{
        id: string;
        requiredLookups: { recipes: string[]; diagnostics: string[] };
        successCriteria: string[];
      }>;
    }>("authoring-scenarios.json");
    const scenario = scenarios.scenarios.find(
      (entry) => entry.id === "paper-itemstack-semantic-identity-review",
    );
    expect(scenario?.requiredLookups.recipes).toEqual(["paper-itemstack-semantic-identity"]);
    expect(scenario?.requiredLookups.diagnostics).toContain(
      "paper-itemstack-identity-or-state-loss",
    );
    expect(scenario?.successCriteria.join("\n")).toContain("similarity");
    expect(scenario?.successCriteria.join("\n")).toContain("all out-of-scope state");

    const guardrails = readDataJson<{
      guardrails: Array<{ id: string; rules: string[]; requiredEvidence: string[] }>;
    }>("authoring-guardrails.json");
    const guardrail = guardrails.guardrails.find(
      (entry) => entry.id === "paper-itemstack-semantic-identity",
    );
    expect(guardrail?.rules.join("\n")).toContain("all unowned PDC entries");
    expect(guardrail?.rules.join("\n")).toContain("Write a new version only after");
    expect(guardrail?.requiredEvidence.join("\n")).toContain("unknown-item");

    const diagnostics = readDataJson<{
      diagnostics: Array<{
        id: string;
        severity: string;
        requiredChecks: string[];
        failIf: string[];
      }>;
    }>("authoring-diagnostics.json");
    const diagnostic = diagnostics.diagnostics.find(
      (entry) => entry.id === "paper-itemstack-identity-or-state-loss",
    );
    expect(diagnostic?.severity).toBe("error");
    expect(diagnostic?.requiredChecks.join("\n")).toContain("repeat-migration");
    expect(diagnostic?.failIf.join("\n")).toContain("possibly aliased ItemStack");
    expect(diagnostic?.failIf.join("\n")).toContain("unrelated-state preservation");
  });

  it("loads complete Paper display interaction contract guidance", () => {
    const checklists = readDataJson<{
      checklists: Array<{ domain: string; steps: Array<{ id: string; evidence: string[] }> }>;
    }>("authoring-checklists.json");
    const paperChecklist = checklists.checklists.find((entry) => entry.domain === "paper-plugin");
    expect(paperChecklist?.steps.map((step) => step.id)).toContain(
      "define-display-interaction-contract",
    );

    const recipes = readDataJson<{
      recipes: Array<{
        id: string;
        steps: Array<{ id: string; action: string; evidence: string[]; stopIfMissing: string }>;
        finalChecks: string[];
      }>;
    }>("authoring-recipes.json");
    const recipe = recipes.recipes.find(
      (entry) => entry.id === "paper-display-interaction-contract",
    );
    expect(recipe?.steps.map((step) => step.id)).toEqual(
      expect.arrayContaining([
        "verify-target-display-and-interaction-surfaces",
        "derive-visuals-and-hit-targets-from-one-layout",
        "publish-and-reconcile-owned-entity-pairs",
        "route-one-interaction-to-one-logical-element",
        "test-layout-lifecycle-and-client-result",
      ]),
    );
    const actions = recipe?.steps.map((step) => step.action).join("\n") ?? "";
    expect(actions).toContain("ItemDisplay model origin");
    expect(actions).toContain("display width or height");
    expect(actions).toContain("setPersistent(false)");
    expect(actions).toContain("spuriously in addition to the parent event");
    expect(actions).toContain("Never place an unregistered or pending Interaction");
    expect(JSON.stringify(recipe)).not.toContain("jd.papermc.io/paper/1.21.11");
    expect(actions).toContain("dedicated guidance");
    expect(recipe?.steps.flatMap((step) => step.evidence).join("\n")).toContain(
      "https://docs.papermc.io/paper/dev/display-entities/",
    );
    expect(recipe?.finalChecks).toContain("paper-display-interaction-contract");

    const scenarios = readDataJson<{
      scenarios: Array<{
        id: string;
        requiredLookups: { recipes: string[]; diagnostics: string[] };
        successCriteria: string[];
        mustAvoid: string[];
      }>;
    }>("authoring-scenarios.json");
    const scenario = scenarios.scenarios.find(
      (entry) => entry.id === "paper-display-interaction-contract-review",
    );
    expect(scenario?.requiredLookups.recipes).toEqual([
      "paper-display-interaction-contract",
      "paper-event-listener",
    ]);
    expect(scenario?.requiredLookups.diagnostics).toContain(
      "paper-display-interaction-contract-unsafe",
    );
    expect(scenario?.successCriteria.join("\n")).toContain("same layout result");
    expect(scenario?.mustAvoid.join("\n")).toContain("persistent-data");

    const guardrails = readDataJson<{
      guardrails: Array<{ id: string; rules: string[]; requiredEvidence: string[] }>;
    }>("authoring-guardrails.json");
    const guardrail = guardrails.guardrails.find(
      (entry) => entry.id === "paper-display-interaction-contract",
    );
    expect(guardrail?.rules.join("\n")).toContain("derive each display and hit-target");
    expect(guardrail?.rules.join("\n")).toContain("never-unloading chunk");
    expect(guardrail?.rules.join("\n")).toContain("pending Interaction outside live input space");
    expect(guardrail?.rules.join("\n")).toContain("possible extra delivery");

    const diagnostics = readDataJson<{
      diagnostics: Array<{
        id: string;
        severity: string;
        requiredChecks: string[];
        failIf: string[];
      }>;
    }>("authoring-diagnostics.json");
    const diagnostic = diagnostics.diagnostics.find(
      (entry) => entry.id === "paper-display-interaction-contract-unsafe",
    );
    expect(diagnostic?.severity).toBe("error");
    expect(diagnostic?.requiredChecks.join("\n")).toContain(
      "paired display and Interaction specifications",
    );
    expect(diagnostic?.failIf.join("\n")).toContain("both parent and position-specific");
    expect(diagnostic?.failIf.join("\n")).toContain("foreign Display or Interaction entities");
    expect(diagnostic?.failIf.join("\n")).toContain(
      "unregistered or pending Interaction can receive live input",
    );
  });

  it("loads Paper player-session lifecycle safety guidance", () => {
    const recipes = readDataJson<{
      recipes: Array<{ id: string; steps: Array<{ id: string }>; finalChecks: string[] }>;
    }>("authoring-recipes.json");
    const recipe = recipes.recipes.find((entry) => entry.id === "paper-player-session-lifecycle");
    expect(recipe?.steps.map((step) => step.id)).toEqual(
      expect.arrayContaining([
        "separate-durable-data-from-session-state",
        "reject-stale-asynchronous-publication",
        "bound-durable-flush-and-shutdown",
      ]),
    );
    expect(recipe?.finalChecks).toContain("paper-player-session-lifecycle-safety");

    const scenarios = readDataJson<{
      scenarios: Array<{
        id: string;
        requiredLookups: { recipes: string[]; diagnostics: string[] };
        mustAvoid: string[];
      }>;
    }>("authoring-scenarios.json");
    const scenario = scenarios.scenarios.find(
      (entry) => entry.id === "paper-player-session-lifecycle-review",
    );
    expect(scenario?.requiredLookups.recipes).toEqual(["paper-player-session-lifecycle"]);
    expect(scenario?.requiredLookups.diagnostics).toContain(
      "paper-player-session-lifecycle-unsafe",
    );
    expect(scenario?.mustAvoid.join("\n")).toContain("inventory contents");

    const guardrails = readDataJson<{ guardrails: Array<{ id: string; rules: string[] }> }>(
      "authoring-guardrails.json",
    );
    expect(
      guardrails.guardrails.find((entry) => entry.id === "paper-player-session-lifecycle-safety")
        ?.rules,
    ).toEqual(expect.arrayContaining([expect.stringContaining("session instance or generation")]));

    const diagnostics = readDataJson<{
      diagnostics: Array<{ id: string; severity: string; failIf: string[] }>;
    }>("authoring-diagnostics.json");
    const diagnostic = diagnostics.diagnostics.find(
      (entry) => entry.id === "paper-player-session-lifecycle-unsafe",
    );
    expect(diagnostic?.severity).toBe("error");
    expect(diagnostic?.failIf).toEqual(
      expect.arrayContaining([expect.stringContaining("fire-and-forget persistence")]),
    );
  });

  it("loads Paper high-frequency persistence contention guidance", () => {
    const recipes = readDataJson<{
      recipes: Array<{
        id: string;
        steps: Array<{ id: string; action: string; evidence: string[] }>;
        finalChecks: string[];
      }>;
    }>("authoring-recipes.json");
    const recipe = recipes.recipes.find((entry) => entry.id === "paper-high-frequency-persistence");
    expect(recipe?.steps.map((step) => step.id)).toEqual(
      expect.arrayContaining([
        "model-rate-durability-and-ordering",
        "choose-direct-or-coalesced-writes",
        "isolate-io-and-bound-admission",
        "flush-with-exact-accounting",
        "retry-only-verified-whole-transactions",
        "shut-down-recover-and-observe",
        "prove-contention-and-route-session-cleanup",
      ]),
    );
    expect(recipe?.steps.flatMap((step) => step.evidence).join("\n")).toContain(
      "Real-adapter contention evidence",
    );
    expect(recipe?.steps.map((step) => step.action).join("\n")).toContain(
      "paper-player-session-lifecycle",
    );
    expect(recipe?.finalChecks).toContain("paper-high-frequency-persistence-safety");

    const scenarios = readDataJson<{
      scenarios: Array<{
        id: string;
        requiredLookups: { recipes: string[]; diagnostics: string[] };
        successCriteria: string[];
      }>;
    }>("authoring-scenarios.json");
    const scenario = scenarios.scenarios.find(
      (entry) => entry.id === "paper-high-frequency-persistence-review",
    );
    expect(scenario?.requiredLookups.recipes).toEqual(["paper-high-frequency-persistence"]);
    expect(scenario?.requiredLookups.diagnostics).toContain(
      "paper-high-frequency-persistence-unsafe",
    );
    expect(scenario?.successCriteria.join("\n")).toContain("real-adapter contention tests");

    const guardrails = readDataJson<{
      guardrails: Array<{ id: string; rules: string[]; requiredEvidence: string[] }>;
    }>("authoring-guardrails.json");
    const guardrail = guardrails.guardrails.find(
      (entry) => entry.id === "paper-high-frequency-persistence-safety",
    );
    expect(guardrail?.rules.join("\n")).toContain("fresh transaction");
    expect(guardrail?.requiredEvidence.join("\n")).toContain("real-adapter contention tests");

    const diagnostics = readDataJson<{
      diagnostics: Array<{ id: string; severity: string; failIf: string[] }>;
    }>("authoring-diagnostics.json");
    const diagnostic = diagnostics.diagnostics.find(
      (entry) => entry.id === "paper-high-frequency-persistence-unsafe",
    );
    expect(diagnostic?.severity).toBe("error");
    expect(diagnostic?.failIf.join("\n")).toContain("unknown commit outcome");
    expect(diagnostic?.failIf.join("\n")).toContain("real database adapter and driver");

    const checklists = readDataJson<{
      checklists: Array<{ domain: string; steps: Array<{ id: string; evidence: string[] }> }>;
    }>("authoring-checklists.json");
    const checklistStep = checklists.checklists
      .find((entry) => entry.domain === "paper-plugin")
      ?.steps.find((step) => step.id === "bound-high-frequency-persistence");
    expect(checklistStep?.evidence.join("\n")).toContain(
      "database-and-driver-verified serialization or deadlock conflicts",
    );
  });

  it("loads complete Paper BossBar audience lifecycle guidance", () => {
    const recipes = readDataJson<{
      recipes: Array<{
        id: string;
        steps: Array<{ id: string; action: string; evidence: string[]; stopIfMissing: string }>;
        finalChecks: string[];
      }>;
    }>("authoring-recipes.json");
    const recipe = recipes.recipes.find((entry) => entry.id === "paper-bossbar-audience-lifecycle");
    expect(recipe?.steps.map((step) => step.id)).toEqual(
      expect.arrayContaining([
        "select-a-stable-winner-with-hysteresis",
        "reconcile-an-authoritative-viewer-set-by-diff",
        "serialize-bounded-revisioned-updates",
        "terminally-hide-detach-and-drop-the-generation",
        "test-races-reconcile-leaks-and-report-limits",
      ]),
    );
    expect(recipe?.steps.map((step) => step.action).join("\n")).toContain(
      "current-minus-desired removals",
    );
    expect(recipe?.steps.map((step) => step.action).join("\n")).toContain("priority switch margin");
    expect(recipe?.steps.flatMap((step) => step.evidence).join("\n")).toContain(
      "rapid enter and leave",
    );
    expect(recipe?.steps.map((step) => step.stopIfMissing).join("\n")).toContain("starve cleanup");
    expect(recipe?.finalChecks).toEqual(
      expect.arrayContaining([
        "paper-bossbar-audience-lifecycle-safety",
        "paper-player-session-lifecycle-safety",
        "paper-plugin-testing-evidence",
      ]),
    );

    const scenarios = readDataJson<{
      scenarios: Array<{
        id: string;
        requiredLookups: { recipes: string[]; diagnostics: string[] };
        successCriteria: string[];
        mustAvoid: string[];
      }>;
    }>("authoring-scenarios.json");
    const scenario = scenarios.scenarios.find(
      (entry) => entry.id === "paper-bossbar-audience-lifecycle-review",
    );
    expect(scenario?.requiredLookups.recipes).toEqual(
      expect.arrayContaining(["paper-bossbar-audience-lifecycle", "paper-plugin-testing-evidence"]),
    );
    expect(scenario?.requiredLookups.diagnostics).toContain(
      "paper-bossbar-audience-lifecycle-unsafe",
    );
    const successCriteria = scenario?.successCriteria.join("\n") ?? "";
    expect(successCriteria).toContain("backend transfer");
    expect(successCriteria).toContain("repeated disable");
    expect(successCriteria).toContain("zero attached viewers");
    expect(successCriteria).toContain("stale generations and revisions");
    const excludedScope = scenario?.mustAvoid.join("\n") ?? "";
    expect(excludedScope).toContain("one non-owning viewer session ends");
    expect(excludedScope).toContain("ModelEngine");
    expect(excludedScope).toContain("vanilla /bossbar command authoring");

    const guardrails = readDataJson<{
      guardrails: Array<{ id: string; rules: string[]; requiredEvidence: string[] }>;
    }>("authoring-guardrails.json");
    const guardrail = guardrails.guardrails.find(
      (entry) => entry.id === "paper-bossbar-audience-lifecycle-safety",
    );
    expect(guardrail?.rules.join("\n")).toContain("exactly one plugin-owned current generation");
    expect(guardrail?.rules.join("\n")).toContain("desired viewer identity set as authoritative");
    expect(guardrail?.rules.join("\n")).toContain("distributed ownership");
    expect(guardrail?.requiredEvidence.join("\n")).toContain("zero viewer leaks");

    const diagnostics = readDataJson<{
      diagnostics: Array<{
        id: string;
        severity: string;
        requiredChecks: string[];
        failIf: string[];
      }>;
    }>("authoring-diagnostics.json");
    const diagnostic = diagnostics.diagnostics.find(
      (entry) => entry.id === "paper-bossbar-audience-lifecycle-unsafe",
    );
    expect(diagnostic?.severity).toBe("error");
    expect(diagnostic?.requiredChecks.join("\n")).toContain("monotonic revision");
    expect(diagnostic?.failIf.join("\n")).toContain("repeatedly adds viewers");
    expect(diagnostic?.failIf.join("\n")).toContain("rapid reconnect");
    expect(diagnostic?.failIf.join("\n")).toContain("only bar handle");
  });

  it("loads complete Paper plugin configuration lifecycle guidance", () => {
    const recipes = readDataJson<{
      recipes: Array<{
        id: string;
        steps: Array<{ id: string; evidence: string[]; stopIfMissing: string }>;
        finalChecks: string[];
      }>;
    }>("authoring-recipes.json");
    const recipe = recipes.recipes.find(
      (entry) => entry.id === "paper-plugin-configuration-lifecycle",
    );
    expect(recipe?.steps.map((step) => step.id)).toEqual(
      expect.arrayContaining([
        "stage-and-validate-startup-state",
        "reload-through-prepare-commit-and-retire",
        "persist-without-clobbering-operator-input",
      ]),
    );
    expect(recipe?.steps.flatMap((step) => step.evidence).join("\n")).toContain(
      "last-known-good test",
    );
    expect(recipe?.steps.map((step) => step.stopIfMissing).join("\n")).toContain("saveConfig");
    expect(recipe?.finalChecks).toContain("paper-plugin-configuration-lifecycle-safety");

    const scenarios = readDataJson<{
      scenarios: Array<{
        id: string;
        requiredLookups: { recipes: string[]; diagnostics: string[] };
        mustAvoid: string[];
      }>;
    }>("authoring-scenarios.json");
    const scenario = scenarios.scenarios.find(
      (entry) => entry.id === "paper-plugin-configuration-lifecycle-review",
    );
    expect(scenario?.requiredLookups.recipes).toEqual(["paper-plugin-configuration-lifecycle"]);
    expect(scenario?.requiredLookups.diagnostics).toContain(
      "paper-plugin-configuration-lifecycle-unsafe",
    );
    expect(scenario?.mustAvoid.join("\n")).toContain("deprecated server-wide reload");

    const guardrails = readDataJson<{ guardrails: Array<{ id: string; rules: string[] }> }>(
      "authoring-guardrails.json",
    );
    const guardrail = guardrails.guardrails.find(
      (entry) => entry.id === "paper-plugin-configuration-lifecycle-safety",
    );
    expect(guardrail?.rules.join("\n")).toContain("monotonic revisions");
    expect(guardrail?.rules.join("\n")).toContain("last known good snapshot");

    const diagnostics = readDataJson<{
      diagnostics: Array<{ id: string; severity: string; failIf: string[] }>;
    }>("authoring-diagnostics.json");
    const diagnostic = diagnostics.diagnostics.find(
      (entry) => entry.id === "paper-plugin-configuration-lifecycle-unsafe",
    );
    expect(diagnostic?.severity).toBe("error");
    expect(diagnostic?.failIf.join("\n")).toContain("older slow reload");
    expect(diagnostic?.failIf.join("\n")).toContain("stale in-memory state");
  });

  it("loads Paper scheduled-task lifecycle safety guidance", () => {
    const recipes = readDataJson<{
      recipes: Array<{
        id: string;
        steps: Array<{ id: string; action: string; stopIfMissing: string }>;
        finalChecks: string[];
      }>;
    }>("authoring-recipes.json");
    const recipe = recipes.recipes.find((entry) => entry.id === "paper-scheduled-task-lifecycle");
    expect(recipe?.steps.map((step) => step.id)).toEqual(
      expect.arrayContaining([
        "assign-task-ownership-and-generation",
        "separate-background-work-from-api-publication",
        "cancel-and-fence-teardown",
        "test-ordering-cancellation-and-disable",
      ]),
    );
    expect(recipe?.steps.map((step) => step.stopIfMissing).join("\n")).toContain("already-running");
    expect(recipe?.finalChecks).toContain("paper-scheduled-task-lifecycle-safety");

    const scenarios = readDataJson<{
      scenarios: Array<{
        id: string;
        requiredLookups: { recipes: string[]; diagnostics: string[] };
        mustAvoid: string[];
      }>;
    }>("authoring-scenarios.json");
    const scenario = scenarios.scenarios.find(
      (entry) => entry.id === "paper-scheduled-task-lifecycle-review",
    );
    expect(scenario?.requiredLookups.recipes).toEqual(["paper-scheduled-task-lifecycle"]);
    expect(scenario?.requiredLookups.diagnostics).toContain(
      "paper-scheduled-task-lifecycle-unsafe",
    );
    expect(scenario?.mustAvoid.join("\n")).toContain("custom executors");

    const checklists = readDataJson<{
      checklists: Array<{ domain: string; steps: Array<{ id: string; evidence: string[] }> }>;
    }>("authoring-checklists.json");
    const checklist = checklists.checklists.find((entry) => entry.domain === "paper-plugin");
    expect(checklist?.steps.map((step) => step.id)).toContain(
      "own-scheduled-work-through-teardown",
    );
    expect(checklist?.steps.flatMap((step) => step.evidence).join("\n")).toContain(
      "late-publication fence",
    );

    const guardrails = readDataJson<{ guardrails: Array<{ id: string; rules: string[] }> }>(
      "authoring-guardrails.json",
    );
    const guardrail = guardrails.guardrails.find(
      (entry) => entry.id === "paper-scheduled-task-lifecycle-safety",
    );
    expect(guardrail?.rules.join("\n")).toContain("already-running callback");
    expect(guardrail?.rules.join("\n")).toContain("custom executors");

    const diagnostics = readDataJson<{
      diagnostics: Array<{ id: string; severity: string; failIf: string[] }>;
    }>("authoring-diagnostics.json");
    const diagnostic = diagnostics.diagnostics.find(
      (entry) => entry.id === "paper-scheduled-task-lifecycle-unsafe",
    );
    expect(diagnostic?.severity).toBe("error");
    expect(diagnostic?.failIf.join("\n")).toContain("already-running callback");
    expect(diagnostic?.failIf.join("\n")).toContain("prohibited scheduler Future wait");
  });

  it("loads complete Paper plugin testing evidence guidance", () => {
    const recipes = readDataJson<{
      recipes: Array<{
        id: string;
        steps: Array<{ id: string; evidence: string[]; stopIfMissing: string }>;
      }>;
    }>("authoring-recipes.json");
    const recipe = recipes.recipes.find((entry) => entry.id === "paper-plugin-testing-evidence");
    expect(recipe?.steps.map((step) => step.id)).toContain(
      "choose-the-minimum-sufficient-evidence-layer",
    );
    expect(recipe?.steps.flatMap((step) => step.evidence).join("\n")).toContain(
      "loaded-server test",
    );
    expect(recipe?.steps.map((step) => step.stopIfMissing).join("\n")).toContain("MockBukkit");

    const scenarios = readDataJson<{
      scenarios: Array<{
        id: string;
        requiredLookups: { recipes: string[]; diagnostics: string[] };
        mustAvoid: string[];
      }>;
    }>("authoring-scenarios.json");
    const scenario = scenarios.scenarios.find(
      (entry) => entry.id === "paper-plugin-testing-evidence-review",
    );
    expect(scenario?.requiredLookups.recipes).toEqual(["paper-plugin-testing-evidence"]);
    expect(scenario?.requiredLookups.diagnostics).toContain("paper-plugin-test-evidence-gap");
    expect(scenario?.mustAvoid.join("\n")).toContain("Thread.sleep");

    const guardrails = readDataJson<{ guardrails: Array<{ id: string; rules: string[] }> }>(
      "authoring-guardrails.json",
    );
    const guardrail = guardrails.guardrails.find(
      (entry) => entry.id === "paper-plugin-testing-evidence",
    );
    expect(guardrail?.rules.join("\n")).toContain("type-compatibility evidence only");
    expect(guardrail?.rules.join("\n")).toContain("protocol oracle for packet transport");
    expect(guardrail?.rules.join("\n")).toContain("real instrumented client");

    const diagnostics = readDataJson<{
      diagnostics: Array<{ id: string; severity: string; failIf: string[] }>;
    }>("authoring-diagnostics.json");
    const diagnostic = diagnostics.diagnostics.find(
      (entry) => entry.id === "paper-plugin-test-evidence-gap",
    );
    expect(diagnostic?.severity).toBe("error");
    expect(diagnostic?.failIf.join("\n")).toContain("loaded-plugin evidence");
  });

  it("loads complete Fabric Client GameTest visual evidence guidance", () => {
    const recipes = readDataJson<{
      recipes: Array<{
        id: string;
        domains: string[];
        steps: Array<{ id: string; action: string; evidence: string[] }>;
        finalChecks: string[];
      }>;
    }>("authoring-recipes.json");
    const recipe = recipes.recipes.find(
      (entry) => entry.id === "fabric-client-gametest-visual-evidence",
    );
    expect(recipe?.domains).toEqual(["resourcepack"]);
    expect(recipe?.steps.map((step) => step.id)).toEqual([
      "define-stable-cases-and-readiness",
      "record-selection-without-overclaiming",
      "capture-full-frames-and-verified-crops",
      "separate-compare-and-baseline-update-runs",
      "reconcile-artifacts-and-failure-phases",
      "report-environment-and-evidence-limits",
    ]);
    expect(recipe?.steps.map((step) => step.action).join("\n")).toContain(
      "selected, executed, passed, failed, skipped, and not-selected sets",
    );
    expect(recipe?.steps.map((step) => step.action).join("\n")).toContain("full client frame");
    expect(
      recipe?.steps.find((step) => step.id === "capture-full-frames-and-verified-crops")?.action,
    ).toContain("primary failure occurs before or during capture may have no frame");
    expect(recipe?.steps.flatMap((step) => step.evidence).join("\n")).toContain(
      "phase-aware expected-absence record",
    );
    expect(recipe?.steps.map((step) => step.action).join("\n")).toContain(
      "mutually exclusive run types",
    );
    expect(recipe?.steps.flatMap((step) => step.evidence).join("\n")).toContain(
      "https://docs.fabricmc.net/develop/automatic-testing",
    );
    expect(recipe?.finalChecks).toEqual([
      "fabric-client-gametest-visual-evidence-integrity",
      "fabric-client-visual-evidence-claim",
      "fabric-client-visual-evidence-report",
    ]);
    const scenarios = readDataJson<{
      scenarios: Array<{
        id: string;
        domains: string[];
        requiredLookups: {
          recipes: string[];
          intents: string[];
          diagnostics: string[];
          claimPolicies: string[];
          factSurfaces: string[];
          responsePatterns: string[];
        };
        mustAvoid: string[];
      }>;
    }>("authoring-scenarios.json");
    const scenario = scenarios.scenarios.find(
      (entry) => entry.id === "fabric-client-gametest-visual-evidence-review",
    );
    expect(scenario?.domains).toEqual(["resourcepack"]);
    expect(scenario?.requiredLookups.recipes).toEqual(["fabric-client-gametest-visual-evidence"]);
    expect(scenario?.requiredLookups.intents).toEqual(["verify-fabric-client-visual-evidence"]);
    expect(scenario?.requiredLookups.diagnostics).toEqual([
      "fabric-client-gametest-visual-evidence-gap",
    ]);
    expect(scenario?.requiredLookups.claimPolicies).toEqual([
      "fabric-client-visual-evidence-claim",
    ]);
    expect(scenario?.requiredLookups.factSurfaces).toEqual(["java-version-metadata"]);
    expect(scenario?.requiredLookups.responsePatterns).toEqual(["verified-authoring-answer"]);
    expect(scenario?.mustAvoid.join("\n")).toContain("Paper or server GameTest");

    const guardrails = readDataJson<{
      guardrails: Array<{ id: string; domains: string[]; rules: string[] }>;
    }>("authoring-guardrails.json");
    const guardrail = guardrails.guardrails.find(
      (entry) => entry.id === "fabric-client-gametest-visual-evidence-integrity",
    );
    expect(guardrail?.domains).toEqual(["resourcepack"]);
    expect(guardrail?.rules.join("\n")).toContain("runtime-derived zero-based half-open bounds");
    expect(guardrail?.rules.join("\n")).toContain("missing, stale, duplicate, or unexpected");

    const diagnostics = readDataJson<{
      diagnostics: Array<{ id: string; domains: string[]; severity: string; failIf: string[] }>;
    }>("authoring-diagnostics.json");
    const diagnostic = diagnostics.diagnostics.find(
      (entry) => entry.id === "fabric-client-gametest-visual-evidence-gap",
    );
    expect(diagnostic?.domains).toEqual(["resourcepack"]);
    expect(diagnostic?.severity).toBe("error");
    expect(diagnostic?.failIf.join("\n")).toContain("virtual-framebuffer output");

    const intents = readDataJson<{
      intents: Array<{ id: string; domains: string[]; lookups: Array<{ purpose: string }> }>;
    }>("intent-lookups.json");
    const intent = intents.intents.find(
      (entry) => entry.id === "verify-fabric-client-visual-evidence",
    );
    expect(intent?.domains).toEqual(["resourcepack"]);
    expect(intent?.lookups.map((lookup) => lookup.purpose).join("\n")).toContain(
      "final-report contract",
    );

    const policies = readDataJson<{
      policies: Array<{ id: string; domains: string[]; disallowedWording: string[] }>;
    }>("claim-policies.json");
    const policy = policies.policies.find(
      (entry) => entry.id === "fabric-client-visual-evidence-claim",
    );
    expect(policy?.domains).toEqual(["resourcepack"]);
    expect(policy?.disallowedWording.join("\n")).toContain("update run completed");

    const requirements = readDataJson<{
      requirements: Array<{ id: string; domains: string[]; mustInclude: string[] }>;
    }>("output-requirements.json");
    const requirement = requirements.requirements.find(
      (entry) => entry.id === "fabric-client-visual-evidence-report",
    );
    expect(requirement?.domains).toEqual(["resourcepack"]);
    expect(requirement?.mustInclude.join("\n")).toContain("explicit complete-suite value");
  });

  it("loads Fabric client UI scale and clipping guidance", () => {
    const recipes = readDataJson<{
      recipes: Array<{
        id: string;
        domains: string[];
        steps: Array<{ id: string; action: string; evidence: string[] }>;
        finalChecks: string[];
      }>;
    }>("authoring-recipes.json");
    const recipe = recipes.recipes.find((entry) => entry.id === "fabric-client-ui-scale-clipping");
    expect(recipe?.domains).toEqual([]);
    expect(recipe?.steps.map((step) => step.id)).toEqual([
      "establish-one-scaled-coordinate-space",
      "compute-one-layout-result",
      "validate-content-before-clipping",
      "exercise-scale-language-viewport-and-state-matrix",
      "verify-version-specific-client-apis",
    ]);
    expect(recipe?.steps.map((step) => step.action).join("\n")).toContain(
      "Do not apply GUI scale again",
    );
    expect(recipe?.steps.map((step) => step.action).join("\n")).toContain(
      "normal, hover, pressed, and disabled states",
    );
    expect(recipe?.steps.flatMap((step) => step.evidence).join("\n")).toContain(
      "https://docs.fabricmc.net/develop/rendering/gui/custom-screens",
    );
    expect(recipe?.finalChecks).toEqual(["fabric-client-ui-scale-clipping-safety"]);

    const guardrails = readDataJson<{
      guardrails: Array<{ id: string; domains: string[]; rules: string[] }>;
    }>("authoring-guardrails.json");
    const guardrail = guardrails.guardrails.find(
      (entry) => entry.id === "fabric-client-ui-scale-clipping-safety",
    );
    expect(guardrail?.domains).toEqual([]);
    expect(guardrail?.rules.join("\n")).toContain("one immutable layout result");
    expect(guardrail?.rules.join("\n")).toContain("pre-clip bounds");
    expect(guardrail?.rules.join("\n")).toContain("Screenshots are visual evidence");

    const diagnostics = readDataJson<{
      diagnostics: Array<{
        id: string;
        domains: string[];
        severity: string;
        requiredChecks: string[];
        failIf: string[];
      }>;
    }>("authoring-diagnostics.json");
    const diagnostic = diagnostics.diagnostics.find(
      (entry) => entry.id === "fabric-client-ui-scale-clipping-unsafe",
    );
    expect(diagnostic?.domains).toEqual([]);
    expect(diagnostic?.severity).toBe("error");
    expect(diagnostic?.requiredChecks.join("\n")).toContain("especially Auto");
    expect(diagnostic?.failIf.join("\n")).toContain("GUI scale applied a second time");
    expect(diagnostic?.failIf.join("\n")).toContain("screenshots are the only proof");
  });

  it("bundles Paper world operation lifecycle safety guidance and official sources", () => {
    const recipes = readDataJson<{
      recipes: Array<{ id: string; steps: Array<{ id: string }>; finalChecks: string[] }>;
    }>("authoring-recipes.json");
    const recipe = recipes.recipes.find((entry) => entry.id === "paper-world-operation-safety");
    expect(recipe?.steps.map((step) => step.id)).toEqual([
      "verify-version-and-pre-enumerate-targets",
      "acquire-chunks-without-blocking",
      "schedule-by-owner-and-re-resolve",
      "apply-bounded-resumable-batches",
      "revalidate-racy-side-effects",
      "reconcile-idempotently",
      "terminate-and-release-exactly-once",
    ]);
    expect(recipe?.finalChecks).toContain("paper-world-operation-safety");

    const guardrails = readDataJson<{ guardrails: Array<{ id: string; rules: string[] }> }>(
      "authoring-guardrails.json",
    );
    const rules = guardrails.guardrails
      .find((entry) => entry.id === "paper-world-operation-safety")
      ?.rules.join("\n");
    expect(rules).toContain("isChunkLoaded as a point-in-time observation, not a lease");
    expect(rules).toContain("complete, partial, rejected, timeout, stale, or unloaded");
    expect(rules).toContain("applyPhysics=false");
    expect(rules).toContain("entity scheduler as the handoff mechanism for entity work");
    expect(rules).toContain("entity's identity, validity, lifecycle state");
    expect(rules).toContain("do not require an unsafe cross-region World.getEntity lookup");
    expect(rules).toContain("EntityScheduler retired callback as critical code");
    expect(rules).toContain("record or forward only minimal terminal intent");
    expect(rules).not.toContain("immutable world identity plus coordinates or entity UUID");

    const diagnostics = readDataJson<{
      diagnostics: Array<{ id: string; severity: string; failIf: string[] }>;
    }>("authoring-diagnostics.json");
    const diagnostic = diagnostics.diagnostics.find(
      (entry) => entry.id === "paper-world-operation-unbounded",
    );
    expect(diagnostic?.severity).toBe("error");
    expect(diagnostic?.failIf.join("\n")).toContain("events alone");
    expect(diagnostic?.failIf.join("\n")).toContain("automatically released");
    expect(diagnostic?.failIf.join("\n")).toContain("unsafe cross-region World.getEntity lookup");
    expect(diagnostic?.failIf.join("\n")).toContain(
      "EntityScheduler retired callback removes the entity or other entities",
    );

    const scenarios = readDataJson<{
      scenarios: Array<{
        id: string;
        requiredLookups: { recipes: string[]; diagnostics: string[] };
      }>;
    }>("authoring-scenarios.json");
    const scenario = scenarios.scenarios.find(
      (entry) => entry.id === "paper-world-operation-safety-review",
    );
    expect(scenario?.requiredLookups.recipes).toEqual(["paper-world-operation-safety"]);
    expect(scenario?.requiredLookups.diagnostics).toContain("paper-world-operation-unbounded");

    const usage = readFileSync(join(process.cwd(), "../../docs/USAGE.md"), "utf8");
    for (const officialUrl of [
      "https://jd.papermc.io/paper/26.2/org/bukkit/World.html",
      "https://jd.papermc.io/paper/26.2/org/bukkit/block/Block.html",
      "https://jd.papermc.io/paper/26.2/org/bukkit/entity/Entity.html",
      "https://jd.papermc.io/paper/26.2/org/bukkit/event/world/ChunkUnloadEvent.html",
      "https://jd.papermc.io/paper/26.2/io/papermc/paper/threadedregions/scheduler/RegionScheduler.html",
      "https://jd.papermc.io/paper/26.2/io/papermc/paper/threadedregions/scheduler/EntityScheduler.html",
      "https://docs.papermc.io/paper/dev/folia-support/",
      "https://docs.papermc.io/folia/reference/overview/",
    ]) {
      expect(usage).toContain(officialUrl);
    }
  });

  it("loads complete Paper custom recipe ownership guidance", () => {
    const checklists = readDataJson<{
      checklists: Array<{ domain: string; steps: Array<{ id: string }> }>;
    }>("authoring-checklists.json");
    const paperChecklist = checklists.checklists.find((entry) => entry.domain === "paper-plugin");
    expect(paperChecklist?.steps.map((step) => step.id)).toContain(
      "own-custom-recipe-keys-and-matching",
    );

    const recipes = readDataJson<{
      recipes: Array<{
        id: string;
        steps: Array<{ id: string; action: string; stopIfMissing: string }>;
      }>;
    }>("authoring-recipes.json");
    const recipe = recipes.recipes.find((entry) => entry.id === "paper-custom-recipe-registration");
    expect(recipe?.steps.map((step) => step.id)).toContain("reconcile-only-plugin-owned-recipes");
    expect(recipe?.steps.map((step) => step.id)).toContain(
      "validate-patterns-counts-and-match-collisions",
    );
    expect(recipe?.steps.map((step) => step.action).join("\n")).toContain(
      "RecipeChoice.ExactChoice",
    );
    expect(recipe?.steps.map((step) => step.stopIfMissing).join("\n")).toContain("clearRecipes");

    const scenarios = readDataJson<{
      scenarios: Array<{
        id: string;
        requiredLookups: { recipes: string[]; diagnostics: string[] };
        mustAvoid: string[];
      }>;
    }>("authoring-scenarios.json");
    const scenario = scenarios.scenarios.find((entry) => entry.id === "paper-custom-recipe-review");
    expect(scenario?.requiredLookups.recipes).toEqual(["paper-custom-recipe-registration"]);
    expect(scenario?.requiredLookups.diagnostics).toContain(
      "paper-custom-recipe-registration-unsafe",
    );
    expect(scenario?.mustAvoid.join("\n")).toContain("resetRecipes");

    const guardrails = readDataJson<{ guardrails: Array<{ id: string; rules: string[] }> }>(
      "authoring-guardrails.json",
    );
    const guardrail = guardrails.guardrails.find(
      (entry) => entry.id === "paper-custom-recipe-ownership",
    );
    expect(guardrail?.rules.join("\n")).toContain("last-known-good");
    expect(guardrail?.rules.join("\n")).toContain("recipe-book discovery");
    expect(guardrail?.rules.join("\n")).toContain("counted ingredient-identity multisets");

    const diagnostics = readDataJson<{
      diagnostics: Array<{ id: string; severity: string; failIf: string[] }>;
    }>("authoring-diagnostics.json");
    const diagnostic = diagnostics.diagnostics.find(
      (entry) => entry.id === "paper-custom-recipe-registration-unsafe",
    );
    expect(diagnostic?.severity).toBe("error");
    expect(diagnostic?.failIf.join("\n")).toContain("partial replacement");
    expect(diagnostic?.failIf.join("\n")).toContain("colliding recipe outputs");
  });

  it("loads complete Model Engine runtime binding guidance", () => {
    const recipes = readDataJson<{
      recipes: Array<{
        id: string;
        steps: Array<{ id: string; action: string; evidence: string[] }>;
        finalChecks: string[];
      }>;
    }>("authoring-recipes.json");
    const recipe = recipes.recipes.find(
      (entry) => entry.id === "paper-modelengine-runtime-binding",
    );
    expect(recipe?.steps.map((step) => step.id)).toEqual(
      expect.arrayContaining([
        "resolve-target-runtime-and-identifiers",
        "stage-carrier-attach-and-publication",
        "assign-animation-channel-ownership",
        "replace-and-retire-runtime-generations",
        "prove-the-contract-on-the-loaded-runtime",
      ]),
    );
    expect(recipe?.steps.map((step) => step.action).join("\n")).toContain(
      "Paper type and member indexes can verify Paper carrier surfaces only",
    );
    expect(recipe?.steps.flatMap((step) => step.evidence).join("\n")).toContain(
      "configure carrier, attach model, verify attachment, then publish",
    );
    expect(recipe?.steps.map((step) => step.action).join("\n")).toContain("controlled rejection");
    expect(recipe?.steps.map((step) => step.action).join("\n")).toContain(
      "borrowed carrier without deleting it",
    );
    expect(recipe?.finalChecks).toContain("paper-modelengine-runtime-binding-safety");

    const scenarios = readDataJson<{
      scenarios: Array<{
        id: string;
        requiredLookups: { recipes: string[]; diagnostics: string[] };
        successCriteria: string[];
        mustAvoid: string[];
      }>;
    }>("authoring-scenarios.json");
    const scenario = scenarios.scenarios.find(
      (entry) => entry.id === "paper-modelengine-runtime-binding-review",
    );
    expect(scenario?.requiredLookups.recipes).toEqual(["paper-modelengine-runtime-binding"]);
    expect(scenario?.requiredLookups.diagnostics).toContain(
      "paper-modelengine-runtime-binding-unsafe",
    );
    expect(scenario?.successCriteria.join("\n")).toContain(
      "idle, locomotion, and action channels each have one owner",
    );
    expect(scenario?.mustAvoid.join("\n")).toContain("Paper API indexes");
    expect(scenario?.mustAvoid.join("\n")).toContain("display-interaction geometry");

    const guardrails = readDataJson<{ guardrails: Array<{ id: string; rules: string[] }> }>(
      "authoring-guardrails.json",
    );
    const guardrail = guardrails.guardrails.find(
      (entry) => entry.id === "paper-modelengine-runtime-binding-safety",
    );
    expect(guardrail?.rules.join("\n")).toContain("positive attachment result");
    expect(guardrail?.rules.join("\n")).toContain("never a silent default");
    expect(guardrail?.rules.join("\n")).toContain("paired target client");
    expect(guardrail?.rules.join("\n")).toContain(
      "restoring rather than deleting a borrowed carrier",
    );

    const diagnostics = readDataJson<{
      diagnostics: Array<{ id: string; severity: string; failIf: string[] }>;
    }>("authoring-diagnostics.json");
    const diagnostic = diagnostics.diagnostics.find(
      (entry) => entry.id === "paper-modelengine-runtime-binding-unsafe",
    );
    expect(diagnostic?.severity).toBe("error");
    expect(diagnostic?.failIf.join("\n")).toContain("Paper-only data");
    expect(diagnostic?.failIf.join("\n")).toContain("old-generation callbacks");
    expect(diagnostic?.failIf.join("\n")).toContain("deletes a borrowed carrier");
    expect(JSON.stringify({ recipe, scenario, guardrail, diagnostic })).not.toContain("https://");

    const checklists = readDataJson<{
      checklists: Array<{ domain: string; steps: Array<{ id: string; reason: string }> }>;
    }>("authoring-checklists.json");
    const paperChecklist = checklists.checklists.find((entry) => entry.domain === "paper-plugin");
    expect(paperChecklist?.steps.map((step) => step.id)).toContain(
      "verify-modelengine-runtime-binding",
    );
    expect(
      paperChecklist?.steps.find((step) => step.id === "verify-modelengine-runtime-binding")
        ?.reason,
    ).toContain("otherwise this task-specific step does not apply");
  });

  it("loads bundled claim policy JSON", () => {
    const policies = readDataJson<{ policies: Array<{ id: string }> }>("claim-policies.json");
    expect(policies.policies.map((policy) => policy.id)).toContain("paper-type-or-member-exists");
  });

  it("loads bundled output requirement JSON", () => {
    const requirements = readDataJson<{ requirements: Array<{ id: string }> }>(
      "output-requirements.json",
    );
    expect(requirements.requirements.map((requirement) => requirement.id)).toContain(
      "paper-plugin-output-safety",
    );
  });

  it("loads bundled response pattern JSON", () => {
    const patterns = readDataJson<{ patterns: Array<{ id: string }> }>("response-patterns.json");
    expect(patterns.patterns.map((pattern) => pattern.id)).toContain("paper-api-answer");
  });

  it("exposes a package data root", () => {
    expect(getDataRoot()).toMatch(/packages\/data\/data$/);
  });

  it("checks bundled data files", () => {
    expect(hasDataFile("catalog.json")).toBe(true);
    expect(hasBundledDataFile("catalog.json")).toBe(true);
    expect(hasCachedDataFile("catalog.json")).toBe(false);
    expect(hasDataFile("skills/minecraft-paper-plugins/SKILL.md")).toBe(true);
    expect(hasDataFile("missing.json")).toBe(false);
  });

  it("rejects unsafe data paths", () => {
    expect(() => readDataText("../package.json")).toThrow("safe relative path");
    expect(() => hasDataFile("/tmp/package.json")).toThrow("safe relative path");
    expect(() => getCachedDataPath("nested/../package.json")).toThrow("safe relative path");
    expect(() => getCacheDataRoot("../outside")).toThrow("safe relative path");
    expect(() => cleanCachedData("../outside")).toThrow("safe relative path");
  });

  it("loads packaged skill payload text", () => {
    expect(readDataText("skills/minecraft-paper-plugins/SKILL.md")).toContain(
      "# Minecraft Paper Plugins",
    );
  });

  it("guides skill callers to translate only non-English discovery intent", () => {
    for (const skill of [
      "minecraft-datapacks",
      "minecraft-resourcepacks",
      "minecraft-paper-plugins",
    ]) {
      const content = readDataText(`skills/${skill}/SKILL.md`);
      expect(content).toMatch(
        /translate non-English user intent into concise English canonical\s+Minecraft terms/,
      );
      expect(content).toMatch(
        /Keep exact identifiers, namespace IDs, file paths, and content literals\s+unchanged/,
      );
      expect(content).toMatch(/keep the user's requested response\s+language/);
    }
  });

  it("loads data manifest and resolves cache directories", async () => {
    await withCacheDir((cacheDir) => {
      const manifest = getDataManifest();
      expect(manifest.dataVersion).toBe("2026.06.23-2");
      expect(manifest.downloadable).toHaveLength(138);
      expect(manifest.downloadable).toContainEqual(
        expect.objectContaining({ kind: "datapack-schema-surface", version: "1.13" }),
      );
      expect(manifest.downloadable).toContainEqual(
        expect.objectContaining({ kind: "paper-api-surface", version: "1.20.5" }),
      );
      expect(manifest.downloadable).toContainEqual(
        expect.objectContaining({ kind: "resourcepack-model-summary", version: "1.13" }),
      );
      expect(getCacheRoot()).toBe(cacheDir);
      expect(getCacheDataRoot()).toBe(join(cacheDir, "data", manifest.dataVersion));
    });
  });

  it("reads cache files when a relative path is not bundled", async () => {
    await withCacheDir(() => {
      const path = "custom/example.json";
      const file = getCachedDataPath(path);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, `${JSON.stringify({ ok: true })}\n`);

      expect(hasDataFile(path)).toBe(true);
      expect(hasBundledDataFile(path)).toBe(false);
      expect(hasCachedDataFile(path)).toBe(true);
      expect(readDataJson<{ ok: boolean }>(path)).toEqual({ ok: true });
      expect(listCachedDataFiles()).toEqual([
        expect.objectContaining({
          path,
          bytes: 12,
        }),
      ]);
      cleanCachedData();
      expect(hasDataFile(path)).toBe(false);
    });
  });

  it("fetches manifest entries into the cache with sha256 verification", async () => {
    await withCacheDir(async () => {
      const body = readDataText("java/datapack-schema-surfaces/26.2.json");
      const fetchMock: typeof fetch = async (_input, _init) =>
        ({
          ok: true,
          status: 200,
          statusText: "OK",
          arrayBuffer: async () => Buffer.from(body),
        }) as unknown as Response;

      const result = await fetchData({
        kind: "datapack-schema-surface",
        version: "26.2",
        fetch: fetchMock,
      });

      expect(result.fetched).toEqual([
        expect.objectContaining({
          path: "java/datapack-schema-surfaces/26.2.json",
          bytes: Buffer.byteLength(body),
        }),
      ]);
      expect(hasDataFile("java/datapack-schema-surfaces/26.2.json")).toBe(true);

      const skipped = await fetchData({
        kind: "datapack-schema-surface",
        version: "26.2",
        fetch: fetchMock,
      });
      expect(skipped.skipped).toEqual([
        expect.objectContaining({
          path: "java/datapack-schema-surfaces/26.2.json",
          reason: "already-cached",
        }),
      ]);
    });
  });

  it("rejects fetched bytes when sha256 verification fails", async () => {
    await withCacheDir(async () => {
      const fetchMock: typeof fetch = async (_input, _init) =>
        ({
          ok: true,
          status: 200,
          statusText: "OK",
          arrayBuffer: async () => Buffer.from("not the manifest payload"),
        }) as unknown as Response;

      await expect(
        fetchData({
          kind: "datapack-schema-surface",
          version: "26.2",
          fetch: fetchMock,
        }),
      ).rejects.toThrow("Integrity mismatch");

      expect(hasCachedDataFile("java/datapack-schema-surfaces/26.2.json")).toBe(false);
    });
  });

  it("rejects a Mojang server jar response whose declared length exceeds the cache bound", async () => {
    await withCacheDir(async () => {
      const fetchMock: typeof fetch = async () =>
        new Response("x", {
          headers: { "content-length": String(256 * 1024 * 1024 + 1) },
        });

      await expect(
        fetchMojangServerJar({
          version: "26.2",
          url: "https://piston-data.mojang.com/example/server.jar",
          fetch: fetchMock,
        }),
      ).rejects.toThrow("response exceeds 268435456 bytes");
      expect(getMojangServerJarStatus("26.2").cached).toBe(false);
    });
  });

  it("uses official expected size as the streaming response bound", async () => {
    await withCacheDir(async () => {
      const fetchMock: typeof fetch = async () => new Response("12345");
      await expect(
        fetchMojangServerJar({
          version: "26.2",
          url: "https://piston-data.mojang.com/example/server.jar",
          size: 4,
          fetch: fetchMock,
        }),
      ).rejects.toThrow("response exceeds 4 bytes");
    });
  });

  it("aborts a Mojang server jar fetch at its bounded deadline", async () => {
    await withCacheDir(async () => {
      const fetchMock: typeof fetch = async (_input, init) =>
        await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), {
            once: true,
          });
        });
      await expect(
        fetchMojangServerJar({
          version: "26.2",
          url: "https://piston-data.mojang.com/example/server.jar",
          timeoutMs: 5,
          fetch: fetchMock,
        }),
      ).rejects.toThrow("Fetch timed out after 5 ms");
    });
  });

  it("bounds cancellation of an oversized Mojang server jar response", async () => {
    await withCacheDir(async () => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2]));
        },
        cancel: () => new Promise<void>(() => undefined),
      });
      const fetchMock: typeof fetch = async () => new Response(body);
      await expect(
        fetchMojangServerJar({
          version: "26.2",
          url: "https://piston-data.mojang.com/example/server.jar",
          size: 1,
          timeoutMs: 20,
          fetch: fetchMock,
        }),
      ).rejects.toThrow("Fetch timed out after 20 ms");
    });
  });

  it("refuses to reuse a non-regular Mojang server jar cache path", async () => {
    await withCacheDir(async (cacheDir) => {
      const jarPath = join(cacheDir, "mojang-server-jars", "26.2.jar");
      mkdirSync(jarPath, { recursive: true });
      await expect(
        fetchMojangServerJar({
          version: "26.2",
          url: "https://piston-data.mojang.com/example/server.jar",
        }),
      ).rejects.toThrow("is not a regular file");
    });
  });

  it("rechecks an expected SHA-1 before reusing a cached Mojang server jar", async () => {
    await withCacheDir(async (cacheDir) => {
      const jarDirectory = join(cacheDir, "mojang-server-jars");
      mkdirSync(jarDirectory, { recursive: true });
      writeFileSync(join(jarDirectory, "26.2.jar"), "corrupt cache");
      let fetchCalls = 0;
      const fetchMock: typeof fetch = async () => {
        fetchCalls += 1;
        throw new Error("network should not be used");
      };

      await expect(
        fetchMojangServerJar({
          version: "26.2",
          url: "https://piston-data.mojang.com/example/server.jar",
          sha1: "0".repeat(40),
          fetch: fetchMock,
        }),
      ).rejects.toThrow("failed SHA-1 verification");
      expect(fetchCalls).toBe(0);
    });
  });

  it("caches Minecraft assets by single file and searchable version index", async () => {
    await withCacheDir(async () => {
      const tree = {
        tree: [
          { path: "assets/minecraft/models/item/diamond_sword.json", type: "blob" },
          { path: "assets/minecraft/textures/item/diamond_sword.png", type: "blob" },
          { path: "README.md", type: "blob" },
        ],
      };
      const fetchMock: typeof fetch = async (input, _init) => {
        const url = String(input);
        if (url.includes("/git/trees/1.21.8")) {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => tree,
          } as unknown as Response;
        }
        if (url.endsWith("/assets/minecraft/models/item/diamond_sword.json")) {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            arrayBuffer: async () => Buffer.from('{"parent":"minecraft:item/generated"}'),
          } as unknown as Response;
        }
        if (url.endsWith("/1.21.8.zip")) {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            arrayBuffer: async () => Buffer.from("zip bytes"),
          } as unknown as Response;
        }
        throw new Error(`unexpected url ${url}`);
      };

      const index = await fetchMinecraftAssetsIndex({
        version: "1.21.8",
        fetch: fetchMock,
      });
      expect(index.pathCount).toBe(2);

      const search = searchMinecraftAssets({
        version: "1.21.8",
        contains: "diamond_sword",
        extension: "json",
      });
      expect(search.matches).toEqual(["assets/minecraft/models/item/diamond_sword.json"]);

      const file = await fetchMinecraftAssetFile({
        version: "1.21.8",
        path: "assets/minecraft/models/item/diamond_sword.json",
        fetch: fetchMock,
      });
      expect(file.cached).toBe(false);
      expect(hasCachedMinecraftAssetFile("1.21.8", file.path)).toBe(true);
      expect(readCachedMinecraftAssetText("1.21.8", file.path)).toContain("generated");
      expect(getCachedMinecraftAssetPath("1.21.8", file.path)).toBe(file.file);

      const archive = await fetchMinecraftAssetsArchive({
        version: "1.21.8",
        fetch: fetchMock,
      });
      expect(archive.bytes).toBe(9);
      expect(getMinecraftAssetsStatus("1.21.8")).toMatchObject({
        indexCached: true,
        archiveCached: true,
        cachedFileCount: 1,
      });
    });
  });

  it("explains how to fetch a missing Minecraft assets index", async () => {
    await withCacheDir(() => {
      expect(() => searchMinecraftAssets({ version: "1.21.8", contains: "bundle" })).toThrow(
        /fetch_resourcepack_assets.*indexOnly/,
      );
    });
  });

  it("loads Paper attribute and effect ownership guidance", () => {
    const checklists = readDataJson<{
      checklists: Array<{ domain: string; steps: Array<{ id: string; evidence: string[] }> }>;
    }>("authoring-checklists.json");
    const paperChecklist = checklists.checklists.find((entry) => entry.domain === "paper-plugin");
    expect(paperChecklist?.steps.map((step) => step.id)).toContain(
      "design-attribute-effect-ownership",
    );

    const recipes = readDataJson<{
      recipes: Array<{
        id: string;
        steps: Array<{ id: string; action: string; evidence: string[] }>;
        finalChecks: string[];
      }>;
    }>("authoring-recipes.json");
    const recipe = recipes.recipes.find((entry) => entry.id === "paper-attribute-effect-ownership");
    expect(recipe?.steps.map((step) => step.id)).toEqual(
      expect.arrayContaining([
        "reconcile-equipment-modifiers-without-erasing-defaults",
        "reconcile-session-attribute-modifiers-by-key",
        "treat-potion-effect-type-as-a-collision-domain",
        "apply-capacity-before-clamping-current-values",
      ]),
    );
    expect(recipe?.steps.map((step) => step.action).join("\n")).toContain(
      "PotionEffect has no per-source NamespacedKey",
    );
    expect(recipe?.steps.map((step) => step.action).join("\n")).toContain(
      "Attribute.MAX_ABSORPTION",
    );
    expect(recipe?.finalChecks).toContain("paper-attribute-effect-ownership-safety");

    const scenarios = readDataJson<{
      scenarios: Array<{
        id: string;
        requiredLookups: { recipes: string[]; diagnostics: string[] };
        successCriteria: string[];
      }>;
    }>("authoring-scenarios.json");
    const scenario = scenarios.scenarios.find(
      (entry) => entry.id === "paper-attribute-effect-ownership-review",
    );
    expect(scenario?.requiredLookups.recipes).toEqual(["paper-attribute-effect-ownership"]);
    expect(scenario?.successCriteria.join("\n")).toContain("weaker reapply");

    const guardrails = readDataJson<{ guardrails: Array<{ id: string; rules: string[] }> }>(
      "authoring-guardrails.json",
    );
    const guardrail = guardrails.guardrails.find(
      (entry) => entry.id === "paper-attribute-effect-ownership-safety",
    );
    expect(guardrail?.rules.join("\n")).toContain("implicit ItemType defaults");
    expect(guardrail?.rules.join("\n")).toContain("keep zero health at zero");

    const diagnostics = readDataJson<{
      diagnostics: Array<{ id: string; severity: string; failIf: string[] }>;
    }>("authoring-diagnostics.json");
    const diagnostic = diagnostics.diagnostics.find(
      (entry) => entry.id === "paper-attribute-effect-ownership-unsafe",
    );
    expect(diagnostic?.severity).toBe("error");
    expect(diagnostic?.failIf.join("\n")).toContain("hidden effect");
  });
});

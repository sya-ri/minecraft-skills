import { listReferences, listSkills } from "@minecraft-skills/catalog";
import { describe, expect, it } from "vitest";
import { listMinecraftSkillsResources, readMinecraftSkillsResource } from "./resources.js";

describe("MCP resources", () => {
  it("lists packaged skill resources", () => {
    const resources = listMinecraftSkillsResources();
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://skills/minecraft-paper-plugins/SKILL.md",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://skills/minecraft-paper-plugins/agents/openai.yaml",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://skills/minecraft-paper-plugins/references/sources.md",
    );
    expect(resources.every((resource) => resource.size > 0)).toBe(true);
  });

  it("lists data manifest and downloadable data resources", () => {
    const resources = listMinecraftSkillsResources();
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/authoring-checklists.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/authoring-checklists/paper-plugin.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/authoring-guardrails.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/authoring-guardrails/paper-api-surface-limits.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/authoring-guardrails/paper-inventory-gui-interaction-safety.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/authoring-guardrails/paper-administrative-command-operability.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/authoring-guardrails/paper-player-identity-and-display.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/authoring-guardrails/paper-plugin-testing-evidence.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/authoring-diagnostics.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/authoring-diagnostics/paper-api-member-unverified.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/authoring-diagnostics/paper-inventory-gui-interaction-unbounded.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/authoring-diagnostics/paper-administrative-command-incomplete.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/authoring-diagnostics/paper-player-identity-display-confusion.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/authoring-diagnostics/paper-plugin-test-evidence-gap.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/authoring-recipes.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/authoring-recipes/paper-event-listener.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/authoring-recipes/paper-inventory-gui-interactions.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/authoring-recipes/paper-administrative-command-operability.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/authoring-recipes/paper-player-identity-and-display.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/authoring-recipes/paper-plugin-testing-evidence.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/authoring-scenarios.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/authoring-scenarios/paper-event-listener-review.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/authoring-scenarios/paper-inventory-gui-interaction-review.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/authoring-scenarios/paper-administrative-command-operability-review.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/authoring-scenarios/paper-player-identity-and-display-review.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/authoring-scenarios/paper-plugin-testing-evidence-review.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/claim-policies.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/claim-policies/paper-type-or-member-exists.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/output-requirements.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/output-requirements/paper-plugin-output-safety.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/response-patterns.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/response-patterns/paper-api-answer.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/fact-surfaces.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/fact-surfaces/datapack-schema-surface.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/intent-lookups.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/intent-lookups/verify-paper-type-or-member.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/data-manifest.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/java/datapack-schema-surfaces/26.2.json",
    );
    expect(resources.map((resource) => resource.uri)).toContain(
      "minecraft-skills://data/java/paper-api-surfaces/1.21.11.json",
    );
  });

  it("exposes every catalog skill payload as resources", () => {
    const resources = listMinecraftSkillsResources();
    const uris = new Set(resources.map((resource) => resource.uri));

    for (const skill of listSkills()) {
      expect(uris).toContain(`minecraft-skills://skills/${skill.name}/SKILL.md`);
      expect(uris).toContain(`minecraft-skills://skills/${skill.name}/agents/openai.yaml`);
      for (const reference of listReferences(skill.domain)) {
        expect(uris).toContain(
          `minecraft-skills://skills/${skill.name}/${reference.path.slice(
            `${skill.path}/`.length,
          )}`,
        );
      }
    }
  });

  it("reads skill resources", () => {
    const result = readMinecraftSkillsResource(
      "minecraft-skills://skills/minecraft-paper-plugins/SKILL.md",
    );
    expect(result.contents).toEqual([
      expect.objectContaining({
        uri: "minecraft-skills://skills/minecraft-paper-plugins/SKILL.md",
        mimeType: "text/markdown",
        text: expect.stringContaining("# Minecraft Paper Plugins"),
      }),
    ]);
  });

  it("reads data resources", () => {
    const checklists = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-checklists.json",
    );
    expect(checklists.contents[0]?.text).toContain('"domain": "datapack"');

    const paperChecklist = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-checklists/paper-plugin.json",
    );
    expect(paperChecklist.contents[0]?.text).toContain("verify-types-members-and-events");

    const guardrails = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-guardrails.json",
    );
    expect(guardrails.contents[0]?.text).toContain('"id": "paper-api-surface-limits"');
    expect(guardrails.contents[0]?.text).toContain('"id": "paper-inventory-delivery-outcomes"');
    expect(guardrails.contents[0]?.text).toContain(
      '"id": "paper-inventory-gui-interaction-safety"',
    );

    const guardrail = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-guardrails/paper-api-surface-limits.json",
    );
    expect(guardrail.contents[0]?.text).toContain("Javadocs package, type, and member indexes");

    const itemDeliveryGuardrail = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-guardrails/paper-inventory-delivery-outcomes.json",
    );
    expect(itemDeliveryGuardrail.contents[0]?.text).toContain("uninserted stacks");

    const inventoryGuardrail = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-guardrails/paper-inventory-gui-interaction-safety.json",
    );
    expect(inventoryGuardrail.contents[0]?.text).toContain("InventoryCloseEvent handlers");
    expect(inventoryGuardrail.contents[0]?.text).toContain("exactly once");

    const diagnostics = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-diagnostics.json",
    );
    expect(diagnostics.contents[0]?.text).toContain('"id": "paper-api-member-unverified"');
    expect(diagnostics.contents[0]?.text).toContain('"id": "paper-inventory-leftovers-unhandled"');
    expect(diagnostics.contents[0]?.text).toContain(
      '"id": "paper-inventory-gui-interaction-unbounded"',
    );

    const diagnostic = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-diagnostics/paper-api-member-unverified.json",
    );
    expect(diagnostic.contents[0]?.text).toContain("searchPaperMembers");

    const itemDeliveryDiagnostic = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-diagnostics/paper-inventory-leftovers-unhandled.json",
    );
    expect(itemDeliveryDiagnostic.contents[0]?.text).toContain("original requested stack");

    const inventoryDiagnostic = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-diagnostics/paper-inventory-gui-interaction-unbounded.json",
    );
    expect(inventoryDiagnostic.contents[0]?.text).toContain(
      "deprecated InventoryClickEvent.setCursor",
    );
    expect(inventoryDiagnostic.contents[0]?.text).toContain("repeated callbacks");

    const recipes = readMinecraftSkillsResource("minecraft-skills://data/authoring-recipes.json");
    expect(recipes.contents[0]?.text).toContain('"id": "paper-event-listener"');
    expect(recipes.contents[0]?.text).toContain('"id": "paper-safe-item-delivery"');
    expect(recipes.contents[0]?.text).toContain('"id": "paper-inventory-gui-interactions"');

    const recipe = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-recipes/datapack-function-command.json",
    );
    expect(recipe.contents[0]?.text).toContain("verify-command-path");

    const itemDeliveryRecipe = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-recipes/paper-safe-item-delivery.json",
    );
    expect(itemDeliveryRecipe.contents[0]?.text).toContain("define-delivery-and-overflow-outcomes");

    const inventoryRecipe = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-recipes/paper-inventory-gui-interactions.json",
    );
    expect(inventoryRecipe.contents[0]?.text).toContain("settle-editable-session-exactly-once");
    expect(inventoryRecipe.contents[0]?.text).toContain("InventoryCloseEvent handling");

    const scenarios = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-scenarios.json",
    );
    expect(scenarios.contents[0]?.text).toContain('"id": "paper-event-listener-review"');
    expect(scenarios.contents[0]?.text).toContain('"id": "paper-item-delivery-review"');
    expect(scenarios.contents[0]?.text).toContain('"id": "paper-inventory-gui-interaction-review"');

    const scenario = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-scenarios/paper-event-listener-review.json",
    );
    expect(scenario.contents[0]?.text).toContain("paper-event-candidate-unverified");

    const itemDeliveryScenario = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-scenarios/paper-item-delivery-review.json",
    );
    expect(itemDeliveryScenario.contents[0]?.text).toContain("paper-inventory-leftovers-unhandled");

    const inventoryScenario = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-scenarios/paper-inventory-gui-interaction-review.json",
    );
    expect(inventoryScenario.contents[0]?.text).toContain("atomic settlement transition");
    expect(inventoryScenario.contents[0]?.text).toContain(
      "deprecated InventoryClickEvent.setCursor",
    );

    const claimPolicies = readMinecraftSkillsResource(
      "minecraft-skills://data/claim-policies.json",
    );
    expect(claimPolicies.contents[0]?.text).toContain('"id": "paper-type-or-member-exists"');

    const claimPolicy = readMinecraftSkillsResource(
      "minecraft-skills://data/claim-policies/command-syntax-exists.json",
    );
    expect(claimPolicy.contents[0]?.text).toContain("parser shape, not gameplay behavior");

    const outputRequirements = readMinecraftSkillsResource(
      "minecraft-skills://data/output-requirements.json",
    );
    expect(outputRequirements.contents[0]?.text).toContain('"id": "paper-plugin-output-safety"');

    const outputRequirement = readMinecraftSkillsResource(
      "minecraft-skills://data/output-requirements/paper-plugin-output-safety.json",
    );
    expect(outputRequirement.contents[0]?.text).toContain("Javadocs type/member evidence");

    const responsePatterns = readMinecraftSkillsResource(
      "minecraft-skills://data/response-patterns.json",
    );
    expect(responsePatterns.contents[0]?.text).toContain('"id": "paper-api-answer"');

    const responsePattern = readMinecraftSkillsResource(
      "minecraft-skills://data/response-patterns/paper-api-answer.json",
    );
    expect(responsePattern.contents[0]?.text).toContain("name presence, not behavior");

    const factSurfaces = readMinecraftSkillsResource("minecraft-skills://data/fact-surfaces.json");
    expect(factSurfaces.contents[0]?.text).toContain('"id": "paper-api-surface"');

    const factSurface = readMinecraftSkillsResource(
      "minecraft-skills://data/fact-surfaces/datapack-schema-surface.json",
    );
    expect(factSurface.contents[0]?.text).toContain("not a normative schema");

    const intentLookups = readMinecraftSkillsResource(
      "minecraft-skills://data/intent-lookups.json",
    );
    expect(intentLookups.contents[0]?.text).toContain('"id": "verify-command-syntax"');

    const intentLookup = readMinecraftSkillsResource(
      "minecraft-skills://data/intent-lookups/verify-paper-type-or-member.json",
    );
    expect(intentLookup.contents[0]?.text).toContain('"search_paper_members"');

    const manifest = readMinecraftSkillsResource("minecraft-skills://data/data-manifest.json");
    expect(manifest.contents[0]?.text).toContain('"dataVersion": "2026.06.23-2"');

    const paperSurface = readMinecraftSkillsResource(
      "minecraft-skills://data/java/paper-api-surfaces/1.21.11.json",
    );
    expect(paperSurface.contents[0]?.text).toContain('"coverage": "javadocs-search-index"');
  });

  it("reads administrative command operability resources", () => {
    const recipe = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-recipes/paper-administrative-command-operability.json",
    );
    expect(recipe.contents[0]?.text).toContain("model-sender-target-and-scope");

    const scenario = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-scenarios/paper-administrative-command-operability-review.json",
    );
    expect(scenario.contents[0]?.text).toContain("paper-administrative-command-incomplete");

    const guardrail = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-guardrails/paper-administrative-command-operability.json",
    );
    expect(guardrail.contents[0]?.text).toContain("Allow console execution");

    const diagnostic = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-diagnostics/paper-administrative-command-incomplete.json",
    );
    expect(diagnostic.contents[0]?.text).toContain('"severity": "error"');
  });

  it("rejects unknown resources", () => {
    expect(() => readMinecraftSkillsResource("minecraft-skills://skills/missing/SKILL.md")).toThrow(
      "Unknown resource",
    );
  });

  it("reads Paper player identity and display resources", () => {
    const recipe = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-recipes/paper-player-identity-and-display.json",
    );
    expect(recipe.contents[0]?.text).toContain("persist-and-resolve-stable-identity");

    const scenario = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-scenarios/paper-player-identity-and-display-review.json",
    );
    expect(scenario.contents[0]?.text).toContain("paper-player-identity-display-confusion");

    const guardrail = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-guardrails/paper-player-identity-and-display.json",
    );
    expect(guardrail.contents[0]?.text).toContain("stable player identifier");

    const diagnostic = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-diagnostics/paper-player-identity-display-confusion.json",
    );
    expect(diagnostic.contents[0]?.text).toContain("only persistent player key");
  });

  it("reads Paper ItemStack semantic identity resources", () => {
    const uris = listMinecraftSkillsResources().map((resource) => resource.uri);
    expect(uris).toEqual(
      expect.arrayContaining([
        "minecraft-skills://data/authoring-recipes/paper-itemstack-semantic-identity.json",
        "minecraft-skills://data/authoring-scenarios/paper-itemstack-semantic-identity-review.json",
        "minecraft-skills://data/authoring-guardrails/paper-itemstack-semantic-identity.json",
        "minecraft-skills://data/authoring-diagnostics/paper-itemstack-identity-or-state-loss.json",
      ]),
    );

    const recipe = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-recipes/paper-itemstack-semantic-identity.json",
    );
    expect(recipe.contents[0]?.text).toContain("migrate-deterministically-and-idempotently");
    expect(recipe.contents[0]?.text).toContain("unknown items must be returned untouched");

    const scenario = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-scenarios/paper-itemstack-semantic-identity-review.json",
    );
    expect(scenario.contents[0]?.text).toContain("paper-itemstack-identity-or-state-loss");
    expect(scenario.contents[0]?.text).toContain("duplicate lore");

    const guardrail = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-guardrails/paper-itemstack-semantic-identity.json",
    );
    expect(guardrail.contents[0]?.text).toContain("all unowned PDC entries");

    const diagnostic = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-diagnostics/paper-itemstack-identity-or-state-loss.json",
    );
    expect(diagnostic.contents[0]?.text).toContain("possibly aliased ItemStack");
    expect(diagnostic.contents[0]?.text).toContain("unrelated-state preservation");
  });

  it("reads Paper plugin protocol safety resources", () => {
    const uris = listMinecraftSkillsResources().map((resource) => resource.uri);
    expect(uris).toEqual(
      expect.arrayContaining([
        "minecraft-skills://data/authoring-recipes/paper-plugin-protocol-safety.json",
        "minecraft-skills://data/authoring-scenarios/paper-plugin-protocol-safety-review.json",
        "minecraft-skills://data/authoring-guardrails/paper-plugin-protocol-safety.json",
        "minecraft-skills://data/authoring-diagnostics/paper-plugin-protocol-unsafe.json",
      ]),
    );

    const recipe = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-recipes/paper-plugin-protocol-safety.json",
    );
    expect(recipe.contents[0]?.text).toContain("make-decoding-strict-and-bounded");

    const scenario = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-scenarios/paper-plugin-protocol-safety-review.json",
    );
    expect(scenario.contents[0]?.text).toContain("paper-plugin-protocol-unsafe");

    const guardrail = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-guardrails/paper-plugin-protocol-safety.json",
    );
    expect(guardrail.contents[0]?.text).toContain("authenticated connection");

    const diagnostic = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-diagnostics/paper-plugin-protocol-unsafe.json",
    );
    expect(diagnostic.contents[0]?.text).toContain("Messenger.MAX_MESSAGE_SIZE");
  });

  it("reads Paper player-session lifecycle safety resources", () => {
    const uris = listMinecraftSkillsResources().map((resource) => resource.uri);
    expect(uris).toEqual(
      expect.arrayContaining([
        "minecraft-skills://data/authoring-recipes/paper-player-session-lifecycle.json",
        "minecraft-skills://data/authoring-scenarios/paper-player-session-lifecycle-review.json",
        "minecraft-skills://data/authoring-guardrails/paper-player-session-lifecycle-safety.json",
        "minecraft-skills://data/authoring-diagnostics/paper-player-session-lifecycle-unsafe.json",
      ]),
    );

    const recipe = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-recipes/paper-player-session-lifecycle.json",
    );
    expect(recipe.contents[0]?.text).toContain("reject-stale-asynchronous-publication");

    const scenario = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-scenarios/paper-player-session-lifecycle-review.json",
    );
    expect(scenario.contents[0]?.text).toContain("paper-player-session-lifecycle-unsafe");

    const guardrail = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-guardrails/paper-player-session-lifecycle-safety.json",
    );
    expect(guardrail.contents[0]?.text).toContain("session instance or generation");

    const diagnostic = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-diagnostics/paper-player-session-lifecycle-unsafe.json",
    );
    expect(diagnostic.contents[0]?.text).toContain("fire-and-forget persistence");
  });

  it("reads Paper BossBar audience lifecycle resources", () => {
    const uris = listMinecraftSkillsResources().map((resource) => resource.uri);
    expect(uris).toEqual(
      expect.arrayContaining([
        "minecraft-skills://data/authoring-recipes/paper-bossbar-audience-lifecycle.json",
        "minecraft-skills://data/authoring-scenarios/paper-bossbar-audience-lifecycle-review.json",
        "minecraft-skills://data/authoring-guardrails/paper-bossbar-audience-lifecycle-safety.json",
        "minecraft-skills://data/authoring-diagnostics/paper-bossbar-audience-lifecycle-unsafe.json",
      ]),
    );

    const recipe = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-recipes/paper-bossbar-audience-lifecycle.json",
    );
    expect(recipe.contents[0]?.text).toContain("select-a-stable-winner-with-hysteresis");
    expect(recipe.contents[0]?.text).toContain("current-minus-desired removals");

    const scenario = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-scenarios/paper-bossbar-audience-lifecycle-review.json",
    );
    expect(scenario.contents[0]?.text).toContain("paper-bossbar-audience-lifecycle-unsafe");
    expect(scenario.contents[0]?.text).toContain("backend transfer");

    const guardrail = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-guardrails/paper-bossbar-audience-lifecycle-safety.json",
    );
    expect(guardrail.contents[0]?.text).toContain("one serialized writer");

    const diagnostic = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-diagnostics/paper-bossbar-audience-lifecycle-unsafe.json",
    );
    expect(diagnostic.contents[0]?.text).toContain("zero-viewer leak assertions");
  });

  it("reads Paper plugin testing evidence resources", () => {
    const recipe = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-recipes/paper-plugin-testing-evidence.json",
    );
    expect(recipe.contents[0]?.text).toContain("choose-the-minimum-sufficient-evidence-layer");

    const scenario = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-scenarios/paper-plugin-testing-evidence-review.json",
    );
    expect(scenario.contents[0]?.text).toContain("paper-plugin-test-evidence-gap");

    const guardrail = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-guardrails/paper-plugin-testing-evidence.json",
    );
    expect(guardrail.contents[0]?.text).toContain("type-compatibility evidence only");

    const diagnostic = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-diagnostics/paper-plugin-test-evidence-gap.json",
    );
    expect(diagnostic.contents[0]?.text).toContain("loaded-plugin evidence");
  });

  it("reads complete Fabric Client GameTest visual evidence resources", () => {
    const uris = listMinecraftSkillsResources().map((resource) => resource.uri);
    expect(uris).toEqual(
      expect.arrayContaining([
        "minecraft-skills://data/authoring-recipes/fabric-client-gametest-visual-evidence.json",
        "minecraft-skills://data/authoring-scenarios/fabric-client-gametest-visual-evidence-review.json",
        "minecraft-skills://data/authoring-guardrails/fabric-client-gametest-visual-evidence-integrity.json",
        "minecraft-skills://data/authoring-diagnostics/fabric-client-gametest-visual-evidence-gap.json",
        "minecraft-skills://data/intent-lookups/verify-fabric-client-visual-evidence.json",
        "minecraft-skills://data/claim-policies/fabric-client-visual-evidence-claim.json",
        "minecraft-skills://data/output-requirements/fabric-client-visual-evidence-report.json",
      ]),
    );

    const recipe = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-recipes/fabric-client-gametest-visual-evidence.json",
    );
    expect(recipe.contents[0]?.text).toContain("define-stable-cases-and-readiness");
    expect(recipe.contents[0]?.text).toContain("full client frame");

    const scenario = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-scenarios/fabric-client-gametest-visual-evidence-review.json",
    );
    expect(scenario.contents[0]?.text).toContain("virtual-framebuffer client");

    const guardrail = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-guardrails/fabric-client-gametest-visual-evidence-integrity.json",
    );
    expect(guardrail.contents[0]?.text).toContain("missing, stale, duplicate, or unexpected");

    const diagnostic = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-diagnostics/fabric-client-gametest-visual-evidence-gap.json",
    );
    expect(diagnostic.contents[0]?.text).toContain("Paper GameTest");

    const intent = readMinecraftSkillsResource(
      "minecraft-skills://data/intent-lookups/verify-fabric-client-visual-evidence.json",
    );
    expect(intent.contents[0]?.text).toContain("final-report contract");

    const policy = readMinecraftSkillsResource(
      "minecraft-skills://data/claim-policies/fabric-client-visual-evidence-claim.json",
    );
    expect(policy.contents[0]?.text).toContain("not a complete-suite result");

    const requirement = readMinecraftSkillsResource(
      "minecraft-skills://data/output-requirements/fabric-client-visual-evidence-report.json",
    );
    expect(requirement.contents[0]?.text).toContain("artifact-manifest");
  });

  it("reads Fabric client UI scale and clipping guidance resources", () => {
    const uris = listMinecraftSkillsResources().map((resource) => resource.uri);
    expect(uris).toEqual(
      expect.arrayContaining([
        "minecraft-skills://data/authoring-recipes/fabric-client-ui-scale-clipping.json",
        "minecraft-skills://data/authoring-guardrails/fabric-client-ui-scale-clipping-safety.json",
        "minecraft-skills://data/authoring-diagnostics/fabric-client-ui-scale-clipping-unsafe.json",
      ]),
    );

    const recipe = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-recipes/fabric-client-ui-scale-clipping.json",
    );
    expect(recipe.contents[0]?.text).toContain("establish-one-scaled-coordinate-space");

    const guardrail = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-guardrails/fabric-client-ui-scale-clipping-safety.json",
    );
    expect(guardrail.contents[0]?.text).toContain("one immutable layout result");

    const diagnostic = readMinecraftSkillsResource(
      "minecraft-skills://data/authoring-diagnostics/fabric-client-ui-scale-clipping-unsafe.json",
    );
    expect(diagnostic.contents[0]?.text).toContain("screenshots are the only proof");
  });
});

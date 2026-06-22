import {
  getAuthoringChecklist,
  getAuthoringDiagnostic,
  getAuthoringGuardrail,
  getAuthoringRecipe,
  getClaimPolicy,
  getDataManifest,
  getDatapackSchemaSurface,
  getFactSurface,
  getIntentLookup,
  getOutputRequirement,
  getPaperApiSurface,
  getResponsePattern,
  getSkillPayload,
  listAuthoringChecklists,
  listAuthoringDiagnostics,
  listAuthoringGuardrails,
  listAuthoringRecipes,
  listClaimPolicies,
  listFactSurfaces,
  listIntentLookups,
  listOutputRequirements,
  listResponsePatterns,
  listSkills,
} from "@minecraft-skills/catalog";

type Resource = {
  uri: string;
  name: string;
  title: string;
  description: string;
  mimeType: string;
  size: number;
};

type ResourceContent = {
  uri: string;
  mimeType: string;
  text: string;
};

type SkillResource = {
  uri: string;
  name: string;
  title: string;
  description: string;
  mimeType: string;
  text: string;
};

const resourceBase = "minecraft-skills://skills";
const dataResourceBase = "minecraft-skills://data";

function textSize(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

function makeSkillResources(skillName: string): SkillResource[] {
  const payload = getSkillPayload(skillName);
  return [
    {
      uri: `${resourceBase}/${payload.skill.name}/SKILL.md`,
      name: `${payload.skill.name}/SKILL.md`,
      title: `${payload.skill.title} SKILL.md`,
      description: payload.skill.description,
      mimeType: "text/markdown",
      text: payload.skillMarkdown,
    },
    {
      uri: `${resourceBase}/${payload.skill.name}/agents/openai.yaml`,
      name: `${payload.skill.name}/agents/openai.yaml`,
      title: `${payload.skill.title} OpenAI metadata`,
      description: `Agent UI metadata for ${payload.skill.title}.`,
      mimeType: "application/yaml",
      text: payload.agentMetadata,
    },
    ...payload.references.map((reference) => ({
      uri: `${resourceBase}/${payload.skill.name}/${reference.reference.path.slice(
        `${payload.skill.path}/`.length,
      )}`,
      name: `${payload.skill.name}/${reference.reference.path.slice(
        `${payload.skill.path}/`.length,
      )}`,
      title: reference.reference.title,
      description: `Generated reference for ${payload.skill.title}.`,
      mimeType: "text/markdown",
      text: reference.markdown,
    })),
  ];
}

export function listMinecraftSkillsResources(): Resource[] {
  const skillResources = listSkills().flatMap((skill) =>
    makeSkillResources(skill.name).map(({ text, ...resource }) => ({
      ...resource,
      size: textSize(text),
    })),
  );
  const manifest = getDataManifest();
  const authoringChecklists = listAuthoringChecklists();
  const authoringChecklistIndex = {
    schemaVersion: 1,
    checklists: authoringChecklists,
  };
  const authoringGuardrails = listAuthoringGuardrails();
  const authoringGuardrailIndex = {
    schemaVersion: 1,
    guardrails: authoringGuardrails,
  };
  const authoringDiagnostics = listAuthoringDiagnostics();
  const authoringDiagnosticIndex = {
    schemaVersion: 1,
    diagnostics: authoringDiagnostics,
  };
  const authoringRecipes = listAuthoringRecipes();
  const authoringRecipeIndex = {
    schemaVersion: 1,
    recipes: authoringRecipes,
  };
  const claimPolicies = listClaimPolicies();
  const claimPolicyIndex = {
    schemaVersion: 1,
    policies: claimPolicies,
  };
  const outputRequirements = listOutputRequirements();
  const outputRequirementIndex = {
    schemaVersion: 1,
    requirements: outputRequirements,
  };
  const responsePatterns = listResponsePatterns();
  const responsePatternIndex = {
    schemaVersion: 1,
    patterns: responsePatterns,
  };
  const factSurfaces = listFactSurfaces();
  const factSurfaceIndex = {
    schemaVersion: 1,
    surfaces: factSurfaces,
  };
  const intentLookups = listIntentLookups();
  const intentLookupIndex = {
    schemaVersion: 1,
    intents: intentLookups,
  };
  const dataResources: Resource[] = [
    {
      uri: `${dataResourceBase}/authoring-checklists.json`,
      name: "authoring-checklists.json",
      title: "Minecraft Skills authoring checklists",
      description:
        "Pre-generation checks for Minecraft datapack, resourcepack, and Paper plugin authoring.",
      mimeType: "application/json",
      size: textSize(JSON.stringify(authoringChecklistIndex, null, 2)),
    },
    ...authoringChecklists.map((checklist) => ({
      uri: `${dataResourceBase}/authoring-checklists/${checklist.domain}.json`,
      name: `authoring-checklists/${checklist.domain}.json`,
      title: checklist.title,
      description: `Pre-generation checklist for ${checklist.domain} authoring.`,
      mimeType: "application/json",
      size: textSize(JSON.stringify(checklist, null, 2)),
    })),
    {
      uri: `${dataResourceBase}/authoring-guardrails.json`,
      name: "authoring-guardrails.json",
      title: "Minecraft Skills authoring guardrails",
      description:
        "Output guardrails that prevent unsupported Minecraft datapack, resourcepack, and Paper plugin claims.",
      mimeType: "application/json",
      size: textSize(JSON.stringify(authoringGuardrailIndex, null, 2)),
    },
    ...authoringGuardrails.map((guardrail) => ({
      uri: `${dataResourceBase}/authoring-guardrails/${guardrail.id}.json`,
      name: `authoring-guardrails/${guardrail.id}.json`,
      title: guardrail.title,
      description: `Output guardrail for ${guardrail.title}.`,
      mimeType: "application/json",
      size: textSize(JSON.stringify(guardrail, null, 2)),
    })),
    {
      uri: `${dataResourceBase}/authoring-diagnostics.json`,
      name: "authoring-diagnostics.json",
      title: "Minecraft Skills authoring diagnostics",
      description: "Pre-finalization diagnostics for generated Minecraft files, code, and answers.",
      mimeType: "application/json",
      size: textSize(JSON.stringify(authoringDiagnosticIndex, null, 2)),
    },
    ...authoringDiagnostics.map((diagnostic) => ({
      uri: `${dataResourceBase}/authoring-diagnostics/${diagnostic.id}.json`,
      name: `authoring-diagnostics/${diagnostic.id}.json`,
      title: diagnostic.title,
      description: `Authoring diagnostic for ${diagnostic.title}.`,
      mimeType: "application/json",
      size: textSize(JSON.stringify(diagnostic, null, 2)),
    })),
    {
      uri: `${dataResourceBase}/authoring-recipes.json`,
      name: "authoring-recipes.json",
      title: "Minecraft Skills authoring recipes",
      description:
        "Task recipes that order exact lookups for common datapack, resourcepack, and Paper plugin work.",
      mimeType: "application/json",
      size: textSize(JSON.stringify(authoringRecipeIndex, null, 2)),
    },
    ...authoringRecipes.map((recipe) => ({
      uri: `${dataResourceBase}/authoring-recipes/${recipe.id}.json`,
      name: `authoring-recipes/${recipe.id}.json`,
      title: recipe.title,
      description: `Task recipe for ${recipe.title}.`,
      mimeType: "application/json",
      size: textSize(JSON.stringify(recipe, null, 2)),
    })),
    {
      uri: `${dataResourceBase}/claim-policies.json`,
      name: "claim-policies.json",
      title: "Minecraft Skills claim policies",
      description: "Required evidence and allowed wording for Minecraft authoring claim types.",
      mimeType: "application/json",
      size: textSize(JSON.stringify(claimPolicyIndex, null, 2)),
    },
    ...claimPolicies.map((policy) => ({
      uri: `${dataResourceBase}/claim-policies/${policy.id}.json`,
      name: `claim-policies/${policy.id}.json`,
      title: policy.claim,
      description: `Claim policy for ${policy.claim}.`,
      mimeType: "application/json",
      size: textSize(JSON.stringify(policy, null, 2)),
    })),
    {
      uri: `${dataResourceBase}/output-requirements.json`,
      name: "output-requirements.json",
      title: "Minecraft Skills output requirements",
      description: "Final-output requirements for Minecraft authoring responses.",
      mimeType: "application/json",
      size: textSize(JSON.stringify(outputRequirementIndex, null, 2)),
    },
    ...outputRequirements.map((requirement) => ({
      uri: `${dataResourceBase}/output-requirements/${requirement.id}.json`,
      name: `output-requirements/${requirement.id}.json`,
      title: requirement.title,
      description: `Final-output requirement for ${requirement.title}.`,
      mimeType: "application/json",
      size: textSize(JSON.stringify(requirement, null, 2)),
    })),
    {
      uri: `${dataResourceBase}/response-patterns.json`,
      name: "response-patterns.json",
      title: "Minecraft Skills response patterns",
      description: "Response patterns for source-backed Minecraft authoring answers.",
      mimeType: "application/json",
      size: textSize(JSON.stringify(responsePatternIndex, null, 2)),
    },
    ...responsePatterns.map((pattern) => ({
      uri: `${dataResourceBase}/response-patterns/${pattern.id}.json`,
      name: `response-patterns/${pattern.id}.json`,
      title: pattern.title,
      description: `Response pattern for ${pattern.title}.`,
      mimeType: "application/json",
      size: textSize(JSON.stringify(pattern, null, 2)),
    })),
    {
      uri: `${dataResourceBase}/fact-surfaces.json`,
      name: "fact-surfaces.json",
      title: "Minecraft Skills fact surfaces",
      description: "Machine-verifiable fact surfaces and what each surface can and cannot prove.",
      mimeType: "application/json",
      size: textSize(JSON.stringify(factSurfaceIndex, null, 2)),
    },
    ...factSurfaces.map((surface) => ({
      uri: `${dataResourceBase}/fact-surfaces/${surface.id}.json`,
      name: `fact-surfaces/${surface.id}.json`,
      title: surface.title,
      description: `Guarantees and non-guarantees for ${surface.title}.`,
      mimeType: "application/json",
      size: textSize(JSON.stringify(surface, null, 2)),
    })),
    {
      uri: `${dataResourceBase}/intent-lookups.json`,
      name: "intent-lookups.json",
      title: "Minecraft Skills intent lookups",
      description: "Intent-to-lookup routing entries for exact source-backed Minecraft authoring.",
      mimeType: "application/json",
      size: textSize(JSON.stringify(intentLookupIndex, null, 2)),
    },
    ...intentLookups.map((intent) => ({
      uri: `${dataResourceBase}/intent-lookups/${intent.id}.json`,
      name: `intent-lookups/${intent.id}.json`,
      title: intent.title,
      description: `Lookup routing for ${intent.title}.`,
      mimeType: "application/json",
      size: textSize(JSON.stringify(intent, null, 2)),
    })),
    {
      uri: `${dataResourceBase}/data-manifest.json`,
      name: "data-manifest.json",
      title: "Minecraft Skills data manifest",
      description: "Downloadable data manifest for minecraft-skills.",
      mimeType: "application/json",
      size: textSize(JSON.stringify(manifest, null, 2)),
    },
    ...manifest.downloadable.map((entry) => ({
      uri: `${dataResourceBase}/${entry.path}`,
      name: entry.path,
      title: `${entry.kind} ${entry.version ?? ""}`.trim(),
      description: `Downloadable ${entry.kind} data for ${entry.version ?? entry.path}.`,
      mimeType: "application/json",
      size: entry.size,
    })),
  ];
  return [...skillResources, ...dataResources];
}

export function readMinecraftSkillsResource(uri: string): { contents: ResourceContent[] } {
  if (uri === `${dataResourceBase}/data-manifest.json`) {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(getDataManifest(), null, 2),
        },
      ],
    };
  }

  if (uri === `${dataResourceBase}/fact-surfaces.json`) {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              schemaVersion: 1,
              surfaces: listFactSurfaces(),
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  if (uri === `${dataResourceBase}/authoring-checklists.json`) {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              schemaVersion: 1,
              checklists: listAuthoringChecklists(),
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  if (uri === `${dataResourceBase}/authoring-guardrails.json`) {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              schemaVersion: 1,
              guardrails: listAuthoringGuardrails(),
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  if (uri === `${dataResourceBase}/authoring-diagnostics.json`) {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              schemaVersion: 1,
              diagnostics: listAuthoringDiagnostics(),
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  if (uri === `${dataResourceBase}/authoring-recipes.json`) {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              schemaVersion: 1,
              recipes: listAuthoringRecipes(),
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  if (uri === `${dataResourceBase}/intent-lookups.json`) {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              schemaVersion: 1,
              intents: listIntentLookups(),
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  if (uri === `${dataResourceBase}/claim-policies.json`) {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              schemaVersion: 1,
              policies: listClaimPolicies(),
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  if (uri === `${dataResourceBase}/output-requirements.json`) {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              schemaVersion: 1,
              requirements: listOutputRequirements(),
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  if (uri === `${dataResourceBase}/response-patterns.json`) {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              schemaVersion: 1,
              patterns: listResponsePatterns(),
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  const dataPrefix = `${dataResourceBase}/`;
  if (uri.startsWith(dataPrefix)) {
    const path = uri.slice(dataPrefix.length);
    const checklistPrefix = "authoring-checklists/";
    if (path.startsWith(checklistPrefix) && path.endsWith(".json")) {
      const domain = path.slice(checklistPrefix.length, -".json".length);
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(getAuthoringChecklist(domain), null, 2),
          },
        ],
      };
    }
    const guardrailPrefix = "authoring-guardrails/";
    if (path.startsWith(guardrailPrefix) && path.endsWith(".json")) {
      const id = path.slice(guardrailPrefix.length, -".json".length);
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(getAuthoringGuardrail(id), null, 2),
          },
        ],
      };
    }
    const diagnosticPrefix = "authoring-diagnostics/";
    if (path.startsWith(diagnosticPrefix) && path.endsWith(".json")) {
      const id = path.slice(diagnosticPrefix.length, -".json".length);
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(getAuthoringDiagnostic(id), null, 2),
          },
        ],
      };
    }
    const claimPolicyPrefix = "claim-policies/";
    if (path.startsWith(claimPolicyPrefix) && path.endsWith(".json")) {
      const id = path.slice(claimPolicyPrefix.length, -".json".length);
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(getClaimPolicy(id), null, 2),
          },
        ],
      };
    }
    const authoringRecipePrefix = "authoring-recipes/";
    if (path.startsWith(authoringRecipePrefix) && path.endsWith(".json")) {
      const id = path.slice(authoringRecipePrefix.length, -".json".length);
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(getAuthoringRecipe(id), null, 2),
          },
        ],
      };
    }
    const outputRequirementPrefix = "output-requirements/";
    if (path.startsWith(outputRequirementPrefix) && path.endsWith(".json")) {
      const id = path.slice(outputRequirementPrefix.length, -".json".length);
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(getOutputRequirement(id), null, 2),
          },
        ],
      };
    }
    const responsePatternPrefix = "response-patterns/";
    if (path.startsWith(responsePatternPrefix) && path.endsWith(".json")) {
      const id = path.slice(responsePatternPrefix.length, -".json".length);
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(getResponsePattern(id), null, 2),
          },
        ],
      };
    }
    const factSurfacePrefix = "fact-surfaces/";
    if (path.startsWith(factSurfacePrefix) && path.endsWith(".json")) {
      const id = path.slice(factSurfacePrefix.length, -".json".length);
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(getFactSurface(id), null, 2),
          },
        ],
      };
    }
    const intentLookupPrefix = "intent-lookups/";
    if (path.startsWith(intentLookupPrefix) && path.endsWith(".json")) {
      const id = path.slice(intentLookupPrefix.length, -".json".length);
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(getIntentLookup(id), null, 2),
          },
        ],
      };
    }
    const entry = getDataManifest().downloadable.find((candidate) => candidate.path === path);
    if (entry?.kind === "datapack-schema-surface" && entry.version) {
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(
              getDatapackSchemaSurface(entry.edition ?? "java", entry.version),
              null,
              2,
            ),
          },
        ],
      };
    }
    if (entry?.kind === "paper-api-surface" && entry.version) {
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(getPaperApiSurface(entry.version), null, 2),
          },
        ],
      };
    }
  }

  for (const skill of listSkills()) {
    const found = makeSkillResources(skill.name).find((resource) => resource.uri === uri);
    if (found) {
      return {
        contents: [
          {
            uri: found.uri,
            mimeType: found.mimeType,
            text: found.text,
          },
        ],
      };
    }
  }

  throw new Error(`Unknown resource: ${uri}`);
}

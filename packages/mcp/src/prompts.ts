import type { GetPromptResult, Prompt } from "@modelcontextprotocol/sdk/types.js";

const promptArguments = [
  {
    name: "target_version",
    description: "Minecraft Java version to target, such as 1.21.11 or 26.2.",
    required: false,
  },
  {
    name: "task",
    description: "Short description of the datapack, resourcepack, or plugin task.",
    required: false,
  },
] satisfies Prompt["arguments"];

type PromptDefinition = Prompt & {
  skillResourceUri: string;
  focus: string;
  tools: string[];
};

const promptDefinitions: PromptDefinition[] = [
  {
    name: "use_minecraft_datapacks",
    title: "Use Minecraft Datapack Skill",
    description: "Start version-aware Minecraft Java datapack authoring assistance.",
    arguments: promptArguments,
    skillResourceUri: "minecraft-skills://skills/minecraft-datapacks/SKILL.md",
    focus:
      "Minecraft Java datapack authoring, commands, server reports, pack formats, and vanilla data paths.",
    tools: [
      "get_support_matrix",
      "list_version_support",
      "list_intent_lookups",
      "get_intent_lookup",
      "list_authoring_recipes",
      "get_authoring_recipe",
      "list_authoring_scenarios",
      "search_authoring_scenarios",
      "get_authoring_scenario",
      "get_authoring_plan",
      "get_authoring_context",
      "get_authoring_preflight",
      "get_evidence_bundle",
      "get_authoring_checklist",
      "list_authoring_guardrails",
      "get_authoring_guardrail",
      "list_authoring_diagnostics",
      "get_authoring_diagnostic",
      "list_claim_policies",
      "get_claim_policy",
      "list_output_requirements",
      "get_output_requirement",
      "list_response_patterns",
      "get_response_pattern",
      "list_fact_surfaces",
      "get_data_manifest",
      "get_coverage_summary",
      "get_source_policy",
      "get_source_report",
      "list_source_tiers",
      "list_community_datasets",
      "get_version",
      "compare_versions",
      "get_server_reports",
      "get_datapack_schema_surface",
      "search_datapack_schema",
      "compare_datapack_schema",
      "search_commands",
      "compare_commands",
      "get_vanilla_inventory",
      "search_vanilla_paths",
      "compare_vanilla_paths",
    ],
  },
  {
    name: "use_minecraft_resourcepacks",
    title: "Use Minecraft Resourcepack Skill",
    description: "Start version-aware Minecraft Java resource pack authoring assistance.",
    arguments: promptArguments,
    skillResourceUri: "minecraft-skills://skills/minecraft-resourcepacks/SKILL.md",
    focus:
      "Minecraft Java resource pack authoring, pack formats, model summaries, and vanilla asset paths.",
    tools: [
      "get_support_matrix",
      "list_version_support",
      "list_intent_lookups",
      "get_intent_lookup",
      "list_authoring_recipes",
      "get_authoring_recipe",
      "list_authoring_scenarios",
      "search_authoring_scenarios",
      "get_authoring_scenario",
      "get_authoring_plan",
      "get_authoring_context",
      "get_authoring_preflight",
      "get_evidence_bundle",
      "get_authoring_checklist",
      "list_authoring_guardrails",
      "get_authoring_guardrail",
      "list_authoring_diagnostics",
      "get_authoring_diagnostic",
      "list_claim_policies",
      "get_claim_policy",
      "list_output_requirements",
      "get_output_requirement",
      "list_response_patterns",
      "get_response_pattern",
      "list_fact_surfaces",
      "get_coverage_summary",
      "get_source_policy",
      "get_source_report",
      "list_source_tiers",
      "list_community_datasets",
      "get_version",
      "compare_versions",
      "get_vanilla_inventory",
      "search_vanilla_paths",
      "compare_vanilla_paths",
      "get_resourcepack_model_summary",
      "search_resourcepack_models",
    ],
  },
  {
    name: "use_minecraft_paper_plugins",
    title: "Use Minecraft Paper Plugin Skill",
    description: "Start version-aware Paper plugin authoring assistance.",
    arguments: promptArguments,
    skillResourceUri: "minecraft-skills://skills/minecraft-paper-plugins/SKILL.md",
    focus:
      "Paper plugin authoring, supported Minecraft versions, Paper API references, Javadocs indexes, Folia notes, and Bukkit/Paper events.",
    tools: [
      "get_support_matrix",
      "list_version_support",
      "list_intent_lookups",
      "get_intent_lookup",
      "list_authoring_recipes",
      "get_authoring_recipe",
      "list_authoring_scenarios",
      "search_authoring_scenarios",
      "get_authoring_scenario",
      "get_authoring_plan",
      "get_authoring_context",
      "get_authoring_preflight",
      "get_evidence_bundle",
      "get_authoring_checklist",
      "list_authoring_guardrails",
      "get_authoring_guardrail",
      "list_authoring_diagnostics",
      "get_authoring_diagnostic",
      "list_claim_policies",
      "get_claim_policy",
      "list_output_requirements",
      "get_output_requirement",
      "list_response_patterns",
      "get_response_pattern",
      "list_fact_surfaces",
      "get_data_manifest",
      "get_coverage_summary",
      "get_source_policy",
      "get_source_report",
      "list_source_tiers",
      "list_community_datasets",
      "get_paper_plugin_data",
      "get_paper_api_reference",
      "get_paper_api_index",
      "compare_paper_api",
      "get_paper_api_surface",
      "search_paper_types",
      "search_paper_members",
      "compare_paper_api_surface",
      "search_paper_events",
    ],
  },
];

export const prompts: Prompt[] = promptDefinitions.map(
  ({ skillResourceUri: _skillResourceUri, focus: _focus, tools: _tools, ...prompt }) => prompt,
);

function optionalLine(label: string, value: string | undefined): string {
  return value ? `\n${label}: ${value}` : "";
}

export function getMinecraftSkillsPrompt(
  name: string,
  args: Record<string, string> | undefined,
): GetPromptResult {
  const definition = promptDefinitions.find((prompt) => prompt.name === name);
  if (!definition) {
    throw new Error(`Unknown prompt: ${name}`);
  }

  const targetVersion = args?.target_version;
  const task = args?.task;
  const tools = definition.tools.map((tool) => `- ${tool}`).join("\n");
  const text = `Use the Minecraft Skills MCP server for this request.

Read this skill resource before answering: ${definition.skillResourceUri}

Focus: ${definition.focus}${optionalLine("Target version", targetVersion)}${optionalLine("Task", task)}

Use these MCP tools when they are relevant:
${tools}

Preflight rules:
- Prefer exact target-version data over latest-version data.
- Call list_intent_lookups when deciding which exact lookup path matches the user's intent.
- Call list_authoring_recipes when you need an ordered workflow for common authoring tasks.
- Call list_authoring_scenarios when you need a realistic evaluation case for the user's task shape.
- Call search_authoring_scenarios when you have task wording and need scenario routing before choosing a plan.
- Call get_authoring_plan after choosing a scenario so the required lookups are resolved in one payload.
- Call get_authoring_context when you need preflight, recipes, intent lookup routing, and evidence in one payload.
- Call get_source_report before using or recommending external sources so prohibited automation and source tiers are explicit.
- Call list_version_support when choosing among target versions or explaining coverage differences.
- Call get_authoring_preflight for the relevant domain before generating files or code.
- Call get_evidence_bundle when you need to cite or explain which sources and extracted files back an answer.
- Call get_authoring_checklist if you need the checklist without version coverage.
- Call list_authoring_guardrails before finalizing generated files or code that relies on version-specific Minecraft facts.
- Call list_authoring_diagnostics before returning generated files, code, or source-backed answers so missing evidence is caught as an explicit failure or warning.
- Call list_claim_policies before making version-specific, behavior, schema, path, API, or event claims.
- Call list_output_requirements before finalizing an answer or generated files.
- Call list_response_patterns before writing source-backed final answers that include verified facts, gaps, or non-guarantees.
- Call list_fact_surfaces when you need to know what a data surface can and cannot prove.
- Call get_support_matrix before using heavyweight surfaces so you know what is bundled, cached, or downloadable.
- Call get_data_manifest and fetch_data when a relevant downloadable surface is missing locally.
- Use compare tools when answering migration or compatibility questions.
- Treat unknown, missing, or not-extracted fields as gaps, not facts.
- Do not fetch, crawl, summarize, or cite Minecraft Wiki pages in AI workflows.
- Do not copy Minecraft Wiki, Paper docs, Javadocs, or community dataset prose; use allowed structured data and linked sources as provenance, then summarize in your own words.`;

  return {
    description: definition.description,
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text,
        },
      },
    ],
  };
}

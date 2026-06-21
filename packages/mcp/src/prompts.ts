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
      "get_coverage_summary",
      "get_version",
      "compare_versions",
      "get_server_reports",
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
      "get_coverage_summary",
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
      "get_coverage_summary",
      "get_paper_plugin_data",
      "get_paper_api_reference",
      "get_paper_api_index",
      "compare_paper_api",
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

Version rules:
- Prefer exact target-version data over latest-version data.
- Use compare tools when answering migration or compatibility questions.
- Treat unknown, missing, or not-extracted fields as gaps, not facts.
- Do not copy Minecraft Wiki, Paper docs, or Javadocs prose; use linked sources as provenance and summarize in your own words.`;

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

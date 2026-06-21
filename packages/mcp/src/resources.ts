import { getSkillPayload, listSkills } from "@minecraft-skills/catalog";

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
  return listSkills().flatMap((skill) =>
    makeSkillResources(skill.name).map(({ text, ...resource }) => ({
      ...resource,
      size: textSize(text),
    })),
  );
}

export function readMinecraftSkillsResource(uri: string): { contents: ResourceContent[] } {
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

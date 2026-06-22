import {
  getDataManifest,
  getDatapackSchemaSurface,
  getFactSurface,
  getPaperApiSurface,
  getSkillPayload,
  listFactSurfaces,
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
  const factSurfaces = listFactSurfaces();
  const factSurfaceIndex = {
    schemaVersion: 1,
    surfaces: factSurfaces,
  };
  const dataResources: Resource[] = [
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

  const dataPrefix = `${dataResourceBase}/`;
  if (uri.startsWith(dataPrefix)) {
    const path = uri.slice(dataPrefix.length);
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

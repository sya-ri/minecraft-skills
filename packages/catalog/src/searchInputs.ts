import { type } from "arktype";

const searchFields = {
  version: "string = 'latest'",
  "contains?": "string",
  limit: "number.integer >= 1 & number <= 500 = 50",
} as const;
const javaSearchFields = { ...searchFields, edition: "'java' = 'java'" } as const;

const paperTypes = type({
  "+": "reject",
  ...searchFields,
  "packageName?": "string",
});
const paperMembers = paperTypes
  .merge({
    "type?": "string",
    "kind?": "'constructor' | 'method' | 'field-or-enum-constant' | 'unknown'",
  })
  .onUndeclaredKey("reject");

export const paperMemberSearchWithFetchInput = paperMembers
  .merge({
    fetchMissing: type.boolean
      .describe(
        "a boolean that explicitly allows downloading the missing exact-version surface into the local cache (manifest size and SHA-256 verified; 30-second deadline). Does not refresh existing data.",
      )
      .default(false),
    "fetch?": "Function",
  })
  .onUndeclaredKey("reject");

const resourcepackAssets = type({
  "+": "reject",
  ...javaSearchFields,
  // The asset path API uses Array.slice limits; it does not declare the other searches' 500 cap.
  limit: "number = 50",
  "ref?": "string",
  "prefix?": "string",
  "suffix?": "string",
  "extension?": "string",
  fetch: "boolean = false",
  force: "boolean = false",
});

export const searchInputs = {
  paperTypes,
  paperMembers,
  paperMembersWithData: paperMemberSearchWithFetchInput.omit("fetch"),
  registryEntries: type({
    "+": "reject",
    ...javaSearchFields,
    "registry?": "string",
    "exact?": "string",
    "prefix?": "string",
  }),
  commands: type({
    "+": "reject",
    ...javaSearchFields,
    "prefix?": "string",
    "parser?": "string",
  }),
  resourcepackModels: type({
    "+": "reject",
    ...javaSearchFields,
    "prefix?": "string",
    "kind?": "'model' | 'item-definition'",
  }),
  resourcepackAssets,
  minecraftAssets: resourcepackAssets
    .omit("edition", "fetch", "force")
    .merge({ version: "string" })
    .onUndeclaredKey("reject"),
};

type SearchInputJsonSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties: false;
  [key: string]: unknown;
};

function inputJsonSchema(input: Pick<typeof paperTypes, "toJsonSchema">): SearchInputJsonSchema {
  const schema = input.toJsonSchema({ target: "draft-07" });
  if (
    !("type" in schema) ||
    schema.type !== "object" ||
    !("additionalProperties" in schema) ||
    schema.additionalProperties !== false
  ) {
    throw new Error("Search input must reject undeclared fields");
  }
  return {
    ...schema,
    type: "object" as const,
    properties: schema.properties ?? {},
    additionalProperties: false as const,
  };
}

export const searchInputJsonSchemas = {
  paperTypes: inputJsonSchema(searchInputs.paperTypes),
  paperMembers: inputJsonSchema(searchInputs.paperMembersWithData),
  registryEntries: inputJsonSchema(searchInputs.registryEntries),
  commands: inputJsonSchema(searchInputs.commands),
  resourcepackModels: inputJsonSchema(searchInputs.resourcepackModels),
  resourcepackAssets: inputJsonSchema(searchInputs.resourcepackAssets),
};

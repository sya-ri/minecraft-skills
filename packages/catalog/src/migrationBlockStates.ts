type Properties = Record<string, string>;
export type MigrationBlockState = { Name: string; Properties?: Properties };

const limits = {
  blocks: 4096,
  reportStates: 200000,
  inputs: 100000,
  properties: 64,
  characters: 16 * 1024 * 1024,
};
const identifier = /^[a-z0-9_.-]+:[a-z0-9/._-]+$/;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype)
    throw new Error("Expected a plain JSON object");
  return value as Record<string, unknown>;
}

/** Fill only reported defaults. Never rename blocks, mutate worlds, or approve differences. */
export function normalizeMigrationBlockStates(input: unknown) {
  const value = object(input);
  if (
    typeof value.version !== "string" ||
    !value.version ||
    value.version.length > 128 ||
    typeof value.source !== "string" ||
    !value.source ||
    value.source.length > 2048
  )
    throw new Error("A bounded report version and source description are required");
  const blocks = object(value.blocks);
  const names = Object.keys(blocks);
  if (!names.length || names.length > limits.blocks) throw new Error("Invalid block report size");
  if (!Array.isArray(value.states) || !value.states.length || value.states.length > limits.inputs)
    throw new Error("Provide between 1 and 100000 block states");
  let characters = 0,
    reportStates = 0;
  function text(s: unknown, pattern: RegExp): string {
    if (typeof s !== "string" || s.length > 256 || !pattern.test(s))
      throw new Error("Invalid block-state identifier or value");
    characters += s.length;
    if (characters > limits.characters) throw new Error("Block-state character budget exceeded");
    return s;
  }
  function properties(raw: unknown): Properties {
    const data = raw === undefined ? {} : object(raw);
    if (Object.keys(data).length > limits.properties) throw new Error("Too many block properties");
    return Object.fromEntries(
      Object.entries(data).map(([k, v]) => [text(k, /^[a-z0-9_]+$/), text(v, /^[a-z0-9_.-]+$/)]),
    );
  }
  function key(p: Properties) {
    return JSON.stringify(Object.entries(p).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  }
  const report = new Map<
    string,
    { defaults: Properties; allowed: Map<string, Set<string>>; combinations: Set<string> }
  >();
  for (const name of names) {
    text(name, identifier);
    const entry = object(blocks[name]);
    const rawProperties = entry.properties === undefined ? {} : object(entry.properties);
    if (Object.keys(rawProperties).length > limits.properties)
      throw new Error("Too many report properties");
    const allowed = new Map<string, Set<string>>();
    for (const [property, rawValues] of Object.entries(rawProperties)) {
      text(property, /^[a-z0-9_]+$/);
      if (!Array.isArray(rawValues) || !rawValues.length || rawValues.length > 256)
        throw new Error("Invalid property value list");
      const values = rawValues.map((v) => text(v, /^[a-z0-9_.-]+$/));
      if (new Set(values).size !== values.length)
        throw new Error("Duplicate report property value");
      allowed.set(property, new Set(values));
    }
    if (!Array.isArray(entry.states) || !entry.states.length)
      throw new Error("Block report requires states");
    reportStates += entry.states.length;
    if (reportStates > limits.reportStates) throw new Error("Block report state limit exceeded");
    let defaults: Properties | undefined;
    const combinations = new Set<string>();
    for (const raw of entry.states) {
      const state = object(raw);
      if (state.default !== undefined && typeof state.default !== "boolean")
        throw new Error("Invalid default state marker");
      const p = properties(state.properties);
      if (
        Object.keys(p).length !== allowed.size ||
        Object.entries(p).some(([k, v]) => !allowed.get(k)?.has(v))
      )
        throw new Error("Report state does not match its property declarations");
      const encoded = key(p);
      if (combinations.has(encoded)) throw new Error("Duplicate reported state combination");
      combinations.add(encoded);
      if (state.default) {
        if (defaults) throw new Error("More than one default state");
        defaults = p;
      }
    }
    if (!defaults) throw new Error("Block report has no default state");
    report.set(name, { defaults, allowed, combinations });
  }
  let defaultedStates = 0,
    defaultedProperties = 0;
  const states = value.states.map((raw) => {
    const state = object(raw);
    if (Object.keys(state).some((k) => k !== "Name" && k !== "Properties"))
      throw new Error("Unexpected input block-state field");
    const name = text(state.Name, identifier),
      explicit = properties(state.Properties);
    const definition = report.get(name);
    if (!definition) throw new Error(`Block is absent from the supplied report: ${name}`);
    for (const [k, v] of Object.entries(explicit))
      if (!definition.allowed.get(k)?.has(v))
        throw new Error(`Unreported property or value for ${name}: ${k}`);
    const merged = { ...definition.defaults, ...explicit };
    if (!definition.combinations.has(key(merged)))
      throw new Error(`Unreported property combination for ${name}`);
    const added = Object.keys(definition.defaults).filter((k) => !Object.hasOwn(explicit, k));
    if (added.length) defaultedStates++;
    defaultedProperties += added.length;
    return {
      Name: name,
      Properties: Object.fromEntries(
        Object.entries(merged).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      ),
    };
  });
  return {
    schemaVersion: 1,
    normalizationComplete: true,
    reportVersion: value.version,
    reportSource: value.source,
    states,
    defaultedStates,
    defaultedProperties,
    limitations: [
      "Uses caller-supplied report provenance; does not authenticate its version or source.",
      "Only fills defaults present in the supplied report. Does not infer renamed IDs, removed blocks, NBT conversion, world coverage, gameplay or rendered equality.",
      "Explicit property values are preserved. A successful normalization is not an equality verdict.",
    ],
  };
}

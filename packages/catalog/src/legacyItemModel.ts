type ModelLeaf = { type: "minecraft:model"; model: string };
type RangeModel = {
  type: "minecraft:range_dispatch";
  property: string;
  index?: number;
  normalize?: boolean;
  entries: Array<{ threshold: number; model: ModelLeaf }>;
  fallback: ModelLeaf;
};
type ConvertedModel =
  | ModelLeaf
  | RangeModel
  | {
      type: "minecraft:condition";
      property: "minecraft:damaged";
      on_true: ModelLeaf | RangeModel;
      on_false: ModelLeaf | RangeModel;
    };

/** Bounded conversion; callers verify source/target property semantics for their versions. */
export function migrateLegacyItemModel(modelId: string, input: unknown) {
  if (
    typeof modelId !== "string" ||
    !/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(modelId) ||
    modelId.includes("..") ||
    modelId.length > 256
  )
    throw new Error("modelId must be a safe namespaced model resource location");
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Expected model JSON object");
  const model = input as Record<string, unknown>;
  if (JSON.stringify(model).length > 2 * 1024 * 1024) throw new Error("Model JSON exceeds 2 MiB");
  const overrides = model.overrides;
  if (overrides === undefined)
    return { status: "unchanged", reason: "no-legacy-overrides", generated: null };
  if (!Array.isArray(overrides) || overrides.length === 0 || overrides.length > 4096)
    throw new Error("Expected 1 through 4096 legacy overrides");
  const unsupported = () => ({
    status: "unsupported",
    reason: "requires-one-supported-numeric-property",
    generated: null,
  });
  let property: "damage" | "custom_model_data" | undefined;
  const records: Array<{ threshold: number; model: string; damaged: number; order: number }> = [];
  for (const [order, value] of overrides.entries()) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("Invalid override object");
    const override = value as Record<string, unknown>;
    const predicate = override.predicate as Record<string, unknown> | undefined;
    if (
      Object.keys(override).some((k) => !["predicate", "model"].includes(k)) ||
      !predicate ||
      typeof predicate !== "object" ||
      Array.isArray(predicate) ||
      typeof override.model !== "string" ||
      !/^(?:[a-z0-9_.-]+:)?[a-z0-9_./-]+$/.test(override.model) ||
      override.model.includes("..")
    )
      return unsupported();
    const numeric = Object.hasOwn(predicate, "custom_model_data") ? "custom_model_data" : "damage";
    if (property && property !== numeric) return unsupported();
    property = numeric;
    const allowed = numeric === "damage" ? ["damage", "damaged"] : ["custom_model_data"];
    const threshold = predicate[numeric];
    if (
      Object.keys(predicate).some((k) => !allowed.includes(k)) ||
      typeof threshold !== "number" ||
      !Number.isFinite(threshold)
    )
      return unsupported();
    if (
      numeric === "custom_model_data" &&
      (!Number.isSafeInteger(threshold) || threshold <= 0 || Math.fround(threshold) !== threshold)
    )
      return unsupported();
    if (numeric === "damage" && (threshold < 0 || threshold > 1)) return unsupported();
    const damaged = Object.hasOwn(predicate, "damaged") ? predicate.damaged : 0;
    if (damaged !== 0 && damaged !== 1) return unsupported();
    records.push({ threshold: Math.fround(threshold), model: override.model, damaged, order });
  }
  const leaf = (id: string): ModelLeaf => ({ type: "minecraft:model", model: id });
  const compile = (damaged: number): ModelLeaf | RangeModel => {
    const byThreshold = new Map<number, (typeof records)[number]>();
    for (const record of records) {
      if (record.damaged <= damaged) byThreshold.set(record.threshold, record);
    }
    const entries: RangeModel["entries"] = [];
    let winner: (typeof records)[number] | undefined;
    let selected = modelId;
    // The last matching source override wins, including unsorted and duplicate thresholds.
    for (const [threshold, record] of [...byThreshold].sort(([a], [b]) => a - b)) {
      if (!winner || record.order > winner.order) winner = record;
      const next = winner.model;
      const qualified = next.includes(":") ? next : `minecraft:${next}`;
      const prior = selected.includes(":") ? selected : `minecraft:${selected}`;
      if (qualified !== prior) entries.push({ threshold, model: leaf(next) });
      selected = next;
    }
    if (entries.length === 0) return leaf(modelId);
    return {
      type: "minecraft:range_dispatch",
      property: `minecraft:${property}`,
      ...(property === "damage" ? { normalize: true } : { index: 0 }),
      entries,
      fallback: leaf(modelId),
    };
  };
  const normal = compile(0),
    damaged = compile(1);
  const converted: ConvertedModel =
    JSON.stringify(normal) === JSON.stringify(damaged)
      ? normal
      : {
          type: "minecraft:condition",
          property: "minecraft:damaged",
          on_true: damaged,
          on_false: normal,
        };
  const { overrides: _removed, ...geometry } = model;
  return {
    status: "converted",
    reason: "last-matching-numeric-thresholds",
    generated: { geometry, itemDefinition: { model: converted } },
    limitations: [
      "Requires matching source/target damage and damaged property semantics and unchanged item durability. Custom model data must be mapped to float index 0.",
      "Does not write files, convert stored items, resolve model references, validate target-version support or render output. Keep geometry at modelId and install the item definition separately.",
    ],
  };
}

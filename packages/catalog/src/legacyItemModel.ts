/** Bounded conservative conversion; callers select the source/target schema using version evidence. */
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
  const serialized = JSON.stringify(model);
  if (serialized.length > 2 * 1024 * 1024) throw new Error("Model JSON exceeds 2 MiB");
  const overrides = model.overrides;
  if (overrides === undefined)
    return { status: "unchanged", reason: "no-legacy-overrides", generated: null };
  if (!Array.isArray(overrides) || overrides.length === 0 || overrides.length > 1024)
    throw new Error("Expected 1 through 1024 legacy overrides");
  const entries: Array<{ threshold: number; model: { type: string; model: string } }> = [];
  let previous = -Infinity;
  for (const value of overrides) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("Invalid override object");
    const override = value as Record<string, unknown>;
    const predicate = override.predicate as Record<string, unknown> | undefined;
    if (
      Object.keys(override).some((key) => !["predicate", "model"].includes(key)) ||
      !predicate ||
      typeof predicate !== "object" ||
      Array.isArray(predicate) ||
      Object.keys(predicate).length !== 1 ||
      typeof predicate.custom_model_data !== "number" ||
      !Number.isFinite(predicate.custom_model_data) ||
      !Number.isSafeInteger(predicate.custom_model_data) ||
      predicate.custom_model_data <= 0 ||
      Math.fround(predicate.custom_model_data) !== predicate.custom_model_data ||
      typeof override.model !== "string" ||
      !/^(?:[a-z0-9_.-]+:)?[a-z0-9_./-]+$/.test(override.model) ||
      override.model.includes("..")
    ) {
      return {
        status: "unsupported",
        reason: "requires-only-exact-float-custom-model-data-predicates",
        generated: null,
      };
    }
    if (predicate.custom_model_data <= previous)
      return {
        status: "unsupported",
        reason: "override-order-not-strictly-increasing",
        generated: null,
      };
    previous = predicate.custom_model_data;
    entries.push({
      threshold: previous,
      model: { type: "minecraft:model", model: override.model },
    });
  }
  const { overrides: _removed, ...geometry } = model;
  return {
    status: "converted",
    reason: "increasing-custom-model-data-thresholds",
    generated: {
      geometry,
      itemDefinition: {
        model: {
          type: "minecraft:range_dispatch",
          property: "minecraft:custom_model_data",
          index: 0,
          entries,
          fallback: { type: "minecraft:model", model: modelId },
        },
      },
    },
    limitations: [
      "Does not write files, convert stored items, resolve model references, validate target-version support or render output. Keep the geometry at modelId and install the item definition separately.",
    ],
  };
}

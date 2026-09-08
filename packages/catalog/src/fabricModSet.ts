import { defaultFabricModValidationLimits, inspectFabricModMetadataForSet } from "./fabricMod.js";
import { compileFabricVersionPredicate } from "./fabricVersionPredicate.js";

export const defaultFabricModSetLimits = Object.freeze({
  maxMods: 512,
  maxInputBytes: 8 * 1024 * 1024,
  maxDependencyEdges: 50_000,
  maxDiagnostics: 200,
  maxMetadataBytes: defaultFabricModValidationLimits.maxMetadataBytes,
  maxMetadataNodes: defaultFabricModValidationLimits.maxMetadataNodes,
  maxMetadataDepth: defaultFabricModValidationLimits.maxMetadataDepth,
  maxMetadataStringBytes: defaultFabricModValidationLimits.maxMetadataStringBytes,
});
export type FabricModSetLimits = {
  -readonly [Key in keyof typeof defaultFabricModSetLimits]: number;
};
export type FabricModSetOptions = {
  mods: Array<{ metadata: unknown; label?: string }>;
  environment: "client" | "server";
  /** Exact versions reported by Loader; Minecraft launcher names are not normalized. */
  runtimeVersions: { minecraft: string; java: string; fabricloader: string };
  /** Caller assertion that the supplied metadata represents the entire selected set. */
  selectionComplete: boolean;
  limits?: Partial<FabricModSetLimits>;
};
type Severity = "error" | "warning" | "info" | "unverified";
export type FabricModSetDiagnostic = {
  severity: Severity;
  code: string;
  path: string;
  message: string;
  modIndex?: number;
  dependencyId?: string;
};
export type FabricModSetResult = {
  schemaVersion: 1;
  scope: "selected-fabric-mod-metadata";
  status: "satisfied" | "invalid" | "incomplete";
  environment: "client" | "server";
  runtimeVersions: FabricModSetOptions["runtimeVersions"];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  unverifiedCount: number;
  diagnostics: FabricModSetDiagnostic[];
  diagnosticsTruncated: boolean;
  omittedDiagnosticCount: number;
  mods: Array<{
    index: number;
    label: string | null;
    id: string | null;
    version: string | null;
    status: "active" | "environment-disabled" | "invalid";
  }>;
  dependencies: {
    inspected: number;
    satisfied: number;
    absent: number;
    mismatched: number;
    matchingIncompatibilities: number;
    informational: number;
    environmentSoftened: number;
    unverified: number;
    invalidPredicates: number;
  };
  coverage: {
    selectionComplete: boolean;
    metadataComplete: boolean;
    dependencyChecksComplete: boolean;
    nestedSelection: "not-declared" | "unverified";
    declaredNestedJars: number;
    complete: boolean;
    notChecked: string[];
  };
  limits: FabricModSetLimits;
  sources: string[];
};

const dependencyKinds = ["depends", "breaks", "conflicts", "recommends", "suggests"] as const;
const runtimeIds = ["minecraft", "java", "fabricloader"] as const;
const maxText = 8_192;

function record(
  value: unknown,
  label: string,
  allowed?: readonly string[],
): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    throw new Error(`${label} must be a JSON object`);
  const result: Record<string, unknown> = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      typeof key !== "string" ||
      !descriptor ||
      !("value" in descriptor) ||
      !descriptor.enumerable ||
      (allowed && !allowed.includes(key))
    ) {
      throw new Error(`${label} must contain only allowed enumerable JSON data properties`);
    }
    result[key] = descriptor.value;
  }
  return result;
}

function text(value: unknown, label: string, maximum = maxText): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maximum ||
    /\p{Cc}/u.test(value)
  ) {
    throw new Error(
      `${label} must be non-empty text of at most ${maximum} characters without controls`,
    );
  }
  return value;
}

function limitsFor(value: unknown): FabricModSetLimits {
  const limits: FabricModSetLimits = { ...defaultFabricModSetLimits };
  if (value === undefined) return limits;
  for (const [key, limit] of Object.entries(record(value, "limits", Object.keys(limits)))) {
    const name = key as keyof FabricModSetLimits;
    if (
      typeof limit !== "number" ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > limits[name]
    ) {
      throw new Error(`limits.${key} must be a positive integer no greater than ${limits[name]}`);
    }
    limits[name] = limit;
  }
  return limits;
}

function bounded(value: string): string {
  return value.replace(/\p{Cc}/gu, " ").slice(0, 1_024);
}

/** Validates one fixed caller-selected set offline; never selects or downloads mods. */
export function validateFabricModSet(options: FabricModSetOptions): FabricModSetResult {
  const input = record(options, "validate_fabric_mod_set", [
    "mods",
    "environment",
    "runtimeVersions",
    "selectionComplete",
    "limits",
  ]);
  const limits = limitsFor(input.limits);
  if (input.environment !== "client" && input.environment !== "server")
    throw new Error("environment must be client or server");
  if (typeof input.selectionComplete !== "boolean")
    throw new Error("selectionComplete must be explicitly true or false");
  if (!Array.isArray(input.mods) || input.mods.length > limits.maxMods)
    throw new Error(`mods must be an array of at most ${limits.maxMods} selected metadata inputs`);
  const arrayKeys = Reflect.ownKeys(input.mods);
  if (
    arrayKeys.length !== input.mods.length + 1 ||
    arrayKeys.some(
      (key) => typeof key !== "string" || (key !== "length" && !/^(?:0|[1-9]\d*)$/u.test(key)),
    )
  )
    throw new Error("mods must be a dense JSON array without named properties");
  const runtimeInput = record(input.runtimeVersions, "runtimeVersions", runtimeIds);
  const runtimeVersions = Object.fromEntries(
    runtimeIds.map((id) => [id, text(runtimeInput[id], `runtimeVersions.${id}`)]),
  ) as FabricModSetOptions["runtimeVersions"];
  const counts = { error: 0, warning: 0, info: 0, unverified: 0 };
  const diagnostics: FabricModSetDiagnostic[] = [];
  let omitted = 0;
  function add(
    severity: Severity,
    code: string,
    path: string,
    message: string,
    modIndex?: number,
    dependencyId?: string,
  ) {
    counts[severity] += 1;
    if (diagnostics.length < limits.maxDiagnostics)
      diagnostics.push({
        severity,
        code,
        path: bounded(path),
        message: bounded(message),
        ...(modIndex === undefined ? {} : { modIndex }),
        ...(dependencyId === undefined ? {} : { dependencyId: bounded(dependencyId) }),
      });
    else omitted += 1;
  }
  const mods: FabricModSetResult["mods"] = [];
  type Mod = {
    index: number;
    metadata: Record<string, unknown>;
    id: string;
    version: string;
    active: boolean;
  };
  const parsed: Mod[] = [];
  let metadataComplete = true;
  let dependencyChecksComplete = true;
  let declaredNestedJars = 0;
  let bytes = Buffer.byteLength(JSON.stringify(runtimeVersions));
  for (let index = 0; index < input.mods.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(input.mods, index);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable)
      throw new Error("mods must contain only enumerable JSON data items");
    const entry = record(descriptor.value, `mods[${index}]`, ["metadata", "label"]);
    if (!Object.hasOwn(entry, "metadata")) throw new Error(`mods[${index}].metadata is required`);
    const label = entry.label === undefined ? null : text(entry.label, `mods[${index}].label`, 256);
    const rawBytes = typeof entry.metadata === "string" ? Buffer.byteLength(entry.metadata) : 0;
    bytes += rawBytes + (label === null ? 0 : Buffer.byteLength(label));
    if (bytes > limits.maxInputBytes) {
      add(
        "error",
        "set.input-byte-limit",
        `mods[${index}]`,
        `Aggregate metadata exceeds ${limits.maxInputBytes} UTF-8 bytes.`,
        index,
      );
      metadataComplete = false;
      break;
    }
    const inspected = inspectFabricModMetadataForSet(entry.metadata, limits);
    if (typeof entry.metadata !== "string" && inspected.metadata)
      bytes += Buffer.byteLength(JSON.stringify(inspected.metadata));
    if (bytes > limits.maxInputBytes) {
      add(
        "error",
        "set.input-byte-limit",
        `mods[${index}]`,
        `Aggregate metadata exceeds ${limits.maxInputBytes} UTF-8 bytes.`,
        index,
      );
      metadataComplete = false;
      break;
    }
    for (const diagnostic of inspected.diagnostics)
      add(
        diagnostic.severity,
        diagnostic.code,
        `mods[${index}].metadata${diagnostic.path}`,
        diagnostic.message,
        index,
      );
    if (inspected.omittedDiagnosticCount) {
      counts.error +=
        inspected.errorCount -
        inspected.diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
      counts.warning +=
        inspected.warningCount -
        inspected.diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length;
      omitted += inspected.omittedDiagnosticCount;
    }
    const id = inspected.mod?.id ?? null;
    const version = inspected.mod?.version ?? null;
    const valid =
      inspected.errorCount === 0 &&
      inspected.metadata !== null &&
      id !== null &&
      version !== null &&
      version.length <= maxText;
    const active =
      inspected.mod?.environment === "*" || inspected.mod?.environment === input.environment;
    mods.push({
      index,
      label,
      id,
      version: version === null || version.length > maxText ? null : version,
      status: !valid ? "invalid" : active ? "active" : "environment-disabled",
    });
    if (!valid) {
      metadataComplete = false;
      if (version !== null && version.length > maxText)
        add(
          "error",
          "set.version-text-limit",
          `mods[${index}].metadata.version`,
          `Version text exceeds ${maxText} characters.`,
          index,
        );
      // A failed bounded snapshot cannot establish the aggregate object-input budget.
      if (inspected.metadata === null && typeof entry.metadata !== "string") break;
      continue;
    }
    if (inspected.metadata && id && version)
      parsed.push({ index, metadata: inspected.metadata, id, version, active });
    declaredNestedJars += inspected.mod?.nestedJars ?? 0;
  }
  const providers = new Map<string, Array<{ version: string; index: number | null }>>();
  const disabledProviders = new Map<string, string[]>();
  for (const id of runtimeIds) providers.set(id, [{ version: runtimeVersions[id], index: null }]);
  for (const mod of parsed) {
    const aliases = mod.metadata.provides as string[] | undefined;
    if (!mod.active) {
      // ModDiscoverer records disabled mods by primary ID only, not provides aliases.
      const versions = disabledProviders.get(mod.id) ?? [];
      versions.push(mod.version);
      disabledProviders.set(mod.id, versions);
      continue;
    }
    for (const id of [mod.id, ...(aliases ?? [])]) {
      const prior = providers.get(id) ?? [];
      if (prior.length)
        add(
          "error",
          "set.duplicate-provider",
          `mods[${mod.index}].metadata`,
          `Selected mod ID or provides alias '${id}' duplicates another selected identity or built-in runtime identity.`,
          mod.index,
          id,
        );
      prior.push({ version: mod.version, index: mod.index });
      providers.set(id, prior);
    }
  }
  const dependencies: FabricModSetResult["dependencies"] = {
    inspected: 0,
    satisfied: 0,
    absent: 0,
    mismatched: 0,
    matchingIncompatibilities: 0,
    informational: 0,
    environmentSoftened: 0,
    unverified: 0,
    invalidPredicates: 0,
  };
  const selectionKnown = input.selectionComplete && metadataComplete && declaredNestedJars === 0;
  dependencyLoop: for (const mod of parsed) {
    if (!mod.active) continue;
    for (const kind of dependencyKinds) {
      for (const [id, predicate] of Object.entries(
        (mod.metadata[kind] ?? {}) as Record<string, string | string[]>,
      )) {
        if (dependencies.inspected === limits.maxDependencyEdges) {
          add(
            "error",
            "set.dependency-edge-limit",
            "mods",
            `Dependency declarations exceed ${limits.maxDependencyEdges} edges.`,
          );
          dependencyChecksComplete = false;
          break dependencyLoop;
        }
        dependencies.inspected += 1;
        const path = `mods[${mod.index}].metadata.${kind}.${id}`;
        let matches: (candidate: string) => boolean;
        try {
          matches = compileFabricVersionPredicate(predicate);
        } catch {
          dependencies.invalidPredicates += 1;
          dependencyChecksComplete = false;
          add(
            "error",
            "dependency.invalid-predicate",
            path,
            "Version predicate could not be parsed using Fabric Loader predicate semantics.",
            mod.index,
            id,
          );
          continue;
        }
        const available = providers.get(id) ?? [];
        if (available.length > 1) {
          dependencies.unverified += 1;
          dependencyChecksComplete = false;
          add(
            "unverified",
            "dependency.ambiguous-provider",
            path,
            "Multiple selected providers make this dependency identity ambiguous.",
            mod.index,
            id,
          );
          continue;
        }
        // Loader's v1 compatibility rule downgrades matching environment-disabled positive dependencies.
        if (
          selectionKnown &&
          (kind === "depends" || kind === "recommends") &&
          available.length === 0 &&
          (disabledProviders.get(id) ?? []).some(matches)
        ) {
          dependencies.environmentSoftened += 1;
          add(
            "info",
            "dependency.environment-softened",
            path,
            "Fabric Loader's schema-v1 rule treats this positive dependency as a suggestion because a matching supplied mod is disabled in this environment.",
            mod.index,
            id,
          );
          continue;
        }
        if (kind === "suggests") {
          dependencies.informational += 1;
          continue;
        }
        const matching = available.some((candidate) => matches(candidate.version));
        if (kind === "breaks" || kind === "conflicts") {
          if (matching) {
            dependencies.matchingIncompatibilities += 1;
            add(
              kind === "breaks" ? "error" : "warning",
              `dependency.${kind}`,
              path,
              `Selected provider ${available[0]?.index === null ? "runtime" : `mods[${available[0]?.index}]`} version '${available[0]?.version}' matches ${kind} predicate ${JSON.stringify(predicate)}.`,
              mod.index,
              id,
            );
          } else if (available.length === 0 && !selectionKnown) {
            dependencies.unverified += 1;
            add(
              "unverified",
              "dependency.absence-unverified",
              path,
              "The incomplete selection does not establish absence of this incompatible dependency.",
              mod.index,
              id,
            );
          } else dependencies.satisfied += 1;
          continue;
        }
        if (matching) {
          dependencies.satisfied += 1;
          continue;
        }
        if (available.length) {
          dependencies.mismatched += 1;
          add(
            kind === "depends" ? "error" : "warning",
            "dependency.version-mismatch",
            path,
            `Selected provider ${available[0]?.index === null ? "runtime" : `mods[${available[0]?.index}]`} version '${available[0]?.version}' does not match ${kind} predicate ${JSON.stringify(predicate)}.`,
            mod.index,
            id,
          );
        } else if (!selectionKnown) {
          dependencies.unverified += 1;
          add(
            "unverified",
            "dependency.missing-unverified",
            path,
            "No supplied provider matches; the incomplete selection cannot establish a missing dependency.",
            mod.index,
            id,
          );
        } else {
          dependencies.absent += 1;
          add(
            kind === "depends" ? "error" : "warning",
            "dependency.missing",
            path,
            `The complete selected set has no provider for this ${kind} dependency.`,
            mod.index,
            id,
          );
        }
      }
    }
  }
  if (declaredNestedJars)
    add(
      "unverified",
      "set.nested-selection-unverified",
      "mods",
      `${declaredNestedJars} nested JAR declarations were observed; nested metadata and selection were not inspected.`,
    );
  const complete = selectionKnown && dependencyChecksComplete;
  return {
    schemaVersion: 1,
    scope: "selected-fabric-mod-metadata",
    status: counts.error ? "invalid" : complete ? "satisfied" : "incomplete",
    environment: input.environment,
    runtimeVersions,
    errorCount: counts.error,
    warningCount: counts.warning,
    infoCount: counts.info,
    unverifiedCount: counts.unverified,
    diagnostics,
    diagnosticsTruncated: omitted > 0,
    omittedDiagnosticCount: omitted,
    mods,
    dependencies,
    coverage: {
      selectionComplete: input.selectionComplete,
      metadataComplete,
      dependencyChecksComplete,
      nestedSelection: declaredNestedJars ? "unverified" : "not-declared",
      declaredNestedJars,
      complete,
      notChecked: [
        "Runtime loading, entrypoint classes, mixins, access wideners, and binary compatibility",
        "Nested JAR metadata, candidate selection, or whole-container completeness when jars are declared",
        "Dependency overrides, custom built-ins, schema versions other than v1, or alternative-version solving",
        "Minecraft launcher-version normalization; runtimeVersions must be Loader-reported values",
        "Duplicate original JSON members and property order for parsed metadata objects",
      ],
    },
    limits,
    sources: [
      "https://docs.fabricmc.net/develop/loader/fabric-mod-json",
      "https://github.com/FabricMC/fabric-loader/blob/c75cac153757b1a75e63e901bed5bc97eff630d3/src/main/java/net/fabricmc/loader/impl/util/version/VersionPredicateParser.java",
      "https://github.com/FabricMC/fabric-loader/blob/c75cac153757b1a75e63e901bed5bc97eff630d3/src/main/java/net/fabricmc/loader/impl/discovery/ModResolver.java",
    ],
  };
}

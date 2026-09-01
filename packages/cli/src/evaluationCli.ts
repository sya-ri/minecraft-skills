import {
  aggregateMissingFeatures,
  createEvaluationStore,
  deleteEvaluationRecords,
  type EvaluationGapFilters,
  type EvaluationScore,
  type EvaluationSearchFilters,
  type EvaluationStore,
  getEvaluationStatus,
  rateEvaluationRecord,
  readEvaluationRecord,
  searchEvaluationRecords,
  setEvaluationEnabled,
} from "@minecraft-skills/evaluation-core";

type Output = {
  write: (value: string) => void;
  error: (value: string) => void;
};

type ParsedOptions = {
  positionals: string[];
  values: Map<string, string>;
  repeated: Map<string, string[]>;
  flags: Set<string>;
};

const evaluationHelp = `minecraft-skills evaluation

Opt-in local MCP tool evaluation history. Raw MCP tool arguments and results may contain secrets.
Storage: ~/.minecraft-skills/evaluation (disabled by default; records persist until deleted).

Commands:
  evaluation status
  evaluation enable
  evaluation disable
  evaluation search [query] [--tool name] [--evaluated true|false]
      [--min-score 1] [--max-score 5] [--missing-feature key]
      [--since ISO-timestamp] [--until ISO-timestamp] [--limit 20]
  evaluation show <id>
  evaluation rate <id> --score 1..5 --information-need text --comment text
      [--missing-feature key=summary]...
  evaluation gaps [query] [--tool name] [--min-score 1] [--max-score 5]
      [--missing-feature key] [--since ISO-timestamp] [--until ISO-timestamp]
  evaluation delete <id...>
  evaluation delete --all --yes`;

function printJson(output: Output, value: unknown): void {
  output.write(JSON.stringify(value, null, 2));
}

function parseOptions(
  args: string[],
  options: {
    values?: readonly string[];
    repeated?: readonly string[];
    flags?: readonly string[];
  },
): ParsedOptions {
  const valueNames = new Set(options.values ?? []);
  const repeatedNames = new Set(options.repeated ?? []);
  const flagNames = new Set(options.flags ?? []);
  const positionals: string[] = [];
  const values = new Map<string, string>();
  const repeated = new Map<string, string[]>();
  const flags = new Set<string>();

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument) continue;
    if (!argument.startsWith("--")) {
      positionals.push(argument);
      continue;
    }
    if (flagNames.has(argument)) {
      if (flags.has(argument)) {
        throw new Error(`evaluation option must not be repeated: ${argument}`);
      }
      flags.add(argument);
      continue;
    }
    if (!valueNames.has(argument) && !repeatedNames.has(argument)) {
      throw new Error(`evaluation received unknown option: ${argument}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`evaluation ${argument} requires a value`);
    }
    if (valueNames.has(argument)) {
      if (values.has(argument)) {
        throw new Error(`evaluation option must not be repeated: ${argument}`);
      }
      values.set(argument, value);
    } else {
      const entries = repeated.get(argument) ?? [];
      entries.push(value);
      repeated.set(argument, entries);
    }
    index += 1;
  }

  return { positionals, values, repeated, flags };
}

function parseScore(
  value: string | undefined,
  option: string,
  required = false,
): EvaluationScore | undefined {
  if (value === undefined) {
    if (required) throw new Error(`evaluation rate requires ${option}`);
    return undefined;
  }
  const score = Number(value);
  if (!Number.isSafeInteger(score) || score < 1 || score > 5) {
    throw new Error(`${option} must be an integer from 1 to 5`);
  }
  return score as EvaluationScore;
}

function parseTimestamp(value: string | undefined, option: string): string | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`${option} must be a valid ISO timestamp`);
  }
  return value;
}

function parseLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("--limit must be an integer from 1 to 100");
  }
  return limit;
}

function parseEvaluated(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error("--evaluated must be true or false");
}

function searchFilters(parsed: ParsedOptions, includeEvaluated: boolean): EvaluationSearchFilters {
  if (parsed.positionals.length > 1) {
    throw new Error("evaluation search accepts at most one query");
  }
  const query = parsed.positionals[0];
  if (query && query.length > 500) {
    throw new Error("evaluation query must not exceed 500 characters");
  }
  const minScore = parseScore(parsed.values.get("--min-score"), "--min-score");
  const maxScore = parseScore(parsed.values.get("--max-score"), "--max-score");
  if (minScore !== undefined && maxScore !== undefined && minScore > maxScore) {
    throw new Error("--min-score must not exceed --max-score");
  }
  return {
    ...(query ? { query } : {}),
    ...(parsed.values.get("--tool") ? { tool: parsed.values.get("--tool") } : {}),
    ...(includeEvaluated && parsed.values.has("--evaluated")
      ? { evaluated: parseEvaluated(parsed.values.get("--evaluated")) }
      : {}),
    ...(minScore === undefined ? {} : { minScore }),
    ...(maxScore === undefined ? {} : { maxScore }),
    ...(parsed.values.get("--missing-feature")
      ? { missingFeature: parsed.values.get("--missing-feature") }
      : {}),
    ...(parsed.values.has("--since")
      ? { from: parseTimestamp(parsed.values.get("--since"), "--since") }
      : {}),
    ...(parsed.values.has("--until")
      ? { to: parseTimestamp(parsed.values.get("--until"), "--until") }
      : {}),
    ...(parsed.values.has("--limit") ? { limit: parseLimit(parsed.values.get("--limit")) } : {}),
  } as EvaluationSearchFilters;
}

const filterValueOptions = [
  "--tool",
  "--evaluated",
  "--min-score",
  "--max-score",
  "--missing-feature",
  "--since",
  "--until",
  "--limit",
] as const;

function parseMissingFeatures(values: readonly string[]): Array<{ key: string; summary: string }> {
  return values.map((value) => {
    const separator = value.indexOf("=");
    if (separator < 1 || separator === value.length - 1) {
      throw new Error("--missing-feature must use key=summary");
    }
    return { key: value.slice(0, separator), summary: value.slice(separator + 1) };
  });
}

function deletionExitCode(result: ReturnType<typeof deleteEvaluationRecords>): number {
  return result.notFound.length === 0 && result.warnings.length === 0 ? 0 : 1;
}

export function runEvaluationCli(
  argv: string[],
  output: Output,
  store: EvaluationStore = createEvaluationStore(),
): number {
  const [command, ...args] = argv;
  try {
    if (!command || command === "help" || command === "--help" || command === "-h") {
      output.write(evaluationHelp);
      return 0;
    }
    if (command === "status") {
      if (args.length > 0) throw new Error("evaluation status accepts no arguments");
      printJson(output, getEvaluationStatus(store));
      return 0;
    }
    if (command === "enable" || command === "disable") {
      if (args.length > 0) throw new Error(`evaluation ${command} accepts no arguments`);
      setEvaluationEnabled(store, command === "enable");
      if (command === "enable") {
        output.error(
          "Warning: raw MCP tool arguments and results may contain secrets. Restart the MCP server so agents receive evaluation instructions.",
        );
      }
      printJson(output, getEvaluationStatus(store));
      return 0;
    }
    if (command === "search") {
      const parsed = parseOptions(args, { values: filterValueOptions });
      printJson(output, searchEvaluationRecords(store, searchFilters(parsed, true)));
      return 0;
    }
    if (command === "show") {
      const parsed = parseOptions(args, {});
      if (parsed.positionals.length !== 1) {
        throw new Error("evaluation show requires exactly one record id");
      }
      output.error("Warning: this record contains raw MCP tool arguments and results.");
      printJson(output, readEvaluationRecord(store, parsed.positionals[0] ?? ""));
      return 0;
    }
    if (command === "rate") {
      const parsed = parseOptions(args, {
        values: ["--score", "--information-need", "--comment"],
        repeated: ["--missing-feature"],
      });
      if (parsed.positionals.length !== 1) {
        throw new Error("evaluation rate requires exactly one record id");
      }
      const informationNeed = parsed.values.get("--information-need");
      const comment = parsed.values.get("--comment");
      if (!informationNeed) throw new Error("evaluation rate requires --information-need");
      if (!comment) throw new Error("evaluation rate requires --comment");
      const record = rateEvaluationRecord(store, parsed.positionals[0] ?? "", {
        informationNeed,
        score: parseScore(parsed.values.get("--score"), "--score", true) as EvaluationScore,
        comment,
        missingFeatures: parseMissingFeatures(parsed.repeated.get("--missing-feature") ?? []),
        source: "cli",
      });
      printJson(output, { id: record.id, evaluation: record.evaluation });
      return 0;
    }
    if (command === "gaps") {
      const parsed = parseOptions(args, {
        values: filterValueOptions.filter(
          (value) => value !== "--evaluated" && value !== "--limit",
        ),
      });
      const filters = searchFilters(parsed, false);
      printJson(output, aggregateMissingFeatures(store, filters as EvaluationGapFilters));
      return 0;
    }
    if (command === "delete") {
      const parsed = parseOptions(args, { flags: ["--all", "--yes"] });
      const all = parsed.flags.has("--all");
      const yes = parsed.flags.has("--yes");
      if (all) {
        if (parsed.positionals.length > 0) {
          throw new Error("evaluation delete --all does not accept record ids");
        }
        if (!yes) throw new Error("evaluation delete --all requires --yes");
        const result = deleteEvaluationRecords(store, { all: true });
        printJson(output, result);
        return deletionExitCode(result);
      }
      if (yes) throw new Error("evaluation delete --yes is only valid with --all");
      if (parsed.positionals.length === 0) {
        throw new Error("evaluation delete requires record ids or --all --yes");
      }
      const result = deleteEvaluationRecords(store, { ids: parsed.positionals });
      printJson(output, result);
      return deletionExitCode(result);
    }
    throw new Error(`Unknown evaluation command: ${command}`);
  } catch (error) {
    output.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

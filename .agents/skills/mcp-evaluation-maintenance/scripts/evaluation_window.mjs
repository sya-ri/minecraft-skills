import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const defaultLimit = 100;
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const defaultCliPath = resolve(scriptDirectory, "../../../../packages/cli/dist/cli.mjs");
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const usage = `Usage:
  pnpm run evaluation:window -- scan --since <ISO timestamp> --until <ISO timestamp> [options]
  pnpm run evaluation:window -- compare --before <UUID> --after <UUID> [--cli <path>]

Scan options:
  --since <timestamp>        Inclusive completedAt lower bound; timezone required
  --until <timestamp>        Inclusive completedAt upper bound; timezone required
  --tool <name>              Restrict records to one MCP tool
  --missing-feature <key>    Restrict records to one stable missing-feature key
  --query <text>             Apply the evaluation CLI free-text query
  --limit <1-100>            Maximum returned summaries (default: 100)
  --cli <path>               Built minecraft-skills CLI entrypoint

Other:
  --help                     Show this help`;

function timestamp(value, option) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/i.exec(
      value,
    );
  if (!match) {
    throw new Error(`${option} must be an ISO timestamp with an explicit timezone`);
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, zone] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const zoneParts = zone.toUpperCase() === "Z" ? null : /[+-](\d{2}):(\d{2})/.exec(zone);
  const invalidCalendarValue =
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > (daysInMonth[month - 1] ?? 0) ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    (zoneParts !== null && (Number(zoneParts[1]) > 23 || Number(zoneParts[2]) > 59));
  if (invalidCalendarValue) throw new Error(`${option} must be a valid ISO timestamp`);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new Error(`${option} must be a valid ISO timestamp`);
  return new Date(milliseconds).toISOString();
}

function integer(value, option, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${option} must be an integer from ${minimum} to ${maximum}`);
  }
  return parsed;
}

function parseValues(args, allowedOptions) {
  const values = new Map();
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (!option || !allowedOptions.has(option)) throw new Error(`unknown option: ${option ?? ""}`);
    if (values.has(option)) throw new Error(`option must not be repeated: ${option}`);
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${option} requires a value`);
    values.set(option, value);
    index += 1;
  }
  return values;
}

function parseScan(args) {
  const values = parseValues(
    args,
    new Set(["--since", "--until", "--tool", "--missing-feature", "--query", "--limit", "--cli"]),
  );
  const sinceValue = values.get("--since");
  const untilValue = values.get("--until");
  if (!sinceValue) throw new Error("scan requires --since");
  if (!untilValue) throw new Error("scan requires --until");
  const since = timestamp(sinceValue, "--since");
  const until = timestamp(untilValue, "--until");
  if (Date.parse(since) > Date.parse(until)) {
    throw new Error("--since must not be later than --until");
  }
  return {
    command: "scan",
    since,
    until,
    tool: values.get("--tool") ?? null,
    missingFeature: values.get("--missing-feature") ?? null,
    query: values.get("--query") ?? null,
    limit: values.has("--limit") ? integer(values.get("--limit"), "--limit", 1, 100) : defaultLimit,
    cliPath: resolve(values.get("--cli") ?? defaultCliPath),
  };
}

function recordId(value, option) {
  if (!value || !uuidPattern.test(value)) throw new Error(`${option} must be a UUID`);
  return value.toLowerCase();
}

function parseCompare(args) {
  const values = parseValues(args, new Set(["--before", "--after", "--cli"]));
  const before = recordId(values.get("--before"), "--before");
  const after = recordId(values.get("--after"), "--after");
  if (before === after) throw new Error("--before and --after must be different record IDs");
  return {
    command: "compare",
    before,
    after,
    cliPath: resolve(values.get("--cli") ?? defaultCliPath),
  };
}

export function parseArguments(argv) {
  const normalized = argv[0] === "--" ? argv.slice(1) : argv;
  if (normalized.length === 0 || normalized[0] === "--help" || normalized[0] === "-h") {
    return { command: "help" };
  }
  const [command, ...args] = normalized;
  if (command === "scan") return parseScan(args);
  if (command === "compare") return parseCompare(args);
  throw new Error(`unknown command: ${command}`);
}

function runCli(cliPath, args) {
  let stdout;
  try {
    stdout = execFileSync(process.execPath, [cliPath, ...args], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
  } catch (error) {
    const status = Number.isInteger(error?.status) ? ` with exit code ${error.status}` : "";
    throw new Error(`evaluation CLI failed${status}`);
  }
  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error("evaluation CLI returned invalid JSON");
  }
}

function resultArray(value, property, command) {
  if (!value || typeof value !== "object" || !Array.isArray(value[property])) {
    throw new Error(`evaluation ${command} returned an unexpected JSON shape`);
  }
  return value[property];
}

function string(value, field) {
  if (typeof value !== "string") throw new Error(`evaluation summary has invalid ${field}`);
  return value;
}

function strings(value, field) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`evaluation summary has invalid ${field}`);
  }
  return [...value];
}

function safeRecord(record) {
  if (!record || typeof record !== "object")
    throw new Error("evaluation search returned a bad record");
  const score = record.score;
  if (score !== null && (!Number.isInteger(score) || score < 1 || score > 5)) {
    throw new Error("evaluation summary has invalid score");
  }
  return {
    id: string(record.id, "id"),
    startedAt: string(record.startedAt, "startedAt"),
    completedAt: string(record.completedAt, "completedAt"),
    tool: string(record.tool, "tool"),
    mcpVersion: string(record.mcpVersion, "mcpVersion"),
    dataVersion: string(record.dataVersion, "dataVersion"),
    score,
    informationNeed: string(record.informationNeed, "informationNeed"),
    missingFeatureKeys: strings(record.missingFeatureKeys, "missingFeatureKeys").sort(),
  };
}

function publicRecord(record) {
  return {
    id: record.id,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    tool: record.tool,
    mcpVersion: record.mcpVersion,
    dataVersion: record.dataVersion,
    score: record.score,
    missingFeatureKeys: record.missingFeatureKeys,
  };
}

function commonFilterArguments(options) {
  const args = ["--since", options.since, "--until", options.until];
  if (options.tool) args.push("--tool", options.tool);
  if (options.missingFeature) args.push("--missing-feature", options.missingFeature);
  return args;
}

function average(total, count) {
  return count === 0 ? null : Math.round((total / count) * 100) / 100;
}

export function nextIsoTimestamp(value) {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new Error("completedAt must be a valid timestamp");
  return new Date(milliseconds + 1).toISOString();
}

function gapPriority(score) {
  if (score <= 2) return "high";
  if (score <= 3) return "medium";
  return "low";
}

function aggregateGaps(records) {
  const aggregate = new Map();
  for (const record of records) {
    if (record.score === null) continue;
    for (const key of record.missingFeatureKeys) {
      const gap = aggregate.get(key) ?? {
        key,
        count: 0,
        scoreTotal: 0,
        tools: new Set(),
        mcpVersions: new Set(),
        dataVersions: new Set(),
        firstSeenAt: record.completedAt,
        lastSeenAt: record.completedAt,
      };
      gap.count += 1;
      gap.scoreTotal += record.score;
      gap.tools.add(record.tool);
      gap.mcpVersions.add(record.mcpVersion);
      gap.dataVersions.add(record.dataVersion);
      if (record.completedAt < gap.firstSeenAt) gap.firstSeenAt = record.completedAt;
      if (record.completedAt > gap.lastSeenAt) gap.lastSeenAt = record.completedAt;
      aggregate.set(key, gap);
    }
  }
  return [...aggregate.values()].map((gap) => ({
    key: gap.key,
    count: gap.count,
    averageScore: gap.scoreTotal / gap.count,
    tools: [...gap.tools].sort(),
    mcpVersions: [...gap.mcpVersions].sort(),
    dataVersions: [...gap.dataVersions].sort(),
    firstSeenAt: gap.firstSeenAt,
    lastSeenAt: gap.lastSeenAt,
  }));
}

export function buildReport(searchResult, options) {
  const rawRecords = resultArray(searchResult, "records", "search");
  const records = rawRecords.map(safeRecord);
  const gaps = aggregateGaps(records);
  const searchWarningCount = Array.isArray(searchResult.warnings)
    ? searchResult.warnings.length
    : 0;
  const scoreDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const toolStats = new Map();
  const mcpVersions = new Set();
  const dataVersions = new Set();
  let scoreTotal = 0;
  let evaluatedCount = 0;
  let latestCompletedAt = null;

  for (const record of records) {
    mcpVersions.add(record.mcpVersion);
    dataVersions.add(record.dataVersion);
    if (!latestCompletedAt || Date.parse(record.completedAt) > Date.parse(latestCompletedAt)) {
      latestCompletedAt = record.completedAt;
    }
    const stats = toolStats.get(record.tool) ?? {
      tool: record.tool,
      records: 0,
      evaluated: 0,
      scoreTotal: 0,
      lowScores: 0,
      missingFeatureKeys: new Set(),
    };
    stats.records += 1;
    if (record.score !== null) {
      scoreDistribution[record.score] += 1;
      scoreTotal += record.score;
      evaluatedCount += 1;
      stats.evaluated += 1;
      stats.scoreTotal += record.score;
      if (record.score <= 3) stats.lowScores += 1;
    }
    for (const key of record.missingFeatureKeys) stats.missingFeatureKeys.add(key);
    toolStats.set(record.tool, stats);
  }

  const limitReached = records.length === options.limit;
  const complete = !limitReached && searchWarningCount === 0;
  const warnings = [];
  if (limitReached) warnings.push("SEARCH_LIMIT_REACHED");
  if (searchWarningCount > 0) warnings.push("SEARCH_SKIPPED_RECORDS");

  const rankedGaps = gaps
    .map((gap) => ({ ...gap, priority: gapPriority(gap.averageScore) }))
    .sort(
      (left, right) =>
        left.averageScore - right.averageScore ||
        right.count - left.count ||
        right.tools.length - left.tools.length ||
        Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt) ||
        left.key.localeCompare(right.key),
    );

  return {
    schemaVersion: 1,
    complete,
    window: {
      field: "completedAt",
      since: options.since,
      until: options.until,
      inclusive: true,
      latestCompletedAt,
      nextSince: latestCompletedAt ? nextIsoTimestamp(latestCompletedAt) : options.since,
    },
    filters: {
      tool: options.tool,
      missingFeature: options.missingFeature,
      queryApplied: options.query !== null,
      limit: options.limit,
    },
    summary: {
      records: records.length,
      evaluated: evaluatedCount,
      averageScore: average(scoreTotal, evaluatedCount),
      scoreDistribution,
      mcpVersions: [...mcpVersions].sort(),
      dataVersions: [...dataVersions].sort(),
      searchWarningCount,
      limitReached,
    },
    tools: [...toolStats.values()]
      .map((stats) => ({
        tool: stats.tool,
        records: stats.records,
        averageScore: average(stats.scoreTotal, stats.evaluated),
        lowScores: stats.lowScores,
        missingFeatureKeys: [...stats.missingFeatureKeys].sort(),
      }))
      .sort(
        (left, right) =>
          right.lowScores - left.lowScores ||
          (left.averageScore ?? 6) - (right.averageScore ?? 6) ||
          right.records - left.records ||
          left.tool.localeCompare(right.tool),
      ),
    rankedGaps,
    lowScoreRecordsWithoutGaps: records
      .filter(
        (record) =>
          record.score !== null && record.score <= 3 && record.missingFeatureKeys.length === 0,
      )
      .map(publicRecord),
    records: records.map(publicRecord),
    warnings,
  };
}

function requireBuiltCli(cliPath) {
  if (!existsSync(cliPath)) {
    throw new Error(`built CLI not found at ${cliPath}; run: mise exec -- pnpm build`);
  }
}

export function createWindowReport(options) {
  requireBuiltCli(options.cliPath);
  const common = commonFilterArguments(options);
  const query = options.query ? [options.query] : [];
  const searchResult = runCli(options.cliPath, [
    "evaluation",
    "search",
    ...query,
    "--evaluated",
    "true",
    ...common,
    "--limit",
    String(options.limit),
  ]);
  return buildReport(searchResult, options);
}

function exactSummary(cliPath, id) {
  const result = runCli(cliPath, [
    "evaluation",
    "search",
    "--id",
    id,
    "--evaluated",
    "true",
    "--limit",
    "1",
  ]);
  const records = resultArray(result, "records", "search").map(safeRecord);
  const warningCount = Array.isArray(result.warnings) ? result.warnings.length : 0;
  if (warningCount > 0) throw new Error(`evaluation search skipped ${warningCount} record(s)`);
  const exact = records.filter((record) => record.id.toLowerCase() === id.toLowerCase());
  if (exact.length !== 1) throw new Error(`evaluated record not found: ${id}`);
  return exact[0];
}

export function buildComparison(beforeInput, afterInput) {
  const before = safeRecord(beforeInput);
  const after = safeRecord(afterInput);
  if (before.id.toLowerCase() === after.id.toLowerCase()) {
    throw new Error("before and after records must be different");
  }
  const beforeGaps = new Set(before.missingFeatureKeys);
  const afterGaps = new Set(after.missingFeatureKeys);
  const scoreDelta =
    before.score === null || after.score === null ? null : after.score - before.score;
  return {
    schemaVersion: 1,
    before: {
      id: before.id,
      completedAt: before.completedAt,
      tool: before.tool,
      mcpVersion: before.mcpVersion,
      dataVersion: before.dataVersion,
      score: before.score,
      missingFeatureKeys: before.missingFeatureKeys,
    },
    after: {
      id: after.id,
      completedAt: after.completedAt,
      tool: after.tool,
      mcpVersion: after.mcpVersion,
      dataVersion: after.dataVersion,
      score: after.score,
      missingFeatureKeys: after.missingFeatureKeys,
    },
    checks: {
      chronological: Date.parse(after.completedAt) > Date.parse(before.completedAt),
      sameTool: before.tool === after.tool,
      sameInformationNeed: before.informationNeed === after.informationNeed,
      mcpVersionChanged: before.mcpVersion !== after.mcpVersion,
      dataVersionChanged: before.dataVersion !== after.dataVersion,
    },
    scoreDelta,
    gaps: {
      removed: before.missingFeatureKeys.filter((key) => !afterGaps.has(key)),
      remaining: before.missingFeatureKeys.filter((key) => afterGaps.has(key)),
      added: after.missingFeatureKeys.filter((key) => !beforeGaps.has(key)),
    },
  };
}

export function createComparison(options) {
  requireBuiltCli(options.cliPath);
  return buildComparison(
    exactSummary(options.cliPath, options.before),
    exactSummary(options.cliPath, options.after),
  );
}

function main(argv) {
  try {
    const options = parseArguments(argv);
    if (options.command === "help") {
      process.stdout.write(`${usage}\n`);
      return;
    }
    const result =
      options.command === "scan" ? createWindowReport(options) : createComparison(options);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (options.command === "scan" && !result.complete) process.exitCode = 2;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${usage}\n`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) main(process.argv.slice(2));

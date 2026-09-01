import { randomUUID } from "node:crypto";
import {
  chmodSync,
  closeSync,
  fchmodSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir, platform, arch as runtimeArch } from "node:os";
import { basename, dirname, join, parse as parsePath, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const EVALUATION_SCHEMA_VERSION = 1 as const;
export const EVALUATION_CONFIG_SCHEMA_VERSION = 1 as const;
export const EVALUATION_MARKER_RELATIVE_PATH = join(".minecraft-skills", "evaluation.disabled");

export type JsonPrimitive = null | boolean | number | string;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type EvaluationScore = 1 | 2 | 3 | 4 | 5;
export type EvaluationSource = "mcp" | "cli";
export type EvaluationOutcome = "success" | "tool-error" | "protocol-error" | "cancelled";

export interface EvaluationConfig {
  schemaVersion: typeof EVALUATION_CONFIG_SCHEMA_VERSION;
  enabled: boolean;
}

export interface EvaluationError {
  name: string;
  message: string;
}

export interface EvaluationRuntime {
  mcpVersion: string;
  dataVersion: string;
  nodeVersion: string;
  platform: string;
  arch: string;
}

export interface EvaluationRequest {
  method: "tools/call";
  tool: string;
  arguments: JsonValue;
}

export type EvaluationResponse =
  | {
      outcome: "success" | "tool-error";
      result: JsonValue;
    }
  | {
      outcome: "protocol-error" | "cancelled";
      error: EvaluationError;
    };

export interface EvaluationMissingFeature {
  key: string;
  summary: string;
}

export interface EvaluationAssessment {
  informationNeed: string;
  score: EvaluationScore;
  comment: string;
  missingFeatures: EvaluationMissingFeature[];
  source: EvaluationSource;
  evaluatedAt: string;
}

export interface EvaluationRecord {
  schemaVersion: typeof EVALUATION_SCHEMA_VERSION;
  id: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  runtime: EvaluationRuntime;
  request: EvaluationRequest;
  response: EvaluationResponse;
  evaluation?: EvaluationAssessment;
}

export interface CreateEvaluationRecordInput {
  startedAt: string | Date;
  completedAt?: string | Date;
  durationMs?: number;
  runtime: {
    mcpVersion: string;
    dataVersion: string;
    nodeVersion?: string;
    platform?: string;
    arch?: string;
  };
  request: {
    tool: string;
    arguments?: unknown;
  };
  response:
    | {
        outcome: "success" | "tool-error";
        result: unknown;
      }
    | {
        outcome: "protocol-error" | "cancelled";
        error: unknown;
      };
}

export interface EvaluationAssessmentInput {
  informationNeed: string;
  score: EvaluationScore;
  comment: string;
  missingFeatures?: readonly EvaluationMissingFeature[];
  source: EvaluationSource;
  evaluatedAt?: string | Date;
}

export type EvaluationRoot = string | URL | { uri: string | URL };

export interface EvaluationContext {
  cwd?: string;
  roots?: readonly EvaluationRoot[];
}

export interface CreateEvaluationStoreOptions extends EvaluationContext {
  rootDirectory?: string;
}

export interface EvaluationStore {
  readonly rootDirectory: string;
  readonly configPath: string;
  readonly recordsDirectory: string;
  readonly cwd: string;
  readonly roots: readonly EvaluationRoot[];
}

export type EvaluationConfigState = "enabled" | "disabled" | "missing" | "invalid";

export interface EvaluationWarning {
  path: string;
  message: string;
}

export interface EvaluationStatus {
  configState: EvaluationConfigState;
  globallyEnabled: boolean;
  effectiveEnabled: boolean;
  disabledByMarker: boolean;
  markerCheckFailed: boolean;
  markerPath: string | null;
  checkedRoots: string[];
  storageDirectory: string;
  configPath: string;
  recordsDirectory: string;
  recordCount: number;
  warnings: EvaluationWarning[];
}

export interface EvaluationGateStatus {
  configState: EvaluationConfigState;
  globallyEnabled: boolean;
  effectiveEnabled: boolean;
  disabledByMarker: boolean;
  markerCheckFailed: boolean;
  markerPath: string | null;
  checkedRoots: string[];
  warnings: EvaluationWarning[];
}

export interface EvaluationSearchFilters {
  query?: string;
  tool?: string;
  evaluated?: boolean;
  minScore?: EvaluationScore;
  maxScore?: EvaluationScore;
  missingFeature?: string;
  from?: string | Date;
  to?: string | Date;
  limit?: number;
}

export type EvaluationGapFilters = Omit<EvaluationSearchFilters, "evaluated" | "limit">;

export interface EvaluationRecordSummary {
  id: string;
  startedAt: string;
  completedAt: string;
  tool: string;
  mcpVersion: string;
  dataVersion: string;
  score: EvaluationScore | null;
  informationNeed: string | null;
  missingFeatureKeys: string[];
}

export interface EvaluationSearchResult {
  records: EvaluationRecordSummary[];
  warnings: EvaluationWarning[];
}

export interface EvaluationMissingFeatureGap {
  key: string;
  count: number;
  averageScore: number;
  tools: string[];
  mcpVersions: string[];
  dataVersions: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  recordIds: string[];
  summaries: string[];
}

export interface EvaluationGapResult {
  gaps: EvaluationMissingFeatureGap[];
  warnings: EvaluationWarning[];
}

export interface ReadEvaluationRecordsResult {
  records: EvaluationRecord[];
  notFound: string[];
  warnings: EvaluationWarning[];
}

export type DeleteEvaluationRecordsOptions =
  | { ids: readonly string[]; all?: never }
  | { all: true; ids?: never };

export interface DeleteEvaluationRecordsResult {
  deleted: string[];
  notFound: string[];
  cleanup: {
    temporaryFilesDeleted: number;
  };
  warnings: EvaluationWarning[];
}

export type EvaluationStoreErrorCode =
  | "INVALID_ID"
  | "NOT_FOUND"
  | "INVALID_CONFIG"
  | "INVALID_RECORD"
  | "INVALID_ASSESSMENT"
  | "UNSAFE_PATH"
  | "IO_ERROR";

export class EvaluationStoreError extends Error {
  readonly code: EvaluationStoreErrorCode;
  readonly path?: string;

  constructor(code: EvaluationStoreErrorCode, message: string, path?: string) {
    super(message);
    this.name = "EvaluationStoreError";
    this.code = code;
    if (path !== undefined) {
      this.path = path;
    }
  }
}

const uuidPatternSource = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const randomUuidPatternSource =
  "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const uuidPattern = new RegExp(`^${uuidPatternSource}$`, "i");
const temporaryRecordPattern = new RegExp(
  `^\\.(${uuidPatternSource})\\.json\\.([1-9][0-9]{0,9})\\.(${randomUuidPatternSource})\\.tmp$`,
);
const missingFeatureKeyPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const defaultSearchLimit = 20;
const maximumSearchLimit = 100;

export function defaultEvaluationRoot(): string {
  return join(homedir(), ".minecraft-skills", "evaluation");
}

export function createEvaluationStore(options: CreateEvaluationStoreOptions = {}): EvaluationStore {
  const cwd = resolve(options.cwd ?? process.cwd());
  return Object.freeze({
    rootDirectory: resolve(options.rootDirectory ?? defaultEvaluationRoot()),
    configPath: resolve(options.rootDirectory ?? defaultEvaluationRoot(), "config.json"),
    recordsDirectory: resolve(options.rootDirectory ?? defaultEvaluationRoot(), "records"),
    cwd,
    roots: Object.freeze([...(options.roots ?? [])]),
  });
}

function warning(path: string, error: unknown, prefix: string): EvaluationWarning {
  return {
    path,
    message: `${prefix}: ${error instanceof Error ? error.message : String(error)}`,
  };
}

function fixedWarning(path: string, message: string): EvaluationWarning {
  return { path, message };
}

function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

function pathComponents(path: string): string[] {
  const absolutePath = resolve(path);
  const root = parsePath(absolutePath).root;
  const segments = absolutePath
    .slice(root.length)
    .split(sep)
    .filter((segment) => segment.length > 0);
  const components = [root];
  let current = root;
  for (const segment of segments) {
    current = join(current, segment);
    components.push(current);
  }
  return components;
}

function inspectSafePath(
  path: string,
  expectedKind: "directory" | "file" | "entry",
  allowMissing: boolean,
): ReturnType<typeof lstatSync> | null {
  const components = pathComponents(path);
  for (const [index, component] of components.entries()) {
    let stat: ReturnType<typeof lstatSync>;
    try {
      stat = lstatSync(component);
    } catch (error) {
      if (isNodeError(error, "ENOENT") || isNodeError(error, "ENOTDIR")) {
        if (allowMissing) {
          return null;
        }
        throw new EvaluationStoreError(
          "NOT_FOUND",
          `Evaluation path does not exist: ${path}`,
          path,
        );
      }
      throw error;
    }
    const finalComponent = index === components.length - 1;
    if (stat.isSymbolicLink() && !(finalComponent && expectedKind === "entry")) {
      throw new EvaluationStoreError(
        "UNSAFE_PATH",
        `Evaluation path contains a symlink component: ${component}`,
        component,
      );
    }
    if (!finalComponent && !stat.isDirectory()) {
      throw new EvaluationStoreError(
        "UNSAFE_PATH",
        `Evaluation path contains a non-directory component: ${component}`,
        component,
      );
    }
    if (finalComponent) {
      if (expectedKind === "directory" && !stat.isDirectory()) {
        throw new EvaluationStoreError(
          "UNSAFE_PATH",
          `Evaluation path must be a real directory: ${path}`,
          path,
        );
      }
      if (expectedKind === "file" && !stat.isFile()) {
        throw new EvaluationStoreError(
          "UNSAFE_PATH",
          `Evaluation path must be a regular file: ${path}`,
          path,
        );
      }
      return stat;
    }
  }
  return null;
}

function assertSafeDirectory(path: string, allowMissing: boolean): boolean {
  return inspectSafePath(path, "directory", allowMissing) !== null;
}

function assertSafeFile(path: string, allowMissing: boolean): boolean {
  return inspectSafePath(path, "file", allowMissing) !== null;
}

function assertSafeRecordsTree(store: EvaluationStore, allowMissing: boolean): boolean {
  if (!assertSafeDirectory(store.rootDirectory, true)) {
    if (allowMissing) {
      return false;
    }
    throw new EvaluationStoreError(
      "NOT_FOUND",
      `Evaluation storage directory does not exist: ${store.rootDirectory}`,
      store.rootDirectory,
    );
  }
  if (!assertSafeDirectory(store.recordsDirectory, true)) {
    if (allowMissing) {
      return false;
    }
    throw new EvaluationStoreError(
      "NOT_FOUND",
      `Evaluation records directory does not exist: ${store.recordsDirectory}`,
      store.recordsDirectory,
    );
  }
  return true;
}

function applyMode(path: string, mode: number): void {
  try {
    chmodSync(path, mode);
  } catch (error) {
    if (process.platform !== "win32") {
      throw error;
    }
  }
}

function ensureDirectory(path: string): void {
  assertSafeDirectory(path, true);
  mkdirSync(path, { recursive: true, mode: 0o700 });
  assertSafeDirectory(path, false);
  applyMode(path, 0o700);
}

function atomicWriteJson(path: string, value: unknown): void {
  const directory = dirname(path);
  assertSafeDirectory(directory, false);
  assertSafeFile(path, true);
  const temporaryPath = join(directory, `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`);
  let descriptor: number | undefined;
  try {
    descriptor = openSync(temporaryPath, "wx", 0o600);
    writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    fsyncSync(descriptor);
    if (process.platform !== "win32") {
      fchmodSync(descriptor, 0o600);
    }
    closeSync(descriptor);
    descriptor = undefined;
    renameSync(temporaryPath, path);
  } finally {
    if (descriptor !== undefined) {
      closeSync(descriptor);
    }
    rmSync(temporaryPath, { force: true });
  }
}

function parseConfig(value: unknown): EvaluationConfig {
  if (
    typeof value !== "object" ||
    value === null ||
    !("schemaVersion" in value) ||
    value.schemaVersion !== EVALUATION_CONFIG_SCHEMA_VERSION ||
    !("enabled" in value) ||
    typeof value.enabled !== "boolean"
  ) {
    throw new EvaluationStoreError(
      "INVALID_CONFIG",
      `Evaluation config must have schemaVersion ${EVALUATION_CONFIG_SCHEMA_VERSION} and a boolean enabled field`,
    );
  }
  return { schemaVersion: EVALUATION_CONFIG_SCHEMA_VERSION, enabled: value.enabled };
}

function readConfig(store: EvaluationStore): {
  state: EvaluationConfigState;
  config: EvaluationConfig | null;
  warnings: EvaluationWarning[];
} {
  try {
    assertSafeDirectory(store.rootDirectory, true);
    if (!assertSafeFile(store.configPath, true)) {
      return { state: "missing", config: null, warnings: [] };
    }
    const config = parseConfig(JSON.parse(readFileSync(store.configPath, "utf8")) as unknown);
    return { state: config.enabled ? "enabled" : "disabled", config, warnings: [] };
  } catch (error) {
    void error;
    return {
      state: "invalid",
      config: null,
      warnings: [
        fixedWarning(
          store.configPath,
          "Evaluation config is unreadable, unsafe, or invalid; recording is disabled",
        ),
      ],
    };
  }
}

function normalizeRoot(root: EvaluationRoot, cwd: string): string | null {
  const value = typeof root === "object" && !(root instanceof URL) ? root.uri : root;
  if (value instanceof URL) {
    return value.protocol === "file:" ? resolve(fileURLToPath(value)) : null;
  }
  if (value.startsWith("file:")) {
    try {
      return resolve(fileURLToPath(new URL(value)));
    } catch {
      return null;
    }
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^[a-z]:[\\/]/i.test(value)) {
    return null;
  }
  return resolve(cwd, value);
}

function checkedRootPaths(store: EvaluationStore, context: EvaluationContext): string[] {
  const cwd = resolve(context.cwd ?? store.cwd);
  const roots = context.roots ?? store.roots;
  const normalized = roots
    .map((root) => normalizeRoot(root, cwd))
    .filter((root): root is string => root !== null);
  const selected = normalized.length > 0 ? normalized : [cwd];
  return [...new Set(selected)];
}

function findMarkerFrom(path: string): string | null {
  let current = resolve(path);
  while (true) {
    const candidate = join(current, EVALUATION_MARKER_RELATIVE_PATH);
    if (inspectSafePath(candidate, "entry", true)) {
      return candidate;
    }
    const parent = dirname(current);
    if (parent === current || current === parsePath(current).root) {
      return null;
    }
    current = parent;
  }
}

function recordEntryIds(store: EvaluationStore, warnings: EvaluationWarning[]): string[] {
  try {
    if (!assertSafeRecordsTree(store, true)) {
      return [];
    }
    const ids: string[] = [];
    for (const entry of readdirSync(store.recordsDirectory, { withFileTypes: true })) {
      const match = /^([0-9a-f-]+)\.json$/i.exec(entry.name);
      if (!match?.[1] || !uuidPattern.test(match[1])) {
        continue;
      }
      const path = join(store.recordsDirectory, entry.name);
      if (!entry.isFile() || entry.isSymbolicLink()) {
        warnings.push({ path, message: "Skipped non-regular evaluation record entry" });
        continue;
      }
      ids.push(match[1].toLowerCase());
    }
    return ids;
  } catch (error) {
    void error;
    warnings.push(
      fixedWarning(store.recordsDirectory, "Evaluation records directory is unreadable or unsafe"),
    );
    return [];
  }
}

function isOwnedTemporaryRecordName(name: string): boolean {
  const match = temporaryRecordPattern.exec(name);
  if (!match?.[2]) {
    return false;
  }
  const pid = Number(match[2]);
  return Number.isSafeInteger(pid) && pid > 0 && pid <= 4_294_967_295;
}

function cleanupTemporaryRecordFiles(
  store: EvaluationStore,
  warnings: EvaluationWarning[],
): number {
  try {
    if (!assertSafeRecordsTree(store, true)) {
      return 0;
    }
    let deleted = 0;
    for (const entry of readdirSync(store.recordsDirectory, { withFileTypes: true })) {
      if (!isOwnedTemporaryRecordName(entry.name)) {
        continue;
      }
      const path = join(store.recordsDirectory, entry.name);
      if (!entry.isFile() || entry.isSymbolicLink()) {
        warnings.push(fixedWarning(path, "Skipped unsafe evaluation temporary file"));
        continue;
      }
      try {
        assertSafeFile(path, false);
        unlinkSync(path);
        deleted += 1;
      } catch (error) {
        if (!isNodeError(error, "ENOENT")) {
          warnings.push(fixedWarning(path, "Could not safely delete evaluation temporary file"));
        }
      }
    }
    return deleted;
  } catch (error) {
    void error;
    warnings.push(
      fixedWarning(
        store.recordsDirectory,
        "Evaluation temporary files could not be safely inspected",
      ),
    );
    return 0;
  }
}

export function getEvaluationGateStatus(
  store: EvaluationStore,
  context: EvaluationContext = {},
): EvaluationGateStatus {
  const configResult = readConfig(store);
  const warnings = [...configResult.warnings];
  const globallyEnabled = configResult.config?.enabled === true;
  const checkedRoots = checkedRootPaths(store, context);
  let markerPath: string | null = null;
  let markerCheckFailed = false;
  for (const root of checkedRoots) {
    try {
      markerPath = findMarkerFrom(root);
    } catch (error) {
      void error;
      markerCheckFailed = true;
      warnings.push(
        fixedWarning(
          root,
          "The evaluation disable marker could not be checked; recording is disabled",
        ),
      );
    }
    if (markerPath) {
      break;
    }
  }
  return {
    configState: configResult.state,
    globallyEnabled,
    effectiveEnabled: globallyEnabled && markerPath === null && !markerCheckFailed,
    disabledByMarker: markerPath !== null,
    markerCheckFailed,
    markerPath,
    checkedRoots,
    warnings,
  };
}

export function getEvaluationStatus(
  store: EvaluationStore,
  context: EvaluationContext = {},
): EvaluationStatus {
  const gate = getEvaluationGateStatus(store, context);
  const warnings = [...gate.warnings];
  const recordCount = recordEntryIds(store, warnings).length;
  return {
    ...gate,
    storageDirectory: store.rootDirectory,
    configPath: store.configPath,
    recordsDirectory: store.recordsDirectory,
    recordCount,
    warnings,
  };
}

export function setEvaluationEnabled(store: EvaluationStore, enabled: boolean): EvaluationConfig {
  const config: EvaluationConfig = {
    schemaVersion: EVALUATION_CONFIG_SCHEMA_VERSION,
    enabled,
  };
  ensureDirectory(store.rootDirectory);
  atomicWriteJson(store.configPath, config);
  return config;
}

function requireString(value: unknown, field: string, maximum?: number): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new EvaluationStoreError("INVALID_RECORD", `${field} must be a non-empty string`);
  }
  if (maximum !== undefined && value.length > maximum) {
    throw new EvaluationStoreError(
      "INVALID_RECORD",
      `${field} must be at most ${maximum} characters`,
    );
  }
  return value;
}

function normalizeTimestamp(value: string | Date, field: string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new EvaluationStoreError("INVALID_RECORD", `${field} must be a valid timestamp`);
  }
  return date.toISOString();
}

function toJsonValue(value: unknown, field: string, seen = new WeakSet<object>()): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new EvaluationStoreError("INVALID_RECORD", `${field} contains a non-finite number`);
    }
    return value;
  }
  if (typeof value !== "object") {
    throw new EvaluationStoreError("INVALID_RECORD", `${field} contains a non-JSON value`);
  }
  if (seen.has(value)) {
    throw new EvaluationStoreError("INVALID_RECORD", `${field} contains a circular reference`);
  }
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((entry, index) => toJsonValue(entry, `${field}[${index}]`, seen));
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new EvaluationStoreError("INVALID_RECORD", `${field} contains a non-plain object`);
    }
    const result = Object.create(null) as { [key: string]: JsonValue };
    for (const [key, entry] of Object.entries(value)) {
      Object.defineProperty(result, key, {
        value: toJsonValue(entry, `${field}.${key}`, seen),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return result;
  } finally {
    seen.delete(value);
  }
}

export function normalizeEvaluationError(error: unknown): EvaluationError {
  if (error instanceof Error) {
    return {
      name: error.name || "Error",
      message: error.message || String(error),
    };
  }
  if (typeof error === "object" && error !== null) {
    const candidate = error as { name?: unknown; message?: unknown };
    if (typeof candidate.message === "string") {
      return {
        name: typeof candidate.name === "string" && candidate.name ? candidate.name : "Error",
        message: candidate.message,
      };
    }
  }
  return { name: "Error", message: String(error) };
}

function assertDuration(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new EvaluationStoreError(
      "INVALID_RECORD",
      "durationMs must be a finite non-negative number",
    );
  }
  return value;
}

function buildRecord(id: string, input: CreateEvaluationRecordInput): EvaluationRecord {
  const startedAt = normalizeTimestamp(input.startedAt, "startedAt");
  const completedAt = normalizeTimestamp(input.completedAt ?? new Date(), "completedAt");
  const durationMs = assertDuration(
    input.durationMs ?? Math.max(0, Date.parse(completedAt) - Date.parse(startedAt)),
  );
  const runtime: EvaluationRuntime = {
    mcpVersion: requireString(input.runtime.mcpVersion, "runtime.mcpVersion"),
    dataVersion: requireString(input.runtime.dataVersion, "runtime.dataVersion"),
    nodeVersion: requireString(input.runtime.nodeVersion ?? process.version, "runtime.nodeVersion"),
    platform: requireString(input.runtime.platform ?? platform(), "runtime.platform"),
    arch: requireString(input.runtime.arch ?? runtimeArch(), "runtime.arch"),
  };
  const request: EvaluationRequest = {
    method: "tools/call",
    tool: requireString(input.request.tool, "request.tool"),
    arguments: toJsonValue(input.request.arguments ?? {}, "request.arguments"),
  };
  let response: EvaluationResponse;
  if ("result" in input.response) {
    response = {
      outcome: input.response.outcome,
      result: toJsonValue(input.response.result, "response.result"),
    };
  } else {
    response = {
      outcome: input.response.outcome,
      error: normalizeEvaluationError(input.response.error),
    };
  }
  return {
    schemaVersion: EVALUATION_SCHEMA_VERSION,
    id,
    startedAt,
    completedAt,
    durationMs,
    runtime,
    request,
    response,
  };
}

function assertId(id: string): string {
  if (!uuidPattern.test(id)) {
    throw new EvaluationStoreError("INVALID_ID", `Invalid evaluation record ID: ${id}`);
  }
  return id.toLowerCase();
}

function pathForRecord(store: EvaluationStore, id: string): string {
  return join(store.recordsDirectory, `${assertId(id)}.json`);
}

export function createEvaluationRecord(
  store: EvaluationStore,
  input: CreateEvaluationRecordInput,
  context: EvaluationContext = {},
): EvaluationRecord | undefined {
  if (!getEvaluationGateStatus(store, context).effectiveEnabled) {
    return undefined;
  }
  ensureDirectory(store.rootDirectory);
  ensureDirectory(store.recordsDirectory);
  const record = buildRecord(randomUUID(), input);
  const path = pathForRecord(store, record.id);
  atomicWriteJson(path, record);
  return record;
}

function isRecord(value: unknown, expectedId?: string): EvaluationRecord {
  if (typeof value !== "object" || value === null) {
    throw new EvaluationStoreError("INVALID_RECORD", "Evaluation record must be an object");
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.schemaVersion !== EVALUATION_SCHEMA_VERSION) {
    throw new EvaluationStoreError("INVALID_RECORD", "Unsupported evaluation schemaVersion");
  }
  const id = assertId(requireString(candidate.id, "id"));
  if (expectedId !== undefined && id !== assertId(expectedId)) {
    throw new EvaluationStoreError(
      "INVALID_RECORD",
      "Evaluation record ID does not match its file",
    );
  }
  const startedAt = normalizeTimestamp(
    requireString(candidate.startedAt, "startedAt"),
    "startedAt",
  );
  const completedAt = normalizeTimestamp(
    requireString(candidate.completedAt, "completedAt"),
    "completedAt",
  );
  const durationMs = assertDuration(candidate.durationMs as number);
  const runtimeValue = candidate.runtime;
  if (typeof runtimeValue !== "object" || runtimeValue === null) {
    throw new EvaluationStoreError("INVALID_RECORD", "runtime must be an object");
  }
  const runtimeCandidate = runtimeValue as Record<string, unknown>;
  const runtime: EvaluationRuntime = {
    mcpVersion: requireString(runtimeCandidate.mcpVersion, "runtime.mcpVersion"),
    dataVersion: requireString(runtimeCandidate.dataVersion, "runtime.dataVersion"),
    nodeVersion: requireString(runtimeCandidate.nodeVersion, "runtime.nodeVersion"),
    platform: requireString(runtimeCandidate.platform, "runtime.platform"),
    arch: requireString(runtimeCandidate.arch, "runtime.arch"),
  };
  const requestValue = candidate.request;
  if (typeof requestValue !== "object" || requestValue === null) {
    throw new EvaluationStoreError("INVALID_RECORD", "request must be an object");
  }
  const requestCandidate = requestValue as Record<string, unknown>;
  if (requestCandidate.method !== "tools/call") {
    throw new EvaluationStoreError("INVALID_RECORD", "request.method must be tools/call");
  }
  const request: EvaluationRequest = {
    method: "tools/call",
    tool: requireString(requestCandidate.tool, "request.tool"),
    arguments: toJsonValue(requestCandidate.arguments, "request.arguments"),
  };
  const response = parseResponse(candidate.response);
  const record: EvaluationRecord = {
    schemaVersion: EVALUATION_SCHEMA_VERSION,
    id,
    startedAt,
    completedAt,
    durationMs,
    runtime,
    request,
    response,
  };
  if (candidate.evaluation !== undefined) {
    record.evaluation = parseAssessment(candidate.evaluation);
  }
  return record;
}

function parseResponse(value: unknown): EvaluationResponse {
  if (typeof value !== "object" || value === null || !("outcome" in value)) {
    throw new EvaluationStoreError("INVALID_RECORD", "response must be an object with outcome");
  }
  const response = value as Record<string, unknown>;
  if (response.outcome === "success" || response.outcome === "tool-error") {
    return {
      outcome: response.outcome,
      result: toJsonValue(response.result, "response.result"),
    };
  }
  if (response.outcome === "protocol-error" || response.outcome === "cancelled") {
    const error = response.error;
    if (typeof error !== "object" || error === null) {
      throw new EvaluationStoreError("INVALID_RECORD", "response.error must be an object");
    }
    const errorCandidate = error as Record<string, unknown>;
    return {
      outcome: response.outcome,
      error: {
        name: requireString(errorCandidate.name, "response.error.name"),
        message: requireString(errorCandidate.message, "response.error.message"),
      },
    };
  }
  throw new EvaluationStoreError("INVALID_RECORD", "Invalid response outcome");
}

function parseAssessment(value: unknown): EvaluationAssessment {
  if (typeof value !== "object" || value === null) {
    throw new EvaluationStoreError("INVALID_ASSESSMENT", "evaluation must be an object");
  }
  const assessment = value as Record<string, unknown>;
  const score = assessment.score;
  if (!Number.isInteger(score) || (score as number) < 1 || (score as number) > 5) {
    throw new EvaluationStoreError("INVALID_ASSESSMENT", "evaluation.score must be an integer 1-5");
  }
  if (assessment.source !== "mcp" && assessment.source !== "cli") {
    throw new EvaluationStoreError("INVALID_ASSESSMENT", "evaluation.source must be mcp or cli");
  }
  if (!Array.isArray(assessment.missingFeatures) || assessment.missingFeatures.length > 20) {
    throw new EvaluationStoreError(
      "INVALID_ASSESSMENT",
      "evaluation.missingFeatures must be an array with at most 20 entries",
    );
  }
  const missingFeatures = assessment.missingFeatures.map((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      throw new EvaluationStoreError(
        "INVALID_ASSESSMENT",
        `evaluation.missingFeatures[${index}] must be an object`,
      );
    }
    const feature = entry as Record<string, unknown>;
    const key = requireString(feature.key, `evaluation.missingFeatures[${index}].key`, 100);
    if (!missingFeatureKeyPattern.test(key)) {
      throw new EvaluationStoreError(
        "INVALID_ASSESSMENT",
        `evaluation.missingFeatures[${index}].key must be stable kebab-case`,
      );
    }
    return {
      key,
      summary: requireString(feature.summary, `evaluation.missingFeatures[${index}].summary`, 500),
    };
  });
  if (new Set(missingFeatures.map((feature) => feature.key)).size !== missingFeatures.length) {
    throw new EvaluationStoreError(
      "INVALID_ASSESSMENT",
      "evaluation.missingFeatures keys must be unique",
    );
  }
  return {
    informationNeed: requireString(assessment.informationNeed, "evaluation.informationNeed", 2000),
    score: score as EvaluationScore,
    comment: requireString(assessment.comment, "evaluation.comment", 4000),
    missingFeatures,
    source: assessment.source,
    evaluatedAt: normalizeTimestamp(
      requireString(assessment.evaluatedAt, "evaluation.evaluatedAt"),
      "evaluation.evaluatedAt",
    ),
  };
}

function assessmentFromInput(input: EvaluationAssessmentInput): EvaluationAssessment {
  return parseAssessment({
    informationNeed: input.informationNeed,
    score: input.score,
    comment: input.comment,
    missingFeatures: [...(input.missingFeatures ?? [])],
    source: input.source,
    evaluatedAt: normalizeTimestamp(input.evaluatedAt ?? new Date(), "evaluation.evaluatedAt"),
  });
}

function readRecordPath(path: string, expectedId: string): EvaluationRecord {
  assertSafeFile(path, false);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    void error;
    throw new EvaluationStoreError(
      "INVALID_RECORD",
      "Could not parse evaluation record JSON",
      path,
    );
  }
  try {
    return isRecord(parsed, expectedId);
  } catch (error) {
    if (error instanceof EvaluationStoreError) {
      throw new EvaluationStoreError(error.code, error.message, path);
    }
    throw error;
  }
}

export function readEvaluationRecord(store: EvaluationStore, id: string): EvaluationRecord {
  const normalizedId = assertId(id);
  assertSafeRecordsTree(store, false);
  return readRecordPath(pathForRecord(store, normalizedId), normalizedId);
}

export function readEvaluationRecords(
  store: EvaluationStore,
  ids: readonly string[],
): ReadEvaluationRecordsResult {
  const records: EvaluationRecord[] = [];
  const notFound: string[] = [];
  const warnings: EvaluationWarning[] = [];
  for (const id of new Set(ids.map(assertId))) {
    const path = pathForRecord(store, id);
    try {
      if (!assertSafeRecordsTree(store, true)) {
        notFound.push(id);
        continue;
      }
      records.push(readRecordPath(path, id));
    } catch (error) {
      if (error instanceof EvaluationStoreError && error.code === "NOT_FOUND") {
        notFound.push(id);
      } else {
        void error;
        warnings.push(
          fixedWarning(path, "Skipped unreadable, unsafe, or invalid evaluation record"),
        );
      }
    }
  }
  return { records, notFound, warnings };
}

export function rateEvaluationRecord(
  store: EvaluationStore,
  id: string,
  input: EvaluationAssessmentInput,
): EvaluationRecord {
  const normalizedId = assertId(id);
  const path = pathForRecord(store, normalizedId);
  const record = readEvaluationRecord(store, normalizedId);
  const updated: EvaluationRecord = {
    ...record,
    evaluation: assessmentFromInput(input),
  };
  atomicWriteJson(path, updated);
  return updated;
}

function* iterateEvaluationRecords(
  store: EvaluationStore,
  warnings: EvaluationWarning[],
): Generator<EvaluationRecord> {
  for (const id of recordEntryIds(store, warnings)) {
    const path = pathForRecord(store, id);
    try {
      yield readRecordPath(path, id);
    } catch (error) {
      void error;
      warnings.push(fixedWarning(path, "Skipped unreadable, unsafe, or invalid evaluation record"));
    }
  }
}

function compareNewestFirst(
  left: Pick<EvaluationRecord, "completedAt" | "id">,
  right: Pick<EvaluationRecord, "completedAt" | "id">,
): number {
  return (
    Date.parse(right.completedAt) - Date.parse(left.completedAt) || right.id.localeCompare(left.id)
  );
}

function validateSearchFilters(
  filters: EvaluationSearchFilters,
  applyLimit: boolean,
): {
  query: string | null;
  from: number | null;
  to: number | null;
  limit: number | null;
} {
  if (
    filters.minScore !== undefined &&
    (!Number.isInteger(filters.minScore) || filters.minScore < 1 || filters.minScore > 5)
  ) {
    throw new EvaluationStoreError("INVALID_ASSESSMENT", "minScore must be an integer 1-5");
  }
  if (
    filters.maxScore !== undefined &&
    (!Number.isInteger(filters.maxScore) || filters.maxScore < 1 || filters.maxScore > 5)
  ) {
    throw new EvaluationStoreError("INVALID_ASSESSMENT", "maxScore must be an integer 1-5");
  }
  if (
    filters.minScore !== undefined &&
    filters.maxScore !== undefined &&
    filters.minScore > filters.maxScore
  ) {
    throw new EvaluationStoreError("INVALID_ASSESSMENT", "minScore must not exceed maxScore");
  }
  const from =
    filters.from === undefined ? null : Date.parse(normalizeTimestamp(filters.from, "from"));
  const to = filters.to === undefined ? null : Date.parse(normalizeTimestamp(filters.to, "to"));
  if (from !== null && to !== null && from > to) {
    throw new EvaluationStoreError("INVALID_RECORD", "from must not be after to");
  }
  let limit: number | null = null;
  if (applyLimit) {
    limit = filters.limit ?? defaultSearchLimit;
    if (!Number.isInteger(limit) || limit < 1 || limit > maximumSearchLimit) {
      throw new EvaluationStoreError(
        "INVALID_RECORD",
        `limit must be an integer between 1 and ${maximumSearchLimit}`,
      );
    }
  }
  return { query: filters.query?.trim().toLowerCase() || null, from, to, limit };
}

function recordMatches(
  record: EvaluationRecord,
  filters: EvaluationSearchFilters,
  normalized: ReturnType<typeof validateSearchFilters>,
): boolean {
  const evaluation = record.evaluation;
  if (filters.tool !== undefined && record.request.tool !== filters.tool) {
    return false;
  }
  if (filters.evaluated !== undefined && (evaluation !== undefined) !== filters.evaluated) {
    return false;
  }
  if (
    filters.minScore !== undefined &&
    (evaluation === undefined || evaluation.score < filters.minScore)
  ) {
    return false;
  }
  if (
    filters.maxScore !== undefined &&
    (evaluation === undefined || evaluation.score > filters.maxScore)
  ) {
    return false;
  }
  if (
    filters.missingFeature !== undefined &&
    !evaluation?.missingFeatures.some((feature) => feature.key === filters.missingFeature)
  ) {
    return false;
  }
  const completed = Date.parse(record.completedAt);
  if (normalized.from !== null && completed < normalized.from) {
    return false;
  }
  if (normalized.to !== null && completed > normalized.to) {
    return false;
  }
  if (normalized.query !== null) {
    const searchable = [
      record.id,
      record.request.tool,
      record.runtime.mcpVersion,
      record.runtime.dataVersion,
      evaluation?.informationNeed,
      evaluation?.comment,
      ...(evaluation?.missingFeatures.flatMap((feature) => [feature.key, feature.summary]) ?? []),
    ]
      .filter((entry): entry is string => typeof entry === "string")
      .join("\n")
      .toLowerCase();
    if (!searchable.includes(normalized.query)) {
      return false;
    }
  }
  return true;
}

function summarizeRecord(record: EvaluationRecord): EvaluationRecordSummary {
  return {
    id: record.id,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    tool: record.request.tool,
    mcpVersion: record.runtime.mcpVersion,
    dataVersion: record.runtime.dataVersion,
    score: record.evaluation?.score ?? null,
    informationNeed: record.evaluation?.informationNeed ?? null,
    missingFeatureKeys: record.evaluation?.missingFeatures.map((feature) => feature.key) ?? [],
  };
}

export function searchEvaluationRecords(
  store: EvaluationStore,
  filters: EvaluationSearchFilters = {},
): EvaluationSearchResult {
  const normalized = validateSearchFilters(filters, true);
  const warnings: EvaluationWarning[] = [];
  const records: EvaluationRecordSummary[] = [];
  const limit = normalized.limit ?? defaultSearchLimit;
  for (const record of iterateEvaluationRecords(store, warnings)) {
    if (!recordMatches(record, filters, normalized)) {
      continue;
    }
    records.push(summarizeRecord(record));
    records.sort(compareNewestFirst);
    if (records.length > limit) {
      records.pop();
    }
  }
  return { records, warnings };
}

export function aggregateMissingFeatures(
  store: EvaluationStore,
  filters: EvaluationGapFilters = {},
): EvaluationGapResult {
  const searchFilters: EvaluationSearchFilters = { ...filters, evaluated: true };
  const normalized = validateSearchFilters(searchFilters, false);
  const warnings: EvaluationWarning[] = [];
  const aggregate = new Map<
    string,
    {
      count: number;
      score: number;
      tools: Set<string>;
      mcpVersions: Set<string>;
      dataVersions: Set<string>;
      firstSeenAt: string;
      lastSeenAt: string;
      records: Array<Pick<EvaluationRecord, "completedAt" | "id">>;
      summaries: Map<string, string>;
    }
  >();
  for (const record of iterateEvaluationRecords(store, warnings)) {
    if (!record.evaluation || !recordMatches(record, searchFilters, normalized)) {
      continue;
    }
    for (const feature of record.evaluation.missingFeatures) {
      const current = aggregate.get(feature.key);
      if (current) {
        current.count += 1;
        current.score += record.evaluation.score;
        current.tools.add(record.request.tool);
        current.mcpVersions.add(record.runtime.mcpVersion);
        current.dataVersions.add(record.runtime.dataVersion);
        current.records.push({ id: record.id, completedAt: record.completedAt });
        const previousSummaryAt = current.summaries.get(feature.summary);
        if (previousSummaryAt === undefined || record.completedAt > previousSummaryAt) {
          current.summaries.set(feature.summary, record.completedAt);
        }
        if (record.completedAt < current.firstSeenAt) {
          current.firstSeenAt = record.completedAt;
        }
        if (record.completedAt > current.lastSeenAt) {
          current.lastSeenAt = record.completedAt;
        }
      } else {
        aggregate.set(feature.key, {
          count: 1,
          score: record.evaluation.score,
          tools: new Set([record.request.tool]),
          mcpVersions: new Set([record.runtime.mcpVersion]),
          dataVersions: new Set([record.runtime.dataVersion]),
          firstSeenAt: record.completedAt,
          lastSeenAt: record.completedAt,
          records: [{ id: record.id, completedAt: record.completedAt }],
          summaries: new Map([[feature.summary, record.completedAt]]),
        });
      }
    }
  }
  const gaps = [...aggregate.entries()]
    .map(
      ([key, value]): EvaluationMissingFeatureGap => ({
        key,
        count: value.count,
        averageScore: value.score / value.count,
        tools: [...value.tools].sort(),
        mcpVersions: [...value.mcpVersions].sort(),
        dataVersions: [...value.dataVersions].sort(),
        firstSeenAt: value.firstSeenAt,
        lastSeenAt: value.lastSeenAt,
        recordIds: value.records.sort(compareNewestFirst).map((record) => record.id),
        summaries: [...value.summaries.entries()]
          .sort(
            ([leftSummary, leftAt], [rightSummary, rightAt]) =>
              Date.parse(rightAt) - Date.parse(leftAt) || leftSummary.localeCompare(rightSummary),
          )
          .map(([summary]) => summary),
      }),
    )
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
  return { gaps, warnings };
}

export function deleteEvaluationRecords(
  store: EvaluationStore,
  options: DeleteEvaluationRecordsOptions,
): DeleteEvaluationRecordsResult {
  const warnings: EvaluationWarning[] = [];
  const ids =
    "all" in options && options.all
      ? recordEntryIds(store, warnings)
      : [...new Set(options.ids.map(assertId))];
  const deleted: string[] = [];
  const notFound: string[] = [];
  for (const id of ids) {
    const path = pathForRecord(store, id);
    try {
      if (!assertSafeRecordsTree(store, true)) {
        notFound.push(id);
        continue;
      }
      assertSafeFile(path, false);
      unlinkSync(path);
      deleted.push(id);
    } catch (error) {
      if (error instanceof EvaluationStoreError && error.code === "NOT_FOUND") {
        notFound.push(id);
      } else if (isNodeError(error, "ENOENT")) {
        notFound.push(id);
      } else {
        warnings.push(warning(path, error, "Could not delete evaluation record"));
      }
    }
  }
  const temporaryFilesDeleted =
    "all" in options && options.all ? cleanupTemporaryRecordFiles(store, warnings) : 0;
  return {
    deleted,
    notFound,
    cleanup: { temporaryFilesDeleted },
    warnings,
  };
}

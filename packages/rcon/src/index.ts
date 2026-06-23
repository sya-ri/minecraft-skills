import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { Socket } from "node:net";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

export type RconPermissionPreset = "readonly" | "guarded" | "full";
export type RconPermissionMode = "allow" | "deny";

export type RconPermissions = {
  preset?: RconPermissionPreset;
  defaultMode?: RconPermissionMode;
  allow?: string[];
  deny?: string[];
};

export type RconProfileConfig = {
  host: string;
  port: number | string;
  password: string;
  timeoutMs?: number | string;
  permissions?: RconPermissions;
};

export type RconConfig = {
  $schema?: string;
  defaultProfile?: string;
  profiles: Record<string, RconProfileConfig>;
};

export type RconConfigStatusOptions = {
  configPath?: string;
  profile?: string;
};

export type RconConfigStatus = {
  configured: boolean;
  configPath: string | null;
  source: "explicit" | "env-config" | "local" | "user" | "env-profile" | "missing";
  profile: string | null;
  missing: string[];
  warnings: string[];
  message: string;
};

export type RconCreateConfigOptions = {
  configPath?: string;
  profile?: string;
  host?: string;
  port?: number | string;
  passwordEnv?: string;
  preset?: RconPermissionPreset;
  force?: boolean;
};

export type RconCreateConfigResult = {
  path: string;
  existed: boolean;
  written: boolean;
  warning: string | null;
  config: RconConfig;
};

export type RconCommandOptions = {
  command: string;
  configPath?: string;
  profile?: string;
  timeoutMs?: number;
};

export type RconPermissionDecision = {
  allowed: boolean;
  defaultMode: RconPermissionMode;
  matchedRule: {
    source: "allow" | "deny" | "default";
    pattern: string | null;
  };
  normalizedCommand: string;
};

export type RconCommandResult = {
  profile: string;
  host: string;
  port: number;
  command: string;
  response: string;
  permissionDecision: RconPermissionDecision;
};

export type ResolvedRconProfile = {
  configPath: string | null;
  source: RconConfigStatus["source"];
  profile: string;
  host: string;
  port: number;
  password: string;
  timeoutMs: number;
  permissions: Required<RconPermissions>;
  warnings: string[];
};

export type RconTransport = (profile: ResolvedRconProfile, command: string) => Promise<string>;

const defaultRconPort = 25575;
const defaultRconTimeoutMs = 2000;

const readonlyPermissions: Required<RconPermissions> = {
  preset: "readonly",
  defaultMode: "deny",
  allow: [
    "^list$",
    "^help(?: .+)?$",
    "^minecraft:help(?: .+)?$",
    "^version$",
    "^plugins$",
    "^pl$",
    "^bukkit:version$",
    "^bukkit:plugins$",
    "^time query (?:daytime|gametime|day)$",
    "^difficulty$",
    "^worldborder get$",
    "^gamerule [A-Za-z0-9_.:-]+$",
    "^datapack list(?: .+)?$",
    "^team list(?: .+)?$",
    "^scoreboard objectives list$",
    "^scoreboard players list(?: .+)?$",
    "^scoreboard players get .+$",
    "^bossbar list$",
    "^bossbar get .+$",
    "^attribute .+ get .+$",
    "^(?:experience|xp) query .+$",
    "^data get .+$",
    "^tag .+ list$",
    "^forceload query(?: .+)?$",
  ],
  deny: [],
};

const guardedPermissions: Required<RconPermissions> = {
  preset: "guarded",
  defaultMode: "allow",
  allow: [],
  deny: [
    "(?:^|\\s)(?:minecraft:)?(?:stop|restart)(?:$|\\s)",
    "(?:^|\\s)(?:minecraft:)?save-[A-Za-z-]+(?:$|\\s)",
    "(?:^|\\s)(?:minecraft:)?(?:op|deop|ban|ban-ip|pardon|pardon-ip|kick)(?:$|\\s)",
    "(?:^|\\s)(?:minecraft:)?whitelist(?:$|\\s)",
  ],
};

const fullPermissions: Required<RconPermissions> = {
  preset: "full",
  defaultMode: "allow",
  allow: [],
  deny: [],
};

function presetPermissions(preset: RconPermissionPreset): Required<RconPermissions> {
  if (preset === "readonly") {
    return readonlyPermissions;
  }
  if (preset === "guarded") {
    return guardedPermissions;
  }
  return fullPermissions;
}

function assertRconPermissionPreset(value: string): RconPermissionPreset {
  if (value === "readonly" || value === "guarded" || value === "full") {
    return value;
  }
  throw new Error(`Invalid RCON permission preset: ${value}`);
}

function assertRconPermissionMode(value: string): RconPermissionMode {
  if (value === "allow" || value === "deny") {
    return value;
  }
  throw new Error(`Invalid RCON permission defaultMode: ${value}`);
}

function stringArray(value: unknown, field: string): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
    throw new Error(`RCON permissions ${field} must be a string array`);
  }
  return value;
}

function normalizeRconCommand(command: string): string {
  return command.trim().replace(/^\/+/, "").replace(/\s+/g, " ");
}

function compileRconRegex(pattern: string): RegExp {
  try {
    return new RegExp(pattern, "i");
  } catch (error) {
    throw new Error(
      `Invalid RCON permission regex ${JSON.stringify(pattern)}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

export function resolveRconPermissions(permissions?: RconPermissions): Required<RconPermissions> {
  if (!permissions) {
    return { ...readonlyPermissions, allow: [...readonlyPermissions.allow], deny: [] };
  }
  const preset = permissions.preset ? assertRconPermissionPreset(permissions.preset) : undefined;
  const defaultMode = permissions.defaultMode
    ? assertRconPermissionMode(permissions.defaultMode)
    : undefined;
  const allow = stringArray(permissions.allow, "allow");
  const deny = stringArray(permissions.deny, "deny");
  const base = permissions.preset
    ? presetPermissions(preset ?? "readonly")
    : {
        preset: "readonly" as const,
        defaultMode: "deny" as const,
        allow: [],
        deny: [],
      };
  return {
    preset: preset ?? base.preset,
    defaultMode: defaultMode ?? base.defaultMode,
    allow: [...base.allow, ...allow],
    deny: [...base.deny, ...deny],
  };
}

export function evaluateRconPermission(
  command: string,
  permissions?: RconPermissions,
): RconPermissionDecision {
  const normalizedCommand = normalizeRconCommand(command);
  const resolved = resolveRconPermissions(permissions);
  for (const pattern of resolved.deny) {
    if (compileRconRegex(pattern).test(normalizedCommand)) {
      return {
        allowed: false,
        defaultMode: resolved.defaultMode,
        matchedRule: { source: "deny", pattern },
        normalizedCommand,
      };
    }
  }
  for (const pattern of resolved.allow) {
    if (compileRconRegex(pattern).test(normalizedCommand)) {
      return {
        allowed: true,
        defaultMode: resolved.defaultMode,
        matchedRule: { source: "allow", pattern },
        normalizedCommand,
      };
    }
  }
  return {
    allowed: resolved.defaultMode === "allow",
    defaultMode: resolved.defaultMode,
    matchedRule: { source: "default", pattern: null },
    normalizedCommand,
  };
}

function configHome(): string {
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "minecraft-skills");
  }
  if (process.platform === "win32") {
    return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "minecraft-skills");
  }
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "minecraft-skills");
}

export function defaultRconConfigPath(): string {
  return join(configHome(), "rcon.json");
}

function localRconConfigCandidates(cwd = process.cwd()): string[] {
  return [join(cwd, ".minecraft-skills", "rcon.json"), join(cwd, "minecraft-skills.rcon.json")];
}

function findRconConfigPath(explicitPath?: string): {
  path: string | null;
  source: RconConfigStatus["source"];
} {
  if (explicitPath) {
    return { path: resolve(explicitPath), source: "explicit" };
  }
  if (process.env.MINECRAFT_SKILLS_RCON_CONFIG) {
    return { path: resolve(process.env.MINECRAFT_SKILLS_RCON_CONFIG), source: "env-config" };
  }
  for (const candidate of localRconConfigCandidates()) {
    if (existsSync(candidate)) {
      return { path: candidate, source: "local" };
    }
  }
  const userPath = defaultRconConfigPath();
  if (existsSync(userPath)) {
    return { path: userPath, source: "user" };
  }
  return { path: null, source: "missing" };
}

function readRconConfig(path: string): RconConfig {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (typeof parsed !== "object" || parsed === null || !("profiles" in parsed)) {
    throw new Error(`Invalid RCON config: ${path}`);
  }
  const config = parsed as RconConfig;
  if (typeof config.profiles !== "object" || config.profiles === null) {
    throw new Error(`Invalid RCON config profiles: ${path}`);
  }
  return config;
}

function envValue(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

function resolveConfigValue(value: string | number, field: string, missing: string[]): string {
  if (typeof value === "number") {
    return String(value);
  }
  if (value.startsWith("$env:")) {
    const name = value.slice("$env:".length);
    const resolved = envValue(name);
    if (!resolved) {
      missing.push(name);
      return "";
    }
    return resolved;
  }
  if (field === "password") {
    return value;
  }
  return value;
}

function parsePort(value: string | number, missing: string[]): number {
  const resolved = resolveConfigValue(value, "port", missing);
  if (!resolved) {
    return defaultRconPort;
  }
  const port = Number(resolved);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid RCON port: ${resolved}`);
  }
  return port;
}

function parseTimeoutMs(value: string | number, missing: string[]): number {
  const resolved = resolveConfigValue(value, "timeoutMs", missing);
  if (!resolved) {
    return defaultRconTimeoutMs;
  }
  const timeoutMs = Number(resolved);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`Invalid RCON timeoutMs: ${resolved}`);
  }
  return timeoutMs;
}

function envProfile(): RconProfileConfig | null {
  const host = envValue("MINECRAFT_SKILLS_RCON_HOST");
  const password = envValue("MINECRAFT_SKILLS_RCON_PASSWORD");
  if (!host || !password) {
    return null;
  }
  return {
    host,
    port: envValue("MINECRAFT_SKILLS_RCON_PORT") ?? defaultRconPort,
    password,
    timeoutMs: envValue("MINECRAFT_SKILLS_RCON_TIMEOUT_MS") ?? defaultRconTimeoutMs,
    permissions: {
      preset:
        (envValue("MINECRAFT_SKILLS_RCON_PRESET") as RconPermissionPreset | undefined) ??
        "readonly",
    },
  };
}

function profileNameFrom(config: RconConfig | null, requested?: string): string | null {
  return requested ?? envValue("MINECRAFT_SKILLS_RCON_PROFILE") ?? config?.defaultProfile ?? null;
}

function resolveRconProfile(options: RconConfigStatusOptions = {}): {
  profile?: ResolvedRconProfile;
  status: RconConfigStatus;
} {
  const missing: string[] = [];
  const warnings: string[] = [];
  const found = findRconConfigPath(options.configPath);
  let config: RconConfig | null = null;
  if (found.path) {
    if (!existsSync(found.path)) {
      return {
        status: {
          configured: false,
          configPath: found.path,
          source: found.source,
          profile: null,
          missing: [found.path],
          warnings,
          message: `RCON config file does not exist: ${found.path}`,
        },
      };
    }
    config = readRconConfig(found.path);
  }

  const profileName = profileNameFrom(config, options.profile) ?? "env";
  const configProfile = config?.profiles[profileName];
  const profileConfig = configProfile ?? (!config ? envProfile() : null);
  if (!profileConfig) {
    return {
      status: {
        configured: false,
        configPath: found.path,
        source: found.source,
        profile: profileName,
        missing: config
          ? [`profiles.${profileName}`]
          : ["MINECRAFT_SKILLS_RCON_HOST", "MINECRAFT_SKILLS_RCON_PASSWORD"],
        warnings,
        message: config
          ? `RCON profile is not defined: ${profileName}`
          : "Set an RCON config file or MINECRAFT_SKILLS_RCON_HOST and MINECRAFT_SKILLS_RCON_PASSWORD.",
      },
    };
  }

  const merged: RconProfileConfig = {
    ...profileConfig,
    ...(envValue("MINECRAFT_SKILLS_RCON_HOST") ? { host: "$env:MINECRAFT_SKILLS_RCON_HOST" } : {}),
    ...(envValue("MINECRAFT_SKILLS_RCON_PORT") ? { port: "$env:MINECRAFT_SKILLS_RCON_PORT" } : {}),
    ...(envValue("MINECRAFT_SKILLS_RCON_PASSWORD")
      ? { password: "$env:MINECRAFT_SKILLS_RCON_PASSWORD" }
      : {}),
    ...(envValue("MINECRAFT_SKILLS_RCON_TIMEOUT_MS")
      ? { timeoutMs: "$env:MINECRAFT_SKILLS_RCON_TIMEOUT_MS" }
      : {}),
  };
  const host = resolveConfigValue(merged.host, "host", missing);
  const password = resolveConfigValue(merged.password, "password", missing);
  const port = parsePort(merged.port ?? defaultRconPort, missing);
  const timeoutMs = parseTimeoutMs(merged.timeoutMs ?? defaultRconTimeoutMs, missing);
  if (typeof merged.password === "string" && !merged.password.startsWith("$env:")) {
    warnings.push('RCON password is stored as a literal value. Prefer password: "$env:NAME".');
  }
  if (missing.length > 0 || !host || !password) {
    return {
      status: {
        configured: false,
        configPath: found.path,
        source: found.path ? found.source : "missing",
        profile: profileName,
        missing,
        warnings,
        message: `RCON profile ${profileName} is missing required values.`,
      },
    };
  }
  const envPreset = envValue("MINECRAFT_SKILLS_RCON_PRESET");
  const permissions = envPreset
    ? {
        ...(merged.permissions ?? {}),
        preset: envPreset as RconPermissionPreset,
      }
    : merged.permissions;
  const profile: ResolvedRconProfile = {
    configPath: found.path,
    source: found.path ? found.source : "env-profile",
    profile: profileName,
    host,
    port,
    password,
    timeoutMs,
    permissions: resolveRconPermissions(permissions),
    warnings,
  };
  return {
    profile,
    status: {
      configured: true,
      configPath: found.path,
      source: profile.source,
      profile: profileName,
      missing: [],
      warnings,
      message: `RCON profile ${profileName} is configured.`,
    },
  };
}

export function getRconConfigStatus(options: RconConfigStatusOptions = {}): RconConfigStatus {
  return resolveRconProfile(options).status;
}

export function isRconConfigured(options: RconConfigStatusOptions = {}): boolean {
  return getRconConfigStatus(options).configured;
}

export function createRconConfig(options: RconCreateConfigOptions = {}): RconCreateConfigResult {
  const path = resolve(options.configPath ?? defaultRconConfigPath());
  const existed = existsSync(path);
  const profile = options.profile ?? "local";
  const config: RconConfig = {
    $schema:
      "https://raw.githubusercontent.com/sya-ri/minecraft-skills/main/schema/rcon-config.schema.json",
    defaultProfile: profile,
    profiles: {
      [profile]: {
        host: options.host ?? "127.0.0.1",
        port: options.port ?? defaultRconPort,
        password: `$env:${options.passwordEnv ?? "MINECRAFT_SKILLS_RCON_PASSWORD"}`,
        permissions: {
          preset: options.preset ?? "readonly",
        },
      },
    },
  };
  if (existed && !options.force) {
    return {
      path,
      existed,
      written: false,
      warning: `RCON config already exists and was not overwritten: ${path}`,
      config,
    };
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  return {
    path,
    existed,
    written: true,
    warning: existed ? `Overwrote existing RCON config: ${path}` : null,
    config,
  };
}

function writePacket(socket: Socket, id: number, type: number, payload: string): void {
  const bodyLength = Buffer.byteLength(payload) + 10;
  const buffer = Buffer.alloc(bodyLength + 4);
  buffer.writeInt32LE(bodyLength, 0);
  buffer.writeInt32LE(id, 4);
  buffer.writeInt32LE(type, 8);
  buffer.write(payload, 12, "utf8");
  buffer.writeInt16LE(0, bodyLength + 2);
  socket.write(buffer);
}

function parsePackets(buffer: Buffer<ArrayBufferLike>): {
  packets: Array<{ id: number; type: number; body: string }>;
  rest: Buffer<ArrayBufferLike>;
} {
  const packets: Array<{ id: number; type: number; body: string }> = [];
  let offset = 0;
  while (buffer.length - offset >= 4) {
    const length = buffer.readInt32LE(offset);
    if (buffer.length - offset < length + 4) {
      break;
    }
    const start = offset + 4;
    const id = buffer.readInt32LE(start);
    const type = buffer.readInt32LE(start + 4);
    const body = buffer.subarray(start + 8, start + length - 2).toString("utf8");
    packets.push({ id, type, body });
    offset += length + 4;
  }
  return { packets, rest: buffer.subarray(offset) };
}

async function readPacketsUntil(
  socket: Socket,
  timeoutMs: number,
  stop: (packet: { id: number; type: number; body: string }) => boolean,
): Promise<Array<{ id: number; type: number; body: string }>> {
  return new Promise((resolvePromise, reject) => {
    let pending: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    const packets: Array<{ id: number; type: number; body: string }> = [];
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("RCON response timed out"));
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("end", onEnd);
      socket.off("close", onClose);
      socket.off("timeout", onTimeout);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onEnd = () => {
      cleanup();
      reject(new Error("RCON connection ended before the expected response was received"));
    };
    const onClose = () => {
      cleanup();
      reject(new Error("RCON connection closed before the expected response was received"));
    };
    const onTimeout = () => {
      cleanup();
      socket.destroy();
      reject(new Error("RCON response timed out"));
    };
    const onData = (chunk: Buffer) => {
      pending = Buffer.concat([pending, chunk]);
      const parsed = parsePackets(pending);
      pending = parsed.rest;
      for (const packet of parsed.packets) {
        packets.push(packet);
        if (stop(packet)) {
          cleanup();
          resolvePromise(packets);
          return;
        }
      }
    };
    socket.on("data", onData);
    socket.on("error", onError);
    socket.on("end", onEnd);
    socket.on("close", onClose);
    socket.on("timeout", onTimeout);
  });
}

export async function sendRconCommand(
  profile: ResolvedRconProfile,
  command: string,
): Promise<string> {
  const socket = new Socket();
  socket.setTimeout(profile.timeoutMs);
  await new Promise<void>((resolvePromise, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      socket.destroy();
      reject(new Error("RCON connection timed out"));
    }, profile.timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      socket.off("error", onError);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    socket.once("error", onError);
    socket.connect(profile.port, profile.host, () => {
      cleanup();
      resolvePromise();
    });
  });
  try {
    const authPromise = readPacketsUntil(
      socket,
      profile.timeoutMs,
      (packet) => packet.id === 1 || packet.id === -1,
    );
    writePacket(socket, 1, 3, profile.password);
    const authPackets = await authPromise;
    if (authPackets.some((packet) => packet.id === -1)) {
      throw new Error("RCON authentication failed");
    }

    const responsePromise = readPacketsUntil(
      socket,
      profile.timeoutMs,
      (packet) => packet.id === 3,
    );
    writePacket(socket, 2, 2, command);
    writePacket(socket, 3, 2, "");
    const responsePackets = await responsePromise;
    return responsePackets
      .filter((packet) => packet.id === 2)
      .map((packet) => packet.body)
      .join("");
  } finally {
    socket.end();
  }
}

export async function runRconCommand(
  options: RconCommandOptions,
  transport: RconTransport = sendRconCommand,
): Promise<RconCommandResult> {
  const resolved = resolveRconProfile(options);
  if (!resolved.profile) {
    throw new Error(resolved.status.message);
  }
  const command = normalizeRconCommand(options.command);
  if (!command) {
    throw new Error("RCON command must not be empty");
  }
  const permissionDecision = evaluateRconPermission(command, resolved.profile.permissions);
  if (!permissionDecision.allowed) {
    return {
      profile: resolved.profile.profile,
      host: resolved.profile.host,
      port: resolved.profile.port,
      command,
      response: "",
      permissionDecision,
    };
  }
  const profile = options.timeoutMs
    ? { ...resolved.profile, timeoutMs: options.timeoutMs }
    : resolved.profile;
  return {
    profile: profile.profile,
    host: profile.host,
    port: profile.port,
    command,
    response: await transport(profile, command),
    permissionDecision,
  };
}

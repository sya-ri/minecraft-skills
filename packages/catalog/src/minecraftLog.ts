export type MinecraftLogLevel = "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";

export type MinecraftLogFormat = "crash-report" | "minecraft-log" | "java-stacktrace" | "unknown";

export type MinecraftLogAnalysisLimits = {
  maxInputBytes: number;
  maxCharacters: number;
  maxLines: number;
  maxLineCharacters: number;
  maxEvents: number;
  maxExceptionChains: number;
  maxMixinFailures: number;
  maxExceptionDepth: number;
  maxExceptionEntries: number;
  maxStackFrames: number;
  maxPlatforms: number;
  maxArtifacts: number;
  maxComponents: number;
  maxTextCharacters: number;
  maxRetainedTextCharacters: number;
};

export type MinecraftLogAnalysisLimitName = keyof MinecraftLogAnalysisLimits;

export const defaultMinecraftLogAnalysisLimits: Readonly<MinecraftLogAnalysisLimits> =
  Object.freeze({
    maxInputBytes: 2 * 1_024 * 1_024,
    maxCharacters: 2 * 1_024 * 1_024,
    maxLines: 50_000,
    maxLineCharacters: 16_384,
    maxEvents: 500,
    maxExceptionChains: 100,
    maxMixinFailures: 100,
    maxExceptionDepth: 64,
    maxExceptionEntries: 500,
    maxStackFrames: 2_000,
    maxPlatforms: 50,
    maxArtifacts: 250,
    maxComponents: 250,
    maxTextCharacters: 2_048,
    maxRetainedTextCharacters: 512 * 1_024,
  });

export type MinecraftLogAnalysisOptions = {
  text: string;
  limits?: Partial<MinecraftLogAnalysisLimits>;
};

export type MinecraftLogEvent = {
  line: number;
  timestamp: string;
  thread: string | null;
  level: MinecraftLogLevel;
  logger: string | null;
  message: string;
};

export type MinecraftStackFrame = {
  line: number;
  frame: string;
  artifact: string | null;
};

export type MinecraftExceptionRelation = "thrown" | "caused-by" | "suppressed";

export type MinecraftExceptionSummary = {
  line: number;
  relation: MinecraftExceptionRelation;
  branch: "primary" | "cause" | "suppressed";
  type: string;
  message: string | null;
};

export type MinecraftExceptionEntry = MinecraftExceptionSummary & {
  totalFrames: number;
  collapsedFrames: number;
  omittedFrames: number;
  frames: MinecraftStackFrame[];
};

export type MinecraftExceptionChain = {
  startLine: number;
  endLine: number;
  eventLine: number | null;
  thread: string | null;
  totalEntries: number;
  omittedEntries: number;
  deepestCause: MinecraftExceptionSummary | null;
  entries: MinecraftExceptionEntry[];
};

export type MinecraftMixinFailureCategory =
  | "shadow-target-not-found"
  | "injection-target-not-found"
  | "injection-check-failed"
  | "mixin-package-class-load"
  | "invalid-static-member";

export type MinecraftMixinFailure = {
  line: number;
  relation: MinecraftExceptionRelation;
  branch: MinecraftExceptionSummary["branch"];
  exceptionType: string;
  category: MinecraftMixinFailureCategory;
  subject: string;
  annotation: string | null;
  memberKind: "field" | "method" | null;
  targetClass: string | null;
  targetMember: string | null;
  selector: string | null;
  mixinPackage: string | null;
  mixinConfig: string | null;
  succeeded: number | null;
  required: number | null;
  scannedTargets: number | null;
  noRefmapReported: boolean;
};

export type MinecraftLogArtifact = {
  name: string;
  firstLine: number;
  occurrences: number;
};

export type MinecraftLogComponent = {
  id: string;
  kind: "mod" | "plugin";
  firstLine: number;
  occurrences: number;
};

export type MinecraftLogPlatform = {
  platform:
    | "minecraft"
    | "paper"
    | "velocity"
    | "fabric-loader"
    | "quilt-loader"
    | "forge"
    | "neoforge";
  version: string;
  line: number;
};

export type MinecraftCrashReportMetadata = {
  description: string | null;
  minecraftVersion: string | null;
  javaVersion: string | null;
  operatingSystem: string | null;
};

export type MinecraftLogAnalysisResult = {
  schemaVersion: 1;
  format: MinecraftLogFormat;
  inputCharacters: number;
  processedCharacters: number;
  processedBytes: number;
  processedLines: number;
  analysisComplete: boolean;
  appliedLimits: MinecraftLogAnalysisLimits;
  exceededLimits: MinecraftLogAnalysisLimitName[];
  redactedValueCount: number;
  retainedTextCharacters: number;
  eventTotal: number;
  retainedEventCount: number;
  omittedEventCount: number;
  exceptionChainTotal: number;
  retainedExceptionChainCount: number;
  omittedExceptionChainCount: number;
  mixinFailureTotal: number;
  retainedMixinFailureCount: number;
  omittedMixinFailureCount: number;
  exceptionEntryTotal: number;
  retainedExceptionEntryCount: number;
  omittedExceptionEntryCount: number;
  stackFrameTotal: number;
  retainedStackFrameCount: number;
  omittedStackFrameCount: number;
  crashReport: MinecraftCrashReportMetadata | null;
  platforms: MinecraftLogPlatform[];
  artifacts: MinecraftLogArtifact[];
  components: MinecraftLogComponent[];
  events: MinecraftLogEvent[];
  exceptionChains: MinecraftExceptionChain[];
  mixinFailures: MinecraftMixinFailure[];
  notes: string[];
};

type ParsedLogEvent = Omit<MinecraftLogEvent, "line" | "message"> & { message: string };

type ParsedExceptionHeader = {
  relation: MinecraftExceptionRelation;
  indentation: number;
  type: string;
  message: string | null;
};

type MutableExceptionEntry = {
  output: MinecraftExceptionEntry | null;
  totalFrames: number;
  collapsedFrames: number;
};

type MutableExceptionChain = {
  output: MinecraftExceptionChain | null;
  current: MutableExceptionEntry | null;
  endLine: number;
  totalEntries: number;
  deepestCause: ParsedExceptionHeader | null;
  deepestCauseLine: number | null;
  suppressedBranchIndents: number[];
};

const logLevels = "TRACE|DEBUG|INFO|WARN|ERROR|FATAL";
const threadedLogPattern = new RegExp(
  `^\\[([^\\]]+)\\]\\s+\\[([^/\\]]+)\\/(${logLevels})\\](?:\\s+\\[([^\\]]+)\\])?:? ?(.*)$`,
);
const simpleLogPattern = new RegExp(`^\\[([^\\]]+?)\\s+(${logLevels})\\]:? ?(.*)$`);
const exceptionPattern =
  /^(?:(Caused by|Suppressed):\s*)?(?:Exception in thread "[^"]+"\s+)?((?:(?:[A-Za-z_$][\w$]*\.)*[A-Za-z_$][\w$]*(?:Exception|Error|Throwable)))(?::\s*(.*))?$/;
const stackFramePattern = /^\s*at\s+(.+?)\s*$/;
const collapsedFramesPattern = /^\s*\.\.\.\s+(\d+)\s+more\s*$/;
const jarPattern = /\b([A-Za-z0-9][A-Za-z0-9._+@-]{0,127}\.jar)\b/gi;
const mixinExceptionPrefix = "org.spongepowered.asm.mixin.";

export function resolveMinecraftLogAnalysisLimits(
  limits: Partial<MinecraftLogAnalysisLimits> | undefined,
): MinecraftLogAnalysisLimits {
  const resolve = (name: MinecraftLogAnalysisLimitName): number => {
    const fallback = defaultMinecraftLogAnalysisLimits[name];
    const requested = limits?.[name];
    return typeof requested === "number" && Number.isFinite(requested) && requested >= 1
      ? Math.min(Math.floor(requested), fallback)
      : fallback;
  };
  return {
    maxInputBytes: resolve("maxInputBytes"),
    maxCharacters: resolve("maxCharacters"),
    maxLines: resolve("maxLines"),
    maxLineCharacters: resolve("maxLineCharacters"),
    maxEvents: resolve("maxEvents"),
    maxExceptionChains: resolve("maxExceptionChains"),
    maxMixinFailures: resolve("maxMixinFailures"),
    maxExceptionDepth: resolve("maxExceptionDepth"),
    maxExceptionEntries: resolve("maxExceptionEntries"),
    maxStackFrames: resolve("maxStackFrames"),
    maxPlatforms: resolve("maxPlatforms"),
    maxArtifacts: resolve("maxArtifacts"),
    maxComponents: resolve("maxComponents"),
    maxTextCharacters: resolve("maxTextCharacters"),
    maxRetainedTextCharacters: resolve("maxRetainedTextCharacters"),
  };
}

function prefixWithinUtf8Bytes(
  value: string,
  maxBytes: number,
): { value: string; bytes: number; truncated: boolean } {
  let bytes = 0;
  let index = 0;
  while (index < value.length) {
    const codePoint = value.codePointAt(index);
    if (codePoint === undefined) {
      break;
    }
    const characterWidth = codePoint > 0xffff ? 2 : 1;
    const byteWidth = codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
    if (bytes + byteWidth > maxBytes) {
      break;
    }
    bytes += byteWidth;
    index += characterWidth;
  }
  return { value: value.slice(0, index), bytes, truncated: index < value.length };
}

function isUnsafeCodePoint(codePoint: number): boolean {
  return (
    (codePoint >= 0 && codePoint <= 8) ||
    codePoint === 11 ||
    codePoint === 12 ||
    codePoint === 13 ||
    (codePoint >= 14 && codePoint <= 31) ||
    (codePoint >= 127 && codePoint <= 159) ||
    codePoint === 0x00ad ||
    codePoint === 0x034f ||
    codePoint === 0x061c ||
    codePoint === 0x180e ||
    (codePoint >= 0x200b && codePoint <= 0x200f) ||
    (codePoint >= 0x202a && codePoint <= 0x202e) ||
    (codePoint >= 0x2060 && codePoint <= 0x206f) ||
    (codePoint >= 0xfe00 && codePoint <= 0xfe0f) ||
    codePoint === 0xfeff ||
    codePoint === 0xe0001 ||
    (codePoint >= 0xe0020 && codePoint <= 0xe007f) ||
    (codePoint >= 0xe0100 && codePoint <= 0xe01ef)
  );
}

function isNoncharacter(codePoint: number): boolean {
  return (codePoint >= 0xfdd0 && codePoint <= 0xfdef) || (codePoint & 0xffff) >= 0xfffe;
}

function consumeControlSequence(source: string, start: number): number {
  let index = start;
  while (index < source.length) {
    const current = source.codePointAt(index);
    if (current === undefined) break;
    index += current > 0xffff ? 2 : 1;
    if (current >= 0x40 && current <= 0x7e) break;
  }
  return index;
}

function consumeControlString(source: string, start: number, allowBell: boolean): number {
  let index = start;
  while (index < source.length) {
    const current = source.codePointAt(index);
    if (current === undefined) break;
    const currentWidth = current > 0xffff ? 2 : 1;
    if ((allowBell && current === 0x07) || current === 0x9c) {
      return index + currentWidth;
    }
    if (current === 0x1b && source.codePointAt(index + currentWidth) === 0x5c) {
      return index + currentWidth + 1;
    }
    index += currentWidth;
  }
  return index;
}

function normalizeLine(line: string): string {
  const source = line.endsWith("\r") ? line.slice(0, -1) : line;
  let output = "";
  for (let index = 0; index < source.length; ) {
    const codePoint = source.codePointAt(index);
    if (codePoint === undefined) {
      break;
    }
    const width = codePoint > 0xffff ? 2 : 1;
    if (codePoint === 0x1b) {
      const next = source.codePointAt(index + width);
      if (next === 0x5b) {
        index = consumeControlSequence(source, index + width + 1);
        continue;
      }
      if (next !== undefined && [0x5d, 0x50, 0x58, 0x5e, 0x5f].includes(next)) {
        index = consumeControlString(source, index + width + 1, next === 0x5d);
        continue;
      }
      index += width + (next === undefined ? 0 : next > 0xffff ? 2 : 1);
      continue;
    }
    if (codePoint === 0x9b) {
      index = consumeControlSequence(source, index + width);
      continue;
    }
    if (
      codePoint === 0x90 ||
      codePoint === 0x98 ||
      codePoint === 0x9d ||
      codePoint === 0x9e ||
      codePoint === 0x9f
    ) {
      index = consumeControlString(source, index + width, codePoint === 0x9d);
      continue;
    }
    if ((codePoint >= 0xd800 && codePoint <= 0xdfff) || isNoncharacter(codePoint)) {
      output += "�";
    } else if (!isUnsafeCodePoint(codePoint)) {
      output += String.fromCodePoint(codePoint);
    }
    index += width;
  }
  return output;
}

function boundedText(value: string, maxCharacters: number): string {
  if (value.length <= maxCharacters) {
    return value;
  }
  if (maxCharacters === 1) {
    return "…";
  }
  let end = maxCharacters - 1;
  if (
    end > 0 &&
    value.charCodeAt(end - 1) >= 0xd800 &&
    value.charCodeAt(end - 1) <= 0xdbff &&
    value.charCodeAt(end) >= 0xdc00 &&
    value.charCodeAt(end) <= 0xdfff
  ) {
    end -= 1;
  }
  return `${value.slice(0, end)}…`;
}

function safePrefix(value: string, maxCharacters: number): string {
  if (value.length <= maxCharacters) {
    return value;
  }
  let end = maxCharacters;
  if (
    end > 0 &&
    value.charCodeAt(end - 1) >= 0xd800 &&
    value.charCodeAt(end - 1) <= 0xdbff &&
    value.charCodeAt(end) >= 0xdc00 &&
    value.charCodeAt(end) <= 0xdfff
  ) {
    end -= 1;
  }
  return value.slice(0, end);
}

function pathBasename(value: string): string {
  return value.split(/[\\/]/).filter(Boolean).at(-1) ?? "[REDACTED]";
}

function redactedPath(value: string): string {
  if (/^\\\\/.test(value)) {
    return "[UNC_PATH]";
  }
  if (/^(?:[A-Za-z]:[\\/](?:Users|Documents and Settings)[\\/]|\/(?:home|Users)\/)/i.test(value)) {
    return "[USER_PATH]";
  }
  return `[PATH]/${pathBasename(value)}`;
}

function isIpv4Address(value: string): boolean {
  const address = value.replace(/:\d+$/, "");
  const octets = address.split(".");
  return (
    octets.length === 4 && octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255)
  );
}

function isIpv6Address(value: string): boolean {
  const address = value.split("%", 1)[0] ?? "";
  if (!/^[A-Fa-f0-9:]+$/.test(address) || !address.includes(":")) {
    return false;
  }
  const halves = address.split("::");
  if (halves.length > 2) {
    return false;
  }
  const groups = halves.flatMap((half) => (half ? half.split(":") : []));
  if (groups.some((group) => !/^[A-Fa-f0-9]{1,4}$/.test(group))) {
    return false;
  }
  return halves.length === 2 ? groups.length < 8 : groups.length === 8;
}

function isExplicitPlatformVersionContext(value: string, offset: number): boolean {
  const prefix = value.slice(Math.max(0, offset - 96), offset);
  return /(?:Minecraft Version:|This server is running Paper version|Booting up Velocity|(?:Fabric|Quilt) Loader(?: version)?\s*[: ]|NeoForge(?: version)?\s*[: ]|Forge Mod Loader(?: version)?\s*[: ])\s*$/i.test(
    prefix,
  );
}

function redactSensitiveData(value: string): { value: string; count: number } {
  let count = 0;
  const authorization = value.replace(
    /\b((?:proxy-)?authorization\s*:\s*)(?:(?:basic|bearer|digest)\s+)?[^\s,;]+/gi,
    (_match, prefix: string) => {
      count += 1;
      return `${prefix}[REDACTED]`;
    },
  );
  const cookie = authorization.replace(
    /\b((?:set-)?cookie\s*:\s*)[^\r\n]+/gi,
    (_match, prefix: string) => {
      count += 1;
      return `${prefix}[REDACTED]`;
    },
  );
  const userInfo = cookie.replace(
    /\b([a-z][a-z0-9+.-]*:\/\/)([^\s/@:]+):([^\s/@]+)@/gi,
    (_match, scheme: string) => {
      count += 1;
      return `${scheme}[CREDENTIALS_REDACTED]@`;
    },
  );
  const partialUserInfo = userInfo.replace(
    /\b([a-z][a-z0-9+.-]*:\/\/)([^\s/@:]+):([^\s/@:]+)(?=$|[\s/])/gi,
    (match, scheme: string, _user: string, credential: string) => {
      if (/^\d+$/.test(credential)) {
        return match;
      }
      count += 1;
      return `${scheme}[CREDENTIALS_REDACTED]`;
    },
  );
  const assigned = partialUserInfo.replace(
    /\b(password|passwd|pwd|token|(?:access|refresh|id)[_-]?token|secret|client[_-]?secret|api[_-]?key|private[_-]?key|credential|session(?:[_-]?id)?)(\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
    (_match, label: string, separator: string) => {
      count += 1;
      return `${label}${separator}[REDACTED]`;
    },
  );
  const queried = assigned.replace(
    /([?&](?:(?:access|refresh|id)_?token|api_?key|client_?secret|key|password|secret|session(?:_?id)?|token)=)[^&#\s]+/gi,
    (_match, prefix: string) => {
      count += 1;
      return `${prefix}[REDACTED]`;
    },
  );
  const ipv4 = queried.replace(
    /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g,
    (match, offset: number, source: string) => {
      if (
        !isIpv4Address(match) ||
        (!match.includes(":") && isExplicitPlatformVersionContext(source, offset))
      ) {
        return match;
      }
      count += 1;
      return "[IP_REDACTED]";
    },
  );
  const bracketedIpv6 = ipv4.replace(
    /\[([A-Fa-f0-9:%._-]{2,})\](?::\d+)?/g,
    (match, address: string) => {
      if (!isIpv6Address(address)) {
        return match;
      }
      count += 1;
      return "[IP_REDACTED]";
    },
  );
  const bareIpv6 = bracketedIpv6.replace(
    /(^|[^A-Fa-f0-9:])((?:[A-Fa-f0-9]{0,4}:){2,7}[A-Fa-f0-9]{0,4}(?:%[A-Za-z0-9._-]+)?)(?![A-Fa-f0-9:])/g,
    (match, prefix: string, address: string) => {
      if (!isIpv6Address(address)) {
        return match;
      }
      count += 1;
      return `${prefix}[IP_REDACTED]`;
    },
  );
  const quotedPaths = bareIpv6.replace(
    /(["'])((?:[A-Za-z]:[\\/]|\/|\\\\)[^"'\r\n]+)\1/g,
    (_match, quote: string, path: string) => {
      count += 1;
      return `${quote}${redactedPath(path)}${quote}`;
    },
  );
  const stackJarPaths = quotedPaths.replace(
    /\b[A-Za-z]:[\\/][^\s()[\]{}<>"']*?[\\/]([^\\/\s]+\.jar)(?=\/\/)/gi,
    (_path, artifact: string) => {
      count += 1;
      return `[PATH]/${artifact}`;
    },
  );
  const windowsUserPaths = stackJarPaths.replace(
    /\b[A-Za-z]:[\\/](?:Users|Documents and Settings)[\\/][^\\/\r\n]+/gi,
    () => {
      count += 1;
      return "[USER_PATH]";
    },
  );
  const uncPaths = windowsUserPaths.replace(
    /(^|[\s(=:"'])\\\\[^\\/\s]+[\\/][^\\/\s]+/g,
    (_match, prefix: string) => {
      count += 1;
      return `${prefix}[UNC_PATH]`;
    },
  );
  const windowsPaths = uncPaths.replace(/\b[A-Za-z]:[\\/][^\s()[\]{}<>"']+/g, (path) => {
    count += 1;
    return `[PATH]/${pathBasename(path)}`;
  });
  const unixUserPaths = windowsPaths.replace(
    /(^|[\s(=:])\/(?:home|Users)\/[^/\s()[\]{}<>"']+/g,
    (_match, prefix: string) => {
      count += 1;
      return `${prefix}[USER_PATH]`;
    },
  );
  const unixPaths = unixUserPaths.replace(
    /(^|[\s(=:])((?:\/[^/\s()[\]{}<>"']+){1,})/g,
    (_match, prefix: string, path: string) => {
      count += 1;
      return `${prefix}[PATH]/${pathBasename(path)}`;
    },
  );
  return { value: unixPaths, count };
}

function parseLogEvent(line: string): ParsedLogEvent | null {
  const threaded = threadedLogPattern.exec(line);
  if (threaded) {
    const timestamp = threaded[1];
    const thread = threaded[2];
    const level = threaded[3] as MinecraftLogLevel | undefined;
    const message = threaded[5];
    if (timestamp && thread && level && message !== undefined) {
      return {
        timestamp,
        thread,
        level,
        logger: threaded[4] ?? null,
        message,
      };
    }
  }
  const simple = simpleLogPattern.exec(line);
  if (!simple) {
    return null;
  }
  const timestamp = simple[1];
  const level = simple[2] as MinecraftLogLevel | undefined;
  const message = simple[3];
  return timestamp && level && message !== undefined
    ? { timestamp, thread: null, level, logger: null, message }
    : null;
}

function parseExceptionHeader(value: string): ParsedExceptionHeader | null {
  const indentationText = /^[ \t]*/.exec(value)?.[0] ?? "";
  const matched = exceptionPattern.exec(value.trim());
  if (!matched?.[2]) {
    return null;
  }
  return {
    relation:
      matched[1] === "Caused by"
        ? "caused-by"
        : matched[1] === "Suppressed"
          ? "suppressed"
          : "thrown",
    indentation: [...indentationText].reduce(
      (total, character) => total + (character === "\t" ? 4 : 1),
      0,
    ),
    type: matched[2],
    message: matched[3]?.trim() || null,
  };
}

type ParsedMixinFailure = Omit<
  MinecraftMixinFailure,
  "line" | "relation" | "branch" | "exceptionType"
>;

function safeEvidenceInteger(value: string): number | null {
  if (!/^(?:0|[1-9]\d{0,14})$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function mixinFailure(
  category: MinecraftMixinFailureCategory,
  subject: string,
  noRefmapReported: boolean,
  evidence: Partial<ParsedMixinFailure> = {},
): ParsedMixinFailure {
  return {
    category,
    subject,
    annotation: null,
    memberKind: null,
    targetClass: null,
    targetMember: null,
    selector: null,
    mixinPackage: null,
    mixinConfig: null,
    succeeded: null,
    required: null,
    scannedTargets: null,
    noRefmapReported,
    ...evidence,
  };
}

function parseMixinFailure(parsed: ParsedExceptionHeader): ParsedMixinFailure | null {
  if (!parsed.type.startsWith(mixinExceptionPrefix) || parsed.message === null) {
    return null;
  }
  const message = parsed.message;
  const noRefmapReported = /\bNo refMap loaded\b/i.test(message);

  if (parsed.type.endsWith(".InvalidMixinException")) {
    const shadow =
      /^@Shadow\s+(field|method)\s+(\S{1,16384})\s+was not located in (?:the )?target class\s+([A-Za-z0-9_.$/]{1,16384}?)(?:\.(?:\s|$)|$)/.exec(
        message,
      );
    if (shadow?.[1] && shadow[2] && shadow[3]) {
      return mixinFailure("shadow-target-not-found", shadow[2], noRefmapReported, {
        memberKind: shadow[1] as "field" | "method",
        targetClass: shadow[3],
        targetMember: shadow[2],
      });
    }

    const staticMember =
      /^Mixin\s+(.{1,16384}?)\s+contains non-private static\s+(field|method)\s+(\S{1,16384})/.exec(
        message,
      );
    if (staticMember?.[1] && staticMember[2] && staticMember[3]) {
      return mixinFailure("invalid-static-member", staticMember[1], noRefmapReported, {
        memberKind: staticMember[2] as "field" | "method",
        targetMember: staticMember[3],
      });
    }
    return null;
  }

  if (parsed.type.endsWith(".InvalidInjectionException")) {
    const missingTarget =
      /^(?:Critical injection failure:\s*)?@([A-Za-z][A-Za-z0-9_]{0,63})\s+annotation on\s+(.{1,16384}?)\s+could not find any targets matching\s+(['"])(.{1,16384}?)\3\s+in\s+([A-Za-z0-9_.$/]{1,16384}?)(?:\.(?:\s|$)|$)/.exec(
        message,
      );
    if (missingTarget?.[1] && missingTarget[2] && missingTarget[4] && missingTarget[5]) {
      return mixinFailure("injection-target-not-found", missingTarget[2], noRefmapReported, {
        annotation: missingTarget[1],
        targetClass: missingTarget[5],
        selector: missingTarget[4],
      });
    }
    return null;
  }

  if (parsed.type.endsWith(".InjectionError")) {
    const failedCheck =
      /^(?:Critical injection failure:\s*)?([A-Za-z][A-Za-z0-9_]{0,63})\s+(.{1,16384}?)\s+in\s+(\S{1,16384}?)(?:\s+from mod\s+\S{1,16384})?\s+failed injection check,\s*\((\d{1,16384})\/(\d{1,16384})\)\s+succeeded\.\s+Scanned\s+(\d{1,16384})\s+target\(s\)\./.exec(
        message,
      );
    if (
      failedCheck?.[1] &&
      failedCheck[2] &&
      failedCheck[3] &&
      failedCheck[4] &&
      failedCheck[5] &&
      failedCheck[6]
    ) {
      return mixinFailure(
        "injection-check-failed",
        `${failedCheck[1]} ${failedCheck[2]}`,
        noRefmapReported,
        {
          mixinConfig: failedCheck[3],
          succeeded: safeEvidenceInteger(failedCheck[4]),
          required: safeEvidenceInteger(failedCheck[5]),
          scannedTargets: safeEvidenceInteger(failedCheck[6]),
        },
      );
    }
    return null;
  }

  if (parsed.type.endsWith(".IllegalClassLoadError")) {
    const packageLoad =
      /^(\S{1,16384})\s+is in a defined mixin package\s+(\S{1,16384})\s+owned by\s+(\S{1,16384})\s+and cannot be referenced directly(?:\.|$)/.exec(
        message,
      );
    if (packageLoad?.[1] && packageLoad[2] && packageLoad[3]) {
      return mixinFailure("mixin-package-class-load", packageLoad[1], noRefmapReported, {
        mixinPackage: packageLoad[2],
        mixinConfig: packageLoad[3],
      });
    }
  }

  return null;
}

function artifactFromFrame(frame: string): string | null {
  const direct = /(?:^|[\\/])([^/\\\s]+\.jar)\/\//i.exec(frame)?.[1];
  if (direct) {
    return direct;
  }
  const source = /~?\[([^\]]+\.jar)(?::[^\]]*)?\]\s*$/i.exec(frame)?.[1];
  return source?.split(/[\\/]/).at(-1) ?? null;
}

function addArtifact(
  artifacts: Map<string, MinecraftLogArtifact>,
  name: string,
  line: number,
  limits: MinecraftLogAnalysisLimits,
  exceeded: Set<MinecraftLogAnalysisLimitName>,
  retain: (value: string) => string,
): void {
  const normalized = name.toLowerCase();
  const existing = artifacts.get(normalized);
  if (existing) {
    existing.occurrences += 1;
    return;
  }
  if (artifacts.size >= limits.maxArtifacts) {
    exceeded.add("maxArtifacts");
    return;
  }
  artifacts.set(normalized, { name: retain(name), firstLine: line, occurrences: 1 });
}

function addComponent(
  components: Map<string, MinecraftLogComponent>,
  component: Omit<MinecraftLogComponent, "firstLine" | "occurrences">,
  line: number,
  limits: MinecraftLogAnalysisLimits,
  exceeded: Set<MinecraftLogAnalysisLimitName>,
  retain: (value: string) => string,
): void {
  const key = `${component.kind}\0${component.id.toLowerCase()}`;
  const existing = components.get(key);
  if (existing) {
    existing.occurrences += 1;
    return;
  }
  if (components.size >= limits.maxComponents) {
    exceeded.add("maxComponents");
    return;
  }
  components.set(key, {
    ...component,
    id: retain(component.id),
    firstLine: line,
    occurrences: 1,
  });
}

function collectComponents(
  line: string,
  lineNumber: number,
  components: Map<string, MinecraftLogComponent>,
  limits: MinecraftLogAnalysisLimits,
  exceeded: Set<MinecraftLogAnalysisLimitName>,
  retain: (value: string) => string,
): void {
  const seen = new Set<string>();
  const addDetected = (id: string, kind: MinecraftLogComponent["kind"]): void => {
    const key = `${kind}\0${id.toLowerCase()}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    addComponent(components, { id, kind }, lineNumber, limits, exceeded, retain);
  };
  const modPatterns = [
    /provided by ['"]([A-Za-z0-9_.-]{1,128})['"]/gi,
    /Mixin apply for mod ([A-Za-z0-9_.-]{1,128})(?![A-Za-z0-9_.-])/gi,
    /(?:from|for) mod ['"]?([A-Za-z0-9_.-]{1,128})(?![A-Za-z0-9_.-])['"]?/gi,
  ];
  for (const pattern of modPatterns) {
    for (const matched of line.matchAll(pattern)) {
      const id = matched[1];
      if (id) {
        addDetected(id, "mod");
      }
    }
  }
  const pluginPatterns = [
    /Error occurred while (?:enabling|disabling|loading) ([A-Za-z0-9_.-]{1,128})(?![A-Za-z0-9_.-])(?:\s+v[^\s]+)?/gi,
    /Could not load ['"]plugins[\\/]([A-Za-z0-9_.-]{1,128}?)(?:\.jar)?['"]/gi,
  ];
  for (const pattern of pluginPatterns) {
    for (const matched of line.matchAll(pattern)) {
      const id = matched[1];
      if (id) {
        addDetected(id, "plugin");
      }
    }
  }
}

function collectPlatforms(
  line: string,
  lineNumber: number,
  platforms: Map<string, MinecraftLogPlatform>,
  limits: MinecraftLogAnalysisLimits,
  exceeded: Set<MinecraftLogAnalysisLimitName>,
  retain: (value: string) => string,
): void {
  const candidates: Array<{
    platform: MinecraftLogPlatform["platform"];
    pattern: RegExp;
  }> = [
    { platform: "minecraft", pattern: /^Minecraft Version:\s*([^\s]{1,256})/i },
    {
      platform: "paper",
      pattern: /This server is running Paper version\s+([^\s]{1,256})/i,
    },
    { platform: "velocity", pattern: /Booting up Velocity\s+([^\s(]{1,256})/i },
    {
      platform: "fabric-loader",
      pattern: /Fabric Loader(?: version)?\s*[: ]\s*([^\s]{1,256})/i,
    },
    {
      platform: "quilt-loader",
      pattern: /Quilt Loader(?: version)?\s*[: ]\s*([^\s]{1,256})/i,
    },
    { platform: "neoforge", pattern: /NeoForge(?: version)?\s*[: ]\s*([^\s]{1,256})/i },
    {
      platform: "forge",
      pattern: /Forge Mod Loader(?: version)?\s*[: ]\s*([^\s]{1,256})/i,
    },
  ];
  for (const candidate of candidates) {
    const version = candidate.pattern.exec(line)?.[1]?.replace(/[),;]+$/, "");
    if (!version) {
      continue;
    }
    const key = `${candidate.platform}\0${version.toLowerCase()}`;
    if (!platforms.has(key)) {
      if (platforms.size >= limits.maxPlatforms) {
        exceeded.add("maxPlatforms");
        continue;
      }
      platforms.set(key, {
        platform: candidate.platform,
        version: retain(version),
        line: lineNumber,
      });
    }
  }
}

function setCrashMetadata(
  line: string,
  metadata: MinecraftCrashReportMetadata,
  sanitize: (value: string) => string,
): void {
  const fields: Array<{
    label: string;
    key: keyof MinecraftCrashReportMetadata;
  }> = [
    { label: "Description", key: "description" },
    { label: "Minecraft Version", key: "minecraftVersion" },
    { label: "Java Version", key: "javaVersion" },
    { label: "Operating System", key: "operatingSystem" },
  ];
  for (const field of fields) {
    if (metadata[field.key] !== null) {
      continue;
    }
    const prefix = `${field.label}:`;
    if (line.startsWith(prefix)) {
      metadata[field.key] = sanitize(line.slice(prefix.length).trim());
    }
  }
}

export function analyzeMinecraftLog(
  options: MinecraftLogAnalysisOptions,
): MinecraftLogAnalysisResult {
  if (typeof options.text !== "string") {
    throw new Error("analyzeMinecraftLog requires string text");
  }
  const limits = resolveMinecraftLogAnalysisLimits(options.limits);
  const exceeded = new Set<MinecraftLogAnalysisLimitName>();
  const byteBoundedInput = prefixWithinUtf8Bytes(options.text, limits.maxInputBytes);
  if (byteBoundedInput.truncated) {
    exceeded.add("maxInputBytes");
  }
  const processedText = safePrefix(byteBoundedInput.value, limits.maxCharacters);
  const inputEndsMidLine =
    byteBoundedInput.truncated || processedText.length < byteBoundedInput.value.length;
  if (options.text.length > limits.maxCharacters) {
    exceeded.add("maxCharacters");
  }
  const processedBytes = prefixWithinUtf8Bytes(
    processedText,
    defaultMinecraftLogAnalysisLimits.maxInputBytes,
  ).bytes;

  const events: MinecraftLogEvent[] = [];
  const exceptionChains: MinecraftExceptionChain[] = [];
  const mixinFailures: MinecraftMixinFailure[] = [];
  const artifacts = new Map<string, MinecraftLogArtifact>();
  const components = new Map<string, MinecraftLogComponent>();
  const platforms = new Map<string, MinecraftLogPlatform>();
  const crashReport: MinecraftCrashReportMetadata = {
    description: null,
    minecraftVersion: null,
    javaVersion: null,
    operatingSystem: null,
  };
  let hasCrashReportMarker = false;
  let redactedValueCount = 0;
  let retainedTextCharacters = 0;
  let eventTotal = 0;
  let exceptionChainTotal = 0;
  let mixinFailureTotal = 0;
  let exceptionEntryTotal = 0;
  let retainedExceptionEntryCount = 0;
  let stackFrameTotal = 0;
  let retainedStackFrameCount = 0;
  let processedLines = 0;
  let activeChain: MutableExceptionChain | null = null;

  const sanitize = (value: string): string => {
    const bounded = boundedText(value, limits.maxTextCharacters);
    if (value.length > limits.maxTextCharacters) {
      exceeded.add("maxTextCharacters");
    }
    const remaining = limits.maxRetainedTextCharacters - retainedTextCharacters;
    if (remaining < 1) {
      exceeded.add("maxRetainedTextCharacters");
      return "";
    }
    if (bounded.length <= remaining) {
      retainedTextCharacters += bounded.length;
      return bounded;
    }
    exceeded.add("maxRetainedTextCharacters");
    const retained = boundedText(bounded, remaining);
    retainedTextCharacters += retained.length;
    return retained;
  };

  const finishEntry = (): void => {
    if (!activeChain?.current) {
      return;
    }
    const entry = activeChain.current;
    if (entry.output) {
      entry.output.totalFrames = entry.totalFrames;
      entry.output.collapsedFrames = entry.collapsedFrames;
      entry.output.omittedFrames = Math.max(0, entry.totalFrames - entry.output.frames.length);
    }
    activeChain.current = null;
  };

  const finishChain = (): void => {
    if (!activeChain) {
      return;
    }
    finishEntry();
    if (activeChain.output) {
      activeChain.output.endLine = activeChain.endLine;
      activeChain.output.omittedEntries = Math.max(
        0,
        activeChain.output.totalEntries - activeChain.output.entries.length,
      );
      if (activeChain.deepestCause && activeChain.deepestCauseLine !== null) {
        activeChain.output.deepestCause = {
          line: activeChain.deepestCauseLine,
          relation: "caused-by",
          branch: "cause",
          type: sanitize(activeChain.deepestCause.type),
          message:
            activeChain.deepestCause.message === null
              ? null
              : sanitize(activeChain.deepestCause.message),
        };
      }
      exceptionChains.push(activeChain.output);
    }
    activeChain = null;
  };

  const startChain = (line: number, event: ParsedLogEvent | null): void => {
    finishChain();
    exceptionChainTotal += 1;
    activeChain = {
      output:
        exceptionChains.length < limits.maxExceptionChains
          ? {
              startLine: line,
              endLine: line,
              eventLine: event ? line : null,
              thread: event?.thread ? sanitize(event.thread) : null,
              totalEntries: 0,
              omittedEntries: 0,
              deepestCause: null,
              entries: [],
            }
          : null,
      current: null,
      endLine: line,
      totalEntries: 0,
      deepestCause: null,
      deepestCauseLine: null,
      suppressedBranchIndents: [],
    };
    if (!activeChain.output) {
      exceeded.add("maxExceptionChains");
    }
  };

  const addMixinFailure = (
    parsed: ParsedMixinFailure,
    exception: ParsedExceptionHeader,
    branch: MinecraftExceptionSummary["branch"],
    line: number,
  ): void => {
    mixinFailureTotal += 1;
    if (mixinFailures.length >= limits.maxMixinFailures) {
      exceeded.add("maxMixinFailures");
      return;
    }
    const retainNullable = (value: string | null): string | null =>
      value === null ? null : sanitize(value);
    mixinFailures.push({
      ...parsed,
      line,
      relation: exception.relation,
      branch,
      exceptionType: sanitize(exception.type),
      subject: sanitize(parsed.subject),
      annotation: retainNullable(parsed.annotation),
      targetClass: retainNullable(parsed.targetClass),
      targetMember: retainNullable(parsed.targetMember),
      selector: retainNullable(parsed.selector),
      mixinPackage: retainNullable(parsed.mixinPackage),
      mixinConfig: retainNullable(parsed.mixinConfig),
    });
  };

  const addException = (
    parsed: ParsedExceptionHeader,
    line: number,
    event: ParsedLogEvent | null,
  ): void => {
    if (parsed.relation === "thrown" || !activeChain) {
      startChain(line, event);
    } else {
      finishEntry();
    }
    const chain = activeChain;
    if (!chain) {
      return;
    }
    exceptionEntryTotal += 1;
    chain.totalEntries += 1;
    chain.endLine = line;
    if (parsed.relation === "thrown") {
      chain.suppressedBranchIndents = [];
    } else if (parsed.relation === "suppressed") {
      while (
        chain.suppressedBranchIndents.length > 0 &&
        (chain.suppressedBranchIndents.at(-1) ?? -1) >= parsed.indentation
      ) {
        chain.suppressedBranchIndents.pop();
      }
      chain.suppressedBranchIndents.push(parsed.indentation);
    } else {
      while (
        chain.suppressedBranchIndents.length > 0 &&
        (chain.suppressedBranchIndents.at(-1) ?? -1) > parsed.indentation
      ) {
        chain.suppressedBranchIndents.pop();
      }
    }
    const branch: MinecraftExceptionSummary["branch"] =
      parsed.relation === "thrown"
        ? "primary"
        : parsed.relation === "suppressed" || chain.suppressedBranchIndents.length > 0
          ? "suppressed"
          : "cause";
    const mixinFailureEvidence = parseMixinFailure(parsed);
    if (mixinFailureEvidence) {
      addMixinFailure(mixinFailureEvidence, parsed, branch, line);
    }
    if (branch === "cause") {
      chain.deepestCause = parsed;
      chain.deepestCauseLine = line;
    }
    let output: MinecraftExceptionEntry | null = null;
    if (!chain.output) {
      output = null;
    } else if (chain.totalEntries > limits.maxExceptionDepth) {
      exceeded.add("maxExceptionDepth");
    } else if (retainedExceptionEntryCount >= limits.maxExceptionEntries) {
      exceeded.add("maxExceptionEntries");
    } else {
      const summary: MinecraftExceptionSummary = {
        line,
        relation: parsed.relation,
        branch,
        type: sanitize(parsed.type),
        message: parsed.message === null ? null : sanitize(parsed.message),
      };
      output = {
        ...summary,
        totalFrames: 0,
        collapsedFrames: 0,
        omittedFrames: 0,
        frames: [],
      };
      chain.output.entries.push(output);
      retainedExceptionEntryCount += 1;
    }
    if (chain.output) {
      chain.output.totalEntries = chain.totalEntries;
    }
    chain.current = { output, totalFrames: 0, collapsedFrames: 0 };
  };

  const addFrame = (frame: string, line: number): void => {
    const chain = activeChain;
    if (!chain?.current) {
      return;
    }
    stackFrameTotal += 1;
    chain.endLine = line;
    chain.current.totalFrames += 1;
    const artifact = artifactFromFrame(frame);
    if (!chain.current.output) {
      return;
    }
    if (retainedStackFrameCount < limits.maxStackFrames) {
      chain.current.output.frames.push({
        line,
        frame: sanitize(frame),
        artifact: artifact === null ? null : sanitize(artifact),
      });
      retainedStackFrameCount += 1;
    } else {
      exceeded.add("maxStackFrames");
    }
  };

  const addCollapsedFrames = (count: number, line: number): void => {
    const chain = activeChain;
    if (!chain?.current) {
      return;
    }
    chain.endLine = line;
    const boundedCount = Number.isSafeInteger(count) ? count : Number.MAX_SAFE_INTEGER;
    chain.current.collapsedFrames = Math.min(
      Number.MAX_SAFE_INTEGER,
      chain.current.collapsedFrames + boundedCount,
    );
  };

  const processTrace = (value: string, line: number, event: ParsedLogEvent | null): boolean => {
    const exception = parseExceptionHeader(value);
    if (exception) {
      addException(exception, line, event);
      return true;
    }
    const frame = stackFramePattern.exec(value)?.[1];
    if (frame) {
      addFrame(frame, line);
      return true;
    }
    const collapsed = collapsedFramesPattern.exec(value)?.[1];
    if (collapsed) {
      addCollapsedFrames(Number(collapsed), line);
      return true;
    }
    return false;
  };

  let cursor = 0;
  while (cursor < processedText.length && processedLines < limits.maxLines) {
    const newline = processedText.indexOf("\n", cursor);
    const end = newline === -1 ? processedText.length : newline;
    // A globally truncated final line has an unknown continuation, so even its apparent terminal
    // token may be only a sensitive prefix. It is counted but not retained as evidence.
    const originalLine =
      newline === -1 && inputEndsMidLine ? "" : normalizeLine(processedText.slice(cursor, end));
    processedLines += 1;
    const lineNumber = processedLines;
    if (originalLine.length > limits.maxLineCharacters) {
      exceeded.add("maxLineCharacters");
    }
    // Redaction must see complete, globally bounded lines. Cutting the source first can turn an
    // address, path, or credential into an unrecognizable prefix that would then be retained.
    const redactedLine = redactSensitiveData(originalLine);
    redactedValueCount += redactedLine.count;
    const line = safePrefix(redactedLine.value, limits.maxLineCharacters);

    if (line.includes("---- Minecraft Crash Report ----")) {
      hasCrashReportMarker = true;
    }
    setCrashMetadata(line.trim(), crashReport, sanitize);
    collectPlatforms(line, lineNumber, platforms, limits, exceeded, sanitize);
    collectComponents(line, lineNumber, components, limits, exceeded, sanitize);
    jarPattern.lastIndex = 0;
    for (const matched of line.matchAll(jarPattern)) {
      const artifact = matched[1];
      if (artifact) {
        addArtifact(artifacts, artifact, lineNumber, limits, exceeded, sanitize);
      }
    }

    const event = parseLogEvent(line);
    if (event) {
      eventTotal += 1;
      if (events.length < limits.maxEvents) {
        events.push({
          line: lineNumber,
          timestamp: sanitize(event.timestamp),
          thread: event.thread === null ? null : sanitize(event.thread),
          level: event.level,
          logger: event.logger === null ? null : sanitize(event.logger),
          message: sanitize(event.message),
        });
      } else {
        exceeded.add("maxEvents");
      }
      if (!processTrace(event.message, lineNumber, event)) {
        finishChain();
      }
    } else if (!processTrace(line, lineNumber, null)) {
      finishChain();
    }

    cursor = newline === -1 ? processedText.length : newline + 1;
  }
  if (cursor < processedText.length) {
    exceeded.add("maxLines");
  }
  finishChain();

  const crashMetadataAvailable = Object.values(crashReport).some((value) => value !== null);
  const format: MinecraftLogFormat = hasCrashReportMarker
    ? "crash-report"
    : eventTotal > 0
      ? "minecraft-log"
      : exceptionChainTotal > 0
        ? "java-stacktrace"
        : "unknown";
  const exceededLimits = [...exceeded].sort();

  return {
    schemaVersion: 1,
    format,
    inputCharacters: options.text.length,
    processedCharacters: processedText.length,
    processedBytes,
    processedLines,
    analysisComplete: exceededLimits.length === 0,
    appliedLimits: limits,
    exceededLimits,
    redactedValueCount,
    retainedTextCharacters,
    eventTotal,
    retainedEventCount: events.length,
    omittedEventCount: Math.max(0, eventTotal - events.length),
    exceptionChainTotal,
    retainedExceptionChainCount: exceptionChains.length,
    omittedExceptionChainCount: Math.max(0, exceptionChainTotal - exceptionChains.length),
    mixinFailureTotal,
    retainedMixinFailureCount: mixinFailures.length,
    omittedMixinFailureCount: Math.max(0, mixinFailureTotal - mixinFailures.length),
    exceptionEntryTotal,
    retainedExceptionEntryCount,
    omittedExceptionEntryCount: Math.max(0, exceptionEntryTotal - retainedExceptionEntryCount),
    stackFrameTotal,
    retainedStackFrameCount,
    omittedStackFrameCount: Math.max(0, stackFrameTotal - retainedStackFrameCount),
    crashReport: hasCrashReportMarker || crashMetadataAvailable ? crashReport : null,
    platforms: [...platforms.values()],
    artifacts: [...artifacts.values()],
    components: [...components.values()],
    events,
    exceptionChains,
    mixinFailures,
    notes: [
      "deepestCause is the last explicit Caused by entry on the primary branch, or null when no primary cause is present; suppressed branches never replace it.",
      "Exception ordering comes only from explicit thrown/Caused by/Suppressed text and does not prove which component is responsible.",
      "Artifacts and component IDs are extracted evidence labels, not blame attribution or compatibility claims.",
      "Mixin failures are categories extracted only from explicit Mixin exception wording; they do not identify blame or validate mappings, refmaps, configuration, target bytecode, a fix, or runtime compatibility.",
      "noRefmapReported is true only when the same exception message explicitly says that no refMap was loaded; false does not prove that a refmap was loaded or correct.",
      "Likely credentials, secret assignments, authentication headers, and sensitive URL values are redacted from retained output.",
      ...(exceededLimits.length > 0
        ? [
            "One or more analysis limits were reached; omitted input or output may contain additional evidence.",
          ]
        : []),
    ],
  };
}

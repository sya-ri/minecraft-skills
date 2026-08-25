import { createPublicKey, verify } from "node:crypto";
import { types as utilTypes } from "node:util";

const playerNamePattern = /^[A-Za-z0-9_]{1,16}$/;
const undashedUuidPattern = /^[0-9a-fA-F]{32}$/;
const dashedUuidPattern =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const textureHashPattern = /^[0-9a-f]{64}$/;
const canonicalBase64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

const maxProperties = 16;
const maxPropertyNameCharacters = 64;
const maxPropertyValueCharacters = 32_768;
const maxPropertySignatureCharacters = 8_192;
const maxProfileActions = 16;
const maxProfileActionCharacters = 64;
const maxPublicKeys = 8;
const maxPublicKeyCharacters = 16_384;
const maxTextureUrlCharacters = 512;
const maxTextureMetadataEntries = 8;
const maxTextureMetadataKeyCharacters = 64;
const maxTextureMetadataValueCharacters = 128;

export const javaPlayerProfileSourceEvidence = {
  minecraftVersion: "26.2",
  versionMetadataUrl:
    "https://piston-meta.mojang.com/v1/packages/c75d82e7fa6eca5a043dab0c6cf77cb8317644f4/26.2.json",
  clientSha1: "2dc72797acbc1b63fc16a11c4ac393605f453754",
  authlib: {
    version: "9.0.75",
    artifactUrl: "https://libraries.minecraft.net/com/mojang/authlib/9.0.75/authlib-9.0.75.jar",
    sha1: "d61056a234d5e4b272e09d59b0713f80d6c0b6af",
    size: 145_285,
    inspectedClasses: [
      "YggdrasilEnvironment",
      "YggdrasilGameProfileRepository",
      "YggdrasilMinecraftSessionService",
      "YggdrasilServicesKeyInfo",
      "TextureUrlChecker",
      "MinecraftTexturesPayload",
    ],
  },
  stability: "version-specific-undocumented" as const,
  notes: [
    "Exact service paths and response shapes are pinned to the official Minecraft 26.2 Authlib artifact, not a documented stable public API.",
    "Current signed payloads can contain signatureRequired while Authlib 9.0.75 models isPublic; neither boolean is exposed as a stable semantic claim.",
    "SHA1withRSA is the compatibility algorithm used by the pinned Authlib artifact, not a claim of account authentication or modern protocol negotiation.",
    "The 64-hex texture reference is extracted from verified signed metadata; its canonical HTTPS URL is derived by placing that reference into the fixed official URL shape and is not itself a signed string.",
  ],
  nonClaims: [
    "Microsoft or Xbox authentication",
    "account ownership",
    "offline-mode UUID derivation",
    "profile rename history",
    "skin licensing",
    "texture freshness",
    "Cloudflare or other hosting-provider reachability",
  ],
} as const;

export type JavaPlayerProfileEndpoint = "name-lookup" | "session-profile" | "public-keys";

export type JavaPlayerIdentity = {
  uuid: string;
  name: string;
};

export type JavaPlayerTextureModel = "slim" | "wide" | "unknown";

export type JavaPlayerTextureReference = {
  hash: string;
  canonicalUrl: string;
};

export type JavaPlayerSkinReference = JavaPlayerTextureReference & {
  model: JavaPlayerTextureModel;
  modelEvidence:
    | "signed-metadata-model-slim"
    | "signed-metadata-model-absent"
    | "signed-metadata-model-unrecognized";
};

export type VerifiedJavaPlayerTextures = {
  profile: JavaPlayerIdentity;
  timestamp: number;
  textures: {
    skin: JavaPlayerSkinReference | null;
    cape: JavaPlayerTextureReference | null;
    elytra: JavaPlayerTextureReference | null;
  };
  verification: {
    state: "verified";
    algorithm: "SHA1withRSA";
    keySource: "official-profile-property-keys";
  };
};

export type JavaPlayerInvalidInputOutcome = {
  status: "invalid-input";
  field: "name" | "uuid" | "verification-input";
  code: "unsupported-format" | "unsupported-structure";
};

export type JavaPlayerNotFoundOutcome = {
  status: "not-found";
  endpoint: "name-lookup" | "session-profile";
};

export type JavaPlayerForbiddenOutcome = {
  status: "forbidden";
  endpoint: "name-lookup" | "session-profile";
  httpStatus: 403;
};

export type JavaPlayerRateLimitedOutcome = {
  status: "rate-limited";
  endpoint: JavaPlayerProfileEndpoint;
  httpStatus: 429;
  retryAfterSeconds: number | null;
};

export type JavaPlayerUpstreamErrorOutcome = {
  status: "upstream-error";
  endpoint: "name-lookup" | "session-profile";
  code: "network" | "timeout" | "redirect-rejected" | "service-unavailable" | "unexpected-status";
  httpStatus?: number;
};

export type JavaPlayerInvalidResponseOutcome = {
  status: "invalid-response";
  endpoint: "name-lookup" | "session-profile";
  code:
    | "invalid-content-type"
    | "invalid-status"
    | "unsupported-content-encoding"
    | "invalid-content-length"
    | "oversized-response"
    | "response-chunk-limit-exceeded"
    | "truncated-response"
    | "missing-body"
    | "body-read-failed"
    | "invalid-utf8"
    | "invalid-json"
    | "invalid-schema"
    | "invalid-textures-payload"
    | "unsafe-texture-reference";
};

export type JavaPlayerIdentityMismatchOutcome = {
  status: "identity-mismatch";
  endpoint: "name-lookup" | "session-profile";
  code: "requested-name" | "requested-uuid" | "payload-uuid" | "payload-name";
};

export type JavaPlayerSignatureMissingOutcome = {
  status: "signature-missing";
  endpoint: "session-profile";
};

export type JavaPlayerTexturesPropertyMissingOutcome = {
  status: "textures-property-missing";
  endpoint: "session-profile";
};

export type JavaPlayerInvalidSignatureOutcome = {
  status: "invalid-signature";
  endpoint: "session-profile";
  code: "malformed-signature" | "verification-failed";
};

export type JavaPlayerKeyUnavailableOutcome = {
  status: "key-unavailable";
  endpoint: "public-keys";
  code:
    | "network"
    | "timeout"
    | "forbidden"
    | "not-found"
    | "redirect-rejected"
    | "service-unavailable"
    | "unexpected-status"
    | "invalid-response"
    | "no-usable-keys";
  httpStatus?: number;
};

export type JavaPlayerProfileFailure =
  | JavaPlayerInvalidInputOutcome
  | JavaPlayerNotFoundOutcome
  | JavaPlayerForbiddenOutcome
  | JavaPlayerRateLimitedOutcome
  | JavaPlayerUpstreamErrorOutcome
  | JavaPlayerInvalidResponseOutcome
  | JavaPlayerIdentityMismatchOutcome
  | JavaPlayerTexturesPropertyMissingOutcome
  | JavaPlayerSignatureMissingOutcome
  | JavaPlayerInvalidSignatureOutcome
  | JavaPlayerKeyUnavailableOutcome;

export type JavaPlayerNameNormalizationOutcome =
  | {
      status: "normalized";
      lookupName: string;
    }
  | JavaPlayerInvalidInputOutcome;

export type JavaPlayerUuidNormalizationOutcome =
  | {
      status: "normalized";
      uuid: string;
      undashedUuid: string;
    }
  | JavaPlayerInvalidInputOutcome;

export type JavaPlayerProfileLookupParseOutcome =
  | {
      status: "found";
      profile: JavaPlayerIdentity;
    }
  | JavaPlayerInvalidResponseOutcome
  | JavaPlayerIdentityMismatchOutcome;

export type JavaPlayerSessionInspectionOutcome =
  | {
      status: "ready-for-verification";
      profile: JavaPlayerIdentity;
    }
  | JavaPlayerInvalidResponseOutcome
  | JavaPlayerIdentityMismatchOutcome
  | JavaPlayerTexturesPropertyMissingOutcome
  | JavaPlayerSignatureMissingOutcome
  | JavaPlayerInvalidSignatureOutcome;

export type JavaPlayerTextureVerificationOutcome =
  | {
      status: "verified";
      data: VerifiedJavaPlayerTextures;
    }
  | JavaPlayerInvalidResponseOutcome
  | JavaPlayerIdentityMismatchOutcome
  | JavaPlayerTexturesPropertyMissingOutcome
  | JavaPlayerSignatureMissingOutcome
  | JavaPlayerInvalidSignatureOutcome
  | JavaPlayerKeyUnavailableOutcome;

type JsonRecordReadResult = { ok: true; value: Record<string, unknown> } | { ok: false };

type JsonArrayReadResult = { ok: true; value: unknown[] } | { ok: false };

type ParsedSessionProfile = {
  profile: JavaPlayerIdentity;
  textureProperty: {
    value: string;
    signature: string;
  };
};

type SessionProfileParseFailure = Exclude<
  JavaPlayerSessionInspectionOutcome,
  { status: "ready-for-verification" }
>;

function hasAsciiControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 32 || codePoint === 127;
  });
}

function readJsonRecord(value: unknown, allowedKeys: readonly string[]): JsonRecordReadResult {
  if (
    typeof value !== "object" ||
    value === null ||
    utilTypes.isProxy(value) ||
    Array.isArray(value)
  ) {
    return { ok: false };
  }

  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return { ok: false };
    }
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      return { ok: false };
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const names = Object.keys(descriptors);
    if (names.some((name) => !allowedKeys.includes(name))) {
      return { ok: false };
    }
    const record: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const name of names) {
      const descriptor = descriptors[name];
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return { ok: false };
      }
      record[name] = descriptor.value;
    }
    return { ok: true, value: record };
  } catch {
    return { ok: false };
  }
}

function readJsonRecordAllowUnknown(
  value: unknown,
  requiredKeys: readonly string[],
  maxEntries: number,
): JsonRecordReadResult {
  if (
    typeof value !== "object" ||
    value === null ||
    utilTypes.isProxy(value) ||
    Array.isArray(value)
  ) {
    return { ok: false };
  }

  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return { ok: false };
    }
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      return { ok: false };
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const names = Object.keys(descriptors);
    if (names.length > maxEntries || requiredKeys.some((key) => !names.includes(key))) {
      return { ok: false };
    }
    const record: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const name of names) {
      const descriptor = descriptors[name];
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return { ok: false };
      }
      record[name] = descriptor.value;
    }
    return { ok: true, value: record };
  } catch {
    return { ok: false };
  }
}

function readJsonArray(value: unknown, maxLength: number): JsonArrayReadResult {
  if (
    typeof value !== "object" ||
    value === null ||
    utilTypes.isProxy(value) ||
    !Array.isArray(value) ||
    value.length > maxLength
  ) {
    return { ok: false };
  }

  try {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      return { ok: false };
    }
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      return { ok: false };
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const entries: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return { ok: false };
      }
      entries.push(descriptor.value);
    }
    const allowedNames = new Set(["length", ...entries.map((_entry, index) => String(index))]);
    if (Object.keys(descriptors).some((name) => !allowedNames.has(name))) {
      return { ok: false };
    }
    return { ok: true, value: entries };
  } catch {
    return { ok: false };
  }
}

function readExtensibleStringRecord(
  value: unknown,
  maxEntries: number,
  maxKeyCharacters: number,
  maxValueCharacters: number,
): JsonRecordReadResult {
  if (
    typeof value !== "object" ||
    value === null ||
    utilTypes.isProxy(value) ||
    Array.isArray(value)
  ) {
    return { ok: false };
  }

  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return { ok: false };
    }
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      return { ok: false };
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const names = Object.keys(descriptors);
    if (names.length > maxEntries) {
      return { ok: false };
    }
    const record: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const name of names) {
      const descriptor = descriptors[name];
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        !descriptor.enumerable ||
        name.length === 0 ||
        name.length > maxKeyCharacters ||
        hasAsciiControlCharacter(name) ||
        typeof descriptor.value !== "string" ||
        descriptor.value.length > maxValueCharacters ||
        hasAsciiControlCharacter(descriptor.value)
      ) {
        return { ok: false };
      }
      record[name] = descriptor.value;
    }
    return { ok: true, value: record };
  } catch {
    return { ok: false };
  }
}

function isBoundedString(value: unknown, maxCharacters: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxCharacters &&
    !hasAsciiControlCharacter(value)
  );
}

function decodeCanonicalBase64(value: string, maxCharacters: number): Uint8Array | null {
  if (
    value.length === 0 ||
    value.length > maxCharacters ||
    value.length % 4 !== 0 ||
    !canonicalBase64Pattern.test(value)
  ) {
    return null;
  }
  const decoded = Buffer.from(value, "base64");
  return decoded.toString("base64") === value ? decoded : null;
}

function canonicalUuid(undashedUuid: string): string {
  return `${undashedUuid.slice(0, 8)}-${undashedUuid.slice(8, 12)}-${undashedUuid.slice(12, 16)}-${undashedUuid.slice(16, 20)}-${undashedUuid.slice(20)}`;
}

function normalizeResponseUuid(value: unknown): { uuid: string; undashedUuid: string } | null {
  if (typeof value !== "string") {
    return null;
  }
  const undashedUuid = value.replaceAll("-", "").toLowerCase();
  if (
    (!undashedUuidPattern.test(value) && !dashedUuidPattern.test(value)) ||
    !undashedUuidPattern.test(undashedUuid)
  ) {
    return null;
  }
  return { uuid: canonicalUuid(undashedUuid), undashedUuid };
}

function invalidResponse(
  endpoint: "name-lookup" | "session-profile",
  code: JavaPlayerInvalidResponseOutcome["code"],
): JavaPlayerInvalidResponseOutcome {
  return { status: "invalid-response", endpoint, code };
}

export function normalizeJavaPlayerName(value: unknown): JavaPlayerNameNormalizationOutcome {
  if (typeof value !== "string" || !playerNamePattern.test(value)) {
    return {
      status: "invalid-input",
      field: "name",
      code: "unsupported-format",
    };
  }
  return { status: "normalized", lookupName: value.toLowerCase() };
}

export function normalizeJavaPlayerUuid(value: unknown): JavaPlayerUuidNormalizationOutcome {
  const normalized = normalizeResponseUuid(value);
  if (normalized === null) {
    return {
      status: "invalid-input",
      field: "uuid",
      code: "unsupported-format",
    };
  }
  return { status: "normalized", ...normalized };
}

export function parseJavaPlayerProfileLookupResponse(
  value: unknown,
  expectedLookupName: string,
): JavaPlayerProfileLookupParseOutcome {
  const record = readJsonRecord(value, ["id", "name"]);
  if (
    !record.ok ||
    typeof record.value.name !== "string" ||
    !playerNamePattern.test(record.value.name) ||
    typeof expectedLookupName !== "string" ||
    !/^[a-z0-9_]{1,16}$/.test(expectedLookupName)
  ) {
    return invalidResponse("name-lookup", "invalid-schema");
  }
  const name = record.value.name as string;
  const uuid = normalizeResponseUuid(record.value.id);
  if (uuid === null) {
    return invalidResponse("name-lookup", "invalid-schema");
  }
  if (name.toLowerCase() !== expectedLookupName) {
    return {
      status: "identity-mismatch",
      endpoint: "name-lookup",
      code: "requested-name",
    };
  }
  return {
    status: "found",
    profile: { uuid: uuid.uuid, name },
  };
}

function parseProfileActions(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  const actions = readJsonArray(value, maxProfileActions);
  if (!actions.ok) {
    return false;
  }
  return actions.value.every((action) => {
    const record = readJsonRecord(action, ["updateType"]);
    return record.ok && isBoundedString(record.value.updateType, maxProfileActionCharacters);
  });
}

function parseSessionProfile(
  value: unknown,
  expectedUuid: string,
): ParsedSessionProfile | SessionProfileParseFailure {
  const record = readJsonRecord(value, ["id", "name", "properties", "profileActions"]);
  if (
    !record.ok ||
    typeof record.value.name !== "string" ||
    !playerNamePattern.test(record.value.name)
  ) {
    return invalidResponse("session-profile", "invalid-schema");
  }
  const responseUuid = normalizeResponseUuid(record.value.id);
  if (responseUuid === null) {
    return invalidResponse("session-profile", "invalid-schema");
  }
  if (responseUuid.uuid !== expectedUuid) {
    return {
      status: "identity-mismatch",
      endpoint: "session-profile",
      code: "requested-uuid",
    };
  }
  if (!parseProfileActions(record.value.profileActions)) {
    return invalidResponse("session-profile", "invalid-schema");
  }
  const properties = readJsonArray(record.value.properties, maxProperties);
  if (!properties.ok) {
    return invalidResponse("session-profile", "invalid-schema");
  }

  let textureProperty: ParsedSessionProfile["textureProperty"] | null = null;
  for (const property of properties.value) {
    const propertyRecord = readJsonRecord(property, ["name", "value", "signature"]);
    if (
      !propertyRecord.ok ||
      !isBoundedString(propertyRecord.value.name, maxPropertyNameCharacters) ||
      !isBoundedString(propertyRecord.value.value, maxPropertyValueCharacters)
    ) {
      return invalidResponse("session-profile", "invalid-schema");
    }
    const propertyName = propertyRecord.value.name;
    const propertyValue = propertyRecord.value.value;
    if (propertyName !== "textures") {
      if (
        propertyRecord.value.signature !== undefined &&
        !isBoundedString(propertyRecord.value.signature, maxPropertySignatureCharacters)
      ) {
        return invalidResponse("session-profile", "invalid-schema");
      }
      continue;
    }
    if (textureProperty !== null) {
      return invalidResponse("session-profile", "invalid-schema");
    }
    if (decodeCanonicalBase64(propertyValue, maxPropertyValueCharacters) === null) {
      return invalidResponse("session-profile", "invalid-textures-payload");
    }
    if (propertyRecord.value.signature === undefined) {
      return { status: "signature-missing", endpoint: "session-profile" };
    }
    if (
      !isBoundedString(propertyRecord.value.signature, maxPropertySignatureCharacters) ||
      decodeCanonicalBase64(propertyRecord.value.signature, maxPropertySignatureCharacters) === null
    ) {
      return {
        status: "invalid-signature",
        endpoint: "session-profile",
        code: "malformed-signature",
      };
    }
    textureProperty = {
      value: propertyValue,
      signature: propertyRecord.value.signature,
    };
  }

  if (textureProperty === null) {
    return { status: "textures-property-missing", endpoint: "session-profile" };
  }
  return {
    profile: {
      uuid: responseUuid.uuid,
      name: record.value.name as string,
    },
    textureProperty,
  };
}

export function inspectJavaPlayerSessionResponse(
  value: unknown,
  expectedUuid: string,
): JavaPlayerSessionInspectionOutcome {
  const parsed = parseSessionProfile(value, expectedUuid);
  if (!("profile" in parsed) || !("textureProperty" in parsed)) {
    return parsed;
  }
  return {
    status: "ready-for-verification",
    profile: parsed.profile,
  };
}

function parseProfilePropertyKeys(value: unknown): string[] | JavaPlayerKeyUnavailableOutcome {
  const record = readJsonRecordAllowUnknown(value, ["profilePropertyKeys"], 16);
  if (!record.ok) {
    return {
      status: "key-unavailable",
      endpoint: "public-keys",
      code: "invalid-response",
    };
  }
  const profileKeys = readJsonArray(record.value.profilePropertyKeys, maxPublicKeys);
  if (!profileKeys.ok) {
    return {
      status: "key-unavailable",
      endpoint: "public-keys",
      code: "invalid-response",
    };
  }

  const readKeys = (entries: unknown[]): string[] | null => {
    const keys: string[] = [];
    for (const entry of entries) {
      const keyRecord = readJsonRecord(entry, ["publicKey"]);
      if (
        !keyRecord.ok ||
        !isBoundedString(keyRecord.value.publicKey, maxPublicKeyCharacters) ||
        decodeCanonicalBase64(keyRecord.value.publicKey, maxPublicKeyCharacters) === null
      ) {
        return null;
      }
      keys.push(keyRecord.value.publicKey);
    }
    return keys;
  };

  const parsedProfileKeys = readKeys(profileKeys.value);
  if (parsedProfileKeys === null) {
    return {
      status: "key-unavailable",
      endpoint: "public-keys",
      code: "invalid-response",
    };
  }
  if (parsedProfileKeys.length === 0) {
    return {
      status: "key-unavailable",
      endpoint: "public-keys",
      code: "no-usable-keys",
    };
  }
  return parsedProfileKeys;
}

function verifyTexturePropertySignature(
  value: string,
  signatureValue: string,
  encodedPublicKeys: string[],
): "verified" | "invalid" | "no-usable-keys" {
  const signature = decodeCanonicalBase64(signatureValue, maxPropertySignatureCharacters);
  if (signature === null) {
    return "invalid";
  }
  let usableKeys = 0;
  for (const encodedPublicKey of encodedPublicKeys) {
    const publicKeyBytes = decodeCanonicalBase64(encodedPublicKey, maxPublicKeyCharacters);
    if (publicKeyBytes === null) {
      continue;
    }
    try {
      const publicKey = createPublicKey({ key: publicKeyBytes, format: "der", type: "spki" });
      const modulusLength = publicKey.asymmetricKeyDetails?.modulusLength;
      if (
        publicKey.asymmetricKeyType !== "rsa" ||
        modulusLength === undefined ||
        modulusLength < 2_048 ||
        modulusLength > 8_192
      ) {
        continue;
      }
      usableKeys += 1;
      if (verify("sha1", Buffer.from(value, "ascii"), publicKey, signature)) {
        return "verified";
      }
    } catch {}
  }
  return usableKeys === 0 ? "no-usable-keys" : "invalid";
}

function canonicalizeTextureReference(
  value: unknown,
): JavaPlayerTextureReference | JavaPlayerInvalidResponseOutcome {
  if (!isBoundedString(value, maxTextureUrlCharacters)) {
    return invalidResponse("session-profile", "unsafe-texture-reference");
  }
  const exactReference =
    /^(http|https):\/\/textures\.minecraft\.net\/texture\/([0-9a-f]{64})$/.exec(value);
  if (exactReference === null) {
    return invalidResponse("session-profile", "unsafe-texture-reference");
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return invalidResponse("session-profile", "unsafe-texture-reference");
  }
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.hostname !== "textures.minecraft.net" ||
    url.username !== "" ||
    url.password !== "" ||
    url.port !== "" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    return invalidResponse("session-profile", "unsafe-texture-reference");
  }
  const hash = exactReference[2];
  if (hash === undefined || !textureHashPattern.test(hash)) {
    return invalidResponse("session-profile", "unsafe-texture-reference");
  }
  return {
    hash,
    canonicalUrl: `https://textures.minecraft.net/texture/${hash}`,
  };
}

function parseTexture(
  value: unknown,
  type: "SKIN" | "CAPE" | "ELYTRA",
): JavaPlayerSkinReference | JavaPlayerTextureReference | JavaPlayerInvalidResponseOutcome {
  const record = readJsonRecord(value, ["url", "metadata"]);
  if (!record.ok) {
    return invalidResponse("session-profile", "invalid-textures-payload");
  }
  const reference = canonicalizeTextureReference(record.value.url);
  if ("status" in reference) {
    return reference;
  }

  if (type !== "SKIN") {
    if (record.value.metadata !== undefined) {
      const metadata = readExtensibleStringRecord(
        record.value.metadata,
        maxTextureMetadataEntries,
        maxTextureMetadataKeyCharacters,
        maxTextureMetadataValueCharacters,
      );
      if (!metadata.ok) {
        return invalidResponse("session-profile", "invalid-textures-payload");
      }
    }
    return reference;
  }

  if (record.value.metadata === undefined) {
    return {
      ...reference,
      model: "wide",
      modelEvidence: "signed-metadata-model-absent",
    };
  }
  const metadata = readExtensibleStringRecord(
    record.value.metadata,
    maxTextureMetadataEntries,
    maxTextureMetadataKeyCharacters,
    maxTextureMetadataValueCharacters,
  );
  if (!metadata.ok) {
    return invalidResponse("session-profile", "invalid-textures-payload");
  }
  if (metadata.value.model === undefined) {
    return {
      ...reference,
      model: "wide",
      modelEvidence: "signed-metadata-model-absent",
    };
  }
  if (metadata.value.model === "slim") {
    return {
      ...reference,
      model: "slim",
      modelEvidence: "signed-metadata-model-slim",
    };
  }
  return {
    ...reference,
    model: "unknown",
    modelEvidence: "signed-metadata-model-unrecognized",
  };
}

function parseSignedTexturesPayload(
  value: string,
  sessionProfile: JavaPlayerIdentity,
): VerifiedJavaPlayerTextures | JavaPlayerTextureVerificationOutcome {
  const decoded = decodeCanonicalBase64(value, maxPropertyValueCharacters);
  if (decoded === null) {
    return invalidResponse("session-profile", "invalid-textures-payload");
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(decoded);
  } catch {
    return invalidResponse("session-profile", "invalid-textures-payload");
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return invalidResponse("session-profile", "invalid-textures-payload");
  }
  const record = readJsonRecord(raw, [
    "timestamp",
    "profileId",
    "profileName",
    "isPublic",
    "signatureRequired",
    "textures",
  ]);
  if (
    !record.ok ||
    typeof record.value.timestamp !== "number" ||
    !Number.isSafeInteger(record.value.timestamp) ||
    record.value.timestamp < 0 ||
    typeof record.value.profileName !== "string" ||
    !playerNamePattern.test(record.value.profileName) ||
    (record.value.isPublic !== undefined && typeof record.value.isPublic !== "boolean") ||
    (record.value.signatureRequired !== undefined &&
      typeof record.value.signatureRequired !== "boolean") ||
    (record.value.isPublic !== undefined && record.value.signatureRequired !== undefined)
  ) {
    return invalidResponse("session-profile", "invalid-textures-payload");
  }
  const payloadUuid = normalizeResponseUuid(record.value.profileId);
  if (payloadUuid === null) {
    return invalidResponse("session-profile", "invalid-textures-payload");
  }
  if (payloadUuid.uuid !== sessionProfile.uuid) {
    return {
      status: "identity-mismatch",
      endpoint: "session-profile",
      code: "payload-uuid",
    };
  }
  if (record.value.profileName !== sessionProfile.name) {
    return {
      status: "identity-mismatch",
      endpoint: "session-profile",
      code: "payload-name",
    };
  }
  const textures = readJsonRecord(record.value.textures, ["SKIN", "CAPE", "ELYTRA"]);
  if (!textures.ok) {
    return invalidResponse("session-profile", "invalid-textures-payload");
  }

  const skin = textures.value.SKIN === undefined ? null : parseTexture(textures.value.SKIN, "SKIN");
  if (skin !== null && "status" in skin) {
    return skin;
  }
  const cape = textures.value.CAPE === undefined ? null : parseTexture(textures.value.CAPE, "CAPE");
  if (cape !== null && "status" in cape) {
    return cape;
  }
  const elytra =
    textures.value.ELYTRA === undefined ? null : parseTexture(textures.value.ELYTRA, "ELYTRA");
  if (elytra !== null && "status" in elytra) {
    return elytra;
  }

  return {
    profile: sessionProfile,
    timestamp: record.value.timestamp,
    textures: {
      skin: skin as JavaPlayerSkinReference | null,
      cape: cape as JavaPlayerTextureReference | null,
      elytra: elytra as JavaPlayerTextureReference | null,
    },
    verification: {
      state: "verified",
      algorithm: "SHA1withRSA",
      keySource: "official-profile-property-keys",
    },
  };
}

export function verifyJavaPlayerTextureMetadata(
  input: unknown,
): JavaPlayerTextureVerificationOutcome | JavaPlayerInvalidInputOutcome {
  const record = readJsonRecord(input, ["sessionResponse", "publicKeysResponse", "expectedUuid"]);
  if (
    !record.ok ||
    !("sessionResponse" in record.value) ||
    !("publicKeysResponse" in record.value) ||
    typeof record.value.expectedUuid !== "string"
  ) {
    return {
      status: "invalid-input",
      field: "verification-input",
      code: "unsupported-structure",
    };
  }
  const expectedUuid = normalizeResponseUuid(record.value.expectedUuid);
  if (expectedUuid === null || expectedUuid.uuid !== record.value.expectedUuid) {
    return {
      status: "invalid-input",
      field: "verification-input",
      code: "unsupported-structure",
    };
  }
  const session = parseSessionProfile(record.value.sessionResponse, expectedUuid.uuid);
  if (!("profile" in session) || !("textureProperty" in session)) {
    return session;
  }
  const publicKeys = parseProfilePropertyKeys(record.value.publicKeysResponse);
  if (!Array.isArray(publicKeys)) {
    return publicKeys;
  }
  const signatureState = verifyTexturePropertySignature(
    session.textureProperty.value,
    session.textureProperty.signature,
    publicKeys,
  );
  if (signatureState === "no-usable-keys") {
    return {
      status: "key-unavailable",
      endpoint: "public-keys",
      code: "no-usable-keys",
    };
  }
  if (signatureState === "invalid") {
    return {
      status: "invalid-signature",
      endpoint: "session-profile",
      code: "verification-failed",
    };
  }
  const payload = parseSignedTexturesPayload(session.textureProperty.value, session.profile);
  if (!("profile" in payload) || !("verification" in payload)) {
    return payload;
  }
  return { status: "verified", data: payload };
}

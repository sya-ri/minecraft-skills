import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
import { inspectResourcepackPng } from "./resourcepackPng.js";

const MAX_PNG_BYTES = 8 * 1024 * 1024;
const MAX_PIXELS = 4_194_304;
export type MigrationCapture = {
  version: string;
  caseId: string;
  context: "inventory" | "first-person" | "third-person" | "head" | "ground" | "fixed" | "world";
  conditions: string;
  pngBase64: string;
};

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a),
    pb = Math.abs(p - b),
    pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Decode only the static 8-bit RGB/RGBA format normally produced by vanilla screenshots. */
function decodeCapture(input: MigrationCapture) {
  if (
    !input ||
    typeof input.version !== "string" ||
    !input.version ||
    typeof input.caseId !== "string" ||
    !input.caseId ||
    typeof input.conditions !== "string" ||
    !input.conditions ||
    !["inventory", "first-person", "third-person", "head", "ground", "fixed", "world"].includes(
      input.context,
    )
  )
    throw new Error("Capture provenance fields are required");
  if (
    typeof input.pngBase64 !== "string" ||
    input.pngBase64.length > Math.ceil(MAX_PNG_BYTES / 3) * 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.pngBase64)
  )
    throw new Error("Capture requires bounded canonical PNG base64");
  const bytes = Buffer.from(input.pngBase64, "base64");
  if (bytes.toString("base64") !== input.pngBase64)
    throw new Error("Capture base64 is not canonical");
  let header: Uint8Array | undefined;
  const compressed: Buffer[] = [];
  let animated = false;
  let transparency = false;
  const inspection = inspectResourcepackPng(bytes, {
    limits: { maxInputBytes: MAX_PNG_BYTES, maxPixels: MAX_PIXELS },
    onChunk(chunk) {
      if (chunk.type === "IHDR") header = chunk.data;
      if (chunk.type === "IDAT") compressed.push(Buffer.from(chunk.data));
      if (chunk.type === "acTL") animated = true;
      if (chunk.type === "tRNS") transparency = true;
    },
  });
  if (!inspection.valid || !inspection.validationComplete || !header)
    throw new Error("Invalid or incompletely validated screenshot PNG");
  const h = Buffer.from(header);
  const width = h.readUInt32BE(0),
    height = h.readUInt32BE(4);
  if (animated || transparency || h[8] !== 8 || ![2, 6].includes(h[9] ?? -1) || h[12] !== 0)
    throw new Error(
      "Unsupported capture PNG: requires static noninterlaced 8-bit RGB/RGBA without tRNS",
    );
  const channels = h[9] === 2 ? 3 : 4;
  const stride = width * channels;
  const expected = (stride + 1) * height;
  const inflated = inflateSync(Buffer.concat(compressed), { maxOutputLength: expected + 1 });
  if (inflated.length !== expected) throw new Error("Screenshot inflated length mismatch");
  const pixels = Buffer.alloc(width * height * 4);
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const offset = y * (stride + 1);
    const filter = inflated[offset] ?? -1;
    if (filter < 0 || filter > 4) throw new Error("Invalid screenshot PNG row filter");
    const row = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? (row[x - channels] ?? 0) : 0;
      const b = previous[x] ?? 0;
      const c = x >= channels ? (previous[x - channels] ?? 0) : 0;
      const predictor =
        filter === 0
          ? 0
          : filter === 1
            ? a
            : filter === 2
              ? b
              : filter === 3
                ? Math.floor((a + b) / 2)
                : paeth(a, b, c);
      row[x] = ((inflated[offset + 1 + x] ?? 0) + predictor) & 255;
    }
    for (let x = 0; x < width; x++) {
      const target = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) pixels[target + c] = row[x * channels + c] ?? 0;
      pixels[target + 3] = channels === 4 ? (row[x * channels + 3] ?? 0) : 255;
    }
    previous = row;
  }
  return { width, height, pixels, sha256: createHash("sha256").update(bytes).digest("hex") };
}

/** Pixel evidence only; mismatched conditions never produce an equality verdict. */
export function compareMigrationCaptures(before: MigrationCapture, after: MigrationCapture) {
  const a = decodeCapture(before),
    b = decodeCapture(after);
  const comparable =
    before.caseId === after.caseId &&
    before.context === after.context &&
    before.conditions === after.conditions &&
    a.width === b.width &&
    a.height === b.height;
  let changedPixels = 0,
    maxChannelDifference = 0;
  let minX = a.width,
    minY = a.height,
    maxX = -1,
    maxY = -1;
  if (comparable) {
    for (let i = 0; i < a.pixels.length; i += 4) {
      let changed = false;
      for (let c = 0; c < 4; c++) {
        const delta = Math.abs((a.pixels[i + c] ?? 0) - (b.pixels[i + c] ?? 0));
        maxChannelDifference = Math.max(maxChannelDifference, delta);
        changed ||= delta !== 0;
      }
      if (changed) {
        changedPixels++;
        const x = (i / 4) % a.width,
          y = Math.floor(i / 4 / a.width);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  return {
    schemaVersion: 1,
    status: !comparable ? "incomparable" : changedPixels === 0 ? "equal" : "different",
    comparisonStrength: "decoded-rgba-exact",
    beforeSha256: a.sha256,
    afterSha256: b.sha256,
    changedPixels: comparable ? changedPixels : null,
    changedFraction: comparable ? changedPixels / (a.width * a.height) : null,
    maxChannelDifference: comparable ? maxChannelDifference : null,
    differenceBounds: comparable && changedPixels > 0 ? { minX, minY, maxX, maxY } : null,
    limitations: [
      "Caller supplies capture provenance; equal images do not establish that the intended item was rendered or that gameplay is equivalent.",
      "No automatic tolerance, cropping, masks, alignment or baseline replacement is applied.",
    ],
  };
}

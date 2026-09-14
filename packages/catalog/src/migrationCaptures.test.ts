import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { compareMigrationCaptures, type MigrationCapture } from "./migrationCaptures.js";

function png(
  pixel: number[],
  colorType = 6,
  filter = 0,
  width = 1,
  height = 1,
  scanlines?: number[],
) {
  function chunk(name: string, data: Buffer) {
    const body = Buffer.concat([Buffer.from(name), data]);
    let crc = 0xffffffff;
    for (const byte of body) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const result = Buffer.alloc(data.length + 12);
    result.writeUInt32BE(data.length);
    body.copy(result, 4);
    result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
    return result;
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = colorType;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.from(scanlines ?? [filter, ...pixel]))),
    chunk("IEND", Buffer.alloc(0)),
  ]).toString("base64");
}

const capture = (pngBase64: string): MigrationCapture => ({
  version: "source",
  caseId: "example:sample",
  context: "inventory",
  conditions: "fixed-fixture-v1",
  pngBase64,
});
describe("migration capture comparison", () => {
  it.each([
    [1, [1, 10, 20, 30, 30, 30, 30, 1, 20, 40, 60, 60, 60, 60]],
    [2, [2, 10, 20, 30, 40, 50, 60, 2, 10, 20, 30, 40, 50, 60]],
    [3, [3, 10, 20, 30, 35, 40, 45, 3, 15, 30, 45, 50, 55, 60]],
    [4, [4, 10, 20, 30, 30, 30, 30, 4, 10, 20, 30, 40, 50, 60]],
  ])("decodes nonzero row/column predictors for filter %i", (_filter, encoded) => {
    const reference = [0, 10, 20, 30, 40, 50, 60, 0, 20, 40, 60, 80, 100, 120];
    expect(
      compareMigrationCaptures(
        capture(png([], 2, 0, 2, 2, reference)),
        capture(png([], 2, 0, 2, 2, encoded)),
      ).status,
    ).toBe("equal");
  });
  it.each([0, 1, 2, 3, 4])("decodes PNG filter %i and ignores encoding differences", (filter) => {
    const a = capture(png([10, 20, 30, 255]));
    const b = capture(png([10, 20, 30], 2, filter));
    expect(compareMigrationCaptures(a, b).status).toBe("equal");
  });
  it("detects a one-channel one-pixel change", () => {
    const result = compareMigrationCaptures(
      capture(png([10, 20, 30, 255])),
      capture(png([11, 20, 30, 255])),
    );
    expect(result.status).toBe("different");
    expect(result.changedPixels).toBe(1);
    expect(result.maxChannelDifference).toBe(1);
    expect(result.differenceBounds).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
  });
  it("rejects mislabeled comparison contexts and capture conditions", () => {
    const a = capture(png([10, 20, 30, 255]));
    expect(compareMigrationCaptures(a, { ...a, context: "first-person" }).status).toBe(
      "incomparable",
    );
    expect(compareMigrationCaptures(a, { ...a, conditions: "other-fov" }).status).toBe(
      "incomparable",
    );
  });
  it("rejects corrupt PNG and invalid row filters", () => {
    expect(() => compareMigrationCaptures(capture("AAAA"), capture("AAAA"))).toThrow();
    expect(() =>
      compareMigrationCaptures(capture(png([1, 2, 3, 255], 6, 5)), capture(png([1, 2, 3, 255]))),
    ).toThrow();
  });
});

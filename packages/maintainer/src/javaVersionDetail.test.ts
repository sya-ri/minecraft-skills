import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildJavaVersionDetail } from "./javaVersionDetail.js";

function createStoredZip(entries: Record<string, string>): Buffer {
  const chunks: Buffer[] = [];
  const centralDirectoryChunks: Buffer[] = [];
  let offset = 0;

  for (const [name, content] of Object.entries(entries)) {
    const nameBuffer = Buffer.from(name);
    const contentBuffer = Buffer.from(content);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(contentBuffer.length, 18);
    localHeader.writeUInt32LE(contentBuffer.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    chunks.push(localHeader, nameBuffer, contentBuffer);

    const centralDirectoryHeader = Buffer.alloc(46);
    centralDirectoryHeader.writeUInt32LE(0x02014b50, 0);
    centralDirectoryHeader.writeUInt16LE(20, 4);
    centralDirectoryHeader.writeUInt16LE(20, 6);
    centralDirectoryHeader.writeUInt32LE(0, 16);
    centralDirectoryHeader.writeUInt32LE(contentBuffer.length, 20);
    centralDirectoryHeader.writeUInt32LE(contentBuffer.length, 24);
    centralDirectoryHeader.writeUInt16LE(nameBuffer.length, 28);
    centralDirectoryHeader.writeUInt32LE(offset, 42);
    centralDirectoryChunks.push(centralDirectoryHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + contentBuffer.length;
  }

  const centralDirectoryOffset = offset;
  const centralDirectory = Buffer.concat(centralDirectoryChunks);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(Object.keys(entries).length, 8);
  endOfCentralDirectory.writeUInt16LE(Object.keys(entries).length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(centralDirectoryOffset, 16);

  return Buffer.concat([...chunks, centralDirectory, endOfCentralDirectory]);
}

describe("buildJavaVersionDetail", () => {
  it("builds version-json details without jar data", () => {
    const dir = mkdtempSync(join(tmpdir(), "minecraft-skills-version-detail-"));
    const versionJsonPath = join(dir, "version.json");
    writeFileSync(
      versionJsonPath,
      JSON.stringify({
        id: "1.21.4",
        type: "release",
        releaseTime: "2024-12-03T10:12:57+00:00",
        time: "2026-06-16T06:31:45+00:00",
        javaVersion: {
          component: "java-runtime-delta",
          majorVersion: 21,
        },
        downloads: {
          client: {
            sha1: "client",
            size: 1,
            url: "https://example.test/client.jar",
          },
        },
      }),
    );

    const detail = buildJavaVersionDetail({
      versionJsonPath,
      retrievedAt: "2026-06-22T00:00:00+09:00",
    });

    expect(detail.coverage).toBe("version-json");
    expect(detail.javaVersion.majorVersion).toBe(21);
    expect(detail.packFormats.status).toBe("not-extracted");
  });

  it("falls back to pack.mcmeta for legacy jars without version.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "minecraft-skills-version-detail-"));
    const versionJsonPath = join(dir, "version.json");
    const clientJarPath = join(dir, "client.jar");
    writeFileSync(
      versionJsonPath,
      JSON.stringify({
        id: "1.13.2",
        type: "release",
        releaseTime: "2018-10-22T11:41:07+00:00",
        time: "2026-06-16T06:25:14+00:00",
        downloads: {
          client: {
            sha1: "client",
            size: 1,
            url: "https://example.test/client.jar",
          },
        },
      }),
    );
    writeFileSync(
      clientJarPath,
      createStoredZip({
        "pack.mcmeta": JSON.stringify({
          pack: {
            pack_format: 4,
          },
        }),
      }),
    );

    const detail = buildJavaVersionDetail({
      versionJsonPath,
      clientJarPath,
      retrievedAt: "2026-06-22T00:00:00+09:00",
    });

    expect(detail.coverage).toBe("version-json-and-jar");
    expect(detail.packFormats.data).toBe(4);
    expect(detail.packFormats.resource).toBe(4);
    expect(detail.sources.map((source) => source.id)).toContain("mojang-client-jar-pack-mcmeta");
  });

  it("reads legacy pack_version data/resource keys from jar version.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "minecraft-skills-version-detail-"));
    const versionJsonPath = join(dir, "version.json");
    const clientJarPath = join(dir, "client.jar");
    writeFileSync(
      versionJsonPath,
      JSON.stringify({
        id: "1.21.8",
        type: "release",
        releaseTime: "2025-07-17T12:04:02+00:00",
        time: "2026-06-16T06:36:57+00:00",
        downloads: {
          client: {
            sha1: "client",
            size: 1,
            url: "https://example.test/client.jar",
          },
        },
      }),
    );
    writeFileSync(
      clientJarPath,
      createStoredZip({
        "version.json": JSON.stringify({
          id: "1.21.8",
          pack_version: {
            resource: 64,
            data: 81,
          },
        }),
      }),
    );

    const detail = buildJavaVersionDetail({
      versionJsonPath,
      clientJarPath,
      retrievedAt: "2026-06-22T00:00:00+09:00",
    });

    expect(detail.packFormats.data).toBe(81);
    expect(detail.packFormats.resource).toBe(64);
  });

  it("reads numeric pack_version from jar version.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "minecraft-skills-version-detail-"));
    const versionJsonPath = join(dir, "version.json");
    const clientJarPath = join(dir, "client.jar");
    writeFileSync(
      versionJsonPath,
      JSON.stringify({
        id: "1.16.5",
        type: "release",
        releaseTime: "2021-01-14T16:05:32+00:00",
        time: "2026-06-16T06:29:24+00:00",
        downloads: {
          client: {
            sha1: "client",
            size: 1,
            url: "https://example.test/client.jar",
          },
        },
      }),
    );
    writeFileSync(
      clientJarPath,
      createStoredZip({
        "version.json": JSON.stringify({
          id: "1.16.5",
          pack_version: 6,
        }),
      }),
    );

    const detail = buildJavaVersionDetail({
      versionJsonPath,
      clientJarPath,
      retrievedAt: "2026-06-22T00:00:00+09:00",
    });

    expect(detail.packFormats.data).toBe(6);
    expect(detail.packFormats.resource).toBe(6);
  });
});

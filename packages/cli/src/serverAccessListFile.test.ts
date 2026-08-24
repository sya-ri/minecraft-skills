import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultServerAccessListValidationLimits } from "@minecraft-skills/catalog";
import { describe, expect, it } from "vitest";
import { runCli } from "./cli.js";

async function capture(argv: string[]) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await runCli(argv, {
    write: (value) => stdout.push(value),
    error: (value) => stderr.push(value),
  });
  return { code, stdout, stderr };
}

describe("server access-list CLI", () => {
  it("infers canonical filenames and does not print identity values", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-access-list-cli-"));
    const file = join(root, "whitelist.json");
    const uuid = "123e4567-e89b-42d3-a456-426614174000";
    const name = "PrivateName";
    try {
      writeFileSync(file, `\uFEFF${JSON.stringify([{ uuid, name }])}`);
      const result = await capture([
        "minecraft",
        "validate-access-list",
        file,
        "--evaluated-at",
        "2026-08-25T00:00:00.000Z",
      ]);
      const output = result.stdout.join("\n");

      expect(result.code).toBe(0);
      expect(output).toContain('"kind": "whitelist"');
      expect(output).toContain('"evaluatedAt": "2026-08-25T00:00:00.000Z"');
      expect(output).toContain('"code": "utf8-bom"');
      expect(output).not.toContain(uuid);
      expect(output).not.toContain(name);
      expect(output).not.toContain(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("accepts a regular file through a symlink and an explicit kind", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-access-list-link-"));
    const targetDirectory = join(root, "target");
    const linkedDirectory = join(root, "linked");
    const target = join(targetDirectory, "custom.json");
    const link = join(linkedDirectory, "custom.json");
    try {
      mkdirSync(targetDirectory);
      writeFileSync(target, "[]");
      symlinkSync(
        targetDirectory,
        linkedDirectory,
        process.platform === "win32" ? "junction" : "dir",
      );
      const result = await capture(["minecraft", "validate-access-list", link, "--kind", "ops"]);

      expect(result.code).toBe(0);
      expect(result.stdout.join("\n")).toContain('"kind": "ops"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects directories, oversized files, and malformed UTF-8 with path-free errors", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-access-list-errors-"));
    const oversized = join(root, "whitelist.json");
    const malformed = join(root, "ops.json");
    const directory = join(root, "banned-players.json");
    try {
      writeFileSync(
        oversized,
        Buffer.alloc(defaultServerAccessListValidationLimits.maxInputBytes + 1, 0x20),
      );
      writeFileSync(malformed, Buffer.from([0xc3, 0x28]));
      mkdirSync(directory);

      const oversizedResult = await capture(["minecraft", "validate-access-list", oversized]);
      const malformedResult = await capture(["minecraft", "validate-access-list", malformed]);
      const directoryResult = await capture(["minecraft", "validate-access-list", directory]);

      expect(oversizedResult.code).toBe(1);
      expect(oversizedResult.stderr.join("\n")).toContain("fixed byte limit");
      expect(malformedResult.code).toBe(1);
      expect(malformedResult.stderr.join("\n")).toContain("valid UTF-8");
      expect(directoryResult.code).toBe(1);
      expect(directoryResult.stderr.join("\n")).toContain("regular local file");
      expect(
        [oversizedResult, malformedResult, directoryResult]
          .flatMap((result) => result.stderr)
          .join("\n"),
      ).not.toContain(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("requires a kind for noncanonical filenames without printing the path", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-access-list-kind-"));
    const file = join(root, "custom.json");
    const canonicalFile = join(root, "ops.json");
    try {
      writeFileSync(file, "[]");
      writeFileSync(canonicalFile, "[]");
      const result = await capture(["minecraft", "validate-access-list", file]);
      const mismatch = await capture([
        "minecraft",
        "validate-access-list",
        canonicalFile,
        "--kind",
        "whitelist",
      ]);

      expect(result.code).toBe(1);
      expect(result.stderr.join("\n")).toContain("requires --kind");
      expect(result.stderr.join("\n")).not.toContain(file);
      expect(mismatch.code).toBe(1);
      expect(mismatch.stderr.join("\n")).toContain("does not match the canonical filename");
      expect(mismatch.stderr.join("\n")).not.toContain(canonicalFile);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

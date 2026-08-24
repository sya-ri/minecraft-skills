import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultMinecraftPerformanceAnalysisLimits } from "@minecraft-skills/catalog";
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

function validInput() {
  return {
    samples: [
      { timestamp: "2026-08-25T00:00:00.000Z", tps: 20, mspt: 40 },
      { timestamp: "2026-08-25T00:01:00.000Z", tps: 20, mspt: 45 },
    ],
    expectedIntervalSeconds: 60,
  };
}

describe("minecraft performance CLI", () => {
  it("analyzes a bounded JSON file without returning the local path", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-performance-cli-"));
    const file = join(root, "metrics.json");
    try {
      writeFileSync(file, JSON.stringify(validInput()));
      const result = await capture(["minecraft", "analyze-performance", file]);
      const output = result.stdout.join("\n");

      expect(result.code).toBe(0);
      expect(output).toContain('"outcome": "analyzed"');
      expect(output).toContain('"thresholdStatus": "within-thresholds"');
      expect(output).not.toContain(root);
      expect(result.stderr).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns a failing exit code and scoped spark guidance for threshold violations", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-performance-violation-"));
    const file = join(root, "metrics.json");
    try {
      const input = validInput();
      input.samples[1] = {
        timestamp: "2026-08-25T00:01:00.000Z",
        tps: 18,
        mspt: 75,
      };
      writeFileSync(file, JSON.stringify(input));
      const result = await capture(["minecraft", "analyze-performance", file]);
      const output = result.stdout.join("\n");

      expect(result.code).toBe(1);
      expect(output).toContain('"thresholdStatus": "violations-detected"');
      expect(output).toContain('"kind": "scoped-spark-profile"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not report success when valid timestamps contain no observed metrics", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-performance-empty-metrics-"));
    const file = join(root, "metrics.json");
    try {
      writeFileSync(
        file,
        JSON.stringify({
          samples: [
            { timestamp: "2026-08-25T00:00:00.000Z" },
            { timestamp: "2026-08-25T00:01:00.000Z" },
          ],
        }),
      );
      const result = await capture(["minecraft", "analyze-performance", file]);

      expect(result.code).toBe(1);
      expect(result.stdout.join("\n")).toContain('"outcome": "insufficient-data"');
      expect(result.stdout.join("\n")).toContain('"thresholdStatus": "not-observed"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects unknown options instead of silently skipping them", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-performance-option-"));
    const file = join(root, "metrics.json");
    try {
      writeFileSync(file, JSON.stringify(validInput()));
      const result = await capture([
        "minecraft",
        "analyze-performance",
        file,
        "--source-label",
        "private",
      ]);

      expect(result.code).toBe(1);
      expect(result.stderr.join("\n")).toContain("does not accept command options");
      expect(result.stderr.join("\n")).not.toContain("source-label");
      expect(result.stderr.join("\n")).not.toContain("private");
      expect(result.stdout).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.skipIf(process.platform === "win32")(
    "rejects a symbolic-link input instead of following it",
    async () => {
      const root = mkdtempSync(join(tmpdir(), "minecraft-performance-link-"));
      const file = join(root, "metrics.json");
      const linkedFile = join(root, "linked.json");
      try {
        writeFileSync(file, JSON.stringify(validInput()));
        symlinkSync(file, linkedFile, "file");
        const result = await capture(["minecraft", "analyze-performance", linkedFile]);

        expect(result.code).toBe(1);
        expect(result.stderr.join("\n")).toContain("regular non-symlink file");
        expect(result.stderr.join("\n")).not.toContain(root);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );

  it("rejects duplicate JSON object keys before parsing without echoing keys or paths", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-performance-duplicates-"));
    const inputs = [
      '{"samples":[],"sam\\u0070les":[]}',
      '{"samples":[{"timestamp":"2026-08-25T00:00:00.000Z","timestamp":"secret"}]}',
      '{"samples":[],"thresholds":{"tps":{"minimum":20,"minimum":1}}}',
    ];
    try {
      const results = await Promise.all(
        inputs.map(async (input, index) => {
          const file = join(root, `duplicate-${index}.json`);
          writeFileSync(file, input);
          return capture(["minecraft", "analyze-performance", file]);
        }),
      );

      for (const result of results) {
        const error = result.stderr.join("\n");
        expect(result.code).toBe(1);
        expect(error).toContain("duplicate object key");
        expect(error).not.toContain("timestamp");
        expect(error).not.toContain("minimum");
        expect(error).not.toContain(root);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects JSON with more structural nodes than the bounded sample envelope", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-performance-nodes-"));
    const file = join(root, "nodes.json");
    try {
      const nodeCount = defaultMinecraftPerformanceAnalysisLimits.maxSamples * 12 + 257;
      writeFileSync(file, `[${new Array(nodeCount).fill("0").join(",")}]`);
      const result = await capture(["minecraft", "analyze-performance", file]);

      expect(result.code).toBe(1);
      expect(result.stderr.join("\n")).toContain("fixed JSON node limit");
      expect(result.stderr.join("\n")).not.toContain(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects directories, oversized files, malformed UTF-8, deep JSON, and invalid JSON path-free", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-performance-errors-"));
    const directory = join(root, "directory.json");
    const oversized = join(root, "oversized.json");
    const malformedUtf8 = join(root, "utf8.json");
    const deep = join(root, "deep.json");
    const invalidJson = join(root, "invalid.json");
    try {
      mkdirSync(directory);
      writeFileSync(
        oversized,
        Buffer.alloc(defaultMinecraftPerformanceAnalysisLimits.maxInputBytes + 1, 0x20),
      );
      writeFileSync(malformedUtf8, Buffer.from([0xc3, 0x28]));
      writeFileSync(deep, `${"[".repeat(17)}0${"]".repeat(17)}`);
      writeFileSync(invalidJson, "{");

      const results = await Promise.all([
        capture(["minecraft", "analyze-performance", directory]),
        capture(["minecraft", "analyze-performance", oversized]),
        capture(["minecraft", "analyze-performance", malformedUtf8]),
        capture(["minecraft", "analyze-performance", deep]),
        capture(["minecraft", "analyze-performance", invalidJson]),
      ]);
      const errors = results.flatMap((result) => result.stderr).join("\n");

      expect(results.every((result) => result.code === 1)).toBe(true);
      expect(errors).toContain("regular non-symlink file");
      expect(errors).toContain("fixed byte limit");
      expect(errors).toContain("valid UTF-8");
      expect(errors).toContain("fixed JSON depth limit");
      expect(errors).toContain("valid JSON");
      expect(errors).not.toContain(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

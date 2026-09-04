import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ search: vi.fn(), fetchData: vi.fn() }));
vi.mock("@minecraft-skills/catalog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@minecraft-skills/catalog")>()),
  searchPaperMembersWithData: mocks.search,
  fetchData: mocks.fetchData,
}));

import { runCli } from "./cli.js";

async function capture(args: string[]) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await runCli(args, {
    write: (value) => stdout.push(value),
    error: (value) => stderr.push(value),
  });
  return { code, stdout, stderr };
}

describe("Paper member recovery CLI", () => {
  beforeEach(() => {
    mocks.search.mockReset().mockResolvedValue({ version: "26.2", members: [] });
    mocks.fetchData.mockReset().mockResolvedValue({ fetched: [] });
  });

  it.each([
    { flags: [] },
    { flags: ["--fetch-missing"] },
  ])("passes the explicit flag without enabling downloads by default ($flags)", async ({
    flags,
  }) => {
    const result = await capture([
      "plugin",
      "paper",
      "members",
      "26.2",
      "--type",
      "JavaPlugin",
      "--contains",
      "onDisable",
      ...flags,
    ]);
    expect(result.code).toBe(0);
    expect(mocks.search).toHaveBeenCalledExactlyOnceWith({
      version: "26.2",
      type: "JavaPlugin",
      contains: "onDisable",
      limit: 50,
      fetchMissing: flags.length > 0,
    });
  });

  it("accepts the flag before the version without consuming it", async () => {
    const result = await capture([
      "plugin",
      "paper",
      "members",
      "--fetch-missing",
      "26.2",
      "--limit",
      "10",
    ]);
    expect(result.code).toBe(0);
    expect(mocks.search).toHaveBeenCalledExactlyOnceWith({
      version: "26.2",
      limit: 10,
      fetchMissing: true,
    });
  });

  it("keeps the documented standalone recovery command scoped to one kind and version", async () => {
    const result = await capture(["data", "fetch", "paper-api-surface", "--version", "26.2"]);
    expect(result.code).toBe(0);
    expect(mocks.fetchData).toHaveBeenCalledExactlyOnceWith({
      kind: "paper-api-surface",
      version: "26.2",
      force: false,
    });
  });

  it("reports download failure without printing member facts", async () => {
    mocks.search.mockRejectedValue(new Error("Size mismatch for exact-version surface"));
    const result = await capture(["plugin", "paper", "members", "26.2", "--fetch-missing"]);
    expect(result.code).toBe(1);
    expect(result.stdout).toEqual([]);
    expect(result.stderr.join("\n")).toContain("Size mismatch");
  });

  it("documents the local-cache side effect in help", async () => {
    const result = await capture(["--help"]);
    expect(result.stdout.join("\n")).toContain("--fetch-missing");
    expect(result.stdout.join("\n")).toContain("Read-only by default");
  });
});

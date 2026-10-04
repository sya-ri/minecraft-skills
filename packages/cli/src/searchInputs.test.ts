import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ search: vi.fn(), fetch: vi.fn() }));
vi.mock("@minecraft-skills/catalog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@minecraft-skills/catalog")>()),
  searchCommands: mocks.search,
  searchMinecraftAssets: mocks.search,
  searchPaperMembersWithData: mocks.search,
  searchPaperTypes: mocks.search,
  searchRegistryEntries: mocks.search,
  searchResourcepackModelPaths: mocks.search,
  fetchMinecraftAssetsIndex: mocks.fetch,
}));

import { runCli } from "./cli.js";

describe("shared search inputs in the CLI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.search.mockReturnValue({ matches: [] });
  });

  const commands = [
    ["plugin", "paper", "types"],
    ["plugin", "paper", "members"],
    ["minecraft", "registry-entries"],
    ["datapack", "commands"],
    ["resourcepack", "search-models"],
    ["resourcepack", "assets", "search"],
  ];

  it.each(
    commands.map((argv) => ({ argv })),
  )("$argv rejects unknown flags before searching", async ({ argv }) => {
    const errors: string[] = [];
    const code = await runCli([...argv, "26.3", "--query", "needle"], {
      write: () => {},
      error: (value) => errors.push(value),
    });
    expect(code).toBe(1);
    expect(errors.join("\n")).toMatch(/unknown option.*--query/i);
    expect(mocks.search).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it.each(
    commands.map((argv) => ({ argv })),
  )("$argv validates normalized numeric flags before searching", async ({ argv }) => {
    const errors: string[] = [];
    const code = await runCli([...argv, "26.3", "--limit", "wrong-number"], {
      write: () => {},
      error: (value) => errors.push(value),
    });
    expect(code).toBe(1);
    expect(errors.join("\n")).toMatch(/limit/i);
    expect(mocks.search).not.toHaveBeenCalled();
  });

  it("validates asset filters before an opt-in cache fetch", async () => {
    const errors: string[] = [];
    const code = await runCli(
      ["resourcepack-assets-search", "26.3", "--fetch", "--limit", "wrong-number"],
      {
        write: () => {},
        error: (value) => errors.push(value),
      },
    );
    expect(code).toBe(1);
    expect(errors.join("\n")).toMatch(/limit/i);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});

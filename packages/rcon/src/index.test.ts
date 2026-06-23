import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createRconConfig,
  evaluateRconPermission,
  getRconConfigStatus,
  runRconCommand,
} from "./index.js";

describe("RCON configuration and permissions", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows readonly inspection commands and denies unknown mutations", () => {
    expect(evaluateRconPermission("list").allowed).toBe(true);
    expect(evaluateRconPermission("/time   query   day").allowed).toBe(true);
    expect(evaluateRconPermission("gamerule doDaylightCycle").allowed).toBe(true);
    expect(evaluateRconPermission("gamerule doDaylightCycle false").allowed).toBe(false);
  });

  it("denies guarded commands even when nested behind execute", () => {
    const permissions = { preset: "guarded" as const };

    expect(evaluateRconPermission("execute run stop", permissions)).toEqual(
      expect.objectContaining({
        allowed: false,
        matchedRule: expect.objectContaining({ source: "deny" }),
      }),
    );
    expect(evaluateRconPermission("execute run say hello", permissions).allowed).toBe(true);
  });

  it("creates config files without overwriting existing files unless forced", () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-rcon-"));
    const configPath = join(root, "rcon.json");
    try {
      const created = createRconConfig({ configPath, preset: "guarded" });
      expect(created.written).toBe(true);
      expect(readFileSync(configPath, "utf8")).toContain('"preset": "guarded"');

      const blocked = createRconConfig({ configPath, preset: "full" });
      expect(blocked.written).toBe(false);
      expect(blocked.warning).toContain("already exists");
      expect(readFileSync(configPath, "utf8")).toContain('"preset": "guarded"');

      const overwritten = createRconConfig({ configPath, preset: "full", force: true });
      expect(overwritten.written).toBe(true);
      expect(overwritten.warning).toContain("Overwrote");
      expect(readFileSync(configPath, "utf8")).toContain('"preset": "full"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reports configured profiles and masks secret values from status", () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-rcon-"));
    const configPath = join(root, "rcon.json");
    try {
      createRconConfig({ configPath });
      vi.stubEnv("MINECRAFT_SKILLS_RCON_PASSWORD", "secret");

      const status = getRconConfigStatus({ configPath });
      expect(status.configured).toBe(true);
      expect(status.profile).toBe("local");
      expect(JSON.stringify(status)).not.toContain("secret");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("lets environment variables override preset and timeout for config profiles", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-rcon-"));
    const configPath = join(root, "rcon.json");
    const transport = vi.fn(async (profile) => `${profile.timeoutMs}`);
    try {
      writeFileSync(
        configPath,
        JSON.stringify({
          defaultProfile: "local",
          profiles: {
            local: {
              host: "127.0.0.1",
              port: 25575,
              password: "$env:MINECRAFT_SKILLS_RCON_PASSWORD",
            },
          },
        }),
      );
      vi.stubEnv("MINECRAFT_SKILLS_RCON_PASSWORD", "secret");
      vi.stubEnv("MINECRAFT_SKILLS_RCON_PRESET", "full");
      vi.stubEnv("MINECRAFT_SKILLS_RCON_TIMEOUT_MS", "1234");

      const result = await runRconCommand({ configPath, command: "give @p diamond" }, transport);
      expect(result.permissionDecision.allowed).toBe(true);
      expect(result.response).toBe("1234");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not execute commands rejected by permissions", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-rcon-"));
    const configPath = join(root, "rcon.json");
    const transport = vi.fn(async () => "ok");
    try {
      createRconConfig({ configPath });
      vi.stubEnv("MINECRAFT_SKILLS_RCON_PASSWORD", "secret");

      const result = await runRconCommand({ configPath, command: "give @p diamond" }, transport);
      expect(result.permissionDecision.allowed).toBe(false);
      expect(transport).not.toHaveBeenCalled();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("runs allowed commands through the injected transport", async () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-rcon-"));
    const configPath = join(root, "rcon.json");
    const transport = vi.fn(async () => "There are 0 of a max of 20 players online");
    try {
      createRconConfig({ configPath });
      vi.stubEnv("MINECRAFT_SKILLS_RCON_PASSWORD", "secret");

      const result = await runRconCommand({ configPath, command: "list" }, transport);
      expect(result.permissionDecision.allowed).toBe(true);
      expect(result.response).toContain("0 of a max");
      expect(transport).toHaveBeenCalledOnce();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

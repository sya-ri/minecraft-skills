import { describe, expect, it } from "vitest";
import { runCli } from "./cli.js";

function capture(argv: string[]) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = runCli(argv, {
    write: (value) => stdout.push(value),
    error: (value) => stderr.push(value),
  });
  return { code, stdout, stderr };
}

describe("minecraft-skills CLI", () => {
  it("prints domains", () => {
    const result = capture(["domains"]);
    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain("paper-plugin");
  });

  it("prints latest Java version", () => {
    expect(capture(["latest"]).stdout).toEqual(["26.2"]);
  });

  it("filters references by domain", () => {
    const result = capture(["references", "--domain", "paper-plugin"]);
    expect(result.stdout.join("\n")).toContain("minecraft-paper-plugins");
  });

  it("reports unknown commands", () => {
    const result = capture(["nope"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toEqual(["Unknown command: nope"]);
  });
});

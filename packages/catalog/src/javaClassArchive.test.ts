import { describe, expect, it } from "vitest";
import { javaBinaryNameToClassEntryPath, maxJavaBinaryNameCharacters } from "./javaClassArchive.js";

describe("javaBinaryNameToClassEntryPath", () => {
  it("maps default-package, qualified, and nested binary names to exact JAR entries", () => {
    expect(javaBinaryNameToClassEntryPath("ExamplePlugin")).toBe("ExamplePlugin.class");
    expect(javaBinaryNameToClassEntryPath("dev.example.ExamplePlugin")).toBe(
      "dev/example/ExamplePlugin.class",
    );
    expect(javaBinaryNameToClassEntryPath("dev.example.Outer$Inner")).toBe(
      "dev/example/Outer$Inner.class",
    );
  });

  it("rejects malformed and oversized names", () => {
    expect(javaBinaryNameToClassEntryPath("dev.example.Bad/Class")).toBeNull();
    expect(
      javaBinaryNameToClassEntryPath(`dev.example.${"A".repeat(maxJavaBinaryNameCharacters)}`),
    ).toBeNull();
  });
});

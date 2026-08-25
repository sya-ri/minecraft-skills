import { describe, expect, it } from "vitest";
import {
  analyzeMinecraftLog,
  defaultMinecraftLogAnalysisLimits,
  resolveMinecraftLogAnalysisLimits,
} from "./minecraftLog.js";

describe("Minecraft log analysis", () => {
  it("extracts Paper-style events and explicit exception causes without assigning blame", () => {
    const result = analyzeMinecraftLog({
      text: [
        "[01:58:16] [Server thread/ERROR]: java.lang.RuntimeException: request failed",
        "at example-plugin.jar//com.example.Plugin.run(Plugin.kt:42) ~[?:?]",
        "Caused by: java.lang.IllegalStateException: database unavailable",
        "at java.base/java.util.Objects.requireNonNull(Objects.java:233) ~[?:?]",
      ].join("\n"),
    });

    expect(result.format).toBe("minecraft-log");
    expect(result.eventTotal).toBe(1);
    expect(result.events[0]).toMatchObject({
      line: 1,
      timestamp: "01:58:16",
      thread: "Server thread",
      level: "ERROR",
    });
    expect(result.exceptionChainTotal).toBe(1);
    expect(result.exceptionChains[0]?.deepestCause).toMatchObject({
      branch: "cause",
      type: "java.lang.IllegalStateException",
      message: "database unavailable",
    });
    expect(result.exceptionChains[0]?.entries.map((entry) => entry.branch)).toEqual([
      "primary",
      "cause",
    ]);
    expect(result.artifacts).toEqual([
      { name: "example-plugin.jar", firstLine: 2, occurrences: 1 },
    ]);
    expect(result.platforms).toEqual([]);
    expect(result.notes.join("\n")).toContain("not blame attribution");
  });

  it("keeps suppressed branches separate from the deepest explicit primary cause", () => {
    const result = analyzeMinecraftLog({
      text: [
        "java.lang.RuntimeException: top",
        "\tat example.Top.run(Top.java:1)",
        "\tSuppressed: java.io.IOException: close failed",
        "\t\tat example.Close.run(Close.java:2)",
        "\tCaused by: java.lang.IllegalStateException: suppressed cause",
        "\t\tat example.Close.cause(Close.java:3)",
        "Caused by: java.lang.IllegalArgumentException: primary root",
        "\tat example.Root.run(Root.java:4)",
      ].join("\r\n"),
    });

    const chain = result.exceptionChains[0];
    expect(result.format).toBe("java-stacktrace");
    expect(result.processedLines).toBe(8);
    expect(chain?.entries.map((entry) => [entry.relation, entry.branch])).toEqual([
      ["thrown", "primary"],
      ["suppressed", "suppressed"],
      ["caused-by", "suppressed"],
      ["caused-by", "cause"],
    ]);
    expect(chain?.deepestCause).toMatchObject({
      branch: "cause",
      type: "java.lang.IllegalArgumentException",
      message: "primary root",
    });
  });

  it("leaves deepestCause null when there is no explicit primary Caused by entry", () => {
    const result = analyzeMinecraftLog({
      text: [
        "java.lang.RuntimeException: top",
        "\tSuppressed: java.io.IOException: outer suppressed",
        "\t\tSuppressed: java.lang.IllegalStateException: nested suppressed",
        "\t\tCaused by: java.lang.IllegalArgumentException: nested cause",
        "\tCaused by: java.io.UncheckedIOException: outer suppressed cause",
      ].join("\n"),
    });

    expect(result.exceptionChains[0]?.deepestCause).toBeNull();
    expect(result.exceptionChains[0]?.entries.map((entry) => entry.branch)).toEqual([
      "primary",
      "suppressed",
      "suppressed",
      "suppressed",
      "suppressed",
    ]);
  });

  it("tracks nested suppressed ancestry until a true primary cause is reached", () => {
    const result = analyzeMinecraftLog({
      text: [
        "java.lang.RuntimeException: top",
        "\tSuppressed: java.io.IOException: outer suppressed",
        "\t\tSuppressed: java.lang.IllegalStateException: nested suppressed",
        "\t\tCaused by: java.lang.IllegalArgumentException: nested cause",
        "\tCaused by: java.io.UncheckedIOException: outer suppressed cause",
        "Caused by: java.lang.AssertionError: primary root",
      ].join("\n"),
    });

    const chain = result.exceptionChains[0];
    expect(chain?.entries.map((entry) => [entry.relation, entry.branch])).toEqual([
      ["thrown", "primary"],
      ["suppressed", "suppressed"],
      ["suppressed", "suppressed"],
      ["caused-by", "suppressed"],
      ["caused-by", "suppressed"],
      ["caused-by", "cause"],
    ]);
    expect(chain?.deepestCause).toMatchObject({
      line: 6,
      type: "java.lang.AssertionError",
      message: "primary root",
    });
  });

  it("joins stack traces whose continuation lines repeat the Minecraft log prefix", () => {
    const result = analyzeMinecraftLog({
      text: [
        "[11:18:33] [Render thread/ERROR] [examplemod]: java.lang.RuntimeException: wrapper",
        "[11:18:33] [Render thread/ERROR] [examplemod]: \tat knot//example.Client.start(Client.java:5)",
        "[11:18:33] [Render thread/ERROR] [examplemod]: Caused by: java.lang.NoClassDefFoundError: example/Missing",
        "[11:18:33] [Render thread/ERROR] [examplemod]: \tat knot//example.Client.load(Client.java:6)",
      ].join("\n"),
    });

    expect(result.eventTotal).toBe(4);
    expect(result.exceptionChainTotal).toBe(1);
    expect(result.exceptionChains[0]?.entries).toHaveLength(2);
    expect(result.exceptionChains[0]?.deepestCause?.type).toBe("java.lang.NoClassDefFoundError");
  });

  it("does not attach frames that occur after an unrelated non-log line", () => {
    const result = analyzeMinecraftLog({
      text: [
        "java.lang.RuntimeException: first",
        "\tat example.First.run(First.java:1)",
        "unrelated separator",
        "\tat example.Unrelated.run(Unrelated.java:2)",
      ].join("\n"),
    });

    expect(result.exceptionChainTotal).toBe(1);
    expect(result.stackFrameTotal).toBe(1);
    expect(result.exceptionChains[0]?.entries[0]?.frames).toEqual([
      expect.objectContaining({ frame: "example.First.run(First.java:1)" }),
    ]);
  });

  it("extracts crash metadata and only explicit platform version statements", () => {
    const result = analyzeMinecraftLog({
      text: [
        "---- Minecraft Crash Report ----",
        "Description: Rendering screen",
        "Minecraft Version: 1.2.3.4",
        "Java Version: 25.0.2, Eclipse Adoptium",
        "Operating System: Windows 11 (amd64)",
        "[22:51:46 INFO]: Booting up Velocity 3.5.0-SNAPSHOT (git-a7581821-b605)...",
        "[22:51:47 INFO]: This server is running Paper version 1.21.11-132@c5eb079",
      ].join("\n"),
    });

    expect(result.format).toBe("crash-report");
    expect(result.crashReport).toEqual({
      description: "Rendering screen",
      minecraftVersion: "1.2.3.4",
      javaVersion: "25.0.2, Eclipse Adoptium",
      operatingSystem: "Windows 11 (amd64)",
    });
    expect(result.platforms).toEqual([
      { platform: "minecraft", version: "1.2.3.4", line: 3 },
      { platform: "velocity", version: "3.5.0-SNAPSHOT", line: 6 },
      { platform: "paper", version: "1.21.11-132@c5eb079", line: 7 },
    ]);
  });

  it("extracts only explicitly named mod and plugin components", () => {
    const result = analyzeMinecraftLog({
      text: [
        "java.lang.RuntimeException: failed",
        "at hiddenpackage.internal.Component.run(Component.java:1)",
        "Could not execute entrypoint stage 'client' due to errors, provided by 'emotecraft'!",
        "Mixin apply for mod examplemod failed",
        "Error occurred while enabling ExamplePlugin v1.2.3",
      ].join("\n"),
    });

    expect(result.components).toEqual([
      { id: "emotecraft", kind: "mod", firstLine: 3, occurrences: 1 },
      { id: "examplemod", kind: "mod", firstLine: 4, occurrences: 1 },
      { id: "ExamplePlugin", kind: "plugin", firstLine: 5, occurrences: 1 },
    ]);
    expect(result.components.map((entry) => entry.id)).not.toContain("hiddenpackage");
  });

  it("redacts credentials, IP addresses, and absolute user paths before retaining output", () => {
    const result = analyzeMinecraftLog({
      text: [
        '[12:00:00] [Server thread/ERROR]: java.lang.RuntimeException: password=hunter2 pass\u200bword=hidden token: abc123 peer=203.0.113.7:25565 local=::1 invalid=999.999.999.999 single=/private-root quoted="C:\\Users\\Quoted User" unc="\\\\private-server\\private-share\\file.log"',
        "at C:\\Users\\alice\\server\\plugins\\private-plugin.jar//example.Plugin.run(Plugin.java:1)",
        "Caused by: java.io.IOException: file=/home/alice/server/logs/latest.log Authorization: Basic basic-value dsn=https://dbuser:dbpass@198.51.100.4/database",
        "[12:00:01 ERROR]: Cookie: session=private-cookie",
        "at C:\\Users\\Alice Smith\\server\\plugins\\space-plugin.jar//example.Space.run(Space.java:2)",
        "Connect to [2001:db8::1]:25565 with api_key=private",
      ].join("\n"),
    });
    const serialized = JSON.stringify(result);

    expect(result.redactedValueCount).toBeGreaterThanOrEqual(7);
    expect(serialized).not.toContain("hunter2");
    expect(serialized).not.toContain("hidden");
    expect(serialized).not.toContain("abc123");
    expect(serialized).not.toContain("203.0.113.7");
    expect(serialized).not.toContain("198.51.100.4");
    expect(serialized).not.toContain("2001:db8::1");
    expect(serialized).not.toContain("::1");
    expect(serialized).not.toContain("alice");
    expect(serialized).not.toContain("Alice Smith");
    expect(serialized).not.toContain("Quoted User");
    expect(serialized).not.toContain("private-server");
    expect(serialized).not.toContain("private-share");
    expect(serialized).not.toContain("single=/private-root");
    expect(serialized).not.toContain("basic-value");
    expect(serialized).not.toContain("dbuser");
    expect(serialized).not.toContain("dbpass");
    expect(serialized).not.toContain("private-cookie");
    expect(serialized).not.toContain("api_key=private");
    expect(serialized).toContain("[PATH]/private-plugin.jar");
    expect(serialized).toContain("[USER_PATH]/server/logs/latest.log");
    expect(serialized).toContain("[UNC_PATH]");
    expect(serialized).toContain("single=[PATH]/private-root");
    expect(serialized).toContain("[IP_REDACTED]");
    expect(serialized).toContain("999.999.999.999");
    expect(result.artifacts[0]?.name).toBe("private-plugin.jar");
  });

  it("does not expose partial URI credentials when a line limit cuts before the at-sign", () => {
    const text =
      "[12:00:00 ERROR]: java.lang.RuntimeException: dsn=https://dbuser:dbpassword-that-is-long@example.invalid";
    const result = analyzeMinecraftLog({
      text,
      limits: { maxLineCharacters: text.indexOf("is-long") + 2 },
    });
    const serialized = JSON.stringify(result);

    expect(result.exceededLimits).toContain("maxLineCharacters");
    expect(serialized).toContain("[CREDENTIALS_REDACTED]");
    expect(serialized).not.toContain("dbuser");
    expect(serialized).not.toContain("dbpassword");
  });

  it("redacts complete sensitive values before applying a line character limit", () => {
    const cases = [
      {
        text: "java.lang.RuntimeException: unc=\\\\private-server\\private-share\\latest.log",
        maxLineCharacters: "java.lang.RuntimeException: unc=\\\\private-ser".length,
        forbidden: ["private-ser", "private-share"],
      },
      {
        text: "java.lang.RuntimeException: peer=203.0.113.77:25565",
        maxLineCharacters: "java.lang.RuntimeException: peer=203.0.11".length,
        forbidden: ["203.0.11", "203.0.113.77"],
      },
      {
        text: "java.lang.RuntimeException: peer=[2001:db8::1234]:25565",
        maxLineCharacters: "java.lang.RuntimeException: peer=[2001:db8:".length,
        forbidden: ["2001:db8:", "2001:db8::1234"],
      },
      {
        text: "java.lang.RuntimeException: file=C:\\Users\\Private User\\server\\latest.log",
        maxLineCharacters: "java.lang.RuntimeException: file=C:\\Us".length,
        forbidden: ["C:\\Us", "Private User"],
      },
    ];

    for (const sample of cases) {
      const result = analyzeMinecraftLog({
        text: sample.text,
        limits: { maxLineCharacters: sample.maxLineCharacters },
      });
      const serialized = JSON.stringify(result);

      expect(result.exceededLimits).toContain("maxLineCharacters");
      expect(result.redactedValueCount).toBeGreaterThan(0);
      for (const value of sample.forbidden) {
        expect(serialized).not.toContain(value);
      }
    }
  });

  it("removes ANSI/OSC controls, unsafe C0/C1 controls, bidi overrides, and lone surrogates", () => {
    const text = [
      "\u001b]0;private title\u0007\u001b[31m[12:00:00 WARN]: warning\u001b[0m",
      "java.lang.RuntimeException: bad\u0000value\u009b31m\u202esecret\ud800\ufffe",
      "[12:00:01 ERROR]: before\u009dprivate c1 title\u009cafter",
    ].join("\r\n");
    const result = analyzeMinecraftLog({ text });
    const serialized = JSON.stringify(result);

    expect(result.processedLines).toBe(3);
    expect(serialized).not.toContain("private title");
    expect(serialized).not.toContain("private c1 title");
    expect(serialized).not.toContain("\u001b");
    expect(serialized).not.toContain("\u0000");
    expect(serialized).not.toContain("\u009b");
    expect(serialized).not.toContain("\u202e");
    expect(serialized).not.toContain("\ud800");
    expect(serialized).not.toContain("\ufffe");
    expect(serialized).toContain("�");
  });

  it("reports every reached work and retention limit", () => {
    const result = analyzeMinecraftLog({
      text: [
        "[00:00:00 INFO]: This server is running Paper version 1.21.11",
        "[00:00:01 WARN]: Booting up Velocity 3.5.0-SNAPSHOT",
        "java.lang.RuntimeException: first exception message is long",
        "at first.jar//example.First.run(First.java:1)",
        "at second.jar//example.Second.run(Second.java:2)",
        "Caused by: java.lang.IllegalStateException: second",
        "Caused by: java.lang.IllegalArgumentException: third",
        "Mixin apply for mod firstmod failed",
        "Mixin apply for mod secondmod failed",
        "java.lang.AssertionError: another chain",
        `very long line ${"x".repeat(100)}`,
        "trailing line beyond the line limit",
      ].join("\n"),
      limits: {
        maxCharacters: 1_000,
        maxLines: 11,
        maxLineCharacters: 80,
        maxEvents: 1,
        maxExceptionChains: 1,
        maxExceptionDepth: 2,
        maxExceptionEntries: 1,
        maxStackFrames: 1,
        maxPlatforms: 1,
        maxArtifacts: 1,
        maxComponents: 1,
        maxTextCharacters: 16,
        maxRetainedTextCharacters: 64,
      },
    });

    expect(result.analysisComplete).toBe(false);
    expect(result.exceededLimits).toEqual(
      expect.arrayContaining([
        "maxLines",
        "maxLineCharacters",
        "maxEvents",
        "maxExceptionChains",
        "maxExceptionDepth",
        "maxExceptionEntries",
        "maxStackFrames",
        "maxPlatforms",
        "maxArtifacts",
        "maxComponents",
        "maxTextCharacters",
        "maxRetainedTextCharacters",
      ]),
    );
    expect(result.retainedEventCount).toBe(1);
    expect(result.retainedExceptionChainCount).toBe(1);
    expect(result.retainedExceptionEntryCount).toBe(1);
    expect(result.retainedStackFrameCount).toBe(1);
    expect(result.platforms).toHaveLength(1);
    expect(result.artifacts).toHaveLength(1);
    expect(result.components).toHaveLength(1);
    expect(result.exceptionChains[0]?.entries[0]?.message?.length).toBeLessThanOrEqual(16);
    expect(result.retainedTextCharacters).toBe(64);
    const retainedValues = [
      ...result.events.flatMap((event) => [
        event.timestamp,
        event.thread,
        event.logger,
        event.message,
      ]),
      ...(result.crashReport ? Object.values(result.crashReport) : []),
      ...result.platforms.map((platform) => platform.version),
      ...result.artifacts.map((artifact) => artifact.name),
      ...result.components.map((component) => component.id),
      ...result.exceptionChains.flatMap((chain) => [
        chain.thread,
        ...(chain.deepestCause ? [chain.deepestCause.type, chain.deepestCause.message] : []),
        ...chain.entries.flatMap((entry) => [
          entry.type,
          entry.message,
          ...entry.frames.flatMap((frame) => [frame.frame, frame.artifact]),
        ]),
      ]),
    ].filter((value): value is string => typeof value === "string");
    expect(retainedValues.reduce((total, value) => total + value.length, 0)).toBe(
      result.retainedTextCharacters,
    );
  });

  it("reports maxTextCharacters when it is the only reached limit", () => {
    const result = analyzeMinecraftLog({
      text: "java.lang.RuntimeException: a deliberately long retained message",
      limits: { maxTextCharacters: 12 },
    });

    expect(result.exceededLimits).toEqual(["maxTextCharacters"]);
    expect(result.analysisComplete).toBe(false);
    expect(result.exceptionChains[0]?.entries[0]?.message).toBe("a deliberat…");
  });

  it("distinguishes JVM-collapsed frames from frames omitted by analysis limits", () => {
    const result = analyzeMinecraftLog({
      text: [
        "java.lang.RuntimeException: wrapper",
        "\tat example.Top.run(Top.java:1)",
        "\t... 7 more",
      ].join("\n"),
    });
    const entry = result.exceptionChains[0]?.entries[0];

    expect(entry).toMatchObject({ totalFrames: 1, collapsedFrames: 7, omittedFrames: 0 });
    expect(result.stackFrameTotal).toBe(1);
    expect(result.omittedStackFrameCount).toBe(0);
    expect(result.analysisComplete).toBe(true);
  });

  it("keeps adversarial collapsed-frame counts finite", () => {
    const result = analyzeMinecraftLog({
      text: ["java.lang.RuntimeException: wrapper", `\t... ${"9".repeat(1_000)} more`].join("\n"),
    });

    expect(result.exceptionChains[0]?.entries[0]?.collapsedFrames).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("bounds processed input characters and safely handles empty or unknown text", () => {
    const bounded = analyzeMinecraftLog({
      text: "plain text that is not a known log format",
      limits: { maxCharacters: 10 },
    });
    const empty = analyzeMinecraftLog({ text: "" });

    expect(bounded.format).toBe("unknown");
    expect(bounded.processedCharacters).toBe(10);
    expect(bounded.exceededLimits).toContain("maxCharacters");
    expect(empty).toMatchObject({
      format: "unknown",
      inputCharacters: 0,
      processedCharacters: 0,
      processedLines: 0,
      analysisComplete: true,
    });
  });

  it("does not retain an incomplete final line cut by a global input bound", () => {
    const text = [
      "java.lang.RuntimeException: complete",
      "java.lang.IllegalStateException: peer=203.0.113.77",
    ].join("\n");
    const result = analyzeMinecraftLog({
      text,
      limits: { maxCharacters: text.indexOf("203.0.113") + 5 },
    });
    const serialized = JSON.stringify(result);

    expect(result.exceededLimits).toContain("maxCharacters");
    expect(result.exceptionChainTotal).toBe(1);
    expect(serialized).not.toContain("203.0");
    expect(serialized).not.toContain("java.lang.IllegalStateException");
  });

  it("bounds UTF-8 bytes independently from UTF-16 character count", () => {
    const result = analyzeMinecraftLog({
      text: "éé",
      limits: { maxInputBytes: 3, maxCharacters: 10 },
    });

    expect(result.processedCharacters).toBe(1);
    expect(result.processedBytes).toBe(2);
    expect(result.exceededLimits).toContain("maxInputBytes");
    expect(result.exceededLimits).not.toContain("maxCharacters");
  });

  it("only permits callers to lower published limits", () => {
    const resolved = resolveMinecraftLogAnalysisLimits({
      maxInputBytes: defaultMinecraftLogAnalysisLimits.maxInputBytes + 1,
      maxCharacters: defaultMinecraftLogAnalysisLimits.maxCharacters + 1,
      maxEvents: 2,
      maxLines: Number.NaN,
    });

    expect(resolved.maxInputBytes).toBe(defaultMinecraftLogAnalysisLimits.maxInputBytes);
    expect(resolved.maxCharacters).toBe(defaultMinecraftLogAnalysisLimits.maxCharacters);
    expect(resolved.maxEvents).toBe(2);
    expect(resolved.maxLines).toBe(defaultMinecraftLogAnalysisLimits.maxLines);
  });
});

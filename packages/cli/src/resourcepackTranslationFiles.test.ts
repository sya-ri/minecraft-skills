import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  readResourcepackTranslationFiles,
  sameResourcepackTranslationFileIdentity,
} from "./resourcepackTranslationFiles.js";

function fixture(): { file: string; root: string } {
  const root = mkdtempSync(join(tmpdir(), "minecraft-skills-translations-"));
  const directory = join(root, "assets", "example", "lang");
  mkdirSync(directory, { recursive: true });
  const file = join(directory, "en_us.json");
  writeFileSync(file, '{"example.key":"private-value"}');
  return { file, root };
}

describe("readResourcepackTranslationFiles", () => {
  it("reads bounded UTF-8 as a pack-relative raw text input", () => {
    const { file, root } = fixture();
    try {
      const files = readResourcepackTranslationFiles(root, [file]);

      expect(files).toEqual([
        {
          path: "assets/example/lang/en_us.json",
          content: '{"example.key":"private-value"}',
        },
      ]);
      expect(JSON.stringify(files)).not.toContain(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects malformed UTF-8 without exposing a local path", () => {
    const { file, root } = fixture();
    try {
      writeFileSync(file, Buffer.from([0xc3, 0x28]));

      expect(() => readResourcepackTranslationFiles(root, [file])).toThrow(
        "input 1 is not valid UTF-8",
      );
      try {
        readResourcepackTranslationFiles(root, [file]);
      } catch (error) {
        expect(String(error)).not.toContain(root);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects files outside the pack root without echoing their path", () => {
    const { root } = fixture();
    const outsideRoot = mkdtempSync(join(tmpdir(), "minecraft-skills-translations-outside-"));
    const outside = join(outsideRoot, "secret.json");
    writeFileSync(outside, "{}");
    try {
      expect(() => readResourcepackTranslationFiles(root, [outside])).toThrow(
        "input 1 must be a regular file inside the pack root",
      );
      try {
        readResourcepackTranslationFiles(root, [outside]);
      } catch (error) {
        expect(String(error)).not.toContain(outside);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(outsideRoot, { recursive: true, force: true });
    }
  });

  it.runIf(process.platform !== "win32")("rejects symbolic-link file inputs", () => {
    const { file, root } = fixture();
    const link = join(root, "assets", "example", "lang", "link.json");
    try {
      symlinkSync(file, link);
      expect(() => readResourcepackTranslationFiles(root, [link])).toThrow(
        "input 1 must be a regular file inside the pack root",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("compares every stable-file snapshot field", () => {
    const snapshot = {
      ctimeNs: 1n,
      dev: 2n,
      ino: 3n,
      mode: 4n,
      mtimeNs: 5n,
      nlink: 6n,
      size: 7n,
    };

    expect(sameResourcepackTranslationFileIdentity(snapshot, { ...snapshot })).toBe(true);
    for (const field of ["ctimeNs", "dev", "ino", "mode", "mtimeNs", "nlink", "size"] as const) {
      expect(
        sameResourcepackTranslationFileIdentity(snapshot, {
          ...snapshot,
          [field]: snapshot[field] + 1n,
        }),
      ).toBe(false);
    }
  });
});

import { constants, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { waveAudioInspectionLimits } from "@minecraft-skills/catalog";
import { describe, expect, it, vi } from "vitest";
import { readStableWaveAudioFile } from "./waveAudioFile.js";

function fileStatus(
  overrides: Partial<{
    birthtimeNs: bigint;
    ctimeNs: bigint;
    dev: bigint;
    ino: bigint;
    file: boolean;
    link: boolean;
    mode: bigint;
    mtimeNs: bigint;
    nlink: bigint;
    size: bigint;
  }> = {},
) {
  return {
    birthtimeNs: overrides.birthtimeNs ?? 10n,
    ctimeNs: overrides.ctimeNs ?? 20n,
    dev: overrides.dev ?? 1n,
    ino: overrides.ino ?? 2n,
    isFile: () => overrides.file ?? true,
    isSymbolicLink: () => overrides.link ?? false,
    mode: overrides.mode ?? 0o100644n,
    mtimeNs: overrides.mtimeNs ?? 30n,
    nlink: overrides.nlink ?? 1n,
    size: overrides.size ?? 4n,
  };
}

function stableOperations(bytes = Buffer.from([1, 2, 3, 4])) {
  const status = fileStatus({ size: BigInt(bytes.length) });
  return {
    lstat: vi.fn(() => status),
    open: vi.fn((_path: string, _flags: number) => 7),
    fstat: vi.fn(() => status),
    read: vi.fn(
      (_file: number, target: Buffer, offset: number, length: number, position: number) => {
        if (position >= bytes.length) {
          return 0;
        }
        const count = Math.min(length, 2, bytes.length - position);
        bytes.copy(target, offset, position, position + count);
        return count;
      },
    ),
    close: vi.fn(),
  };
}

describe("readStableWaveAudioFile", () => {
  it("reads a final regular entry through a stable positional snapshot", () => {
    const operations = stableOperations();

    expect(readStableWaveAudioFile("sound.wav", operations)).toEqual(Buffer.from([1, 2, 3, 4]));
    expect(operations.lstat).toHaveBeenCalledTimes(2);
    expect(operations.fstat).toHaveBeenCalledTimes(2);
    expect(operations.read).toHaveBeenLastCalledWith(7, expect.any(Buffer), 0, 1, 4);
    expect(operations.close).toHaveBeenCalledWith(7);
  });

  it("requests nonblocking and no-follow open flags when the host exposes them", () => {
    const operations = stableOperations();
    readStableWaveAudioFile("sound.wav", operations);

    const flags = operations.open.mock.calls[0]?.[1];
    const expectedFlags =
      constants.O_RDONLY |
      (typeof constants.O_NONBLOCK === "number" ? constants.O_NONBLOCK : 0) |
      (typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0);
    expect(flags).toBe(expectedFlags);
    if (typeof constants.O_NONBLOCK === "number") {
      expect((flags ?? 0) & constants.O_NONBLOCK).toBe(constants.O_NONBLOCK);
    }
    if (typeof constants.O_NOFOLLOW === "number") {
      expect((flags ?? 0) & constants.O_NOFOLLOW).toBe(constants.O_NOFOLLOW);
    }
  });

  it("rejects a special entry substituted between lstat and nonblocking open", () => {
    const operations = stableOperations();
    operations.fstat.mockReturnValue(fileStatus({ file: false }));

    expect(() => readStableWaveAudioFile("sound.wav", operations)).toThrow(
      "regular, non-symbolic-link local .wav file",
    );
    expect(operations.open).toHaveBeenCalledOnce();
    expect(operations.fstat).toHaveBeenCalledOnce();
    expect(operations.read).not.toHaveBeenCalled();
    expect(operations.close).toHaveBeenCalledWith(7);
  });

  it("requires the exact lower-case .wav extension before filesystem access", () => {
    const operations = stableOperations();

    expect(() => readStableWaveAudioFile("sound.WAV", operations)).toThrow(
      "filename with the exact .wav extension",
    );
    expect(operations.lstat).not.toHaveBeenCalled();
    expect(operations.open).not.toHaveBeenCalled();
  });

  it.each([
    fileStatus({ link: true, file: false }),
    fileStatus({ file: false }),
  ])("rejects symbolic links and special final entries", (status) => {
    const operations = stableOperations();
    operations.lstat.mockReturnValue(status);

    expect(() => readStableWaveAudioFile("sound.wav", operations)).toThrow(
      "regular, non-symbolic-link local .wav file",
    );
    expect(operations.open).not.toHaveBeenCalled();
  });

  it("rejects an actual final symbolic link or junction entry", () => {
    const root = mkdtempSync(join(tmpdir(), "minecraft-skills-wave-link-"));
    const target = join(root, "target");
    const link = join(root, "source.wav");
    try {
      mkdirSync(target);
      symlinkSync(target, link, process.platform === "win32" ? "junction" : "dir");

      expect(() => readStableWaveAudioFile(link)).toThrow(
        "regular, non-symbolic-link local .wav file",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("checks the open handle size before allocating or reading", () => {
    const size = BigInt(waveAudioInspectionLimits.maxInputBytes + 1);
    const status = fileStatus({ size });
    const operations = stableOperations();
    operations.lstat.mockReturnValue(status);
    operations.fstat.mockReturnValue(status);

    expect(() => readStableWaveAudioFile("large.wav", operations)).toThrow(
      `larger than ${waveAudioInspectionLimits.maxInputBytes} bytes`,
    );
    expect(operations.read).not.toHaveBeenCalled();
    expect(operations.close).toHaveBeenCalledWith(7);
  });

  it("detects shrink and growth races during the bounded read", () => {
    const shrink = stableOperations();
    shrink.read.mockReturnValue(0);
    expect(() => readStableWaveAudioFile("shrinking.wav", shrink)).toThrow(
      "changed while it was being read",
    );

    const growth = stableOperations();
    growth.read.mockImplementation(
      (_file: number, target: Buffer, offset: number, length: number, position: number) => {
        if (position === 4) {
          target[offset] = 5;
          return 1;
        }
        const count = Math.min(length, 4 - position);
        Buffer.from([1, 2, 3, 4]).copy(target, offset, position, position + count);
        return count;
      },
    );
    expect(() => readStableWaveAudioFile("growing.wav", growth)).toThrow(
      "changed while it was being read",
    );
  });

  it("detects identity and metadata replacement around the read", () => {
    const replacement = stableOperations();
    replacement.lstat
      .mockReturnValueOnce(fileStatus())
      .mockReturnValueOnce(fileStatus({ ino: 99n }));
    expect(() => readStableWaveAudioFile("replaced.wav", replacement)).toThrow(
      "changed while it was being read",
    );

    const rewrite = stableOperations();
    rewrite.fstat
      .mockReturnValueOnce(fileStatus())
      .mockReturnValueOnce(fileStatus({ mtimeNs: 99n }));
    expect(() => readStableWaveAudioFile("rewritten.wav", rewrite)).toThrow(
      "changed while it was being read",
    );
  });

  it("sanitizes filesystem errors without leaking a path or OS message", () => {
    const operations = stableOperations();
    operations.lstat.mockImplementation(() => {
      throw new Error("ENOENT: secret-root/private/source.wav");
    });

    expect(() => readStableWaveAudioFile("secret-root/private/source.wav", operations)).toThrow(
      "could not safely access the local .wav file",
    );
    try {
      readStableWaveAudioFile("secret-root/private/source.wav", operations);
    } catch (error) {
      expect(String(error)).not.toContain("secret-root");
      expect(String(error)).not.toContain("ENOENT");
    }
  });

  it("sanitizes no-follow or nonblocking open failures", () => {
    const operations = stableOperations();
    operations.open.mockImplementation(() => {
      throw new Error("ELOOP: secret-root/private/source.wav");
    });

    expect(() => readStableWaveAudioFile("secret-root/private/source.wav", operations)).toThrow(
      "could not safely access the local .wav file",
    );
    expect(operations.fstat).not.toHaveBeenCalled();
    expect(operations.close).not.toHaveBeenCalled();
    try {
      readStableWaveAudioFile("secret-root/private/source.wav", operations);
    } catch (error) {
      expect(String(error)).not.toContain("secret-root");
      expect(String(error)).not.toContain("ELOOP");
    }
  });

  it("rejects a snapshot when closing its file handle fails", () => {
    const operations = stableOperations();
    operations.close.mockImplementation(() => {
      throw new Error("close failed");
    });

    expect(() => readStableWaveAudioFile("sound.wav", operations)).toThrow(
      "could not safely close the local .wav file",
    );
  });
});

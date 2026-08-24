import { closeSync, constants, fstatSync, lstatSync, openSync, readSync } from "node:fs";
import type { MinecraftPerformanceAnalysisLimits } from "@minecraft-skills/catalog";

class MinecraftPerformanceFileError extends Error {}

const maximumJsonDepth = 16;
const jsonNodesPerSampleBudget = 12;
const fixedJsonNodeBudget = 256;

function inputError(message: string): MinecraftPerformanceFileError {
  return new MinecraftPerformanceFileError(message);
}

class BoundedJsonScanner {
  private index = 0;
  private nodes = 0;

  constructor(
    private readonly content: string,
    private readonly maximumDepth: number,
    private readonly maximumNodes: number,
  ) {}

  scan(): void {
    this.skipWhitespace();
    this.parseValue(1);
    this.skipWhitespace();
    if (this.index !== this.content.length) {
      this.invalid();
    }
  }

  private parseValue(depth: number): void {
    this.nodes += 1;
    if (this.maximumNodes < this.nodes) {
      throw inputError("minecraft analyze-performance input exceeds the fixed JSON node limit");
    }

    const character = this.content[this.index];
    if (character === "{") {
      this.checkDepth(depth);
      this.parseObject(depth);
      return;
    }
    if (character === "[") {
      this.checkDepth(depth);
      this.parseArray(depth);
      return;
    }
    if (character === '"') {
      this.parseString();
      return;
    }
    if (character === "t") {
      this.parseLiteral("true");
      return;
    }
    if (character === "f") {
      this.parseLiteral("false");
      return;
    }
    if (character === "n") {
      this.parseLiteral("null");
      return;
    }
    if (character === "-" || (character !== undefined && character >= "0" && character <= "9")) {
      this.parseNumber();
      return;
    }
    this.invalid();
  }

  private parseObject(depth: number): void {
    this.index += 1;
    this.skipWhitespace();
    if (this.consume("}")) {
      return;
    }

    const keys = new Set<string>();
    while (true) {
      if (this.content[this.index] !== '"') {
        this.invalid();
      }
      const key = this.parseString();
      if (keys.has(key)) {
        throw inputError("minecraft analyze-performance input contains a duplicate object key");
      }
      keys.add(key);
      this.skipWhitespace();
      if (!this.consume(":")) {
        this.invalid();
      }
      this.skipWhitespace();
      this.parseValue(depth + 1);
      this.skipWhitespace();
      if (this.consume("}")) {
        return;
      }
      if (!this.consume(",")) {
        this.invalid();
      }
      this.skipWhitespace();
    }
  }

  private parseArray(depth: number): void {
    this.index += 1;
    this.skipWhitespace();
    if (this.consume("]")) {
      return;
    }

    while (true) {
      this.parseValue(depth + 1);
      this.skipWhitespace();
      if (this.consume("]")) {
        return;
      }
      if (!this.consume(",")) {
        this.invalid();
      }
      this.skipWhitespace();
    }
  }

  private parseString(): string {
    const start = this.index;
    this.index += 1;
    while (this.index < this.content.length) {
      const character = this.content[this.index];
      if (character === '"') {
        this.index += 1;
        try {
          return JSON.parse(this.content.slice(start, this.index)) as string;
        } catch {
          this.invalid();
        }
      }
      if (character === undefined || character.charCodeAt(0) < 0x20) {
        this.invalid();
      }
      if (character === "\\") {
        this.index += 1;
        const escapeCode = this.content[this.index];
        if (escapeCode === "u") {
          for (let offset = 1; offset <= 4; offset += 1) {
            const digit = this.content[this.index + offset];
            if (digit === undefined || !/[0-9a-fA-F]/.test(digit)) {
              this.invalid();
            }
          }
          this.index += 5;
          continue;
        }
        if (escapeCode === undefined || !'"\\/bfnrt'.includes(escapeCode)) {
          this.invalid();
        }
      }
      this.index += 1;
    }
    this.invalid();
  }

  private parseNumber(): void {
    if (this.consume("-")) {
      // The integer part is checked below.
    }
    if (this.consume("0")) {
      if (this.isDigit(this.content[this.index])) {
        this.invalid();
      }
    } else {
      if (!this.isNonZeroDigit(this.content[this.index])) {
        this.invalid();
      }
      while (this.isDigit(this.content[this.index])) {
        this.index += 1;
      }
    }
    if (this.consume(".")) {
      if (!this.isDigit(this.content[this.index])) {
        this.invalid();
      }
      while (this.isDigit(this.content[this.index])) {
        this.index += 1;
      }
    }
    const exponent = this.content[this.index];
    if (exponent === "e" || exponent === "E") {
      this.index += 1;
      const sign = this.content[this.index];
      if (sign === "+" || sign === "-") {
        this.index += 1;
      }
      if (!this.isDigit(this.content[this.index])) {
        this.invalid();
      }
      while (this.isDigit(this.content[this.index])) {
        this.index += 1;
      }
    }
  }

  private parseLiteral(literal: string): void {
    if (this.content.slice(this.index, this.index + literal.length) !== literal) {
      this.invalid();
    }
    this.index += literal.length;
  }

  private checkDepth(depth: number): void {
    if (this.maximumDepth < depth) {
      throw inputError("minecraft analyze-performance input exceeds the fixed JSON depth limit");
    }
  }

  private skipWhitespace(): void {
    while (
      this.content[this.index] === " " ||
      this.content[this.index] === "\n" ||
      this.content[this.index] === "\r" ||
      this.content[this.index] === "\t"
    ) {
      this.index += 1;
    }
  }

  private consume(character: string): boolean {
    if (this.content[this.index] !== character) {
      return false;
    }
    this.index += 1;
    return true;
  }

  private isDigit(character: string | undefined): boolean {
    return character !== undefined && character >= "0" && character <= "9";
  }

  private isNonZeroDigit(character: string | undefined): boolean {
    return character !== undefined && character >= "1" && character <= "9";
  }

  private invalid(): never {
    throw inputError("minecraft analyze-performance input must contain valid JSON");
  }
}

export function readMinecraftPerformanceFile(
  filePath: string,
  limits: Pick<
    MinecraftPerformanceAnalysisLimits,
    "maxInputBytes" | "maxInputCharacters" | "maxSamples"
  >,
): unknown {
  let pathStatus: ReturnType<typeof lstatSync>;
  try {
    pathStatus = lstatSync(filePath, { bigint: true });
  } catch {
    throw inputError("minecraft analyze-performance could not inspect the input file");
  }
  if (pathStatus.isSymbolicLink() || !pathStatus.isFile()) {
    throw inputError("minecraft analyze-performance requires a regular non-symlink file");
  }

  let file: number;
  try {
    const noFollowFlag = constants.O_NOFOLLOW ?? 0;
    file = openSync(filePath, constants.O_RDONLY | constants.O_NONBLOCK | noFollowFlag);
  } catch {
    throw inputError("minecraft analyze-performance could not open the input file");
  }

  try {
    const before = fstatSync(file, { bigint: true });
    if (!before.isFile()) {
      throw inputError("minecraft analyze-performance requires a regular file");
    }
    if (before.dev !== pathStatus.dev || before.ino !== pathStatus.ino) {
      throw inputError("minecraft analyze-performance input changed before it was opened");
    }
    if (BigInt(limits.maxInputBytes) < before.size) {
      throw inputError("minecraft analyze-performance input exceeds the fixed byte limit");
    }

    const contents = Buffer.allocUnsafe(Number(before.size));
    let offset = 0;
    while (offset < contents.byteLength) {
      const bytesRead = readSync(file, contents, offset, contents.byteLength - offset, null);
      if (bytesRead === 0) {
        break;
      }
      offset += bytesRead;
    }
    const after = fstatSync(file, { bigint: true });
    if (
      offset !== contents.byteLength ||
      after.size !== before.size ||
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.mtimeNs !== before.mtimeNs ||
      after.ctimeNs !== before.ctimeNs
    ) {
      throw inputError("minecraft analyze-performance input changed while it was being read");
    }

    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(contents);
    } catch {
      throw inputError("minecraft analyze-performance input must be valid UTF-8");
    }
    if (limits.maxInputCharacters < text.length) {
      throw inputError("minecraft analyze-performance input exceeds the fixed character limit");
    }
    const maximumJsonNodes = limits.maxSamples * jsonNodesPerSampleBudget + fixedJsonNodeBudget;
    new BoundedJsonScanner(text, maximumJsonDepth, maximumJsonNodes).scan();
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw inputError("minecraft analyze-performance input must contain valid JSON");
    }
  } catch (error) {
    if (error instanceof MinecraftPerformanceFileError) {
      throw error;
    }
    throw inputError("minecraft analyze-performance could not safely read the input file");
  } finally {
    try {
      closeSync(file);
    } catch {
      // Reading has already completed or failed with a path-free diagnostic.
    }
  }
}

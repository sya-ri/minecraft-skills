const classFileMagic = 0xcafebabe;

export const velocityPluginClassFileLimits = {
  maxBytes: 8 * 1024 * 1024,
  maxUtf8Bytes: 4 * 1024 * 1024,
  maxStructureNodes: 100_000,
  maxAnnotationNodes: 4_096,
  maxAnnotationDepth: 16,
} as const;

export type ParsedClassAnnotationValue =
  | { kind: "string"; value: string }
  | { kind: "integer"; value: number }
  | { kind: "annotation"; value: ParsedClassAnnotation }
  | { kind: "array"; value: ParsedClassAnnotationValue[] }
  | { kind: "other" };

export type ParsedClassAnnotation = {
  descriptor: string;
  values: ReadonlyMap<string, ParsedClassAnnotationValue>;
};

export type JavaClassFileEvidence = {
  minorVersion: number;
  majorVersion: number;
  declaredInternalName: string;
  runtimeVisibleAnnotations: readonly ParsedClassAnnotation[];
};

type ConstantPoolEntry =
  | { kind: "utf8"; tag: 1; value: string }
  | { kind: "integer"; tag: 3; value: number }
  | { kind: "class"; tag: 7; nameIndex: number }
  | { kind: "other"; tag: number };

class ClassFileFormatError extends Error {}

class Cursor {
  position: number;

  constructor(
    readonly bytes: Buffer,
    position = 0,
    readonly end = bytes.length,
  ) {
    this.position = position;
  }

  remaining(): number {
    return this.end - this.position;
  }

  u1(): number {
    this.require(1);
    const value = this.bytes[this.position];
    this.position += 1;
    if (value === undefined) throw new ClassFileFormatError();
    return value;
  }

  u2(): number {
    this.require(2);
    const value = this.bytes.readUInt16BE(this.position);
    this.position += 2;
    return value;
  }

  u4(): number {
    this.require(4);
    const value = this.bytes.readUInt32BE(this.position);
    this.position += 4;
    return value;
  }

  take(length: number): Buffer {
    this.require(length);
    const start = this.position;
    this.position += length;
    return this.bytes.subarray(start, this.position);
  }

  skip(length: number): void {
    this.require(length);
    this.position += length;
  }

  fork(length: number): Cursor {
    this.require(length);
    const child = new Cursor(this.bytes, this.position, this.position + length);
    this.position += length;
    return child;
  }

  requireEnd(): void {
    if (this.position !== this.end) throw new ClassFileFormatError();
  }

  private require(length: number): void {
    if (!Number.isSafeInteger(length) || length < 0 || length > this.remaining()) {
      throw new ClassFileFormatError();
    }
  }
}

function decodeModifiedUtf8(bytes: Uint8Array): string {
  const codeUnits: number[] = [];
  for (let index = 0; index < bytes.length; ) {
    const first = bytes[index];
    if (first === undefined || first === 0) throw new ClassFileFormatError();
    if (first <= 0x7f) {
      codeUnits.push(first);
      index += 1;
      continue;
    }
    if ((first & 0xe0) === 0xc0) {
      const second = bytes[index + 1];
      if (second === undefined || (second & 0xc0) !== 0x80) throw new ClassFileFormatError();
      const value = ((first & 0x1f) << 6) | (second & 0x3f);
      if (value < 0x80 && !(first === 0xc0 && second === 0x80)) {
        throw new ClassFileFormatError();
      }
      codeUnits.push(value);
      index += 2;
      continue;
    }
    if ((first & 0xf0) === 0xe0) {
      const second = bytes[index + 1];
      const third = bytes[index + 2];
      if (
        second === undefined ||
        third === undefined ||
        (second & 0xc0) !== 0x80 ||
        (third & 0xc0) !== 0x80
      ) {
        throw new ClassFileFormatError();
      }
      const value = ((first & 0x0f) << 12) | ((second & 0x3f) << 6) | (third & 0x3f);
      if (value < 0x800) throw new ClassFileFormatError();
      codeUnits.push(value);
      index += 3;
      continue;
    }
    throw new ClassFileFormatError();
  }

  const chunks: string[] = [];
  for (let index = 0; index < codeUnits.length; index += 8_192) {
    chunks.push(String.fromCharCode(...codeUnits.slice(index, index + 8_192)));
  }
  return chunks.join("");
}

function constantPoolUtf8(pool: readonly (ConstantPoolEntry | undefined)[], index: number): string {
  const entry = pool[index];
  if (entry?.kind !== "utf8") throw new ClassFileFormatError();
  return entry.value;
}

function constantPoolInteger(
  pool: readonly (ConstantPoolEntry | undefined)[],
  index: number,
): number {
  const entry = pool[index];
  if (entry?.kind !== "integer") throw new ClassFileFormatError();
  return entry.value;
}

function constantPoolClassName(
  pool: readonly (ConstantPoolEntry | undefined)[],
  index: number,
): string {
  const entry = pool[index];
  if (entry?.kind !== "class") throw new ClassFileFormatError();
  return constantPoolUtf8(pool, entry.nameIndex);
}

function parseConstantPool(cursor: Cursor): Array<ConstantPoolEntry | undefined> {
  const count = cursor.u2();
  if (count < 1) throw new ClassFileFormatError();
  const pool: Array<ConstantPoolEntry | undefined> = Array.from({ length: count });
  let utf8Bytes = 0;
  for (let index = 1; index < count; index += 1) {
    const tag = cursor.u1();
    if (tag === 1) {
      const length = cursor.u2();
      utf8Bytes += length;
      if (utf8Bytes > velocityPluginClassFileLimits.maxUtf8Bytes) {
        throw new ClassFileFormatError();
      }
      pool[index] = { kind: "utf8", tag, value: decodeModifiedUtf8(cursor.take(length)) };
      continue;
    }
    if (tag === 3) {
      pool[index] = { kind: "integer", tag, value: cursor.u4() };
      continue;
    }
    if (tag === 4) {
      cursor.skip(4);
      pool[index] = { kind: "other", tag };
      continue;
    }
    if (tag === 5 || tag === 6) {
      cursor.skip(8);
      pool[index] = { kind: "other", tag };
      index += 1;
      if (index >= count) throw new ClassFileFormatError();
      continue;
    }
    if (tag === 7) {
      pool[index] = { kind: "class", tag, nameIndex: cursor.u2() };
      continue;
    }
    if (tag === 8 || tag === 16 || tag === 19 || tag === 20) {
      cursor.skip(2);
      pool[index] = { kind: "other", tag };
      continue;
    }
    if ([9, 10, 11, 12, 17, 18].includes(tag)) {
      cursor.skip(4);
      pool[index] = { kind: "other", tag };
      continue;
    }
    if (tag === 15) {
      cursor.skip(3);
      pool[index] = { kind: "other", tag };
      continue;
    }
    throw new ClassFileFormatError();
  }
  return pool;
}

type AnnotationState = {
  nodes: number;
};

function countAnnotationNode(state: AnnotationState, depth: number): void {
  state.nodes += 1;
  if (
    state.nodes > velocityPluginClassFileLimits.maxAnnotationNodes ||
    depth > velocityPluginClassFileLimits.maxAnnotationDepth
  ) {
    throw new ClassFileFormatError();
  }
}

function parseAnnotationValue(
  cursor: Cursor,
  pool: readonly (ConstantPoolEntry | undefined)[],
  state: AnnotationState,
  depth: number,
): ParsedClassAnnotationValue {
  countAnnotationNode(state, depth);
  const tag = String.fromCharCode(cursor.u1());
  if (tag === "s") {
    return { kind: "string", value: constantPoolUtf8(pool, cursor.u2()) };
  }
  if (["B", "C", "I", "S", "Z"].includes(tag)) {
    return { kind: "integer", value: constantPoolInteger(pool, cursor.u2()) };
  }
  if (["D", "F", "J"].includes(tag)) {
    const index = cursor.u2();
    const expectedTag = tag === "D" ? 6 : tag === "F" ? 4 : 5;
    if (pool[index]?.tag !== expectedTag) throw new ClassFileFormatError();
    return { kind: "other" };
  }
  if (tag === "e") {
    constantPoolUtf8(pool, cursor.u2());
    constantPoolUtf8(pool, cursor.u2());
    return { kind: "other" };
  }
  if (tag === "c") {
    constantPoolUtf8(pool, cursor.u2());
    return { kind: "other" };
  }
  if (tag === "@") {
    return { kind: "annotation", value: parseAnnotation(cursor, pool, state, depth + 1) };
  }
  if (tag === "[") {
    const count = cursor.u2();
    if (state.nodes + count > velocityPluginClassFileLimits.maxAnnotationNodes) {
      throw new ClassFileFormatError();
    }
    const values: ParsedClassAnnotationValue[] = [];
    for (let index = 0; index < count; index += 1) {
      values.push(parseAnnotationValue(cursor, pool, state, depth + 1));
    }
    return { kind: "array", value: values };
  }
  throw new ClassFileFormatError();
}

function parseAnnotation(
  cursor: Cursor,
  pool: readonly (ConstantPoolEntry | undefined)[],
  state: AnnotationState,
  depth: number,
): ParsedClassAnnotation {
  countAnnotationNode(state, depth);
  const descriptor = constantPoolUtf8(pool, cursor.u2());
  const pairCount = cursor.u2();
  if (state.nodes + pairCount > velocityPluginClassFileLimits.maxAnnotationNodes) {
    throw new ClassFileFormatError();
  }
  const values = new Map<string, ParsedClassAnnotationValue>();
  for (let index = 0; index < pairCount; index += 1) {
    const name = constantPoolUtf8(pool, cursor.u2());
    if (values.has(name)) throw new ClassFileFormatError();
    values.set(name, parseAnnotationValue(cursor, pool, state, depth + 1));
  }
  return { descriptor, values };
}

function parseRuntimeVisibleAnnotations(
  cursor: Cursor,
  pool: readonly (ConstantPoolEntry | undefined)[],
): ParsedClassAnnotation[] {
  const count = cursor.u2();
  const state: AnnotationState = { nodes: 0 };
  const annotations: ParsedClassAnnotation[] = [];
  for (let index = 0; index < count; index += 1) {
    annotations.push(parseAnnotation(cursor, pool, state, 0));
  }
  cursor.requireEnd();
  return annotations;
}

function countStructureNode(state: { nodes: number }, amount = 1): void {
  state.nodes += amount;
  if (state.nodes > velocityPluginClassFileLimits.maxStructureNodes) {
    throw new ClassFileFormatError();
  }
}

function skipAttributes(
  cursor: Cursor,
  pool: readonly (ConstantPoolEntry | undefined)[],
  count: number,
  state: { nodes: number },
): void {
  countStructureNode(state, count);
  for (let index = 0; index < count; index += 1) {
    constantPoolUtf8(pool, cursor.u2());
    cursor.skip(cursor.u4());
  }
}

function skipMembers(
  cursor: Cursor,
  pool: readonly (ConstantPoolEntry | undefined)[],
  state: { nodes: number },
): void {
  const count = cursor.u2();
  countStructureNode(state, count);
  for (let index = 0; index < count; index += 1) {
    cursor.skip(6);
    skipAttributes(cursor, pool, cursor.u2(), state);
  }
}

/**
 * Parses only bounded classfile structure needed for identity, target-Java, and class annotations.
 * It intentionally does not verify method bytecode, linkage, constructors, or JVM loadability.
 */
export function inspectJavaClassFile(bytes: Uint8Array): JavaClassFileEvidence {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > velocityPluginClassFileLimits.maxBytes) {
    throw new ClassFileFormatError();
  }
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const cursor = new Cursor(buffer);
  if (cursor.u4() !== classFileMagic) throw new ClassFileFormatError();
  const minorVersion = cursor.u2();
  const majorVersion = cursor.u2();
  const pool = parseConstantPool(cursor);
  cursor.skip(2);
  const declaredInternalName = constantPoolClassName(pool, cursor.u2());
  const superClass = cursor.u2();
  if (superClass !== 0) constantPoolClassName(pool, superClass);
  const interfaceCount = cursor.u2();
  const structureState = { nodes: interfaceCount };
  for (let index = 0; index < interfaceCount; index += 1) {
    constantPoolClassName(pool, cursor.u2());
  }
  skipMembers(cursor, pool, structureState);
  skipMembers(cursor, pool, structureState);

  const attributeCount = cursor.u2();
  countStructureNode(structureState, attributeCount);
  let runtimeVisibleAnnotations: ParsedClassAnnotation[] = [];
  let runtimeVisibleAnnotationAttributeObserved = false;
  for (let index = 0; index < attributeCount; index += 1) {
    const name = constantPoolUtf8(pool, cursor.u2());
    const attribute = cursor.fork(cursor.u4());
    if (name === "RuntimeVisibleAnnotations") {
      if (runtimeVisibleAnnotationAttributeObserved) throw new ClassFileFormatError();
      runtimeVisibleAnnotationAttributeObserved = true;
      runtimeVisibleAnnotations = parseRuntimeVisibleAnnotations(attribute, pool);
    }
  }
  cursor.requireEnd();
  return {
    minorVersion,
    majorVersion,
    declaredInternalName,
    runtimeVisibleAnnotations,
  };
}

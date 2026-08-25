const javaIdentifier = /^[$_\p{ID_Start}][$_\p{ID_Continue}]*$/u;

/** Maximum binary-name length accepted before deriving an archive class-entry path. */
export const maxJavaBinaryNameCharacters = 512;

/**
 * Converts a Java binary name to its exact root JAR class entry.
 * Returns null for malformed or oversized names.
 */
export function javaBinaryNameToClassEntryPath(className: string): string | null {
  if (
    typeof className !== "string" ||
    !className ||
    className.length > maxJavaBinaryNameCharacters
  ) {
    return null;
  }
  const segments = className.split(".");
  if (segments.some((segment) => !javaIdentifier.test(segment))) return null;
  return `${segments.join("/")}.class`;
}

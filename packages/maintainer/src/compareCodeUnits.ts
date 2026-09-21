/**
 * Ascending UTF-16 code unit order: "10" < "2" < "A" < "a".
 * Keeps the default string sort order independent of the host locale.
 */
export function compareCodeUnits(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

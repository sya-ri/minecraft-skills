export type ObservedProtocolIdChange = {
  from: number;
  to: number;
};

export function compareObservedProtocolIds(
  from: number | null,
  to: number | null,
): ObservedProtocolIdChange | undefined {
  if (typeof from !== "number" || typeof to !== "number" || from === to) {
    return undefined;
  }
  return { from, to };
}

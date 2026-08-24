import { describe, expect, it } from "vitest";
import { compareObservedProtocolIds } from "./registryEntryComparison.js";

describe("compareObservedProtocolIds", () => {
  it("reports changes only when both versions expose numeric protocol IDs", () => {
    expect(compareObservedProtocolIds(0, 1)).toEqual({ from: 0, to: 1 });
    expect(compareObservedProtocolIds(1, 1)).toBeUndefined();
    expect(compareObservedProtocolIds(null, 1)).toBeUndefined();
    expect(compareObservedProtocolIds(1, null)).toBeUndefined();
    expect(compareObservedProtocolIds(null, null)).toBeUndefined();
  });
});

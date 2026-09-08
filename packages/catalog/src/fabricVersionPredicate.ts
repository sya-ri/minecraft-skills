/**
 * Fabric Loader predicate semantics, independently implemented from its documented
 * operators and observable VersionPredicateParser/SemanticVersionImpl behavior.
 * See docs/FABRIC_MOD_SET.md for the reference implementation and scope.
 */
type Version = {
  friendly: string;
  components: number[] | null;
  prerelease: string | null;
  wildcard: boolean;
};
type Operator = ">=" | "<=" | ">" | "<" | "=" | "~" | "^";
type Term = { operator: Operator; version: Version };

function numericComponent(part: string): number | null {
  if (!part) return null;
  let component = 0;
  for (let index = 0; index < part.length; index += 1) {
    const unit = part.charAt(index);
    if (!/^\p{Decimal_Number}$/u.test(unit)) return null;
    let zero = part.charCodeAt(index);
    // Integer.parseInt accepts BMP decimal digits, including non-ASCII decimal blocks.
    while (zero > 0 && /^\p{Decimal_Number}$/u.test(String.fromCharCode(zero - 1))) zero -= 1;
    component = component * 10 + ((part.charCodeAt(index) - zero) % 10);
    if (component > 2_147_483_647) return null;
  }
  return component;
}

function version(value: string, wildcards: boolean): Version {
  if (!value) throw new Error("Version must be non-empty");
  const raw: Version = { friendly: value, components: null, prerelease: null, wildcard: false };
  const plus = value.indexOf("+");
  const coreAndPre = plus < 0 ? value : value.slice(0, plus);
  const dash = coreAndPre.indexOf("-");
  const core = dash < 0 ? coreAndPre : coreAndPre.slice(0, dash);
  const prerelease = dash < 0 ? null : coreAndPre.slice(dash + 1);
  if (prerelease !== null && !/^(?:[-0-9A-Za-z]+(?:\.[-0-9A-Za-z]+)*)?$/u.test(prerelease))
    return raw;
  const parts = core.split(".");
  const components: number[] = [];
  let wildcard = false;
  for (const part of parts) {
    if (wildcards && /^[xX*]$/u.test(part)) {
      if (prerelease !== null) return raw;
      wildcard = true;
      if (components.at(-1) !== -1) components.push(-1);
    } else {
      if (wildcard) return raw;
      const component = numericComponent(part);
      if (component === null) return raw;
      components.push(component);
    }
  }
  if (components[0] === -1) return raw;
  const friendly =
    components.map((item) => (item === -1 ? "x" : item)).join(".") +
    (prerelease === null ? "" : `-${prerelease}`) +
    (plus < 0 ? "" : value.slice(plus));
  return { friendly, components, prerelease, wildcard };
}

function compare(left: Version, right: Version): number {
  const a = left.components ?? [];
  const b = right.components ?? [];
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference) return Math.sign(difference);
  }
  if (left.prerelease === right.prerelease) return 0;
  if (left.prerelease === null) return 1;
  if (right.prerelease === null) return -1;
  const preA = left.prerelease ? left.prerelease.split(".") : [];
  const preB = right.prerelease ? right.prerelease.split(".") : [];
  for (let index = 0; index < Math.max(preA.length, preB.length); index += 1) {
    const partA = preA[index];
    const partB = preB[index];
    if (partA === undefined) return -1;
    if (partB === undefined) return 1;
    const numericA = /^(?:0|[1-9][0-9]*)$/u.test(partA);
    const numericB = /^(?:0|[1-9][0-9]*)$/u.test(partB);
    if (numericA !== numericB) return numericA ? -1 : 1;
    if (numericA && partA.length !== partB.length) return Math.sign(partA.length - partB.length);
    if (partA !== partB) return partA < partB ? -1 : 1;
  }
  return 0;
}

function terms(predicate: string): Term[] {
  const result: Term[] = [];
  // Loader splits on literal spaces, then Java-trims each term.
  for (const input of predicate.split(" ")) {
    let start = 0;
    let end = input.length;
    while (start < end && input.charCodeAt(start) <= 32) start += 1;
    while (end > start && input.charCodeAt(end - 1) <= 32) end -= 1;
    let term = input.slice(start, end);
    if (!term || term === "*") continue;
    let operator: Operator = "=";
    for (const candidate of [">=", "<=", ">", "<", "=", "~", "^"] as const) {
      if (term.startsWith(candidate)) {
        operator = candidate;
        term = term.slice(candidate.length);
        break;
      }
    }
    let parsed = version(term, true);
    if (parsed.wildcard && parsed.components) {
      if (operator !== "=") throw new Error("Wildcard ranges require equality or no operator");
      operator = parsed.components.length === 2 ? "^" : "~";
      const components = parsed.components.slice(0, -1);
      const build = parsed.friendly.indexOf("+");
      parsed = {
        ...parsed,
        friendly: `${components.join(".")}-${build < 0 ? "" : parsed.friendly.slice(build)}`,
        components,
        prerelease: "",
        wildcard: false,
      };
    } else if (parsed.components === null) {
      if (operator === ">" || operator === "<")
        throw new Error("Exclusive ranges require a semantic version");
      operator = "=";
    }
    result.push({ operator, version: parsed });
  }
  return result;
}

/** Parse every alternative before evaluating; arrays are OR, terms in a string are AND. */
export function compileFabricVersionPredicate(
  predicates: string | string[],
): (candidate: string) => boolean {
  const alternatives = (typeof predicates === "string" ? [predicates] : predicates).map(terms);
  return (candidate) => {
    const actual = version(candidate, false);
    return alternatives.some((alternative) =>
      alternative.every(({ operator, version: reference }) => {
        if (actual.components === null || reference.components === null) {
          return operator !== ">" && operator !== "<" && actual.friendly === reference.friendly;
        }
        const comparison = compare(actual, reference);
        switch (operator) {
          case ">=":
            return comparison >= 0;
          case "<=":
            return comparison <= 0;
          case ">":
            return comparison > 0;
          case "<":
            return comparison < 0;
          case "=":
            return comparison === 0;
          case "^":
            return comparison >= 0 && actual.components[0] === reference.components[0];
          case "~":
            return (
              comparison >= 0 &&
              actual.components[0] === reference.components[0] &&
              (actual.components[1] ?? 0) === (reference.components[1] ?? 0)
            );
          default:
            return false;
        }
      }),
    );
  };
}

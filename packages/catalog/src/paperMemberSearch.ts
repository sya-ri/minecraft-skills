import type { PaperApiMemberData } from "./schemas.js";

export function paperMemberMatchesType(options: {
  member: PaperApiMemberData;
  typeName: string | undefined;
  resolvedTypeNames: ReadonlySet<string>;
  searchedTypeNames: ReadonlySet<string>;
}): boolean {
  if (!options.typeName) return true;

  const resolvedSearch = options.resolvedTypeNames.size > 0;
  const matchesResolvedType = options.searchedTypeNames.has(options.member.qualifiedTypeName);
  const matchesUnindexedType =
    !resolvedSearch &&
    (options.member.qualifiedTypeName === options.typeName ||
      options.member.typeName === options.typeName);
  if (!matchesResolvedType && !matchesUnindexedType) return false;

  return !(
    resolvedSearch &&
    options.member.kind === "constructor" &&
    !options.resolvedTypeNames.has(options.member.qualifiedTypeName)
  );
}

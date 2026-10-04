/** A tag in a filter: an existing tag (has id) or free text typed by the user. */
export type TagEntry = { id?: string; name: string } | string;

/**
 * Existing tags filter by exact id; free text keeps the backend's partial name match
 * ("food" also matches "seafood").
 */
export function tagFilterParams(tags: TagEntry[] | undefined): {
  filterByTagId?: string[];
  filterByTag?: string[];
} {
  const ids: string[] = [];
  const names: string[] = [];
  for (const t of tags ?? []) {
    if (typeof t !== "string" && t.id) ids.push(t.id);
    else names.push(typeof t === "string" ? t : t.name);
  }
  return {
    filterByTagId: ids.length ? ids : undefined,
    filterByTag: names.length ? names : undefined,
  };
}

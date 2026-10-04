import type { TagEntry } from "./filters";

/** Query params TransactionsPage reads to pre-filter by tag: `tagId` (exact) paired with `tag` (display name). */
export const TAG_ID_PARAM = "tagId";
export const TAG_NAME_PARAM = "tag";

export function transactionsWithTagPath(tag: { id?: string; name?: string }) {
  const params = new URLSearchParams();
  if (tag.id) params.set(TAG_ID_PARAM, tag.id);
  params.set(TAG_NAME_PARAM, tag.name ?? "");
  return `/transactions?${params}`;
}

/** Reads tag filters from the URL; `tag` without a matching `tagId` falls back to a name match. */
export function tagsFromSearchParams(params: URLSearchParams): TagEntry[] {
  const ids = params.getAll(TAG_ID_PARAM);
  const names = params.getAll(TAG_NAME_PARAM);
  return names.map((name, i) => (ids[i] ? { id: ids[i], name } : name));
}

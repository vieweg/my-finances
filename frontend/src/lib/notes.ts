/** Notes value for the API: empty text clears the notes on update, and is omitted on create. */
export function notesForApi(value: string, isEditing: boolean): string | null | undefined {
  const trimmed = value.trim();
  if (trimmed) return trimmed;
  return isEditing ? null : undefined;
}

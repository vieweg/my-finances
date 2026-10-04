import { useEffect, useState } from "react";
import { Search, X, Combine } from "lucide-react";
import { useTags } from "../hooks/useTags";
import { useMergeTags } from "../hooks/useMergeTags";
import { cn } from "@/lib/utils";
import type { components } from "@/api/generated";

type TagType = components["schemas"]["Tag"];

interface Props {
  source: TagType;
  onClose: () => void;
}

export function MergeTagDialog({ source, onClose }: Props) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<TagType | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useTags({ search: search || undefined, sortBy: "name", sortOrder: "asc" });
  const candidates = (data?.pages.flatMap((p) => p.data ?? []) ?? []).filter(
    (t) => t.id !== source.id,
  );

  const mergeTags = useMergeTags();

  async function handleMerge() {
    if (!target) return;
    if (
      !confirm(
        `Merge "${source.name}" into "${target.name}"?\n\nEvery transaction, invoice and contract using "${source.name}" will be moved to "${target.name}", and "${source.name}" will be deleted.`,
      )
    )
      return;
    await mergeTags.mutateAsync({
      targetId: target.id!,
      sourceIds: [source.id!],
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900">Merge tag</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-500"
          >
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Pick the tag that <span className="font-medium text-gray-700">"{source.name}"</span>{" "}
          will be merged into.
        </p>

        <div className="relative mb-2">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            autoFocus
            placeholder="Search tags..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
          {isLoading && (
            <div className="h-24 animate-pulse bg-gray-50" />
          )}
          {!isLoading && candidates.length === 0 && (
            <p className="px-3 py-4 text-sm text-gray-400 text-center">
              No tags found.
            </p>
          )}
          {candidates.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => setTarget(tag)}
              className={cn(
                "w-full text-left px-3 py-2 text-sm transition-colors",
                target?.id === tag.id
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-gray-800 hover:bg-gray-50",
              )}
            >
              {tag.name}
            </button>
          ))}
          {hasNextPage && (
            <button
              type="button"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="w-full px-3 py-2 text-xs text-blue-600 hover:bg-gray-50 disabled:opacity-50"
            >
              {isFetchingNextPage ? "Loading..." : "Load more"}
            </button>
          )}
        </div>

        {mergeTags.error && (
          <p className="text-sm text-red-600 mt-3">{mergeTags.error.message}</p>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleMerge}
            disabled={!target || mergeTags.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Combine size={14} />
            {mergeTags.isPending
              ? "Merging..."
              : target
                ? `Merge into "${target.name}"`
                : "Merge"}
          </button>
        </div>
      </div>
    </div>
  );
}

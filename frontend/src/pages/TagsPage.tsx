import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Tag,
  Search,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Combine,
  ArrowRightLeft,
} from "lucide-react";
import { useTags } from "@/features/tags/hooks/useTags";
import { useCreateTag } from "@/features/tags/hooks/useCreateTag";
import { useUpdateTag } from "@/features/tags/hooks/useUpdateTag";
import { useDeleteTag } from "@/features/tags/hooks/useDeleteTag";
import { useRestoreTag } from "@/features/tags/hooks/useRestoreTag";
import { useTagDuplicates } from "@/features/tags/hooks/useTagDuplicates";
import { useMergeTags } from "@/features/tags/hooks/useMergeTags";
import { MergeTagDialog } from "@/features/tags/components/MergeTagDialog";
import { transactionsWithTagPath } from "@/features/tags/links";
import type { TagFilters } from "@/features/tags/hooks/useTags";
import type { components } from "@/api/generated";

type TagType = components["schemas"]["Tag"];
type DuplicateGroupType = components["schemas"]["TagDuplicateGroup"];
type TagUsage = components["schemas"]["TagWithUsage"]["usage"];
type SortField = NonNullable<TagFilters["sortBy"]>;

const SORT_OPTIONS: { label: string; value: SortField }[] = [
  { label: "Name", value: "name" },
  { label: "Created", value: "createdAt" },
  { label: "Updated", value: "updatedAt" },
];

function TagRow({
  tag,
  onUpdate,
  onDelete,
  onRestore,
  onMerge,
}: {
  tag: TagType;
  onUpdate: (id: string, name: string) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  onRestore?: (id: string) => Promise<unknown>;
  onMerge: (tag: TagType) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tag.name ?? "");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === tag.name) { setEditing(false); setName(tag.name ?? ""); return; }
    setBusy(true);
    try {
      await onUpdate(tag.id!, trimmed);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") { setEditing(false); setName(tag.name ?? ""); }
  }

  async function handleDelete() {
    if (!confirm(`Delete tag "${tag.name}"?`)) return;
    setBusy(true);
    try { await onDelete(tag.id!); } finally { setBusy(false); }
  }

  async function handleRestore() {
    setBusy(true);
    try { await onRestore!(tag.id!); } finally { setBusy(false); }
  }

  if (onRestore) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50 transition-colors">
        <span className="flex-1 text-sm text-gray-500">{tag.name}</span>
        <button
          onClick={handleRestore}
          disabled={busy}
          className="p-1.5 rounded text-gray-400 hover:text-green-600 hover:bg-green-50 disabled:opacity-40"
          title="Restore tag"
        >
          <RotateCcw size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-4 py-3 group hover:bg-gray-50 transition-colors">
      {editing ? (
        <>
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={busy}
            className="flex-1 px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSave}
            disabled={busy || !name.trim()}
            className="p-1.5 rounded text-green-600 hover:bg-green-50 disabled:opacity-40"
          >
            <Check size={15} />
          </button>
          <button
            onClick={() => { setEditing(false); setName(tag.name ?? ""); }}
            disabled={busy}
            className="p-1.5 rounded text-gray-400 hover:bg-gray-100"
          >
            <X size={15} />
          </button>
        </>
      ) : (
        <>
          <Link
            to={transactionsWithTagPath(tag)}
            className="flex-1 text-sm text-gray-800 hover:text-blue-600 hover:underline"
            title="Show transactions with this tag"
          >
            {tag.name}
          </Link>
          <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              title="Rename"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => onMerge(tag)}
              disabled={busy}
              className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-40"
              title="Merge into another tag"
            >
              <ArrowRightLeft size={14} />
            </button>
            <button
              onClick={handleDelete}
              disabled={busy}
              className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function usageLabel(usage: TagUsage) {
  const parts = [
    [usage?.transactions ?? 0, "transaction"],
    [usage?.invoices ?? 0, "invoice"],
    [usage?.contracts ?? 0, "contract"],
  ] as const;
  const used = parts.filter(([n]) => n > 0);
  if (used.length === 0) return "unused";
  return used.map(([n, label]) => `${n} ${label}${n !== 1 ? "s" : ""}`).join(", ");
}

function DuplicateGroup({
  group,
  onMerge,
  isMerging,
}: {
  group: DuplicateGroupType;
  onMerge: (targetId: string, sourceIds: string[]) => void;
  isMerging: boolean;
}) {
  const tags = group.tags ?? [];
  // The backend orders each group by usage, so the first tag is the suggested target
  const [targetId, setTargetId] = useState(tags[0]?.id ?? "");
  const target = tags.find((t) => t.id === targetId);
  const sourceIds = tags.filter((t) => t.id !== targetId).map((t) => t.id!);

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="space-y-1">
        {tags.map((tag) => (
          <label key={tag.id} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name={`merge-target-${group.key}`}
              checked={tag.id === targetId}
              onChange={() => setTargetId(tag.id!)}
              className="accent-blue-600"
            />
            <span className="text-gray-800">{tag.name}</span>
            <Link
              to={transactionsWithTagPath(tag)}
              className="text-xs text-gray-400 hover:text-blue-600 hover:underline"
            >
              {usageLabel(tag.usage)}
            </Link>
          </label>
        ))}
      </div>
      <button
        onClick={() => onMerge(targetId, sourceIds)}
        disabled={isMerging || !target || sourceIds.length === 0}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 border border-blue-200 rounded-md hover:bg-blue-50 disabled:opacity-50 transition-colors"
      >
        <Combine size={12} />
        Merge into "{target?.name}"
      </button>
    </div>
  );
}

export default function TagsPage() {
  const [showDeleted, setShowDeleted] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [mergeSource, setMergeSource] = useState<TagType | null>(null);
  const [newName, setNewName] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState<TagFilters>({
    sortBy: "name",
    sortOrder: "asc",
  });

  useEffect(() => {
    const t = setTimeout(
      () => setFilters((f) => ({ ...f, search: searchInput || undefined })),
      300,
    );
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useTags({ ...filters, deleted: showDeleted || undefined });

  const tags = data?.pages.flatMap((p) => p.data ?? []) ?? [];
  const total = data?.pages[0]?.pagination?.total;

  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();
  const restoreTag = useRestoreTag();
  const mergeTags = useMergeTags();
  const { data: duplicates = [] } = useTagDuplicates();

  function toggleShowDeleted() {
    setShowDeleted((v) => !v);
    setShowDuplicates(false);
  }

  async function handleMerge(targetId: string, sourceIds: string[]) {
    const allTags = duplicates.flatMap((g) => g.tags ?? []);
    const targetName = allTags.find((t) => t.id === targetId)?.name;
    const sourceNames = allTags
      .filter((t) => sourceIds.includes(t.id!))
      .map((t) => `"${t.name}"`)
      .join(", ");
    if (
      !confirm(
        `Merge ${sourceNames} into "${targetName}"?\n\nEvery transaction, invoice and contract using them will be moved to "${targetName}", and the merged tags will be deleted.`,
      )
    )
      return;
    await mergeTags.mutateAsync({ targetId, sourceIds });
  }

  function toggleSort(field: SortField) {
    setFilters((f) => ({
      ...f,
      sortBy: field,
      sortOrder: f.sortBy === field && f.sortOrder === "asc" ? "desc" : "asc",
    }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    await createTag.mutateAsync(trimmed);
    setNewName("");
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Tags</h1>
        <div className="flex items-center gap-2">
          {!showDeleted && duplicates.length > 0 && (
            <button
              onClick={() => setShowDuplicates((v) => !v)}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md border transition-colors ${
                showDuplicates
                  ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                  : "border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
              title="Duplicated tags"
            >
              <Combine size={14} />
              <span className="hidden sm:inline">Duplicates</span>
              <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 text-xs bg-amber-500 text-white rounded-full">
                {duplicates.length}
              </span>
            </button>
          )}
          <button
            onClick={toggleShowDeleted}
            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md border transition-colors ${
              showDeleted
                ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
                : "border-gray-200 text-gray-500 hover:bg-gray-50"
            }`}
          >
            {showDeleted ? <RotateCcw size={14} /> : <Trash2 size={14} />}
            <span className="hidden sm:inline">
              {showDeleted ? "Active" : "Deleted"}
            </span>
          </button>
        </div>
      </div>

      {!showDeleted && (
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New tag name"
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 w-40 sm:w-52"
          />
          <button
            type="submit"
            disabled={createTag.isPending || !newName.trim()}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">{createTag.isPending ? "Creating..." : "New Tag"}</span>
          </button>
        </form>
      )}

      {createTag.error && (
        <p className="text-sm text-red-600">{createTag.error.message}</p>
      )}
      {restoreTag.error && (
        <p className="text-sm text-red-600">{restoreTag.error.message}</p>
      )}

      {showDuplicates && !showDeleted && duplicates.length > 0 && (
        <div className="bg-white rounded-lg border border-amber-200">
          <div className="px-4 py-3 border-b border-amber-100 bg-amber-50 rounded-t-lg">
            <p className="text-sm font-medium text-amber-800">Duplicated tags</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Tags whose names only differ by accents, case or spacing. Pick the
              tag to keep; the others are merged into it.
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {duplicates.map((group) => (
              <DuplicateGroup
                key={group.key}
                group={group}
                onMerge={handleMerge}
                isMerging={mergeTags.isPending}
              />
            ))}
          </div>
          {mergeTags.error && (
            <p className="px-4 pb-3 text-sm text-red-600">{mergeTags.error.message}</p>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search tags..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {SORT_OPTIONS.map(({ label, value }) => {
            const isActive = (filters.sortBy ?? "name") === value;
            return (
              <button
                key={value}
                onClick={() => toggleSort(value)}
                className={`flex items-center gap-0.5 px-2.5 py-2 text-xs rounded-md border transition-colors ${
                  isActive
                    ? "bg-blue-50 border-blue-200 text-blue-700"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                <span className="hidden sm:inline">{label}</span>
                {isActive && (
                  filters.sortOrder === "asc"
                    ? <ChevronUp size={12} />
                    : <ChevronDown size={12} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading && (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 animate-pulse bg-gray-50" />
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600">{error.message}</p>
      )}

      {!isLoading && !error && tags.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-lg border border-gray-200 text-center">
          <Tag size={40} className="text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">
            {searchInput
              ? "No tags match your search."
              : showDeleted
                ? "No deleted tags."
                : "No tags yet."}
          </p>
        </div>
      )}

      {tags.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {tags.map((tag) => (
            <TagRow
              key={tag.id}
              tag={tag}
              onUpdate={(id, name) => updateTag.mutateAsync({ id, name })}
              onDelete={(id) => deleteTag.mutateAsync(id)}
              onRestore={showDeleted ? (id) => restoreTag.mutateAsync(id) : undefined}
              onMerge={setMergeSource}
            />
          ))}
        </div>
      )}

      {hasNextPage && (
        <div className="flex justify-center">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {isFetchingNextPage ? "Loading..." : `Load more${total != null ? ` (${tags.length} of ${total})` : ""}`}
          </button>
        </div>
      )}

      {mergeSource && (
        <MergeTagDialog
          source={mergeSource}
          onClose={() => setMergeSource(null)}
        />
      )}
    </div>
  );
}

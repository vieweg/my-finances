import { RotateCcw, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/format";

interface DeletedBannerProps {
  resource: string;
  deletedAt: string;
  onRestore?: () => void;
  isRestoring?: boolean;
  error?: Error | null;
}

export function DeletedBanner({
  resource,
  deletedAt,
  onRestore,
  isRestoring,
  error,
}: DeletedBannerProps) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 space-y-2">
      <div className="flex items-center gap-3">
        <Trash2 size={16} className="text-red-500 shrink-0" />
        <p className="flex-1 text-sm text-red-700">
          This {resource} was deleted on {formatDate(deletedAt)}.
        </p>
        {onRestore && (
          <button
            onClick={onRestore}
            disabled={isRestoring}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 bg-white border border-green-200 rounded-md hover:bg-green-50 disabled:opacity-50 transition-colors shrink-0"
          >
            <RotateCcw size={13} />
            {isRestoring ? "Restoring..." : "Restore"}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error.message}</p>}
    </div>
  );
}

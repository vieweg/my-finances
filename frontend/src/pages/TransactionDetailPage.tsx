import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  Clock,
  ChevronDown,
  Pencil,
  Trash2,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  useTransaction,
  useTransactionHistory,
  useRestoreTransaction,
  useRestoreDeletedTransaction,
  useDeleteTransaction,
  TransactionFormDialog,
} from "@/features/transactions";
import { useWallets, WalletLink } from "@/features/wallets";
import { DeletedBanner } from "@/components/DeletedBanner";
import type { components } from "@/api/generated";

type Transaction = components["schemas"]["Transaction"];

function VersionCard({
  version,
  isCurrent,
  onRestore,
  isRestoring,
  readOnly,
}: {
  version: Transaction;
  isCurrent: boolean;
  onRestore: (versionId: string) => void;
  isRestoring: boolean;
  readOnly: boolean;
}) {
  const isIncome = version.type === "income";

  return (
    <div
      className={cn(
        "rounded-lg border p-4 space-y-2",
        isCurrent ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-white",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            {isCurrent && (
              <span className="text-xs font-medium px-2 py-0.5 bg-blue-600 text-white rounded-full">
                Current
              </span>
            )}
            <span className="text-xs text-gray-400">
              v{version.version} &middot;{" "}
              {version.updatedAt
                ? new Intl.DateTimeFormat("en-GB", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(new Date(version.updatedAt))
                : "—"}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-900 truncate">
            {version.description}
          </p>
          <div className="flex items-center gap-3 text-sm">
            <span
              className={cn(
                "font-medium",
                isIncome ? "text-green-700" : "text-red-700",
              )}
            >
              {isIncome ? "+" : "−"}
              {formatCurrency(
                version.total?.amount ?? 0,
                version.total?.currency ?? "BRL",
              )}
            </span>
            <span className="text-gray-400 text-xs">
              {version.date ? formatDate(version.date) : "—"}
            </span>
          </div>
          {version.tags && version.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {version.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {!isCurrent && !readOnly && (
          <button
            onClick={() => onRestore(version.versionId!)}
            disabled={isRestoring || !version.versionId}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 border border-blue-200 rounded-md hover:bg-blue-50 disabled:opacity-50 transition-colors shrink-0"
          >
            <RotateCcw size={12} />
            Restore
          </button>
        )}
      </div>
    </div>
  );
}

export default function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const { data: tx, isLoading, error } = useTransaction(id!);
  const {
    data: historyData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useTransactionHistory(id!);
  const restore = useRestoreTransaction(id!);
  const deleteTransaction = useDeleteTransaction();
  const restoreDeleted = useRestoreDeletedTransaction();
  const { data: wallets = [] } = useWallets();

  const [showEdit, setShowEdit] = useState(false);

  const actionError = deleteTransaction.error;
  const restoreError = restore.error;

  const wallet = tx?.wallet;

  async function handleDelete() {
    if (
      !confirm(
        "Delete this transaction? This can be undone from the deleted items list.",
      )
    )
      return;
    await deleteTransaction.mutateAsync(id!);
    navigate(-1);
  }

  async function handleRestore(versionId: string) {
    if (
      !confirm(
        "Restore this version? The current version will be preserved in history.",
      )
    )
      return;
    setRestoringId(versionId);
    try {
      await restore.mutateAsync(versionId);
    } finally {
      setRestoringId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded bg-gray-200 animate-pulse" />
        <div className="h-32 rounded-lg bg-gray-200 animate-pulse" />
        <div className="h-64 rounded-lg bg-gray-200 animate-pulse" />
      </div>
    );
  }

  if (error || !tx) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft size={15} />
          Back
        </button>
        <p className="text-sm text-red-600">
          {error?.message ?? "Transaction not found."}
        </p>
      </div>
    );
  }

  const isIncome = tx.type === "income";
  const isDeleted = !!tx.deletedAt;
  const allVersionPages = historyData?.pages ?? [];
  const allVersions = allVersionPages.flatMap((p) => p.data ?? []);
  const currentVersionId = tx.versionId;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-semibold text-gray-900">
          Transaction Detail
        </h1>
      </div>

      {isDeleted && (
        <DeletedBanner
          resource="transaction"
          deletedAt={tx.deletedAt!}
          onRestore={() => restoreDeleted.mutate(tx.id!)}
          isRestoring={restoreDeleted.isPending}
          error={restoreDeleted.error}
        />
      )}

      {showEdit && (
        <TransactionFormDialog
          transaction={tx}
          wallets={wallets}
          onClose={() => setShowEdit(false)}
        />
      )}

      {/* Current state */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-lg font-semibold text-gray-900">
              {tx.description}
            </p>
            <p className="text-sm text-gray-500">
              {tx.date ? formatDate(tx.date) : "—"}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p
              className={cn(
                "text-2xl font-bold",
                isIncome ? "text-green-700" : "text-red-700",
              )}
            >
              {isIncome ? "+" : "−"}
              {formatCurrency(
                tx.total?.amount ?? 0,
                tx.total?.currency ?? "BRL",
              )}
            </p>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-medium mt-1",
                isIncome ? "text-green-700" : "text-red-700",
              )}
            >
              {isIncome ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {isIncome ? "Income" : "Expense"}
            </span>
          </div>
        </div>

        {tx.tags && tx.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tx.tags.map((tag) => (
              <span
                key={tag.id}
                className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm border-t border-gray-100 pt-3">
          <dt className="text-gray-500">Version</dt>
          <dd className="text-gray-900 font-medium">v{tx.version}</dd>
          <dt className="text-gray-500">Currency</dt>
          <dd className="text-gray-900 font-medium">
            {tx.total?.currency ?? "—"}
          </dd>
          {wallet && (
            <>
              <dt className="text-gray-500">Wallet</dt>
              <dd className="font-medium">
                <WalletLink wallet={wallet} />
              </dd>
            </>
          )}

          {tx.notes && (
            <>
              <dt className="text-gray-500">Notes</dt>
              <dd className="text-gray-900 whitespace-pre-wrap">{tx.notes}</dd>
            </>
          )}
          <dt className="text-gray-500">Created at</dt>
          <dd className="text-gray-900">
            {tx.createdAt
              ? new Intl.DateTimeFormat("en-GB", {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(new Date(tx.createdAt))
              : "—"}
          </dd>
          <dt className="text-gray-500">Updated at</dt>
          <dd className="text-gray-900">
            {tx.updatedAt
              ? new Intl.DateTimeFormat("en-GB", {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(new Date(tx.updatedAt))
              : "—"}
          </dd>
        </dl>

        {actionError && (
          <p className="text-sm text-red-600">{actionError.message}</p>
        )}

        {/* Actions */}
        {!isDeleted && (
          <div className="ml-auto justify-between flex items-center gap-2">
            <button
              onClick={() => setShowEdit(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              <Pencil size={14} />
              Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteTransaction.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 rounded-md hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Version history */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Clock size={15} />
          Version history
        </div>

        {allVersions.length === 0 && !isFetchingNextPage && (
          <p className="text-sm text-gray-400 py-2">
            No previous versions found.
          </p>
        )}

        <div className="space-y-2">
          {allVersions.map((version) => (
            <VersionCard
              key={version.versionId}
              version={version}
              isCurrent={version.versionId === currentVersionId}
              readOnly={isDeleted}
              onRestore={handleRestore}
              isRestoring={restoringId === version.versionId}
            />
          ))}
          {restoreError && (
            <p className="text-sm text-red-600">{restoreError.message}</p>
          )}
        </div>

        {hasNextPage && (
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
          >
            <ChevronDown size={15} />
            {isFetchingNextPage ? "Loading..." : "Load more versions"}
          </button>
        )}
      </div>
    </div>
  );
}

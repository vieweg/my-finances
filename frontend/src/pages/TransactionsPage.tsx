import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import {
  useDeleteTransaction,
  useRestoreDeletedTransaction,
  useHardDeleteTransaction,
  TransactionList,
  TransactionFormDialog,
} from "@/features/transactions";
import { useWallets } from "@/features/wallets";
import { tagsFromSearchParams } from "@/features/tags/links";
import { cn } from "@/lib/utils";
import type { components } from "@/api/generated";

type Transaction = components["schemas"]["Transaction"];

type DialogState =
  | { type: "create" }
  | { type: "edit"; transaction: Transaction }
  | null;

export default function TransactionsPage() {
  const [showDeleted, setShowDeleted] = useState(false);
  const [searchParams] = useSearchParams();
  const tagParams = tagsFromSearchParams(searchParams);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  const deleteTransaction = useDeleteTransaction();
  const restoreDeletedTransaction = useRestoreDeletedTransaction();
  const hardDeleteTransaction = useHardDeleteTransaction();
  const { data: wallets = [] } = useWallets();

  function toggleShowDeleted() {
    setShowDeleted((v) => !v);
    setSelectedIds(new Set());
    setSelectionMode(false);
  }

  async function handleDelete(transaction: Transaction) {
    if (!confirm(`Delete "${transaction.description}"?`)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(transaction.id!);
      return next;
    });
    await deleteTransaction.mutateAsync(transaction.id!);
  }

  async function handleRestore(transaction: Transaction) {
    await restoreDeletedTransaction.mutateAsync(transaction.id!);
  }

  async function handleHardDelete(transaction: Transaction) {
    if (
      !confirm(
        `Permanently delete "${transaction.description}"?\n\nThis action is irreversible and cannot be undone.`,
      )
    )
      return;
    await hardDeleteTransaction.mutateAsync(transaction.id!);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Transactions</h1>
        <div className="flex items-center gap-2">
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
          {!showDeleted && (
            <>
              <button
                onClick={() => {
                  if (selectionMode) setSelectedIds(new Set());
                  setSelectionMode((v) => !v);
                }}
                className={cn(
                  "sm:hidden px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  selectionMode
                    ? "text-blue-600 hover:bg-blue-50"
                    : "text-gray-600 hover:bg-gray-100",
                )}
              >
                {selectionMode ? "Done" : "Select"}
              </button>
              <button
                onClick={() => setDialog({ type: "create" })}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">New Transaction</span>
              </button>
            </>
          )}
        </div>
      </div>

      <TransactionList
        // Remount when the URL filters change so the new initialFilters apply
        key={searchParams.toString()}
        initialFilters={
          tagParams.length ? { tags: tagParams } : undefined
        }
        fixedFilters={{ deleted: showDeleted || undefined }}
        selectedIds={selectedIds}
        selectionMode={selectionMode}
        onSelectionChange={setSelectedIds}
        onEdit={(t) => setDialog({ type: "edit", transaction: t })}
        onDelete={handleDelete}
        onRestore={showDeleted ? handleRestore : undefined}
        onHardDelete={showDeleted ? handleHardDelete : undefined}
      />

      {dialog?.type === "create" && (
        <TransactionFormDialog
          wallets={wallets}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === "edit" && (
        <TransactionFormDialog
          transaction={dialog.transaction}
          wallets={wallets}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

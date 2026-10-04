import { useState, useEffect } from "react";
import { Plus, ChevronDown, ChevronUp, ArrowDownUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useDeleteTransaction,
  TransactionList,
  TransactionFormDialog,
} from "@/features/transactions";
import { useWallets } from "@/features/wallets";
import type { components } from "@/api/generated";

type Transaction = components["schemas"]["Transaction"];

type DialogState =
  | { type: "create" }
  | { type: "edit"; transaction: Transaction }
  | null;

interface Props {
  startDate: string;
  endDate: string;
}

export function DashboardTransactionsSection({ startDate, endDate }: Props) {
  const [open, setOpen] = useState(true);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  const { data: wallets = [] } = useWallets();
  const deleteTransaction = useDeleteTransaction();

  useEffect(() => {
    setDialog(null);
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, [startDate, endDate]);

  async function handleDelete(transaction: Transaction) {
    if (!confirm(`Delete "${transaction.description}"?`)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(transaction.id!);
      return next;
    });
    await deleteTransaction.mutateAsync(transaction.id!);
  }

  return (
    <div className="space-y-2">
      <div className="flex px-4 items-center justify-between">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex uppercase items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900"
        >
          <ArrowDownUp size={14} className="text-gray-400" />
          Transactions
          {open ? (
            <ChevronUp size={14} className="text-gray-400" />
          ) : (
            <ChevronDown size={14} className="text-gray-400" />
          )}
        </button>
        <div className="flex items-center gap-2">
          {open && (
            <button
              onClick={() => {
                if (selectionMode) setSelectedIds(new Set());
                setSelectionMode((v) => !v);
              }}
              className={cn(
                "sm:hidden px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                selectionMode
                  ? "text-blue-600 hover:bg-blue-50"
                  : "text-gray-600 hover:bg-gray-100",
              )}
            >
              {selectionMode ? "Done" : "Select"}
            </button>
          )}
          <button
            onClick={() => setDialog({ type: "create" })}
            title="Add transaction"
            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-xs rounded-md hover:bg-green-700 transition-colors cursor-pointer"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      {open && (
        <TransactionList
          fixedFilters={{ startDate, endDate }}
          hideDateRange
          selectedIds={selectedIds}
          selectionMode={selectionMode}
          onSelectionChange={setSelectedIds}
          onEdit={(t) => setDialog({ type: "edit", transaction: t })}
          onDelete={handleDelete}
          emptyMessage="No transactions this month."
        />
      )}

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

import { useState } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import {
  useDeleteInvoice,
  promptCancelReason,
  useRestoreInvoice,
  useHardDeleteInvoice,
  InvoiceList,
  InvoiceFormDialog,
  AddPaymentDialog,
  BulkPaymentDialog,
} from "@/features/invoices";
import { cn } from "@/lib/utils";
import type { components } from "@/api/generated";

type Invoice = components["schemas"]["Invoice"];

type DialogState =
  | { type: "create" }
  | { type: "edit"; invoice: Invoice }
  | { type: "payment"; invoice: Invoice }
  | { type: "bulkPayment"; invoices: Invoice[] }
  | null;

export default function InvoicesPage() {
  const [showDeleted, setShowDeleted] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  const deleteInvoice = useDeleteInvoice();
  const restoreInvoice = useRestoreInvoice();
  const hardDeleteInvoice = useHardDeleteInvoice();

  function toggleShowDeleted() {
    setShowDeleted((v) => !v);
    setSelectedIds(new Set());
    setSelectionMode(false);
  }

  async function handleDelete(invoice: Invoice) {
    const reason = promptCancelReason(invoice.contact?.name);
    if (reason === null) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(invoice.id!);
      return next;
    });
    await deleteInvoice.mutateAsync({ id: invoice.id!, reason });
  }

  async function handleRestore(invoice: Invoice) {
    await restoreInvoice.mutateAsync(invoice.id!);
  }

  async function handleHardDelete(invoice: Invoice) {
    if (
      !confirm(
        `Permanently delete invoice for "${invoice.contact?.name}"?\n\nThis action is irreversible and cannot be undone.`,
      )
    )
      return;
    await hardDeleteInvoice.mutateAsync(invoice.id!);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Invoices</h1>
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
                <span className="hidden sm:inline">New Invoice</span>
              </button>
            </>
          )}
        </div>
      </div>

      <InvoiceList
        fixedFilters={{ deleted: showDeleted || undefined }}
        defaultSort={{ sortBy: "dueDate", sortOrder: "desc" }}
        selectedIds={selectedIds}
        selectionMode={selectionMode}
        onSelectionChange={setSelectedIds}
        onEdit={(inv) => setDialog({ type: "edit", invoice: inv })}
        onDelete={handleDelete}
        onAddPayment={(inv) => setDialog({ type: "payment", invoice: inv })}
        onBulkPay={(invoices) => setDialog({ type: "bulkPayment", invoices })}
        onRestore={showDeleted ? handleRestore : undefined}
        onHardDelete={showDeleted ? handleHardDelete : undefined}
      />

      {dialog?.type === "create" && (
        <InvoiceFormDialog onClose={() => setDialog(null)} />
      )}
      {dialog?.type === "edit" && (
        <InvoiceFormDialog invoice={dialog.invoice} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === "payment" && (
        <AddPaymentDialog invoice={dialog.invoice} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === "bulkPayment" && (
        <BulkPaymentDialog invoices={dialog.invoices} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

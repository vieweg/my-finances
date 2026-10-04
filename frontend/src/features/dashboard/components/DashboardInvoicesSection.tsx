import { useState, useEffect } from "react";
import { Plus, ChevronDown, ChevronUp, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useDeleteInvoice,
  promptCancelReason,
  InvoiceList,
  InvoiceFormDialog,
  AddPaymentDialog,
  BulkPaymentDialog,
} from "@/features/invoices";
import type { components } from "@/api/generated";

type Invoice = components["schemas"]["Invoice"];

type DialogState =
  | { type: "create" }
  | { type: "edit"; invoice: Invoice }
  | { type: "payment"; invoice: Invoice }
  | { type: "bulkPayment"; invoices: Invoice[] }
  | null;

interface Props {
  startDate: string;
  endDate: string;
}

export function DashboardInvoicesSection({ startDate, endDate }: Props) {
  const [open, setOpen] = useState(true);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  const deleteInvoice = useDeleteInvoice();

  useEffect(() => {
    setDialog(null);
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, [startDate, endDate]);

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

  return (
    <div className="space-y-2">
      <div className="flex px-4 items-center justify-between">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900 cursor-pointer uppercase"
        >
          <FileText size={14} className="text-gray-400" />
          Invoices
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
            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-xs rounded-md hover:bg-green-700 transition-colors cursor-pointer"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      {open && (
        <InvoiceList
          fixedFilters={{
            startDate,
            endDate,
            filterByStatus: ["pending", "partial"],
            forecast: true,
          }}
          hideDateRange
          hideStatus
          selectedIds={selectedIds}
          selectionMode={selectionMode}
          onSelectionChange={setSelectedIds}
          onEdit={(inv) => setDialog({ type: "edit", invoice: inv })}
          onDelete={handleDelete}
          onAddPayment={(inv) => setDialog({ type: "payment", invoice: inv })}
          onBulkPay={(invoices) => setDialog({ type: "bulkPayment", invoices })}
          emptyMessage="No invoices due this month."
        />
      )}

      {dialog?.type === "create" && (
        <InvoiceFormDialog onClose={() => setDialog(null)} />
      )}
      {dialog?.type === "edit" && (
        <InvoiceFormDialog
          invoice={dialog.invoice}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === "payment" && (
        <AddPaymentDialog
          invoice={dialog.invoice}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === "bulkPayment" && (
        <BulkPaymentDialog
          invoices={dialog.invoices}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

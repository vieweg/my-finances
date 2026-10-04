import { useState } from "react";
import { X } from "lucide-react";
import { useAddInvoicePayment } from "../hooks/useAddInvoicePayment";
import { formatCurrency, todayLocal, dateInputToISO } from "@/lib/format";
import type { components } from "@/api/generated";

type Invoice = components["schemas"]["Invoice"];

interface Props {
  invoices: Invoice[];
  onClose: () => void;
}

function outstanding(inv: Invoice): number {
  return Math.max(0, (inv.total?.amount ?? 0) - (inv.paidAmount?.amount ?? 0));
}

export function BulkPaymentDialog({ invoices, onClose }: Props) {
  const today = todayLocal();
  const [date, setDate] = useState(today);
  const [isPaying, setIsPaying] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const addPayment = useAddInvoicePayment();
  const currency = invoices[0]?.total?.currency ?? "";
  const total = invoices.reduce((sum, inv) => sum + outstanding(inv), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsPaying(true);
    setErrors([]);

    const results = await Promise.allSettled(
      invoices.map((inv) =>
        addPayment.mutateAsync({
          invoiceId: inv.id!,
          date: dateInputToISO(date),
          total: outstanding(inv),
          description: inv.description ?? "",
          currency: inv.walletId ? undefined : (inv.total?.currency ?? undefined),
          walletId: inv.walletId ?? null,
        }),
      ),
    );

    const failed = results
      .map((r, i) =>
        r.status === "rejected"
          ? `${invoices[i].description ?? invoices[i].id}: ${(r.reason as Error)?.message}`
          : null,
      )
      .filter(Boolean) as string[];

    setIsPaying(false);
    if (failed.length === 0) {
      onClose();
    } else {
      setErrors(failed);
    }
  }

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">
            Pay {invoices.length} Invoice{invoices.length !== 1 ? "s" : ""}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              autoFocus
              className={inputClass}
            />
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Invoices</p>
            <div className="border border-gray-200 rounded-md divide-y divide-gray-100 max-h-52 overflow-y-auto">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-gray-700 truncate flex-1 mr-2">
                    {inv.description}
                  </span>
                  <span className="text-gray-900 font-medium whitespace-nowrap">
                    {formatCurrency(outstanding(inv), inv.total?.currency ?? "")}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-gray-200">
            <span className="text-sm font-medium text-gray-700">Total</span>
            <span className="text-base font-semibold text-gray-900">
              {formatCurrency(total, currency)}
            </span>
          </div>

          {errors.length > 0 && (
            <div className="text-sm text-red-600 space-y-1 p-3 bg-red-50 rounded-md">
              <p className="font-medium">Some payments failed:</p>
              {errors.map((err, i) => (
                <p key={i}>{err}</p>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPaying || !date}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isPaying
                ? "Paying..."
                : `Pay ${invoices.length} Invoice${invoices.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

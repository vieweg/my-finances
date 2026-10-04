import { useState } from "react";
import { X } from "lucide-react";
import { useAddInvoicePayment } from "../hooks/useAddInvoicePayment";
import { useWallets } from "@/features/wallets";
import { TagInput } from "@/features/transactions/components/TagInput";
import { CurrencyInput } from "@/components/CurrencyInput";
import type { components } from "@/api/generated";
import { todayLocal, dateInputToISO } from "@/lib/format";

type Invoice = components["schemas"]["Invoice"];
type TagEntry = string | { id?: string; name: string };

interface Props {
  invoice: Invoice;
  onClose: () => void;
}

export function AddPaymentDialog({ invoice, onClose }: Props) {
  const today = todayLocal();
  const [date, setDate] = useState(today);
  const initialRemaining = (invoice.total?.amount ?? 0) - (invoice.paidAmount?.amount ?? 0);
  const [total, setTotal] = useState<number | null>(initialRemaining > 0 ? initialRemaining : null);
  const [description, setDescription] = useState(invoice.description || "");
  const [walletId, setWalletId] = useState(invoice.walletId ?? "");
  const [tags, setTags] = useState<TagEntry[]>([]);

  const { data: wallets = [] } = useWallets();
  const compatibleWallets = wallets.filter(
    (w) => w.currency === invoice.total?.currency,
  );
  const addPayment = useAddInvoicePayment();

  const remaining =
    (invoice.total?.amount ?? 0) - (invoice.paidAmount?.amount ?? 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!total || total <= 0) return;

    await addPayment.mutateAsync({
      invoiceId: invoice.id!,
      date: dateInputToISO(date),
      total,
      description,
      currency: walletId ? undefined : (invoice.total?.currency ?? undefined),
      walletId: walletId || null,
      tags,
    });
    onClose();
  }

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Add Payment</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-500"
          >
            <X size={18} />
          </button>
        </div>

        {remaining > 0 && (
          <p className="text-xs text-gray-500 mb-4">
            Remaining:{" "}
            <span className="font-medium text-gray-700">
              {invoice.total?.currency} {remaining.toFixed(2)}
            </span>
          </p>
        )}

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
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount ({invoice.total?.currency}){" "}
              <span className="text-red-500">*</span>
            </label>
            <CurrencyInput
              value={total}
              onChange={setTotal}
              required
              autoFocus
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={2}
              placeholder="Payment description"
              className={`${inputClass} resize-none`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Wallet
            </label>
            <select
              value={walletId}
              onChange={(e) => setWalletId(e.target.value)}
              className={inputClass}
            >
              <option value="">No wallet</option>
              {compatibleWallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags
            </label>
            <TagInput value={tags} onChange={setTags} />
            <div className="flex flex-wrap gap-1 mt-1">
              {invoice.tags &&
                invoice.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500"
                  >
                    {tag.name}
                  </span>
                ))}
            </div>
          </div>

          {addPayment.error && (
            <p className="text-sm text-red-600">{addPayment.error.message}</p>
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
              disabled={addPayment.isPending || !total || !description || !date}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {addPayment.isPending ? "Saving..." : "Add Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

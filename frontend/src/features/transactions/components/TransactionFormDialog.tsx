import { useState } from "react";
import { X, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreateTransaction } from "../hooks/useCreateTransaction";
import { useUpdateTransaction } from "../hooks/useUpdateTransaction";
import { useCurrencyStore } from "@/store/currency";
import { TagInput } from "./TagInput";
import { CurrencyInput } from "@/components/CurrencyInput";
import type { components } from "@/api/generated";
import type { TagEntry } from "../hooks/useCreateTransaction";
import { NotesField } from "@/components/NotesField";
import { notesForApi } from "@/lib/notes";
import { todayLocal } from "@/lib/format";

type Transaction = components["schemas"]["Transaction"];
type WalletType = components["schemas"]["Wallet"];

interface Props {
  transaction?: Transaction;
  wallets: WalletType[];
  onClose: () => void;
}

function toDateInput(dateStr?: string): string {
  if (!dateStr) return todayLocal();
  return new Date(dateStr).toISOString().slice(0, 10);
}

function initTags(transaction?: Transaction): TagEntry[] {
  if (!transaction?.tags) return [];
  return transaction.tags.map((t) => ({ id: t.id, name: t.name ?? "" }));
}

export function TransactionFormDialog({ transaction, wallets, onClose }: Props) {
  const isEditing = !!transaction;
  const { currency: appCurrency } = useCurrencyStore();

  const [date, setDate] = useState(toDateInput(transaction?.date));
  const [description, setDescription] = useState(transaction?.description ?? "");
  const [notes, setNotes] = useState(transaction?.notes ?? "");
  const [type, setType] = useState<"income" | "outcome">(transaction?.type ?? "outcome");
  const [amount, setAmount] = useState<number | null>(transaction?.total?.amount ?? null);
  const [walletId, setWalletId] = useState<string | null>(
    transaction?.walletId ?? null
  );
  const walletCurrencies = [...new Set(wallets.map((w) => w.currency!))].sort();
  const [currency, setCurrency] = useState<string>(
    transaction?.total?.currency ?? appCurrency ?? walletCurrencies[0] ?? "BRL"
  );
  const [tags, setTags] = useState<TagEntry[]>(initTags(transaction));

  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const isPending = createTransaction.isPending || updateTransaction.isPending;
  const error = createTransaction.error || updateTransaction.error;

  const invoiceCurrency = transaction?.invoice?.total?.currency;
  const availableWallets = invoiceCurrency
    ? wallets.filter((w) => w.currency === invoiceCurrency)
    : wallets;

  const selectedWallet = walletId ? availableWallets.find((w) => w.id === walletId) : null;
  const effectiveCurrency = invoiceCurrency ?? selectedWallet?.currency ?? currency;

  const showCurrencySelector = !walletId && !appCurrency && !invoiceCurrency;

  function handleWalletChange(id: string | null) {
    setWalletId(id);
  }

  async function submit() {
    const body = {
      date: new Date(date + "T12:00:00").toISOString(),
      total: amount!,
      description,
      notes: notesForApi(notes, isEditing),
      type,
      tags,
      ...(walletId
        ? { walletId }
        : appCurrency && !invoiceCurrency
        ? { walletId: null }
        : { walletId: null, currency: effectiveCurrency }),
    };
    if (isEditing) {
      await updateTransaction.mutateAsync({ id: transaction.id!, body });
    } else {
      await createTransaction.mutateAsync(body);
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl p-6 w-full max-w-lg mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? "Edit Transaction" : "New Transaction"}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <div className="flex rounded-md border border-gray-300 overflow-hidden h-9.5">
                {(["outcome", "income"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={cn(
                      "flex-1 text-sm font-medium transition-colors",
                      type === t
                        ? t === "income"
                          ? "bg-green-600 text-white"
                          : "bg-red-600 text-white"
                        : "text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    {t === "income" ? "Income" : "Expense"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              autoFocus
              rows={2}
              placeholder="e.g. Grocery store"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <NotesField value={notes} onChange={setNotes} />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
              <CurrencyInput
                value={amount}
                onChange={setAmount}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Wallet</label>
              <select
                value={walletId ?? ""}
                onChange={(e) => handleWalletChange(e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No wallet</option>
                {availableWallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.currency})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {invoiceCurrency && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
              <Wallet size={12} />
              Currency locked to invoice:{" "}
              <span className="font-medium">{invoiceCurrency}</span>
            </div>
          )}
          {!walletId ? (
            showCurrencySelector ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {walletCurrencies.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            ) : null
          ) : (
            selectedWallet && !invoiceCurrency && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Wallet size={12} />
                Wallet currency:{" "}
                <span className="font-medium text-gray-700">{effectiveCurrency}</span>
              </div>
            )
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
            <TagInput value={tags} onChange={setTags} />
          </div>

          {error && <p className="text-sm text-red-600">{error.message}</p>}

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
              disabled={isPending || !description.trim() || !amount}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

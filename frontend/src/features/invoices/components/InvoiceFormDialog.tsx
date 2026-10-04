import { useState } from "react";
import { X, Wallet } from "lucide-react";
import { useCreateInvoice } from "../hooks/useCreateInvoice";
import { useUpdateInvoice } from "../hooks/useUpdateInvoice";
import { ContactCombobox } from "@/features/contacts";
import { useWallets } from "@/features/wallets";
import { useCurrencyStore } from "@/store/currency";
import { TagInput } from "@/features/transactions/components/TagInput";
import { CurrencyInput } from "@/components/CurrencyInput";
import type { components } from "@/api/generated";
import { NotesField } from "@/components/NotesField";
import { notesForApi } from "@/lib/notes";
import { todayLocal } from "@/lib/format";

type Invoice = components["schemas"]["Invoice"];
type TagEntry = string | { id?: string; name: string };

interface Props {
  invoice?: Invoice;
  onClose: () => void;
}

function toDateInput(dateStr?: string | null): string {
  if (!dateStr) return todayLocal();
  return new Date(dateStr).toISOString().slice(0, 10);
}

function initTags(invoice?: Invoice): TagEntry[] {
  if (!invoice?.tags) return [];
  return invoice.tags.map((t) => ({ id: t.id, name: t.name ?? "" }));
}

export function InvoiceFormDialog({ invoice, onClose }: Props) {
  const isEditing = !!invoice;
  const { currency: appCurrency } = useCurrencyStore();

  const { data: wallets = [] } = useWallets();
  const walletCurrencies = [
    ...new Set(wallets.map((w) => w.currency!).filter(Boolean)),
  ].sort();

  const [contactId, setContactId] = useState(invoice?.contact?.id ?? "");
  const [type, setType] = useState<"payable" | "receivable">(
    invoice?.type ?? "payable",
  );
  const [amount, setAmount] = useState<number | null>(
    invoice?.total?.amount ?? null,
  );
  const [currency, setCurrency] = useState<string>(
    invoice?.total?.currency ?? appCurrency ?? walletCurrencies[0] ?? "BRL",
  );
  const [walletId, setWalletId] = useState<string>(invoice?.walletId ?? "");
  const [issueDate, setIssueDate] = useState(toDateInput(invoice?.issueDate));
  const [dueDate, setDueDate] = useState(toDateInput(invoice?.dueDate));
  const [description, setDescription] = useState(invoice?.description ?? "");
  const [notes, setNotes] = useState(invoice?.notes ?? "");
  const [tags, setTags] = useState<TagEntry[]>(initTags(invoice));

  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();

  const isPending = createInvoice.isPending || updateInvoice.isPending;
  const error = createInvoice.error || updateInvoice.error;

  const selectedWallet = walletId
    ? wallets.find((w) => w.id === walletId)
    : null;
  const showCurrencySelector = !walletId && !appCurrency;

  function handleWalletChange(id: string) {
    setWalletId(id);
    if (!id && !appCurrency) {
      setCurrency(walletCurrencies[0] ?? "BRL");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || amount <= 0) return;

    const issueDateISO = new Date(issueDate + "T12:00:00").toISOString();
    const dueDateISO = new Date(dueDate + "T12:00:00").toISOString();

    if (isEditing) {
      await updateInvoice.mutateAsync({
        id: invoice.id!,
        contactId: contactId || undefined,
        walletId: walletId || null,
        amount: amount!,
        currency: walletId || appCurrency ? undefined : currency,
        issueDate: issueDateISO,
        dueDate: dueDateISO,
        description: description || null,
        notes: notesForApi(notes, true),
        tags,
      });
    } else {
      await createInvoice.mutateAsync({
        contactId,
        type,
        amount: amount!,
        currency: walletId || appCurrency ? undefined : currency,
        issueDate: issueDateISO,
        dueDate: dueDateISO,
        walletId: walletId || undefined,
        description: description || undefined,
        notes: notesForApi(notes, false),
        tags,
      });
    }
    onClose();
  }

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? "Edit Invoice" : "New Invoice"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-500"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contact <span className="text-red-500">*</span>
            </label>
            <ContactCombobox
              value={contactId}
              initialName={invoice?.contact?.name ?? ""}
              onChange={setContactId}
              className={inputClass}
            />
          </div>

          {!isEditing && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type <span className="text-red-500">*</span>
              </label>
              <div className="flex rounded-md border border-gray-300 overflow-hidden">
                {(["payable", "receivable"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`flex-1 py-2 text-sm font-medium transition-colors capitalize ${
                      type === t
                        ? "bg-blue-600 text-white"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount <span className="text-red-500">*</span>
              </label>
              <CurrencyInput
                value={amount}
                onChange={setAmount}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Wallet
              </label>
              <select
                value={walletId}
                onChange={(e) => handleWalletChange(e.target.value)}
                className={inputClass}
              >
                <option value="">No wallet</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.currency})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {walletId && selectedWallet ? (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Wallet size={12} />
              Wallet currency:{" "}
              <span className="font-medium text-gray-700">
                {selectedWallet.currency}
              </span>
            </div>
          ) : showCurrencySelector ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Currency <span className="text-red-500">*</span>
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={inputClass}
              >
                {walletCurrencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Issue date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className={inputClass}
              />
            </div>
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
              placeholder="Description"
              className={`${inputClass} resize-none`}
            />
          </div>

          <NotesField value={notes} onChange={setNotes} />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags
            </label>
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
              disabled={
                isPending ||
                !contactId ||
                !amount ||
                !issueDate ||
                !dueDate ||
                !description
              }
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

import { useState } from "react";
import { X, Wallet } from "lucide-react";
import { useCreateContract } from "../hooks/useCreateContract";
import { useUpdateContract } from "../hooks/useUpdateContract";
import { ContactCombobox } from "@/features/contacts";
import { useWallets } from "@/features/wallets";
import { useCurrencyStore } from "@/store/currency";
import { TagInput } from "@/features/transactions/components/TagInput";
import { CurrencyInput } from "@/components/CurrencyInput";
import type { components } from "@/api/generated";
import { NotesField } from "@/components/NotesField";
import { notesForApi } from "@/lib/notes";
import { todayLocal } from "@/lib/format";

type Contract = components["schemas"]["Contract"];
type TagEntry = string | { id?: string; name: string };

interface Props {
  contract?: Contract;
  onClose: () => void;
}

const tagHints: Record<string, string> = {
  "[month]": 'e.g. "June 2026"',
  "[instalment]": 'e.g. "3 of 12"',
  "[contact_name]": "Contact's name",
  "[value]": 'e.g. "£1,500.00"',
  "[period]": 'e.g. "20/01/2026 - 19/02/2026"',
};

function toDateInput(dateStr?: string | null): string {
  if (!dateStr) return todayLocal();
  return new Date(dateStr).toISOString().slice(0, 10);
}

function initTags(contract?: Contract): TagEntry[] {
  if (!contract?.tags) return [];
  return contract.tags.map((t) => ({ id: t.id, name: t.name ?? "" }));
}

export function ContractFormDialog({ contract, onClose }: Props) {
  const isEditing = !!contract;
  const { currency: appCurrency } = useCurrencyStore();

  const { data: wallets = [] } = useWallets();
  const walletCurrencies = [
    ...new Set(wallets.map((w) => w.currency!).filter(Boolean)),
  ].sort();

  const [name, setName] = useState(contract?.name ?? "");
  const [contactId, setContactId] = useState(contract?.contact?.id ?? "");
  const [type, setType] = useState<"payable" | "receivable">(
    contract?.type ?? "payable",
  );
  const [amount, setAmount] = useState<number | null>(
    contract?.total?.amount ?? null,
  );
  const [currency, setCurrency] = useState<string>(
    contract?.total?.currency ?? appCurrency ?? walletCurrencies[0] ?? "BRL",
  );
  const [walletId, setWalletId] = useState<string>(contract?.walletId ?? "");
  const [instalments, setInstalments] = useState(
    contract?.instalments?.toString() ?? "12",
  );
  const [cycleMonths, setCycleMonths] = useState(
    contract?.cycleMonths?.toString() ?? "1",
  );
  const [firstDueDate, setFirstDueDate] = useState(
    toDateInput(contract?.firstDueDate),
  );
  const [description, setDescription] = useState(contract?.description ?? "");
  const [notes, setNotes] = useState(contract?.notes ?? "");
  const [tags, setTags] = useState<TagEntry[]>(initTags(contract));

  const createContract = useCreateContract();
  const updateContract = useUpdateContract();

  const isPending = createContract.isPending || updateContract.isPending;
  const error = createContract.error || updateContract.error;

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
    const parsedInstalments = parseInt(instalments, 10);
    const parsedCycleMonths = parseInt(cycleMonths, 10);
    if (isNaN(parsedInstalments) || parsedInstalments < 0) return;
    if (isNaN(parsedCycleMonths) || parsedCycleMonths < 1 || parsedCycleMonths > 12) return;

    const firstDueDateISO = new Date(firstDueDate + "T12:00:00").toISOString();

    if (isEditing) {
      await updateContract.mutateAsync({
        id: contract.id!,
        name: name || undefined,
        contactId: contactId || undefined,
        walletId: walletId || null,
        amount: amount!,
        currency: walletId || appCurrency ? undefined : currency,
        instalments: parsedInstalments,
        cycleMonths: parsedCycleMonths,
        firstDueDate: firstDueDateISO,
        description,
        notes: notesForApi(notes, true),
        tags,
      });
    } else {
      await createContract.mutateAsync({
        name,
        contactId,
        type,
        amount: amount!,
        currency: walletId || appCurrency ? undefined : currency,
        walletId: walletId || undefined,
        instalments: parsedInstalments,
        cycleMonths: parsedCycleMonths,
        firstDueDate: firstDueDateISO,
        description,
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
            {isEditing ? "Edit Contract" : "New Contract"}
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
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={inputClass}
              placeholder="Contract name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contact <span className="text-red-500">*</span>
            </label>
            <ContactCombobox
              value={contactId}
              initialName={contract?.contact?.name ?? ""}
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
                Instalments <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={instalments}
                onChange={(e) => setInstalments(e.target.value)}
                required
                className={inputClass}
                placeholder="0 = infinite"
              />
              <p className="text-xs text-gray-400 mt-0.5">0 = recurring</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cycle (months) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="12"
                step="1"
                value={cycleMonths}
                onChange={(e) => setCycleMonths(e.target.value)}
                required
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First due date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={firstDueDate}
              onChange={(e) => setFirstDueDate(e.target.value)}
              required
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
              placeholder="e.g. Rent [month] – instalment [instalment]"
              className={`${inputClass} resize-none`}
            />
            <div className="mt-1.5 flex flex-wrap gap-1 items-center">
              <span className="text-xs text-gray-400">Tags:</span>
              {(["[month]", "[instalment]", "[contact_name]", "[value]", "[period]"] as const).map(
                (tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setDescription((d) => d ? `${d} ${tag}` : tag)}
                    className="px-1.5 py-0.5 text-xs font-mono bg-gray-100 text-gray-600 rounded hover:bg-blue-50 hover:text-blue-700 transition-colors cursor-pointer"
                    title={tagHints[tag]}
                  >
                    {tag}
                  </button>
                ),
              )}
            </div>
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
              disabled={isPending || !name || !contactId || !amount || !firstDueDate || !description}
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

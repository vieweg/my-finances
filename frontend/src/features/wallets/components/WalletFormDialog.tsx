import { useState } from "react";
import { X } from "lucide-react";
import { useCreateWallet } from "../hooks/useCreateWallet";
import { useUpdateWallet } from "../hooks/useUpdateWallet";
import { CurrencyCombobox } from "@/components/CurrencyCombobox";
import type { components } from "@/api/generated";

type Wallet = components["schemas"]["Wallet"];

interface Props {
  wallet?: Wallet;
  onClose: () => void;
}

export function WalletFormDialog({ wallet, onClose }: Props) {
  const isEditing = !!wallet;
  const [name, setName] = useState(wallet?.name ?? "");
  const [currency, setCurrency] = useState<string>(wallet?.currency ?? "BRL");

  const createWallet = useCreateWallet();
  const updateWallet = useUpdateWallet();

  const isPending = createWallet.isPending || updateWallet.isPending;
  const error = createWallet.error || updateWallet.error;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isEditing) {
      await updateWallet.mutateAsync({ id: wallet.id!, name });
    } else {
      await createWallet.mutateAsync({ name, currency });
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? "Edit Wallet" : "New Wallet"}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Checking account"
            />
          </div>

          {!isEditing && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Currency
              </label>
              <CurrencyCombobox value={currency} onChange={setCurrency} />
              <p className="mt-1 text-xs text-gray-500">
                Currency cannot be changed after creation.
              </p>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600">{error.message}</p>
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
              disabled={isPending || !name.trim()}
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

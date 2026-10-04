import { useState } from "react";
import { X } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useAdjustWallet } from "../hooks/useAdjustWallet";
import { CurrencyInput } from "@/components/CurrencyInput";
import type { components } from "@/api/generated";

type Wallet = components["schemas"]["Wallet"];

interface Props {
  wallet: Wallet;
  onClose: () => void;
}

export function AdjustBalanceDialog({ wallet, onClose }: Props) {
  const [amount, setAmount] = useState<number | null>(wallet.currentBalance ?? null);
  const adjustWallet = useAdjustWallet();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await adjustWallet.mutateAsync({ id: wallet.id!, amount: amount! });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Adjust Balance</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 text-sm text-gray-600 space-y-0.5">
          <p>
            Wallet: <span className="font-medium text-gray-900">{wallet.name}</span>
          </p>
          <p>
            Current balance:{" "}
            <span className="font-medium text-gray-900">
              {formatCurrency(wallet.currentBalance ?? 0, wallet.currency)}
            </span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New absolute balance
            </label>
            <CurrencyInput
              value={amount}
              onChange={setAmount}
              required
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {adjustWallet.error && (
            <p className="text-sm text-red-600">{adjustWallet.error.message}</p>
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
              disabled={adjustWallet.isPending || !amount}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {adjustWallet.isPending ? "Saving..." : "Confirm"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { Pencil, RotateCcw, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { formatCurrency } from "@/lib/format";
import type { components } from "@/api/generated";

type Wallet = components["schemas"]["Wallet"];

interface Props {
  wallet: Wallet;
  onEdit: (wallet: Wallet) => void;
  onAdjust: (wallet: Wallet) => void;
  onDelete: (wallet: Wallet) => void;
  onRestore?: (wallet: Wallet) => void;
  onHardDelete?: (wallet: Wallet) => void;
}

export function WalletCard({ wallet, onEdit, onAdjust, onDelete, onRestore, onHardDelete }: Props) {
  if (onRestore) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-5 flex flex-col gap-4 opacity-75">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-gray-900 truncate">{wallet.name}</h3>
          <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
            {wallet.currency}
          </span>
        </div>
        <div className="flex justify-between items-center text-2xl font-semibold text-gray-500">
          <span>{formatCurrency(wallet.currentBalance ?? 0, wallet.currency)}</span>
          <div className="flex gap-1">
            <button
              onClick={() => onRestore(wallet)}
              className="cursor-pointer px-2.5 py-1.5 rounded text-sm text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
              title="Restore wallet"
            >
              <RotateCcw size={14} />
            </button>
            {onHardDelete && (
              <button
                onClick={() => onHardDelete(wallet)}
                className="cursor-pointer px-2.5 py-1.5 rounded text-sm text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Permanently delete"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex gap-1">
          <Link to={`/wallets/${wallet.id}`} className="hover:underline">
            <h3 className="font-medium text-gray-900 truncate">
              {wallet.name}
            </h3>
          </Link>
          <button
            onClick={() => onEdit(wallet)}
            className="cursor-pointer px-2 py-1.5 rounded text-sm text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Pencil size={14} />
          </button>
        </div>

        <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
          {wallet.currency}
        </span>
      </div>

      <div className="flex justify-between items-center text-2xl font-semibold text-gray-900">
        <button
          onClick={() => onAdjust(wallet)}
          className="cursor-pointer hover:underline"
        >
          {formatCurrency(wallet.currentBalance ?? 0, wallet.currency)}
        </button>
        <div className="flex">
          <button
            onClick={() => onDelete(wallet)}
            className="cursor-pointer px-2.5 py-1.5 rounded text-sm text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors ml-auto"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

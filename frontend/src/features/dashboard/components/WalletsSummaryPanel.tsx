import { useState } from "react";
import { ChevronDown, ChevronUp, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { AdjustBalanceDialog } from "@/features/wallets";
import type { components } from "@/api/generated";

type WalletType = components["schemas"]["Wallet"];

interface Props {
  wallets: WalletType[];
  globalCurrency: string | null;
  isLoading: boolean;
  availableBalanceByCurrency?: Record<string, number>;
}

export function WalletsSummaryPanel({
  wallets,
  globalCurrency,
  isLoading,
  availableBalanceByCurrency = {},
}: Props) {
  const [open, setOpen] = useState(false);
  const [adjustWallet, setAdjustWallet] = useState<WalletType | null>(null);

  const totalByCurrency = wallets.reduce<Record<string, number>>((acc, w) => {
    const cur = w.currency ?? "";
    acc[cur] = (acc[cur] ?? 0) + (w.currentBalance ?? 0);
    return acc;
  }, {});

  return (
    <>
      <div className="flex-1 bg-white rounded-lg border border-gray-200">
        <div className="flex px-4 py-3 border-b border-gray-100">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex w-full justify-between text-sm font-medium text-gray-700 hover:text-gray-900 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Wallet size={15} className="text-gray-400" />
              Wallets
              {wallets.length > 0 && (
                <span className="text-xs text-gray-400">
                  ({wallets.length})
                </span>
              )}
            </div>
            <div className="flex items-center">
              {open ? (
                <ChevronUp size={14} className="text-gray-400" />
              ) : (
                <ChevronDown size={14} className="text-gray-400" />
              )}
            </div>
          </button>
        </div>

        {open && (
          <div>
            {isLoading && (
              <div className="divide-y divide-gray-100">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="px-4 py-3 flex justify-between">
                    <div className="h-4 w-24 bg-gray-100 animate-pulse rounded" />
                    <div className="h-4 w-20 bg-gray-100 animate-pulse rounded" />
                  </div>
                ))}
              </div>
            )}

            {!isLoading && wallets.length === 0 && (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">
                No wallets found.
              </p>
            )}

            {!isLoading && wallets.length > 0 && (
              <div className="divide-y divide-gray-100">
                {wallets.map((wallet) => (
                  <div
                    key={wallet.id}
                    className="px-4 py-2.5 flex items-center justify-between group"
                  >
                    <span className="text-sm text-gray-700 whitespace-nowrap">
                      {wallet.name}
                    </span>
                    <div>
                      <button
                        onClick={() => setAdjustWallet(wallet)}
                        className="px-2 rounded-lg border border-white text-gray-300 hover:border-blue-700 cursor-pointer transition-colors"
                        title="Adjust balance"
                      >
                        <span className="text-sm font-medium text-gray-900">
                          {formatCurrency(
                            wallet.currentBalance ?? 0,
                            globalCurrency ?? wallet.currency ?? "",
                          )}
                        </span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="px-4 mt-3">
          {globalCurrency ? (
            <div className="mb-2 flex justify-between text-sm font-semibold text-gray-700">
              <span>Total</span>
              <div className="flex items-baseline gap-2">
                <span>
                  {formatCurrency(
                    totalByCurrency[globalCurrency] ?? 0,
                    globalCurrency,
                  )}
                </span>
                {(() => {
                  const total = totalByCurrency[globalCurrency] ?? 0;
                  const available = availableBalanceByCurrency[globalCurrency];
                  if (available === undefined) return null;
                  const diff = Math.round((total - available) * 100) / 100;
                  if (diff === 0) return null;
                  return (
                    <span
                      className={`text-xs font-normal ${diff > 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {diff > 0 ? "+" : ""}
                      {formatCurrency(diff, globalCurrency)}
                    </span>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div className="mb-2">
              <div className="text-left text-xs font-bold text-gray-500 uppercase tracking-wide">
                Totals
              </div>
              {Object.entries(totalByCurrency)
                .sort((a, b) => (a[0] > b[0] ? 1 : -1))
                .map(([cur, total]) => {
                  const available = availableBalanceByCurrency[cur];
                  const diff =
                    available !== undefined
                      ? Math.round((total - available) * 100) / 100
                      : 0;
                  return (
                    <div
                      key={cur}
                      className="flex justify-between text-sm text-gray-600"
                    >
                      <span className="font-semibold text-gray-400">{cur}</span>
                      <div className="flex items-baseline gap-2">
                        <span>{formatCurrency(total, cur)}</span>
                        {diff !== 0 && (
                          <span
                            className={`text-xs ${diff > 0 ? "text-green-600" : "text-red-600"}`}
                          >
                            {diff > 0 ? "+" : ""}
                            {formatCurrency(diff, cur)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {adjustWallet && (
        <AdjustBalanceDialog
          wallet={adjustWallet}
          onClose={() => setAdjustWallet(null)}
        />
      )}
    </>
  );
}

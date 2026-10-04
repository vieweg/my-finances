import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrencyStore } from "@/store/currency";
import { useWallets } from "@/features/wallets";
import { cn } from "@/lib/utils";

export function CurrencySelector() {
  const { currency, setCurrency, availableCurrencies, mergeCurrencies } =
    useCurrencyStore();
  const queryClient = useQueryClient();
  const { data: wallets } = useWallets();

  useEffect(() => {
    if (wallets && wallets.length > 0) {
      mergeCurrencies(wallets.map((w) => w.currency!).filter(Boolean));
    }
  }, [wallets]);

  function handleChange(value: string | null) {
    setCurrency(value);
    queryClient.invalidateQueries();
  }

  if (availableCurrencies.length === 0) return null;

  return (
    <div className="px-6 py-3 border-b border-gray-200">
      <p className="text-xs font-medium text-gray-500 mb-2">Currency</p>
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => handleChange(null)}
          className={cn(
            "px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer",
            currency === null
              ? "bg-blue-600 text-white"
              : "text-gray-600 hover:bg-gray-100",
          )}
        >
          All
        </button>
        {availableCurrencies.map((code) => (
          <button
            key={code}
            onClick={() => handleChange(code)}
            className={cn(
              "px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer",
              currency === code
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:bg-gray-100",
            )}
          >
            {code}
          </button>
        ))}
      </div>
    </div>
  );
}

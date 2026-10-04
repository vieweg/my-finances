import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Currency = string;

interface CurrencyStore {
  currency: Currency | null;
  availableCurrencies: string[];
  setCurrency: (currency: Currency | null) => void;
  mergeCurrencies: (codes: string[]) => void;
  clearCurrencies: () => void;
}

export const useCurrencyStore = create<CurrencyStore>()(
  persist(
    (set, get) => ({
      currency: null,
      availableCurrencies: [],
      setCurrency: (currency) => set({ currency }),
      mergeCurrencies: (codes) => {
        const merged = [
          ...new Set([...get().availableCurrencies, ...codes]),
        ].sort();
        set({ availableCurrencies: merged });
      },
      clearCurrencies: () => {
        set({ currency: null, availableCurrencies: [] });
      },
    }),
    { name: "currency-store" },
  ),
);

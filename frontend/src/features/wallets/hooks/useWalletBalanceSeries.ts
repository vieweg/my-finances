import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export type BalanceInterval = "day" | "week" | "month";

export interface BalanceSeriesParams {
  startDate: string;
  endDate: string;
  /** Omit to let the backend pick from the range length (≤45 days: day, ≤6 months: week, else month). */
  interval?: BalanceInterval;
  /** Omit for all active wallets of the current X-Currency. */
  walletIds?: string[];
}

// Periods are cut in the user's time zone so days line up with the dates they see
const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

export function useWalletBalanceSeries(params: BalanceSeriesParams) {
  return useQuery({
    queryKey: ["wallets", "balance-series", params],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/wallets/balance-series", {
        params: {
          query: {
            startDate: params.startDate,
            endDate: params.endDate,
            interval: params.interval,
            walletId: params.walletIds?.length ? params.walletIds : undefined,
            timezone: TIMEZONE,
          },
        },
      });
      if (error) throw new Error(error.message || "Failed to load balance history");
      return data!;
    },
    enabled: !!params.startDate && !!params.endDate && params.startDate <= params.endDate,
    // Keep the old chart on screen while a new range/interval loads
    placeholderData: keepPreviousData,
  });
}

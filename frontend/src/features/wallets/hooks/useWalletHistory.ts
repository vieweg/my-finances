import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { getNextPageFromPagination } from "@/api/pagination";

const LIMIT = 20;

interface Filters {
  startDate?: string;
  endDate?: string;
}

export function useWalletHistory(walletId: string, filters: Filters = {}) {
  return useInfiniteQuery({
    queryKey: ["wallets", walletId, "history-detail", filters],
    queryFn: async ({ pageParam = 1 }) => {
      const { data, error } = await apiClient.GET("/api/wallets/{id}/history", {
        params: {
          path: { id: walletId },
          query: {
            page: pageParam as number,
            limit: LIMIT,
            startDate: filters.startDate,
            endDate: filters.endDate,
          },
        },
      });
      if (error) throw new Error(error.message || "Erro ao carregar histórico");
      return data!;
    },
    initialPageParam: 1,
    getNextPageParam: getNextPageFromPagination,
    enabled: !!walletId,
  });
}

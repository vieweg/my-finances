import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { getNextPageFromPagination } from "@/api/pagination";

const LIMIT = 10;

export function useTransactionHistory(id: string) {
  return useInfiniteQuery({
    queryKey: ["transactions", id, "history"],
    queryFn: async ({ pageParam = 1 }) => {
      const { data, error } = await apiClient.GET(
        "/api/transactions/{id}/history",
        {
          params: {
            path: { id },
            query: { page: pageParam as number, limit: LIMIT },
          },
        }
      );
      if (error) throw new Error(error.message || "Erro ao carregar histórico");
      return data!;
    },
    initialPageParam: 1,
    getNextPageParam: getNextPageFromPagination,
    enabled: !!id,
  });
}

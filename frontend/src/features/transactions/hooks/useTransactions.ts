import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { getNextPageFromPagination } from "@/api/pagination";
import { tagFilterParams, type TagEntry } from "@/features/tags/filters";

const LIMIT = 20;

export interface TransactionFilters {
  search?: string;
  type?: "income" | "outcome";
  startDate?: string;
  endDate?: string;
  filterByCurrency?: string;
  tags?: TagEntry[];
  sortBy?:
    | "date"
    | "total"
    | "description"
    | "type"
    | "createdAt"
    | "updatedAt"
    | "currency";
  sortOrder?: "asc" | "desc";
  deleted?: boolean;
}

export function useTransactions(filters: TransactionFilters) {
  return useInfiniteQuery({
    queryKey: ["transactions", filters],
    queryFn: async ({ pageParam }) => {
      const { data, error } = await apiClient.GET("/api/transactions", {
        params: {
          query: {
            page: pageParam,
            limit: LIMIT,
            sortBy: filters.sortBy ?? "date",
            sortOrder: filters.sortOrder ?? "desc",
            // Matches description, notes, wallet name or tag names
            search: filters.search || undefined,
            filterByType: filters.type || undefined,
            startDate: filters.startDate || undefined,
            endDate: filters.endDate || undefined,
            filterByCurrency: (filters.filterByCurrency || undefined) as never,
            ...tagFilterParams(filters.tags),
            deleted: filters.deleted || undefined,
          },
        },
      });
      if (error)
        throw new Error(error.message || "Erro ao carregar transações");
      return data ?? {};
    },
    initialPageParam: 1,
    getNextPageParam: getNextPageFromPagination,
  });
}

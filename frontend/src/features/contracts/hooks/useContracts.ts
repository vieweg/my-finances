import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { getNextPageFromPagination } from "@/api/pagination";

const LIMIT = 20;

export interface ContractFilters {
  search?: string;
  filterByStatus?: "active" | "completed" | "cancelled";
  filterByType?: "payable" | "receivable";
  filterByContactId?: string;
  sortBy?: "createdAt" | "updatedAt" | "name" | "amount" | "status" | "type" | "nextDueDate" | "firstDueDate";
  sortOrder?: "asc" | "desc";
  deleted?: boolean;
  /** Backend lists only active contracts by default; true adds completed ones. Ignored with filterByStatus. */
  includeCompleted?: boolean;
}

export function useContracts(filters: ContractFilters = {}) {
  return useInfiniteQuery({
    queryKey: ["contracts", filters],
    queryFn: async ({ pageParam }) => {
      const { data, error } = await apiClient.GET("/api/contracts", {
        params: {
          query: {
            page: pageParam,
            limit: LIMIT,
            sortBy: filters.sortBy ?? "nextDueDate",
            sortOrder: filters.sortOrder ?? "asc",
            search: filters.search || undefined,
            filterByStatus: filters.filterByStatus || undefined,
            filterByType: filters.filterByType || undefined,
            filterByContactId: filters.filterByContactId || undefined,
            deleted: filters.deleted || undefined,
            includeCompleted: filters.includeCompleted || undefined,
          },
        },
      });
      if (error) throw new Error(error.message || "Failed to load contracts");
      return data ?? {};
    },
    initialPageParam: 1,
    getNextPageParam: getNextPageFromPagination,
  });
}

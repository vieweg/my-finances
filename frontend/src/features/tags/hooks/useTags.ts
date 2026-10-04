import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { getNextPageFromPagination } from "@/api/pagination";

const LIMIT = 20;

export interface TagFilters {
  search?: string;
  sortBy?: "name" | "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
  deleted?: boolean;
}

export function useTags(filters: TagFilters = {}) {
  return useInfiniteQuery({
    queryKey: ["tags", filters],
    queryFn: async ({ pageParam }) => {
      const { data, error } = await apiClient.GET("/api/tags", {
        params: {
          query: {
            page: pageParam,
            limit: LIMIT,
            search: filters.search || undefined,
            sortBy: filters.sortBy,
            sortOrder: filters.sortOrder,
            deleted: filters.deleted || undefined,
          },
        },
      });
      if (error) throw new Error(error.message || "Failed to load tags");
      return data ?? {};
    },
    initialPageParam: 1,
    getNextPageParam: getNextPageFromPagination,
  });
}

import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { getNextPageFromPagination } from "@/api/pagination";

const LIMIT = 20;

export interface ContactFilters {
  name?: string;
  email?: string;
  sortBy?: "name" | "email" | "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
  deleted?: boolean;
}

export function useContacts(filters: ContactFilters = {}) {
  return useInfiniteQuery({
    queryKey: ["contacts", filters],
    queryFn: async ({ pageParam }) => {
      const { data, error } = await apiClient.GET("/api/contacts", {
        params: {
          query: {
            page: pageParam,
            limit: LIMIT,
            name: filters.name || undefined,
            email: filters.email || undefined,
            sortBy: filters.sortBy,
            sortOrder: filters.sortOrder,
            deleted: filters.deleted || undefined,
          },
        },
      });
      if (error) throw new Error(error.message || "Failed to load contacts");
      return data ?? {};
    },
    initialPageParam: 1,
    getNextPageParam: getNextPageFromPagination,
  });
}

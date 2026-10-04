import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { getNextPageFromPagination } from "@/api/pagination";
import { tagFilterParams, type TagEntry } from "@/features/tags/filters";

const LIMIT = 20;

export interface InvoiceFilters {
  search?: string;
  filterByType?: "payable" | "receivable";
  filterByStatus?: "pending" | "partial" | "paid" | "cancelled" | ("pending" | "partial" | "paid" | "cancelled")[];
  filterByIsOverdue?: boolean;
  filterByCurrency?: string;
  filterByContactId?: string;
  tags?: TagEntry[];
  startDate?: string;
  endDate?: string;
  sortBy?: "createdAt" | "updatedAt" | "dueDate" | "issueDate" | "amount" | "outstanding" | "description" | "status" | "type" | "currency" | "contact";
  sortOrder?: "asc" | "desc";
  deleted?: boolean;
  forecast?: boolean;
}

export function useInvoices(filters: InvoiceFilters = {}) {
  return useInfiniteQuery({
    queryKey: ["invoices", filters],
    queryFn: async ({ pageParam }) => {
      const { data, error } = await apiClient.GET("/api/invoices", {
        params: {
          query: {
            page: pageParam,
            limit: LIMIT,
            sortBy: filters.sortBy ?? "dueDate",
            sortOrder: filters.sortOrder ?? "desc",
            search: filters.search || undefined,
            filterByType: filters.filterByType || undefined,
            filterByStatus: filters.filterByStatus || undefined,
            filterByIsOverdue: filters.filterByIsOverdue || undefined,
            filterByCurrency: (filters.filterByCurrency || undefined) as never,
            filterByContactId: filters.filterByContactId || undefined,
            ...tagFilterParams(filters.tags),
            startDate: filters.startDate || undefined,
            endDate: filters.endDate || undefined,
            deleted: filters.deleted || undefined,
            forecast: filters.forecast || undefined,
          },
        },
      });
      if (error) throw new Error(error.message || "Failed to load invoices");
      return data ?? {};
    },
    initialPageParam: 1,
    getNextPageParam: getNextPageFromPagination,
  });
}

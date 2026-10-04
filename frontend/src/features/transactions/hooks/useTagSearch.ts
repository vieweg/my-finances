import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export function useTagSearch(search: string) {
  return useQuery({
    queryKey: ["tags", "search", search],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/tags", {
        params: { query: { search, limit: 10, sortBy: "name", sortOrder: "asc" } },
      });
      if (error) throw new Error(error.message || "Erro");
      return data?.data ?? [];
    },
    enabled: search.trim().length > 0,
    staleTime: 30_000,
  });
}

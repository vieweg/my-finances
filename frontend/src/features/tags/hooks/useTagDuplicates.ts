import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export function useTagDuplicates() {
  return useQuery({
    queryKey: ["tags", "duplicates"],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/tags/duplicates");
      if (error) throw new Error(error.message || "Failed to load duplicated tags");
      return data ?? [];
    },
  });
}

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export function useContract(id: string) {
  return useQuery({
    queryKey: ["contracts", id],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/contracts/{id}", {
        // deleted: true so soft-deleted entries can still be viewed and restored
        params: { path: { id }, query: { deleted: true } },
      });
      if (error) throw new Error(error.message || "Failed to load contract");
      return data!;
    },
    enabled: !!id,
  });
}

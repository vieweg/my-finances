import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export function useTransaction(id: string) {
  return useQuery({
    queryKey: ["transactions", id],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/transactions/{id}", {
        // deleted: true so soft-deleted entries can still be viewed and restored
        params: { path: { id }, query: { deleted: true } },
      });
      if (error) throw new Error(error.message || "Erro ao carregar transação");
      return data!;
    },
    enabled: !!id,
  });
}

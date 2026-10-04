import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export function useWallet(id: string) {
  return useQuery({
    queryKey: ["wallets", id],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/wallets/{id}", {
        // deleted: true so soft-deleted entries can still be viewed and restored
        params: { path: { id }, query: { deleted: true } },
      });
      if (error) throw new Error(error.message || "Erro ao carregar carteira");
      return data!;
    },
    enabled: !!id,
  });
}

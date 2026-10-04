import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export function useAdjustWallet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const { data, error } = await apiClient.POST("/api/wallets/{id}/adjust", {
        params: { path: { id } },
        body: { amount },
      });
      if (error) throw new Error(error.message || "Erro ao ajustar saldo");
      return data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
    },
  });
}

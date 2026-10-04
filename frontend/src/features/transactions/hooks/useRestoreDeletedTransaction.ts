import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export function useRestoreDeletedTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await apiClient.PATCH(
        "/api/transactions/{id}/restore",
        { params: { path: { id } } },
      );
      if (error)
        throw new Error(error.message || "Erro ao restaurar transação");
      return data!;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      // Restoring recalculates the linked invoice status
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      if (data.walletId) {
        queryClient.invalidateQueries({ queryKey: ["wallets"] });
        queryClient.invalidateQueries({ queryKey: ["wallets", data.walletId] });
      }
    },
  });
}

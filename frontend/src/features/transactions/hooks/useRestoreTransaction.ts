import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export function useRestoreTransaction(transactionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (versionId: string) => {
      const { data, error } = await apiClient.POST(
        "/api/transactions/{id}/restore/{versionId}",
        {
          params: { path: { id: transactionId, versionId } },
        },
      );
      if (error) throw new Error(error.message || "Erro ao restaurar versão");
      return data!;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["transactions", transactionId],
      });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      if (data.walletId) {
        queryClient.invalidateQueries({ queryKey: ["wallets"] });
        queryClient.invalidateQueries({ queryKey: ["wallets", data.walletId] });
      }
    },
  });
}

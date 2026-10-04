import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export function useDeleteWalletSnapshot(walletId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (snapshotId: string) => {
      const { error } = await apiClient.DELETE(
        "/api/wallets/{id}/history/{snapshotId}",
        { params: { path: { id: walletId, snapshotId } } }
      );
      if (error) throw new Error(error.message || "Erro ao remover ajuste");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallets", walletId] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
    },
  });
}

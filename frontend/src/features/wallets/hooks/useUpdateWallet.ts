import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export function useUpdateWallet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { data, error } = await apiClient.PUT("/api/wallets/{id}", {
        params: { path: { id } },
        body: { name },
      });
      if (error) throw new Error(error.message || "Erro ao atualizar carteira");
      return data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
    },
  });
}
